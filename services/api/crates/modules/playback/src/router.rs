use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    handlers::{
        authorize_playback_get_handler, authorize_playback_handler, heartbeat_handler,
        list_sessions_handler, session_heartbeat_handler, stop_playback_handler,
    },
    service::PlaybackService,
};

pub fn playback_routes(service: Arc<PlaybackService>) -> Router {
    Router::new()
        .route("/authorize", post(authorize_playback_handler))
        .route(
            "/sessions",
            get(list_sessions_handler).post(authorize_playback_handler),
        )
        .route("/start", post(authorize_playback_handler))
        .route("/init", post(authorize_playback_handler))
        .route("/play", post(authorize_playback_handler))
        .route("/authorize/:content_id", get(authorize_playback_get_handler))
        .route("/stream/:content_id", get(authorize_playback_get_handler))
        .route("/heartbeat", post(heartbeat_handler))
        .route("/progress", post(heartbeat_handler))
        .route("/sessions/:session_id/heartbeat", post(session_heartbeat_handler))
        .route("/stop", post(stop_playback_handler))
        .with_state(service)
}

