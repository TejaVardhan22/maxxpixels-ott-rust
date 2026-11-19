use axum::{
    routing::{delete, get, patch, post, put},
    Router,
};
use std::sync::Arc;

use crate::{
    handlers::{
        admin_block_user_handler, admin_create_user_handler, admin_delete_user_handler,
        admin_get_user_handler, admin_list_users_handler, admin_patch_status_handler,
        admin_reset_password_handler, admin_revoke_devices_handler, admin_toggle_status_handler,
        admin_unblock_user_handler, admin_update_user_handler, create_sub_profile_handler,
        get_devices_handler, get_sub_profiles_handler, revoke_device_handler,
        update_my_profile_handler,
    },
    service::UsersService,
};

pub fn user_profile_routes(service: Arc<UsersService>) -> Router {
    Router::new()
        .route("/me", put(update_my_profile_handler))
        .route("/profile", put(update_my_profile_handler))
        .route("/profiles", get(get_sub_profiles_handler).post(create_sub_profile_handler))
        .route("/devices", get(get_devices_handler))
        .route("/devices/:device_id", delete(revoke_device_handler))
        .with_state(service)
}

pub fn admin_users_routes(service: Arc<UsersService>) -> Router {
    Router::new()
        .route("/", get(admin_list_users_handler).post(admin_create_user_handler))
        .route(
            "/:id",
            get(admin_get_user_handler)
                .put(admin_update_user_handler)
                .delete(admin_delete_user_handler),
        )
        .route("/:id/status", patch(admin_patch_status_handler))
        .route("/:id/toggle-status", patch(admin_toggle_status_handler))
        .route("/:id/block", post(admin_block_user_handler))
        .route("/:id/unblock", post(admin_unblock_user_handler))
        .route("/:id/revoke-devices", post(admin_revoke_devices_handler))
        .route("/:id/reset-password", post(admin_reset_password_handler))
        .route("/:id/password", post(admin_reset_password_handler))
        .with_state(service)
}

