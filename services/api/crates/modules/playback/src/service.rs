use chrono::Utc;
use sea_orm::{
    prelude::Decimal, ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend,
    DatabaseConnection, EntityTrait, QueryFilter, Set, Statement,
};
use std::sync::Arc;
use tracing::info;
use uuid::Uuid;

use maxx_common::error::AppError;
use maxx_common::validation::Validatable;
use maxx_core::entities::{
    content, content_purchase, movie, plan, playback_session, role, subscription, user_role,
    watch_history,
};
use maxx_core::realtime::bump_analytics_version;
use maxx_integration_kafka::{KafkaEventBus, ViewEvent};

use crate::dto::{
    AuthorizePlaybackRequest, AuthorizePlaybackResponse, HeartbeatRequest, StopPlaybackRequest,
};

pub struct PlaybackService {
    db: DatabaseConnection,
    kafka: Option<Arc<KafkaEventBus>>,
}

impl PlaybackService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self::with_kafka(db, None)
    }

    pub fn with_kafka(db: DatabaseConnection, kafka: Option<Arc<KafkaEventBus>>) -> Self {
        Self { db, kafka }
    }

    pub async fn authorize_playback(
        &self,
        user_id: Option<i64>,
        req: AuthorizePlaybackRequest,
        ip_address: Option<String>,
    ) -> Result<AuthorizePlaybackResponse, AppError> {
        req.validate()?;
        let content_id = req.resolved_content_id();
        let episode_id = req.resolved_episode_id();
        let device_id = req.resolved_device_id();
        let device_type = req.resolved_device_type();

        let c = content::Entity::find_by_id(content_id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("Content {} not found", content_id)))?;

        let mv = movie::Entity::find_by_id(c.id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let is_trailer = req.resolved_is_trailer();
        let mode = c
            .monetization
            .as_deref()
            .or(c.access_type.as_deref())
            .unwrap_or(if c.is_premium.unwrap_or(false) { "SVOD" } else { "AVOD" })
            .to_uppercase();

        if !is_trailer {
            let uid = user_id.ok_or_else(|| {
                AppError::Unauthorized("Authentication and active subscription required to watch content".to_string())
            })?;

            // Allow ADMIN / SUPER_ADMIN to preview streams in the Admin Panel
            let mut is_admin = false;
            if let Ok(ur_rows) = user_role::Entity::find()
                .filter(user_role::Column::UserId.eq(uid))
                .all(&self.db)
                .await
            {
                let role_ids: Vec<i64> = ur_rows.into_iter().map(|r| r.role_id).collect();
                if !role_ids.is_empty() {
                    if let Ok(roles) = role::Entity::find()
                        .filter(role::Column::Id.is_in(role_ids))
                        .all(&self.db)
                        .await
                    {
                        is_admin = roles.iter().any(|r| {
                            let n = r.name.to_uppercase();
                            n.contains("ADMIN")
                        });
                    }
                }
            }

            if !is_admin {
                let now = Utc::now();
                if mode == "TVOD" {
                    // Verify active, unexpired rental purchase for this content
                    let purchases = content_purchase::Entity::find()
                        .filter(content_purchase::Column::UserId.eq(uid))
                        .filter(content_purchase::Column::ContentId.eq(c.id))
                        .all(&self.db)
                        .await
                        .map_err(|e| AppError::Database(e.to_string()))?;
                    let has_active_rental = purchases.iter().any(|p| {
                        let status_ok = p
                            .status
                            .as_deref()
                            .map(|s| s.eq_ignore_ascii_case("ACTIVE"))
                            .unwrap_or(true);
                        let not_expired = p
                            .expires_at
                            .or(p.valid_until)
                            .map(|exp| exp.with_timezone(&Utc) > now)
                            .unwrap_or(true);
                        status_ok && not_expired
                    });
                    if !has_active_rental {
                        return Err(AppError::Forbidden(
                            "Rental required: please rent this title to watch.".to_string(),
                        ));
                    }
                } else {
                    // SVOD / PREMIUM: verify active, unexpired subscription
                    let subs = subscription::Entity::find()
                        .filter(subscription::Column::UserId.eq(uid))
                        .filter(subscription::Column::Status.eq("ACTIVE"))
                        .all(&self.db)
                        .await
                        .map_err(|e| AppError::Database(e.to_string()))?;
                    let has_active_sub = subs
                        .iter()
                        .any(|s| s.end_date.with_timezone(&Utc) > now);
                    if !has_active_sub {
                        return Err(AppError::Forbidden(
                            "Active subscription required to watch this premium title.".to_string(),
                        ));
                    }
                }
            }
        }

        // Enforce plan max_concurrent_streams for authenticated non-trailer playback
        if !is_trailer {
            if let Some(uid) = user_id {
                let now = Utc::now();
                let mut max_streams: i32 = 1;
                if let Ok(subs) = subscription::Entity::find()
                    .filter(subscription::Column::UserId.eq(uid))
                    .filter(subscription::Column::Status.eq("ACTIVE"))
                    .all(&self.db)
                    .await
                {
                    if let Some(active_sub) = subs.iter().find(|s| s.end_date.with_timezone(&Utc) > now) {
                        if let Ok(Some(p)) = plan::Entity::find_by_id(active_sub.plan_id).one(&self.db).await {
                            max_streams = p.max_concurrent_streams.unwrap_or(1).max(1);
                        }
                    }
                }

                let cutoff = now - chrono::Duration::minutes(2);
                if let Ok(sessions) = playback_session::Entity::find()
                    .filter(playback_session::Column::UserId.eq(uid))
                    .filter(playback_session::Column::IsActive.eq(true))
                    .all(&self.db)
                    .await
                {
                    let req_dev = device_id.as_deref().unwrap_or("");
                    let other_active = sessions
                        .iter()
                        .filter(|s| {
                            let recent = s
                                .last_heartbeat_at
                                .or(s.last_heartbeat)
                                .or(s.started_at)
                                .map(|t| t.with_timezone(&Utc) > cutoff)
                                .unwrap_or(false);
                            let same_device = !req_dev.is_empty()
                                && s.device_id.as_deref() == Some(req_dev);
                            recent && !same_device
                        })
                        .count() as i32;

                    if other_active >= max_streams {
                        return Err(AppError::Forbidden(format!(
                            "Screen limit reached: your plan allows up to {} concurrent stream(s). Stop playback on another device to continue.",
                            max_streams
                        )));
                    }
                }
            }
        }

        let bunny_video_id = mv
            .as_ref()
            .and_then(|m| m.bunny_video_guid.clone())
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_default();

        let stream_url = if is_trailer {
            c.trailer_url.clone().unwrap_or_default()
        } else {
            mv.as_ref()
                .and_then(|m| {
                    m.hls_url
                        .clone()
                        .filter(|s| !s.trim().is_empty())
                        .or_else(|| m.stream_url.clone().filter(|s| !s.trim().is_empty()))
                        .or_else(|| m.video_url.clone().filter(|s| !s.trim().is_empty()))
                        .or_else(|| m.video_asset_id.clone().filter(|s| !s.trim().is_empty()))
                })
                .or_else(|| {
                    if !bunny_video_id.is_empty() {
                        let cdn = std::env::var("BUNNY_STREAM_CDN_HOSTNAME")
                            .unwrap_or_default()
                            .trim()
                            .trim_end_matches('/')
                            .to_string();
                        if !cdn.is_empty() {
                            let host = cdn
                                .strip_prefix("https://")
                                .or_else(|| cdn.strip_prefix("http://"))
                                .unwrap_or(&cdn);
                            return Some(format!("https://{}/{}/playlist.m3u8", host, bunny_video_id));
                        }
                    }
                    None
                })
                .or_else(|| c.trailer_url.clone().filter(|s| !s.trim().is_empty()))
                .unwrap_or_default()
        };

        let duration_seconds = c
            .duration_seconds
            .or_else(|| mv.as_ref().and_then(|m| m.duration_seconds))
            .unwrap_or(0);

        let mut resume_pos = 0;
        if let Some(uid) = user_id {
            if let Ok(Some(wh)) = watch_history::Entity::find()
                .filter(watch_history::Column::UserId.eq(uid))
                .filter(watch_history::Column::ContentId.eq(c.id))
                .one(&self.db)
                .await
            {
                let already_done = wh.is_completed.unwrap_or(false) || wh.completed.unwrap_or(false);
                resume_pos = if already_done {
                    0
                } else {
                    wh.position_seconds.unwrap_or(0)
                };
            }
        }

        let session_id = Uuid::new_v4().to_string();
        let now = Utc::now().into();

        let session = playback_session::ActiveModel {
            session_id: Set(session_id.clone()),
            session_token: Set(Some(session_id.clone())),
            content_id: Set(c.id),
            episode_id: Set(episode_id),
            user_id: Set(user_id),
            profile_id: Set(req.resolved_profile_id()),
            device_id: Set(device_id.clone()),
            device_type: Set(device_type),
            ip_address: Set(ip_address),
            current_position_seconds: Set(Some(resume_pos)),
            total_duration_seconds: Set(Some(duration_seconds)),
            status: Set(Some("ACTIVE".to_string())),
            is_active: Set(Some(true)),
            started_at: Set(Some(now)),
            last_heartbeat: Set(Some(now)),
            last_heartbeat_at: Set(Some(now)),
            ..Default::default()
        };

        let _ = session.insert(&self.db).await;

        if !is_trailer {
            // PostgreSQL is the source of truth for view counts. The session token is
            // the idempotency key, so retries, replays and duplicate client events
            // cannot increment the counter twice.
            let viewer_key = match user_id {
                Some(uid) => format!("user:{uid}"),
                None => device_id
                    .as_deref()
                    .map(str::trim)
                    .filter(|d| !d.is_empty())
                    .map(|d| format!("device:{d}"))
                    .unwrap_or_else(|| format!("session:{session_id}")),
            };

            let ledger_sql = "INSERT INTO content_view_events \
                (event_id, content_id, user_id, viewer_key, session_id, event_type) \
                VALUES ($1, $2, $3, $4, $5, 'start') \
                ON CONFLICT (event_id) DO NOTHING";
            let ledger = self
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    ledger_sql,
                    vec![
                        session_id.clone().into(),
                        c.id.into(),
                        user_id.into(),
                        viewer_key.into(),
                        session_id.clone().into(),
                    ],
                ))
                .await;

            let mut counted = false;
            if let Ok(result) = ledger {
                if result.rows_affected() > 0 {
                    let inc_sql = format!(
                        "UPDATE contents SET view_count = COALESCE(view_count, 0) + 1, updated_at = NOW() WHERE id = {}",
                        c.id
                    );
                    if self
                        .db
                        .execute(Statement::from_string(DatabaseBackend::Postgres, inc_sql))
                        .await
                        .is_ok()
                    {
                        counted = true;
                        bump_analytics_version().await;
                    }
                }
            }
            if !counted {
                info!(
                    "View for session {} was already counted or could not be persisted",
                    session_id
                );
            }

            // Kafka remains an async side channel for downstream analytics only.
            if let Some(kafka) = &self.kafka {
                if kafka.is_enabled() {
                    let evt = ViewEvent {
                        event_id: Some(session_id.clone()),
                        user_id,
                        content_id: c.id,
                        event_type: "start".to_string(),
                        timestamp: Some(Utc::now().to_rfc3339()),
                    };
                    let kafka = kafka.clone();
                    tokio::spawn(async move { let _ = kafka.publish_view_event(&evt).await; });
                }
            }
        }

        info!(
            "Playback authorized for content {} (user {:?}, session {})",
            c.id, user_id, session_id
        );

        let subtitles: Vec<serde_json::Value> = c
            .subtitles_json
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                let src = item
                    .get("src")
                    .or_else(|| item.get("fileUrl"))
                    .or_else(|| item.get("url"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())?;
                let lang = item
                    .get("srclang")
                    .or_else(|| item.get("language"))
                    .or_else(|| item.get("code"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("en")
                    .to_string();
                let label = item
                    .get("label")
                    .or_else(|| item.get("language"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&lang)
                    .to_string();
                Some(serde_json::json!({
                    "label": label,
                    "language": lang,
                    "srclang": lang,
                    "src": src,
                    "fileUrl": src
                }))
            })
            .collect();

        let audio_tracks: Vec<serde_json::Value> = c
            .audio_tracks_json
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
            .unwrap_or_default();

        let content_warnings: Vec<String> = c
            .content_warnings
            .as_deref()
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default();

        Ok(AuthorizePlaybackResponse {
            authorized: true,
            content_id: c.id,
            session_id: session_id.clone(),
            session_token: session_id,
            stream_url: stream_url.clone(),
            hls_url: stream_url.clone(),
            master_playlist_url: stream_url,
            bunny_video_id,
            resume_position_seconds: resume_pos,
            duration_seconds,
            is_trailer,
            subtitles,
            audio_tracks,
            content_warnings,
            skip_intro_start: c.skip_intro_start,
            skip_intro_end: c.skip_intro_end,
            skip_outro_start: c.skip_outro_start,
        })
    }

    async fn persist_watch_progress(
        &self,
        uid: i64,
        prof_id: i64,
        cid: i64,
        ep_id: Option<i64>,
        pos_val: i32,
        dur_val: i32,
        explicit_completed: Option<bool>,
    ) {
        let completed = explicit_completed.unwrap_or(dur_val > 0 && pos_val >= (dur_val * 92 / 100));
        if pos_val <= 0 && !completed {
            // Never overwrite a saved resume position with 0 on initial mount heartbeat.
            return;
        }
        let final_pos = if completed && dur_val > 0 { dur_val } else { pos_val.max(0) };
        let pct = if completed {
            100.0
        } else if dur_val > 0 {
            ((final_pos as f64 / dur_val as f64) * 100.0).min(100.0)
        } else {
            0.0
        };
        let pct_dec = Decimal::from_f64_retain(pct).unwrap_or(Decimal::ZERO);
        let now_wh: chrono::DateTime<Utc> = Utc::now();

        let wh_sql = r#"
            INSERT INTO watch_history (
                user_id, profile_id, content_id, episode_id,
                position_seconds, watched_seconds, watched_duration_seconds,
                duration_seconds, total_duration_seconds,
                percentage, completed, is_completed, last_watched_at
            ) VALUES ($1,$2,$3,$4,$5,$5,$5,$6,$6,$7,$8,$8,$9)
            ON CONFLICT (profile_id, content_id) DO UPDATE SET
                user_id = EXCLUDED.user_id,
                episode_id = EXCLUDED.episode_id,
                position_seconds = EXCLUDED.position_seconds,
                watched_seconds = EXCLUDED.watched_seconds,
                watched_duration_seconds = EXCLUDED.watched_duration_seconds,
                duration_seconds = CASE WHEN EXCLUDED.duration_seconds > 0 THEN EXCLUDED.duration_seconds ELSE watch_history.duration_seconds END,
                total_duration_seconds = CASE WHEN EXCLUDED.total_duration_seconds > 0 THEN EXCLUDED.total_duration_seconds ELSE watch_history.total_duration_seconds END,
                percentage = EXCLUDED.percentage,
                completed = EXCLUDED.completed,
                is_completed = EXCLUDED.is_completed,
                last_watched_at = EXCLUDED.last_watched_at
        "#;
        let _ = self
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                wh_sql,
                vec![
                    uid.into(),
                    prof_id.into(),
                    cid.into(),
                    ep_id.into(),
                    final_pos.into(),
                    dur_val.into(),
                    pct_dec.into(),
                    completed.into(),
                    now_wh.into(),
                ],
            ))
            .await;
        bump_analytics_version().await;
    }

    pub async fn record_heartbeat(&self, req: HeartbeatRequest) -> Result<(), AppError> {
        let sid = req.session_id.or(req.session_token);
        if let Some(session_key) = sid {
            if let Some(session) = playback_session::Entity::find()
                .filter(playback_session::Column::SessionId.eq(&session_key))
                .one(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
            {
                let pos = req.position_seconds.or(req.current_position_seconds);
                let dur = req.duration_seconds.or(req.total_duration_seconds);
                let now = Utc::now().into();
                let uid_opt = session.user_id;
                let cid = session.content_id;
                let ep_id = session.episode_id;
                let prof_id_opt = session.profile_id;

                let mut active: playback_session::ActiveModel = session.into();
                if let Some(p) = pos {
                    if p > 0 {
                        active.current_position_seconds = Set(Some(p));
                    }
                }
                if let Some(d) = dur {
                    if d > 0 {
                        active.total_duration_seconds = Set(Some(d));
                    }
                }
                active.last_heartbeat = Set(Some(now));
                active.last_heartbeat_at = Set(Some(now));
                let _ = active.update(&self.db).await;

                if let Some(uid) = uid_opt {
                    let pos_val = pos.unwrap_or(0);
                    let dur_val = dur.unwrap_or(0);
                    let prof_id = prof_id_opt.unwrap_or(uid);
                    self.persist_watch_progress(uid, prof_id, cid, ep_id, pos_val, dur_val, req.completed)
                        .await;
                }
            }
        }
        Ok(())
    }

    pub async fn stop_playback(&self, req: StopPlaybackRequest) -> Result<(), AppError> {
        let sid = req.session_id.or(req.session_token);
        if let Some(session_key) = sid {
            if let Some(session) = playback_session::Entity::find()
                .filter(playback_session::Column::SessionId.eq(&session_key))
                .one(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
            {
                let pos = req.position_seconds.or(req.current_position_seconds);
                let dur = req.duration_seconds.or(req.total_duration_seconds);
                let uid_opt = session.user_id;
                let cid = session.content_id;
                let ep_id = session.episode_id;
                let prof_id_opt = session.profile_id;

                let mut active: playback_session::ActiveModel = session.into();
                if let Some(p) = pos {
                    if p > 0 {
                        active.current_position_seconds = Set(Some(p));
                    }
                }
                if let Some(d) = dur {
                    if d > 0 {
                        active.total_duration_seconds = Set(Some(d));
                    }
                }
                active.status = Set(Some("ENDED".to_string()));
                active.is_active = Set(Some(false));
                let _ = active.update(&self.db).await;

                if let Some(uid) = uid_opt {
                    let pos_val = pos.unwrap_or(0);
                    let dur_val = dur.unwrap_or(0);
                    let prof_id = prof_id_opt.unwrap_or(uid);
                    self.persist_watch_progress(uid, prof_id, cid, ep_id, pos_val, dur_val, req.completed)
                        .await;
                }
            }
        }
        Ok(())
    }
}

