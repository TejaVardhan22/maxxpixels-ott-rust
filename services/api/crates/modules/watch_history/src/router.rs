use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    handlers::{
        get_continue_watching_handler, get_watch_history_handler, get_watchlist_handler,
        remove_history_handler, remove_watchlist_handler, save_progress_handler,
        toggle_watchlist_handler,
    },
    service::WatchHistoryService,
};

pub fn watch_routes(service: Arc<WatchHistoryService>) -> Router {
    Router::new()
        .route("/", get(get_watch_history_handler))
        .route("/history", get(get_watch_history_handler).post(save_progress_handler))
        .route("/history/:id", delete(remove_history_handler))
        .route("/continue-watching", get(get_continue_watching_handler))
        .route("/continue", get(get_continue_watching_handler))
        .route("/progress", post(save_progress_handler))
        .route("/watchlist", get(get_watchlist_handler).post(toggle_watchlist_handler))
        .route(
            "/watchlist/:content_id",
            post(toggle_watchlist_handler).delete(remove_watchlist_handler),
        )
        .with_state(service)
}

pub fn watchlist_routes(service: Arc<WatchHistoryService>) -> Router {
    Router::new()
        .route(
            "/",
            get(get_watchlist_handler)
                .post(toggle_watchlist_handler)
                .delete(remove_watchlist_handler),
        )
        .route(
            "/:content_id",
            post(toggle_watchlist_handler).delete(remove_watchlist_handler),
        )
        .with_state(service)
}

