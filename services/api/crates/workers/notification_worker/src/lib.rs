use chrono::Utc;
use maxx_core::entities::{device, notification, user, user_notification};
use maxx_integration_email::FcmClient;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect, Set,
};
use std::time::Duration;
use tracing::{info, warn};

pub fn spawn_notification_worker(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        let fcm = FcmClient::from_env();
        loop {
            interval.tick().await;
            let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
            let pending = match notification::Entity::find()
                .filter(notification::Column::Status.eq("SCHEDULED"))
                .filter(notification::Column::ScheduledAt.lte(now))
                .limit(50)
                .all(&db)
                .await
            {
                Ok(rows) => rows,
                Err(e) => {
                    warn!("notification_worker query error: {}", e);
                    continue;
                }
            };

            for item in pending {
                let channel = item.channel.as_deref().unwrap_or("PUSH");
                if channel.eq_ignore_ascii_case("PUSH") || channel.eq_ignore_ascii_case("FCM") {
                    if let Some(ref uid_str) = item.target_user_id {
                        if let Ok(uid) = uid_str.parse::<i64>() {
                            let tokens = device::Entity::find()
                                .filter(device::Column::UserId.eq(uid))
                                .filter(device::Column::FcmToken.is_not_null())
                                .all(&db)
                                .await
                                .unwrap_or_default();
                            for d in tokens {
                                if let Some(tok) = d.fcm_token {
                                    if !tok.is_empty() {
                                        let _ = fcm
                                            .send_to_target(
                                                &tok,
                                                &item.title,
                                                &item.message,
                                                item.image_url.as_deref(),
                                                item.action_url.as_deref(),
                                            )
                                            .await;
                                    }
                                }
                            }
                        }
                    } else {
                        let topic = format!("/topics/{}", item.target_audience.as_deref().unwrap_or("all"));
                        let _ = fcm
                            .send_to_target(
                                &topic,
                                &item.title,
                                &item.message,
                                item.image_url.as_deref(),
                                item.action_url.as_deref(),
                            )
                            .await;
                    }
                }

                // Fan out to in-app inbox (user_notifications) when scheduled notification fires
                let mut delivered: i32 = 0;
                if let Some(ref uid_str) = item.target_user_id {
                    if let Ok(uid) = uid_str.parse::<i64>() {
                        let un = user_notification::ActiveModel {
                            user_id: Set(uid),
                            notification_id: Set(item.id),
                            is_read: Set(Some(false)),
                            created_at: Set(now),
                            ..Default::default()
                        };
                        if un.insert(&db).await.is_ok() {
                            delivered = 1;
                        }
                    }
                } else {
                    let users = user::Entity::find()
                        .filter(user::Column::Status.eq("ACTIVE"))
                        .limit(5000)
                        .all(&db)
                        .await
                        .unwrap_or_default();
                    delivered = users.len() as i32;
                    for chunk in users.chunks(500) {
                        let batch: Vec<user_notification::ActiveModel> = chunk
                            .iter()
                            .map(|u| user_notification::ActiveModel {
                                user_id: Set(u.id),
                                notification_id: Set(item.id),
                                is_read: Set(Some(false)),
                                created_at: Set(now),
                                ..Default::default()
                            })
                            .collect();
                        let _ = user_notification::Entity::insert_many(batch).exec(&db).await;
                    }
                }

                let mut am: notification::ActiveModel = item.into();
                am.status = Set(Some("SENT".to_string()));
                am.sent_at = Set(Some(now));
                am.sent_count = Set(Some(delivered.max(1)));
                if let Err(e) = am.update(&db).await {
                    warn!("notification_worker update error: {}", e);
                } else {
                    info!("notification_worker: dispatched scheduled notification to {} user(s)", delivered);
                }
            }
        }
    });
}
