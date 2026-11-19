use crate::handlers::*;
use axum::routing::{get, post};
use axum::Router;
use maxx_core::AppState;

pub fn marketing_routes() -> Router<AppState> {
    let admin = Router::new()
        .route("/", get(admin_list_agents_handler).post(admin_create_agent_handler))
        .route("/list", get(admin_list_agents_handler))
        .route("/agents", get(admin_list_agents_handler).post(admin_create_agent_handler))
        .route("/:id", get(admin_get_agent_handler))
        .route("/:id/toggle-status", post(admin_toggle_agent_handler))
        .route("/:id/members", get(admin_list_members_handler));

    let public = Router::new()
        .route("/validate", get(validate_agent_query_handler))
        .route("/validate/:code", get(validate_agent_path_handler))
        .route("/agents/validate", get(validate_agent_query_handler))
        .route("/agents/validate/:code", get(validate_agent_path_handler));

    Router::new()
        .nest("/api/v1/admin/marketing", admin.clone())
        .nest("/api/admin/marketing", admin.clone())
        .nest("/admin/marketing", admin)
        .nest("/api/v1/marketing", public.clone())
        .nest("/api/marketing", public.clone())
        .nest("/marketing", public)
}
