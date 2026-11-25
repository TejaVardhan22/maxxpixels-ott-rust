use crate::handlers::*;
use axum::routing::{delete, get, post};
use axum::Router;
use maxx_core::AppState;

pub fn notification_routes() -> Router<AppState> {
    let admin_router = Router::new()
        .route("/history", get(list_history_handler))
        .route("/devices", get(list_devices_handler))
        .route("/config", get(get_config_handler).post(save_config_handler))
        .route("/config/:channel", post(save_config_handler))
        .route("/test", post(test_gateway_handler))
        .route("/push/topic", post(push_topic_handler))
        .route("/push/user/:userId", post(push_user_handler))
        .route("/sms/send", post(send_sms_handler))
        .route("/sms/bulk", post(send_sms_handler))
        .route("/whatsapp/send", post(send_whatsapp_handler))
        .route("/whatsapp/bulk", post(send_whatsapp_handler));

    let device_router = Router::new()
        .route("/device-token", post(register_device_token_handler))
        .route("/fcm-token", post(register_device_token_handler))
        .route("/register-token", post(register_device_token_handler));

    let user_router = Router::new()
        .route("/", get(get_my_notifications_handler))
        .route("/my", get(get_my_notifications_handler))
        .route("/unread-count", get(unread_count_handler))
        .route("/read-all", post(mark_all_read_handler))
        .route("/clear-all", delete(clear_all_notifications_handler))
        .route("/:id/read", post(mark_read_handler));

    Router::new()
        .nest("/api/v1/admin/notifications", admin_router.clone())
        .nest("/api/admin/notifications", admin_router.clone())
        .nest("/admin/notifications", admin_router)
        .nest("/api/v1/notifications", device_router.clone().merge(user_router.clone()))
        .nest("/api/notifications", device_router.clone().merge(user_router.clone()))
        .nest("/notifications", device_router.merge(user_router))
}

