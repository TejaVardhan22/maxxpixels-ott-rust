use crate::handlers::*;
use axum::routing::{get, post};
use axum::Router;
use maxx_core::AppState;

pub fn home_content_routes() -> Router<AppState> {
    let admin_intro = Router::new()
        .route(
            "/",
            get(admin_list_intro_videos_handler).post(admin_create_intro_video_handler),
        )
        .route("/list", get(admin_list_intro_videos_handler))
        .route("/active", get(public_active_intro_video_handler))
        .route(
            "/:id",
            get(admin_get_intro_video_handler)
                .put(admin_update_intro_video_handler)
                .delete(admin_delete_intro_video_handler),
        )
        .route("/:id/activate", post(admin_activate_intro_video_handler));

    let public_intro = Router::new()
        .route("/", get(public_list_intro_videos_handler))
        .route("/list", get(public_list_intro_videos_handler))
        .route("/active", get(public_active_intro_video_handler));

    let admin_portal = Router::new()
        .route(
            "/",
            get(admin_list_portal_banners_handler).post(admin_create_portal_banner_handler),
        )
        .route("/list", get(admin_list_portal_banners_handler))
        .route(
            "/:id",
            get(admin_get_portal_banner_handler)
                .put(admin_update_portal_banner_handler)
                .delete(admin_delete_portal_banner_handler),
        )
        .route("/:id/toggle-status", post(admin_toggle_portal_banner_handler));

    let public_portal = Router::new()
        .route("/", get(public_list_portal_banners_handler))
        .route("/list", get(public_list_portal_banners_handler));

    Router::new()
        .nest("/api/v1/admin/intro-video", admin_intro.clone())
        .nest("/api/v1/admin/intro-videos", admin_intro.clone())
        .nest("/api/admin/intro-video", admin_intro.clone())
        .nest("/api/admin/intro-videos", admin_intro.clone())
        .nest("/admin/intro-video", admin_intro)
        .nest("/api/v1/cms/intro-video", public_intro.clone())
        .nest("/api/v1/intro-video", public_intro.clone())
        .nest("/api/v1/intro-videos", public_intro.clone())
        .nest("/api/cms/intro-video", public_intro.clone())
        .nest("/api/intro-video", public_intro.clone())
        .nest("/cms/intro-video", public_intro)
        .nest("/api/v1/admin/portal-banners", admin_portal.clone())
        .nest("/api/admin/portal-banners", admin_portal.clone())
        .nest("/admin/portal-banners", admin_portal)
        .nest("/api/v1/cms/portal-banners", public_portal.clone())
        .nest("/api/v1/portal-banners", public_portal.clone())
        .nest("/api/cms/portal-banners", public_portal.clone())
        .nest("/api/portal-banners", public_portal.clone())
        .nest("/cms/portal-banners", public_portal)
}
