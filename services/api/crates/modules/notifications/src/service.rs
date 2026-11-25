use chrono::Utc;
use maxx_common::error::AppError;
use maxx_common::validation::ValidationBag;
use maxx_core::entities::{
    device, notification, subscription, system_setting, user, user_notification,
};
use maxx_core::AppState;
use maxx_integration_email::FcmClient;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Set, Statement,
};
use serde_json::{json, Value};

type AppResult<T> = Result<T, AppError>;

pub struct NotificationService;

impl NotificationService {
    pub async fn list_history(
        state: &AppState,
        limit: u64,
    ) -> AppResult<Vec<notification::Model>> {
        let rows = notification::Entity::find()
            .order_by_desc(notification::Column::CreatedAt)
            .limit(limit.clamp(1, 200))
            .all(&state.db)
            .await?;
        Ok(rows)
    }

    pub async fn get_channel_config(state: &AppState) -> AppResult<Value> {
        let rows = system_setting::Entity::find()
            .filter(system_setting::Column::SettingGroup.eq("NOTIFICATIONS"))
            .all(&state.db)
            .await?;
        Ok(json!({ "settings": rows }))
    }

    pub async fn save_channel_config(
        state: &AppState,
        channel: &str,
        body: Value,
    ) -> AppResult<Value> {
        let key = format!("NOTIFY_{}_CONFIG", channel.to_uppercase());
        let val_str = body.to_string();
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(existing) = system_setting::Entity::find()
            .filter(system_setting::Column::SettingKey.eq(&key))
            .one(&state.db)
            .await?
        {
            let mut am: system_setting::ActiveModel = existing.into();
            am.setting_value = Set(Some(val_str));
            am.updated_at = Set(now);
            am.update(&state.db).await?;
        } else {
            let am = system_setting::ActiveModel {
                setting_key: Set(key.clone()),
                setting_value: Set(Some(val_str)),
                setting_group: Set(Some("NOTIFICATIONS".to_string())),
                category: Set(Some("NOTIFICATIONS".to_string())),
                is_secret: Set(Some(true)),
                is_public: Set(Some(false)),
                updated_at: Set(now),
                ..Default::default()
            };
            am.insert(&state.db).await?;
        }

        Ok(json!({ "saved": true, "channel": channel.to_uppercase(), "key": key }))
    }

    /// Resolves recipient user IDs for a target audience (`ALL`, `SUBSCRIBERS`, `FREE`) or single user.
    async fn resolve_recipient_ids(
        state: &AppState,
        target_audience: Option<&str>,
        target_user_id: Option<&str>,
    ) -> Vec<i64> {
        if let Some(uid_str) = target_user_id {
            if let Ok(uid) = uid_str.trim().parse::<i64>() {
                return vec![uid];
            }
        }

        let audience = target_audience.unwrap_or("ALL").trim().to_uppercase();
        let now = Utc::now();

        if audience == "SUBSCRIBERS" || audience == "PREMIUM" || audience == "PAID" {
            let subs = subscription::Entity::find()
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .all(&state.db)
                .await
                .unwrap_or_default();
            let mut ids: Vec<i64> = subs
                .into_iter()
                .filter(|s| s.end_date.with_timezone(&Utc) > now)
                .map(|s| s.user_id)
                .collect();
            ids.sort_unstable();
            ids.dedup();
            return ids;
        }

        let all_users = user::Entity::find()
            .filter(user::Column::Status.eq("ACTIVE"))
            .limit(5000)
            .all(&state.db)
            .await
            .unwrap_or_default();

        if audience == "FREE" || audience == "FREE_TIER" {
            let active_sub_users: std::collections::HashSet<i64> = subscription::Entity::find()
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .all(&state.db)
                .await
                .unwrap_or_default()
                .into_iter()
                .filter(|s| s.end_date.with_timezone(&Utc) > now)
                .map(|s| s.user_id)
                .collect();
            return all_users
                .into_iter()
                .map(|u| u.id)
                .filter(|id| !active_sub_users.contains(id))
                .collect();
        }

        all_users.into_iter().map(|u| u.id).collect()
    }

