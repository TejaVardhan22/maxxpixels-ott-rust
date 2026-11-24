use chrono::Utc;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, ModelTrait, QueryFilter,
    QueryOrder, Set,
};
use std::collections::HashMap;
use std::sync::Arc;

use maxx_common::error::AppError;
use maxx_common::validation::Validatable;
use maxx_core::entities::{content, profile, watch_history, watchlist};
use maxx_core::realtime::bump_analytics_version;
use maxx_integration_kafka::{KafkaEventBus, WatchHistoryEvent};

use crate::dto::{SaveProgressRequest, WatchHistoryItemDto, WatchlistItemDto};

pub struct WatchHistoryService {
    db: DatabaseConnection,
    public_base_url: String,
    kafka: Option<Arc<KafkaEventBus>>,
}

impl WatchHistoryService {
    pub fn new(db: DatabaseConnection, public_base_url: String) -> Self {
        Self::with_kafka(db, public_base_url, None)
    }

    pub fn with_kafka(db: DatabaseConnection, public_base_url: String, kafka: Option<Arc<KafkaEventBus>>) -> Self {
        Self {
            db,
            public_base_url: public_base_url.trim_end_matches('/').to_string(),
            kafka,
        }
    }

    async fn resolve_default_profile_id(&self, user_id: i64, req_profile: Option<i64>) -> Result<i64, AppError> {
        if let Some(pid) = req_profile {
            return Ok(pid);
        }
        let p = profile::Entity::find()
            .filter(profile::Column::UserId.eq(user_id))
            .order_by_asc(profile::Column::Id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(found) = p {
            return Ok(found.id);
        }

        // Create default profile if missing
        let now = Utc::now().into();
        let created = profile::ActiveModel {
            user_id: Set(user_id),
            name: Set("Default".to_string()),
            is_default: Set(Some(true)),
            is_kids: Set(Some(false)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&self.db)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(created.id)
    }

    fn ensure_absolute_url(&self, url: Option<&str>) -> String {
        let raw = match url {
            Some(u) if !u.trim().is_empty() => u.trim(),
            _ => return String::new(),
        };
        if raw.starts_with("http://") || raw.starts_with("https://") || raw.starts_with("data:") {
            return raw.to_string();
        }
        let clean = raw.trim_start_matches('/');
        if !clean.starts_with("uploads/") {
            format!("{}/uploads/{}", self.public_base_url, clean)
        } else {
            format!("{}/{}", self.public_base_url, clean)
        }
    }

    pub async fn get_continue_watching(
        &self,
        user_id: i64,
        profile_id: Option<i64>,
    ) -> Result<Vec<WatchHistoryItemDto>, AppError> {
        let mut q = watch_history::Entity::find()
            .filter(watch_history::Column::UserId.eq(user_id))
            .filter(
                watch_history::Column::IsCompleted
                    .eq(false)
                    .or(watch_history::Column::IsCompleted.is_null()),
            )
            .order_by_desc(watch_history::Column::LastWatchedAt);

        if let Some(pid) = profile_id {
            q = q.filter(watch_history::Column::ProfileId.eq(pid));
        }

        let rows: Vec<watch_history::Model> = q
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .into_iter()
            .take(20)
            .collect();

        self.hydrate_watch_history(rows).await
    }

    pub async fn get_watch_history(
        &self,
        user_id: i64,
        limit: Option<u64>,
    ) -> Result<Vec<WatchHistoryItemDto>, AppError> {
        let max_items = limit.unwrap_or(50).min(100) as usize;
        let rows: Vec<watch_history::Model> = watch_history::Entity::find()
            .filter(watch_history::Column::UserId.eq(user_id))
            .order_by_desc(watch_history::Column::LastWatchedAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .into_iter()
            .take(max_items)
            .collect();

        self.hydrate_watch_history(rows).await
    }

    pub async fn save_watch_progress(
        &self,
        user_id: i64,
        req: SaveProgressRequest,
    ) -> Result<WatchHistoryItemDto, AppError> {
        req.validate()?;
        let profile_id = self.resolve_default_profile_id(user_id, req.profile_id).await?;
        let pos = req.position_seconds.or(req.current_position_seconds).unwrap_or(0);
        let dur = req.duration_seconds.or(req.total_duration_seconds).unwrap_or(0);

        let pct_f64 = if dur > 0 {
            ((pos as f64 / dur as f64) * 100.0).min(100.0)
        } else {
            0.0
        };
        let completed = req.completed.unwrap_or(pct_f64 >= 92.0);
        let pct_dec = Decimal::from_f64_retain(pct_f64).unwrap_or(Decimal::ZERO);
        let now = Utc::now().into();

        let existing = watch_history::Entity::find()
            .filter(watch_history::Column::ProfileId.eq(profile_id))
            .filter(watch_history::Column::ContentId.eq(req.content_id))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let saved = if let Some(found) = existing {
            let mut active: watch_history::ActiveModel = found.into();
            active.user_id = Set(Some(user_id));
            active.position_seconds = Set(Some(pos));
            active.watched_seconds = Set(Some(pos));
            active.watched_duration_seconds = Set(Some(pos));
            active.duration_seconds = Set(Some(dur));
            active.total_duration_seconds = Set(Some(dur));
            active.percentage = Set(Some(pct_dec));
            active.completed = Set(Some(completed));
            active.is_completed = Set(Some(completed));
            active.last_watched_at = Set(Some(now));
            active
                .update(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        } else {
            watch_history::ActiveModel {
                user_id: Set(Some(user_id)),
                profile_id: Set(profile_id),
                content_id: Set(req.content_id),
                episode_id: Set(req.episode_id),
                position_seconds: Set(Some(pos)),
                watched_seconds: Set(Some(pos)),
                watched_duration_seconds: Set(Some(pos)),
                duration_seconds: Set(Some(dur)),
                total_duration_seconds: Set(Some(dur)),
                percentage: Set(Some(pct_dec)),
                completed: Set(Some(completed)),
                is_completed: Set(Some(completed)),
                last_watched_at: Set(Some(now)),
                ..Default::default()
            }
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
        };

        // Publish to Kafka for high-throughput async view/progress processing (best-effort)
        if let Some(kafka) = &self.kafka {
            if kafka.is_enabled() {
                let evt = WatchHistoryEvent {
                    event_id: Some(uuid::Uuid::new_v4().to_string()),
                    user_id: Some(user_id),
                    profile_id: Some(profile_id),
                    content_id: req.content_id,
                    episode_id: req.episode_id,
                    progress_seconds: Some(pos as i64),
                    duration_seconds: Some(dur as i64),
                    completed: Some(completed),
                    timestamp: Some(Utc::now().to_rfc3339()),
                };
                let kafka = kafka.clone();
                tokio::spawn(async move {
                    let _ = kafka.publish_watch_history(&evt).await;
                });
            }
        }

        bump_analytics_version().await;

        let mut list = self.hydrate_watch_history(vec![saved]).await?;
        list.pop()
            .ok_or_else(|| AppError::Internal("Failed to hydrate watch progress".to_string()))
    }

    pub async fn remove_watch_progress(&self, user_id: i64, id: i64) -> Result<(), AppError> {
        if let Some(row) = watch_history::Entity::find_by_id(id)
            .filter(watch_history::Column::UserId.eq(user_id))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
        {
            row.delete(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
        }
        Ok(())
    }

    pub async fn get_watchlist(&self, user_id: i64) -> Result<Vec<WatchlistItemDto>, AppError> {
        let rows = watchlist::Entity::find()
            .filter(watchlist::Column::UserId.eq(user_id))
            .order_by_desc(watchlist::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if rows.is_empty() {
            return Ok(vec![]);
        }

        let ids: Vec<i64> = rows.iter().map(|r| r.content_id).collect();
        let contents = content::Entity::find()
            .filter(content::Column::Id.is_in(ids))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let cmap: HashMap<i64, content::Model> =
            contents.into_iter().map(|c| (c.id, c)).collect();

        Ok(rows
            .into_iter()
            .filter_map(|w| {
                let c = cmap.get(&w.content_id)?;
                Some(WatchlistItemDto {
                    id: w.content_id,
                    content_id: w.content_id,
                    video_id: w.content_id,
                    is_bookmark: 1,
                    title: c.title.clone(),
                    slug: c.slug.clone(),
                    poster_url: self.ensure_absolute_url(c.poster_url.as_deref()),
                    backdrop_url: self.ensure_absolute_url(
                        c.backdrop_url
                            .as_deref()
                            .or(c.landscape_image_url.as_deref())
                            .or(c.poster_url.as_deref()),
                    ),
                    content_type: c
                        .content_type
                        .clone()
                        .or_else(|| c.r#type.clone())
                        .unwrap_or_else(|| "MOVIE".to_string()),
                    release_year: c.release_year,
                    maturity_rating: c.age_rating.clone(),
                    duration_seconds: c.duration_seconds,
                    is_premium: matches!(
                        c.access_type.as_deref().map(|s| s.to_uppercase()).as_deref(),
                        Some("SUBSCRIPTION") | Some("VIP") | Some("PREMIUM") | Some("SVOD") | Some("TVOD") | Some("RENT")
                    ),
                    added_at: w.added_at.unwrap_or(w.created_at).to_rfc3339(),
                })
            })
            .collect())
    }

    pub async fn toggle_watchlist(
        &self,
        user_id: i64,
        content_id: i64,
        profile_id: Option<i64>,
    ) -> Result<serde_json::Value, AppError> {
        let pid = self.resolve_default_profile_id(user_id, profile_id).await?;
        let existing = watchlist::Entity::find()
            .filter(watchlist::Column::ProfileId.eq(pid))
            .filter(watchlist::Column::ContentId.eq(content_id))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(row) = existing {
            row.delete(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(serde_json::json!({ "inWatchlist": false, "contentId": content_id }))
        } else {
            let now = Utc::now().into();
            watchlist::ActiveModel {
                user_id: Set(Some(user_id)),
                profile_id: Set(pid),
                content_id: Set(content_id),
                created_at: Set(now),
                added_at: Set(Some(now)),
                ..Default::default()
            }
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(serde_json::json!({ "inWatchlist": true, "contentId": content_id }))
        }
    }

    pub async fn remove_from_watchlist(
        &self,
        user_id: i64,
        content_id: i64,
    ) -> Result<(), AppError> {
        let rows = watchlist::Entity::find()
            .filter(watchlist::Column::UserId.eq(user_id))
            .filter(
                watchlist::Column::ContentId
                    .eq(content_id)
                    .or(watchlist::Column::Id.eq(content_id)),
            )
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        for row in rows {
            row.delete(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
        }
        Ok(())
    }

    async fn hydrate_watch_history(
        &self,
        rows: Vec<watch_history::Model>,
    ) -> Result<Vec<WatchHistoryItemDto>, AppError> {
        if rows.is_empty() {
            return Ok(vec![]);
        }
        let ids: Vec<i64> = rows.iter().map(|r| r.content_id).collect();
        let contents = content::Entity::find()
            .filter(content::Column::Id.is_in(ids))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let cmap: HashMap<i64, content::Model> =
            contents.into_iter().map(|c| (c.id, c)).collect();

        Ok(rows
            .into_iter()
            .filter_map(|wh| {
                let c = cmap.get(&wh.content_id)?;
                Some(WatchHistoryItemDto {
                    id: wh.id,
                    content_id: wh.content_id,
                    episode_id: wh.episode_id,
                    profile_id: wh.profile_id,
                    title: c.title.clone(),
                    slug: c.slug.clone(),
                    poster_url: self.ensure_absolute_url(c.poster_url.as_deref()),
                    backdrop_url: self.ensure_absolute_url(
                        c.backdrop_url
                            .as_deref()
                            .or(c.landscape_image_url.as_deref())
                            .or(c.poster_url.as_deref()),
                    ),
                    content_type: c
                        .content_type
                        .clone()
                        .or_else(|| c.r#type.clone())
                        .unwrap_or_else(|| "MOVIE".to_string()),
                    position_seconds: wh.position_seconds.unwrap_or(0),
                    duration_seconds: wh.duration_seconds.unwrap_or(0),
                    percentage: wh
                        .percentage
                        .and_then(|d| d.to_f64())
                        .unwrap_or(0.0),
                    completed: wh.is_completed.or(wh.completed).unwrap_or(false),
                    last_watched_at: wh
                        .last_watched_at
                        .map(|d| d.to_rfc3339())
                        .unwrap_or_else(|| Utc::now().to_rfc3339()),
                })
            })
            .collect())
    }
}

