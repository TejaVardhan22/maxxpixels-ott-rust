use chrono::Utc;
use maxx_common::error::AppError;
use maxx_common::validation::ValidationBag;
use maxx_core::entities::{
    device, notification, subscription, system_setting, user, user_notification,
};
use maxx_core::AppState;
use maxx_integration_email::FcmClient;
use maxx_integration_msg91::Msg91Client;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Set, Statement,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use tracing::{info, warn};

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

    /// Resolve one or more recipient phone numbers from a user id or audience.
    async fn resolve_recipient_phones(
        state: &AppState,
        target_audience: Option<&str>,
        target_user_id: Option<&str>,
    ) -> Vec<String> {
        if let Some(uid_str) = target_user_id {
            let raw = uid_str.trim();
            if let Ok(uid) = raw.parse::<i64>() {
                if let Ok(Some(u)) = user::Entity::find_by_id(uid).one(&state.db).await {
                    return u
                        .phone_number
                        .or(u.phone)
                        .map(|p| vec![Msg91Client::normalize_mobile(&p)])
                        .unwrap_or_default();
                }
                return Vec::new();
            }
            // Admin SMS handler may pass a raw phone number as `target_user_id`.
            if raw.chars().filter(|c| c.is_ascii_digit()).count() >= 10 {
                return vec![Msg91Client::normalize_mobile(raw)];
            }
        }

        let ids = Self::resolve_recipient_ids(state, target_audience, None).await;
        if ids.is_empty() {
            return Vec::new();
        }

        let users = user::Entity::find()
            .filter(user::Column::Id.is_in(ids))
            .all(&state.db)
            .await
            .unwrap_or_default();

        let mut phones: Vec<String> = users
            .into_iter()
            .filter_map(|u| u.phone_number.or(u.phone))
            .map(|p| Msg91Client::normalize_mobile(&p))
            .filter(|p| p.len() >= 10)
            .collect();
        phones.sort_unstable();
        phones.dedup();
        phones
    }

    /// Send a template-based transactional SMS and record it in notification history.
    /// `vars` uses MSG91 variable names (`VAR1`, `VAR2`, ...).
    pub async fn send_templated_sms(
        state: &AppState,
        mobile: &str,
        template_id: &str,
        vars: &BTreeMap<String, String>,
        title: Option<&str>,
        created_by: Option<String>,
    ) -> AppResult<Value> {
        let phone = Msg91Client::normalize_mobile(mobile);
        if phone.len() < 10 {
            return Err(AppError::BadRequest("Valid mobile number is required".to_string()));
        }
        if template_id.trim().is_empty() {
            return Err(AppError::BadRequest("SMS template is not configured".to_string()));
        }

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let am = notification::ActiveModel {
            channel: Set(Some("SMS".to_string())),
            title: Set(title
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Transactional SMS".to_string())),
            message: Set(
                vars.get("VAR2")
                    .or_else(|| vars.get("VAR1"))
                    .cloned()
                    .unwrap_or_else(|| "Transactional SMS".to_string()),
            ),
            status: Set(Some("PENDING".to_string())),
            sent_at: Set(Some(now)),
            sent_count: Set(Some(1)),
            created_by: Set(created_by),
            created_at: Set(now),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;
        let notification_id = saved.id;

        let client = Msg91Client::from_env();
        match client.send_template_sms(&phone, template_id, vars).await {
            Ok(result) if result.is_success() => {
                let mut upd: notification::ActiveModel = saved.into();
                upd.status = Set(Some("SENT".to_string()));
                let _ = upd.update(&state.db).await;
                Ok(json!({
                    "sent": true,
                    "provider": "msg91",
                    "requestId": result.request_id,
                    "templateId": template_id,
                    "notificationId": notification_id,
                }))
            }
            Ok(result) => {
                let mut upd: notification::ActiveModel = saved.into();
                upd.status = Set(Some("SKIPPED".to_string()));
                let _ = upd.update(&state.db).await;
                Ok(json!({
                    "sent": false,
                    "provider": result.kind,
                    "reason": result.message,
                    "templateId": template_id,
                }))
            }
            Err(e) => {
                let mut upd: notification::ActiveModel = saved.into();
                upd.status = Set(Some("FAILED".to_string()));
                let _ = upd.update(&state.db).await;
                Err(e)
            }
        }
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
            let mut sms_failed = false;
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
                    let topic = bg_saved
                        .target_audience
                        .as_deref()
                        .unwrap_or("all")
                        .to_lowercase();
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

            if bg_channel.eq_ignore_ascii_case("SMS") {
                let msg91 = Msg91Client::from_env();
                if !msg91.is_transactional_configured() {
                    warn!("MSG91 transactional template missing; admin SMS notification not dispatched");
                    sms_failed = true;
                } else {
                    let phones = Self::resolve_recipient_phones(
                        &bg_state,
                        bg_audience.as_deref(),
                        bg_uid.as_deref(),
                    )
                    .await;
                    let mut vars = BTreeMap::new();
                    vars.insert("VAR1".to_string(), bg_saved.title.clone());
                    vars.insert("VAR2".to_string(), bg_saved.message.clone());
                    for phone in phones {
                        match msg91.send_transactional_sms(&phone, &vars).await {
                            Ok(result) if result.is_success() => {
                                info!(
                                    "Transactional SMS dispatched to {} (request {:?})",
                                    phone, result.request_id
                                );
                            }
                            Ok(result) => {
                                warn!(
                                    "Transactional SMS skipped for {}: {:?}",
                                    phone, result.message
                                );
                                sms_failed = true;
                            }
                            Err(e) => {
                                warn!("Transactional SMS failed for {}: {}", phone, e);
                                sms_failed = true;
                            }
                        }
                    }
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
            if sms_failed && bg_channel.eq_ignore_ascii_case("SMS") {
                upd.status = Set(Some("FAILED".to_string()));
            }
            let _ = upd.update(&bg_state.db).await;
        });

        Ok(saved)
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
}
