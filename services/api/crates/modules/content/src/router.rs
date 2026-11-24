use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use maxx_core::AppState;

use crate::handlers::{
    admin_get_movie_handler, admin_list_movies_handler, create_episode_by_season_handler,
    create_episode_handler, create_live_channel_handler, create_live_event_handler,
    create_movie_handler, create_season_handler, create_series_handler, delete_episode_handler,
    delete_live_channel_handler, delete_live_event_handler, delete_movie_handler,
    delete_season_handler, delete_series_handler, direct_upload_token_handler, get_series_handler,
    list_episodes_by_season_handler, list_episodes_handler,
    list_live_channels_handler, list_live_events_handler, list_seasons_handler,
    list_series_handler, serve_banner_handler, serve_branding_handler, serve_flat_upload_handler,
    serve_poster_handler, serve_upload_handler,
    update_movie_handler, update_movie_status_handler, update_series_handler,
    upload_media_handler, upload_video_handler, presigned_url_get_handler, presigned_url_post_handler,
};

pub fn content_routes() -> Router<AppState> {
    let series_routes = Router::new()
        .route("/", get(list_series_handler).post(create_series_handler))
        .route(
            "/:id",
            get(get_series_handler)
                .put(update_series_handler)
                .delete(delete_series_handler),
        )
        .route(
            "/:series_id/seasons",
            get(list_seasons_handler).post(create_season_handler),
        )
        .route("/:series_id/seasons/:season_id", delete(delete_season_handler))
        .route(
            "/seasons/:season_id/episodes",
            get(list_episodes_by_season_handler).post(create_episode_by_season_handler),
        )
        .route(
            "/:series_id/seasons/:season_id/episodes",
            get(list_episodes_handler).post(create_episode_handler),
        )
        .route(
            "/:series_id/seasons/:season_id/episodes/:episode_id",
            delete(delete_episode_handler),
        );

    let live_routes = Router::new()
        .route(
            "/channels",
            get(list_live_channels_handler).post(create_live_channel_handler),
        )
        .route("/channels/:id", delete(delete_live_channel_handler))
        .route(
            "/events",
            get(list_live_events_handler).post(create_live_event_handler),
        )
        .route("/events/:id", delete(delete_live_event_handler));

    let live_channels_routes = Router::new()
        .route("/", get(list_live_channels_handler).post(create_live_channel_handler))
        .route("/:id", delete(delete_live_channel_handler));

    let storage_routes = Router::new()
        .route("/upload", post(upload_media_handler))
        .route("/direct-upload-token", post(direct_upload_token_handler).get(direct_upload_token_handler))
        .route("/upload-video", post(upload_video_handler))
        .route("/upload/video", post(upload_video_handler))
        .route("/upload-async", post(upload_video_handler))
        .route("/presigned-url", get(presigned_url_get_handler).post(presigned_url_post_handler));

    let admin_movies_full = Router::new()
        .route("/", get(admin_list_movies_handler).post(create_movie_handler))
        .route(
            "/:id",
            get(admin_get_movie_handler)
                .put(update_movie_handler)
                .delete(delete_movie_handler),
        )
        .route("/:id/status", patch(update_movie_status_handler));

    Router::new()
        // Admin Movies Read + Write endpoints
        .nest("/api/v1/admin/movies", admin_movies_full.clone())
        .nest("/api/admin/movies", admin_movies_full.clone())
        .nest("/admin/movies", admin_movies_full)
        // Admin Series, Seasons & Episodes
        .nest("/api/v1/admin/series", series_routes.clone())
        .nest("/api/admin/series", series_routes.clone())
        .nest("/admin/series", series_routes)
        // Live Channels & Events
        .nest("/api/v1/live", live_routes.clone())
        .nest("/api/live", live_routes.clone())
        .nest("/live", live_routes.clone())
        .nest("/api/v1/admin/live", live_routes.clone())
        .nest("/api/admin/live", live_routes)
        .nest("/api/v1/live-channels", live_channels_routes.clone())
        .nest("/api/live-channels", live_channels_routes.clone())
        .nest("/live-channels", live_channels_routes.clone())
        .nest("/api/v1/admin/live-channels", live_channels_routes.clone())
        .nest("/api/admin/live-channels", live_channels_routes)
        // Storage & Video uploads
        .nest("/api/v1/storage", storage_routes.clone())
        .nest("/api/storage", storage_routes.clone())
        .nest("/storage", storage_routes.clone())
        .nest("/api/v1/admin/storage", storage_routes.clone())
        .nest("/api/admin/storage", storage_routes.clone())
        .nest("/admin/storage", storage_routes)
        // Public Media serving (local disk -> Bunny Storage API proxy)
        .route("/uploads/:folder/:file_name", get(serve_upload_handler))
        .route("/api/uploads/:folder/:file_name", get(serve_upload_handler))
        .route("/api/v1/uploads/:folder/:file_name", get(serve_upload_handler))
        .route("/uploads/:file_name", get(serve_flat_upload_handler))
        .route("/api/uploads/:file_name", get(serve_flat_upload_handler))
        .route("/api/v1/uploads/:file_name", get(serve_flat_upload_handler))
        .route("/posters/:file_name", get(serve_poster_handler))
        .route("/api/v1/posters/:file_name", get(serve_poster_handler))
        .route("/banners/:file_name", get(serve_banner_handler))
        .route("/api/v1/banners/:file_name", get(serve_banner_handler))
        .route("/branding/:file_name", get(serve_branding_handler))
        .route("/api/v1/branding/:file_name", get(serve_branding_handler))
}

pub fn admin_movies_write_routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_movie_handler))
        .route("/:id", put(update_movie_handler).delete(delete_movie_handler))
}
