use crate::handlers::*;
use axum::routing::{get, post};
use axum::Router;
use maxx_core::AppState;

pub fn analytics_routes() -> Router<AppState> {
    let admin_router = Router::new()
        .route("/", get(get_overview_handler))
        .route("/overview", get(get_overview_handler))
        .route("/summary", get(get_overview_handler))
        .route("/stats", get(get_overview_handler))
        .route("/dashboard", get(get_overview_handler))
        .route("/stream", get(live_analytics_stream_handler))
        .route("/sse", get(live_analytics_stream_handler))
        .route("/realtime", get(get_realtime_handler))
        .route("/live-streams", get(get_realtime_handler))
        .route("/live", get(get_realtime_handler));

    let public_router = Router::new()
        .route("/event", post(record_event_handler))
        .route("/events", post(record_event_handler))
        .route("/track", post(record_event_handler))
        .route("/interaction", post(record_event_handler));

    Router::new()
        .nest("/api/v1/admin/analytics", admin_router.clone())
        .nest("/api/admin/analytics", admin_router.clone())
        .nest("/admin/analytics", admin_router.clone())
        .nest("/api/v1/admin/dashboard", admin_router.clone())
        .nest("/api/admin/dashboard", admin_router)
        .nest("/api/v1/analytics", public_router.clone())
        .nest("/api/analytics", public_router.clone())
        .nest("/analytics", public_router)
}