    pub async fn send_notification(
        state: &AppState,
        channel: &str,
        title: String,
        message: String,
        target_audience: Option<String>,
        target_user_id: Option<String>,
        image_url: Option<String>,
        deep_link_url: Option<String>,
        scheduled_at_iso: Option<String>,
        created_by: Option<String>,
    ) -> AppResult<notification::Model> {
        let mut v = ValidationBag::new();
        v.require_text("title", Some(title.as_str()), 1, 160);
        v.require_text("message", Some(message.as_str()), 1, 2000);
        v.optional_url("imageUrl", image_url.as_deref());
        v.optional_url("actionUrl", deep_link_url.as_deref());
        v.finish()?;

        let now_utc = Utc::now();
        let now: chrono::DateTime<chrono::FixedOffset> = now_utc.into();
        let scheduled_dt = scheduled_at_iso
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        let is_future_schedule = scheduled_dt
            .map(|dt| dt.with_timezone(&Utc) > now_utc)
            .unwrap_or(false);

        let am = notification::ActiveModel {
            channel: Set(Some(channel.to_uppercase())),
            title: Set(title.trim().to_string()),
            message: Set(message.trim().to_string()),
            target_audience: Set(target_audience.clone()),
            target_user_id: Set(target_user_id.clone()),
            image_url: Set(image_url),
            deep_link_url: Set(deep_link_url.clone()),
            action_url: Set(deep_link_url),
            status: Set(Some(if is_future_schedule {
                "SCHEDULED".to_string()
            } else {
                "SENT".to_string()
            })),
            scheduled_at: Set(scheduled_dt),
            sent_at: Set(if is_future_schedule { None } else { Some(now) }),
            sent_count: Set(Some(0)),
            created_by: Set(created_by),
            created_at: Set(now),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;

        // If scheduled for later, notification_worker will dispatch & fan out at scheduled_at
        if is_future_schedule {
            return Ok(saved);
        }

        // High-throughput low-latency dispatch: offload FCM + chunked batch inbox fan-out to background task
        let bg_state = state.clone();
        let bg_saved = saved.clone();
        let bg_channel = channel.to_string();
        let bg_audience = target_audience.clone();
        let bg_uid = target_user_id.clone();
        tokio::spawn(async move {
            let fcm = FcmClient::from_env();
            if bg_channel.eq_ignore_ascii_case("PUSH") || bg_channel.eq_ignore_ascii_case("FCM") {
                if let Some(ref uid_str) = bg_uid {
                    if let Ok(uid) = uid_str.parse::<i64>() {
                        let tokens = device::Entity::find()
                            .filter(device::Column::UserId.eq(uid))
                            .filter(device::Column::FcmToken.is_not_null())
                            .all(&bg_state.db)
                            .await
                            .unwrap_or_default();
                        for d in tokens {
                            if let Some(tok) = d.fcm_token {
                                if !tok.is_empty() {
                                    let _ = fcm
                                        .send_to_target(
                                            &tok,
                                            &bg_saved.title,
                                            &bg_saved.message,
                                            bg_saved.image_url.as_deref(),
                                            bg_saved.action_url.as_deref(),
                                        )
                                        .await;
                                }
                            }
                        }
                    }
                } else {
                    let raw_topic = bg_saved.target_audience.as_deref().unwrap_or("all");
                    let topic = match raw_topic.trim().to_uppercase().as_str() {
                        "" | "ALL" | "ALL_USERS" | "EVERYONE" => "all_users".to_string(),
                        other => other.to_lowercase(),
                    };
                    let topic_target = format!("/topics/{}", topic);
                    let _ = fcm
                        .send_to_target(
                            &topic_target,
                            &bg_saved.title,
                            &bg_saved.message,
                            bg_saved.image_url.as_deref(),
                            bg_saved.action_url.as_deref(),
                        )
                        .await;
                }
            }

            let recipient_ids = Self::resolve_recipient_ids(
                &bg_state,
                bg_audience.as_deref(),
                bg_uid.as_deref(),
            )
            .await;
            let delivered = recipient_ids.len() as i32;
            let notif_id = bg_saved.id;

            // Chunked batch INSERT (500 rows per query instead of N individual round-trips)
            for chunk in recipient_ids.chunks(500) {
                let batch: Vec<user_notification::ActiveModel> = chunk
                    .iter()
                    .map(|&uid| user_notification::ActiveModel {
                        user_id: Set(uid),
                        notification_id: Set(notif_id),
                        is_read: Set(Some(false)),
                        created_at: Set(now),
                        ..Default::default()
                    })
                    .collect();
                let _ = user_notification::Entity::insert_many(batch)
                    .exec(&bg_state.db)
                    .await;
            }

            let mut upd: notification::ActiveModel = bg_saved.into();
            upd.sent_count = Set(Some(delivered.max(1)));
            let _ = upd.update(&bg_state.db).await;
        });

        Ok(saved)
    }

    pub async fn register_device_token(state: &AppState, user_id: i64, body: Value) -> AppResult<Value> {
        let fcm = body.get("fcmToken").or_else(|| body.get("fcm_token")).or_else(|| body.get("deviceToken")).or_else(|| body.get("device_token")).or_else(|| body.get("token")).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let device_id = body.get("deviceId").or_else(|| body.get("device_id")).and_then(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "default-device".to_string());
        let device_name = body.get("deviceName").or_else(|| body.get("device_name")).and_then(|v| v.as_str()).map(|s| s.to_string());
        let platform = body.get("platform").or_else(|| body.get("os")).and_then(|v| v.as_str()).unwrap_or("ANDROID").to_uppercase();
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(existing) = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .filter(device::Column::DeviceId.eq(device_id.clone()))
            .one(&state.db)
            .await? {
            let mut am: device::ActiveModel = existing.into();
            am.last_seen = Set(Some(now));
            am.last_active_at = Set(Some(now));
            am.is_active = Set(Some(true));
            am.platform = Set(Some(platform));
            if let Some(name) = device_name.clone() { if !name.is_empty() { am.device_name = Set(Some(name)); } }
            if let Some(tok) = fcm.clone() { am.fcm_token = Set(Some(tok)); }
            am.update(&state.db).await?;
        } else {
            let am = device::ActiveModel {
                user_id: Set(user_id),
                device_id: Set(device_id.clone()),
                device_name: Set(device_name.or_else(|| Some("OTT Client".to_string()))),
                device_model: Set(None),
                device_type: Set(None),
                platform: Set(Some(platform)),
                os_version: Set(None),
                app_version: Set(None),
                fcm_token: Set(fcm.clone()),
                ip_address: Set(None),
                is_active: Set(Some(true)),
                last_seen: Set(Some(now)),
                last_active_at: Set(Some(now)),
                created_at: Set(now),
                ..Default::default()
            };
            am.insert(&state.db).await?;
        }

        Ok(json!({ "success": true, "deviceId": device_id, "fcmRegistered": fcm.is_some(), "updatedAt": now }))
    }

    pub async fn list_registered_fcm_devices(state: &AppState) -> AppResult<Vec<Value>> {
        let devices = device::Entity::find()
            .filter(device::Column::FcmToken.is_not_null())
            .order_by_desc(device::Column::CreatedAt)
            .limit(200)
            .all(&state.db)
            .await?;

        Ok(devices
            .into_iter()
            .map(|d| {
                json!({
                    "id": d.id,
                    "userId": d.user_id,
                    "deviceId": d.device_id,
                    "deviceName": d.device_name,
                    "deviceType": d.device_type,
                    "platform": d.platform,
                    "hasFcmToken": d.fcm_token.as_ref().map(|t| !t.is_empty()).unwrap_or(false),
                    "isActive": d.is_active.unwrap_or(true),
                    "lastSeen": d.last_seen,
                })
            })
            .collect())
    }

    pub async fn get_user_notifications(
        state: &AppState,
        user_id: i64,
    ) -> AppResult<Vec<Value>> {
        let user_notifs = user_notification::Entity::find()
            .filter(user_notification::Column::UserId.eq(user_id))
            .order_by_desc(user_notification::Column::CreatedAt)
            .limit(50)
            .all(&state.db)
            .await?;

        let mut out = Vec::with_capacity(user_notifs.len());
        for un in user_notifs {
            let n = notification::Entity::find_by_id(un.notification_id)
                .one(&state.db)
                .await?;
            out.push(json!({
                "id": un.id,
                "notificationId": un.notification_id,
                "title": n.as_ref().map(|x| x.title.clone()).unwrap_or_default(),
                "message": n.as_ref().map(|x| x.message.clone()).unwrap_or_default(),
                "imageUrl": n.as_ref().and_then(|x| x.image_url.clone()),
                "actionUrl": n.as_ref().and_then(|x| x.action_url.clone().or(x.deep_link_url.clone())),
                "channel": n.as_ref().and_then(|x| x.channel.clone()),
                "isRead": un.is_read.unwrap_or(false),
                "readAt": un.read_at,
                "createdAt": un.created_at,
                "notification": n
            }));
        }
        Ok(out)
    }

    pub async fn get_unread_count(state: &AppState, user_id: i64) -> AppResult<u64> {
        let count = user_notification::Entity::find()
            .filter(user_notification::Column::UserId.eq(user_id))
            .filter(user_notification::Column::IsRead.eq(false))
            .count(&state.db)
            .await?;
        Ok(count)
    }

    pub async fn mark_as_read(state: &AppState, user_id: i64, id: i64) -> AppResult<Value> {
        let un = user_notification::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Notification not found".to_string()))?;
        if un.user_id != user_id {
            return Err(AppError::Forbidden("Forbidden".to_string()));
        }
        let mut am: user_notification::ActiveModel = un.into();
        am.is_read = Set(Some(true));
        am.read_at = Set(Some(Utc::now().into()));
        am.update(&state.db).await?;
        Ok(json!({ "id": id, "isRead": true }))
    }

    pub async fn mark_all_as_read(state: &AppState, user_id: i64) -> AppResult<Value> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE user_notifications \
             SET is_read = TRUE, read_at = NOW() \
             WHERE user_id = $1 AND COALESCE(is_read, FALSE) = FALSE",
            vec![user_id.into()],
        );
        let res = state.db.execute(stmt).await?;
        Ok(json!({ "markedRead": res.rows_affected() }))
    }

    pub async fn clear_all_notifications(state: &AppState, user_id: i64) -> AppResult<Value> {
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "DELETE FROM user_notifications WHERE user_id = $1",
            vec![user_id.into()],
        );
        let res = state.db.execute(stmt).await?;
        Ok(json!({ "cleared": res.rows_affected() }))
    }
}
