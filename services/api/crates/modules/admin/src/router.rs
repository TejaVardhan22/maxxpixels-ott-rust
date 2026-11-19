use crate::handlers::*;
use crate::masters::*;
use axum::routing::{delete, get, patch, post, put};
use axum::Router;
use maxx_core::AppState;

pub fn admin_routes() -> Router<AppState> {
    let settings_router = Router::new()
        .route(
            "/",
            get(get_all_settings_handler)
                .put(update_settings_handler)
                .post(update_settings_handler),
        )
        .route(
            "/key/:key",
            get(get_setting_by_key_handler)
                .put(upsert_setting_by_key_handler)
                .delete(delete_setting_by_key_handler),
        )
        .route("/group/:group", get(get_settings_by_group_handler))
        .route("/history", get(get_settings_history_handler))
        .route("/audit-logs", get(get_settings_history_handler))
        .route("/rollback/:id", post(rollback_setting_handler))
        .route("/test-connection", post(test_connection_handler))
        .route("/test", post(test_connection_handler))
        .route("/test-bunny-storage", post(test_bunny_storage_handler))
        .route("/test-bunny-stream", post(test_bunny_stream_handler))
        .route("/test-s3", post(test_s3_handler))
        .route("/test-razorpay", post(test_razorpay_handler))
        .route("/test-stripe", post(test_stripe_handler));

    let public_settings_router = Router::new()
        .route(
            "/",
            get(get_public_settings_handler)
                .put(update_settings_handler)
                .post(update_settings_handler),
        )
        .route("/public", get(get_public_settings_handler));

    let admin_banners_router = Router::new()
        .route(
            "/",
            get(admin_list_banners_handler).post(admin_create_banner_handler),
        )
        .route(
            "/:id",
            put(admin_update_banner_handler).delete(admin_delete_banner_handler),
        );

    let admin_cms_router = Router::new()
        .route("/pages", get(list_pages_handler))
        .route(
            "/sections",
            get(list_sections_handler).post(admin_create_section_handler),
        )
        .route("/sections/order", patch(admin_reorder_sections_handler))
        .route(
            "/sections/:id",
            put(admin_update_section_handler).delete(admin_delete_section_handler),
        )
        .route("/sections/:id/items", post(admin_add_section_item_handler))
        .route(
            "/sections/:id/items/:item_id",
            delete(admin_remove_section_item_handler),
        )
        .route(
            "/banners",
            get(admin_list_banners_handler).post(admin_create_banner_handler),
        )
        .route(
            "/banners/:id",
            put(admin_update_banner_handler).delete(admin_delete_banner_handler),
        );

    let public_cms_router = Router::new()
        .route("/home", get(get_home_page_handler))
        .route("/pages/home", get(get_home_page_handler))
        .route("/pages/:slug", get(get_page_by_slug_handler))
        .route("/banners", get(list_public_banners_handler))
        .route("/sections", get(list_sections_handler));

    let public_banners_router = Router::new().route("/", get(list_public_banners_handler));
    let public_pages_router = Router::new()
        .route("/", get(list_pages_handler))
        .route("/home", get(get_home_page_handler))
        .route("/:slug", get(get_page_by_slug_handler));
    let public_legal_router = Router::new()
        .route("/", get(list_legal_pages_handler).post(create_legal_page_handler))
        .route(
            "/:slug",
            get(get_legal_page_handler).put(update_legal_page_handler),
        );

    let drm_router = Router::new()
        .route("/", get(list_drm_rules_handler).post(create_drm_rule_handler))
        .route("/:id", put(update_drm_rule_handler).delete(delete_drm_rule_handler));

    let admin_devices_router = Router::new()
        .route("/", get(admin_list_devices_handler))
        .route("/:id", delete(admin_delete_device_handler))
        .route("/:id/revoke", post(admin_revoke_device_handler))
        .route("/:id/disconnect", post(admin_revoke_device_handler))
        .route(
            "/user/:user_id/disconnect-all",
            post(admin_disconnect_user_devices_handler),
        );

    let admin_security_router = Router::new()
        .route("/roles", get(admin_list_roles_handler).post(admin_create_role_handler))
        .route(
            "/roles/:id",
            put(admin_update_role_handler).delete(admin_delete_role_handler),
        )
        .route(
            "/settings",
            get(admin_get_security_settings_handler).put(admin_update_security_settings_handler),
        )
        .route(
            "/matrix",
            get(admin_get_permission_matrix_handler).put(admin_update_permission_matrix_handler),
        )
        .route("/audit-logs", get(admin_audit_logs_handler));

    let backup_router = Router::new()
        .route("/", get(list_backups_handler))
        .route("/list", get(list_backups_handler))
        .route("/migrations", get(list_migrations_handler))
        .route("/export", post(trigger_backup_handler))
        .route("/trigger", post(trigger_backup_handler))
        .route("/run", post(trigger_backup_handler))
        .route("/download/:filename", get(download_backup_handler))
        .route("/:filename", delete(delete_backup_handler));

    let cast_router = Router::new()
        .route("/", get(list_cast_members_handler).post(create_cast_member_handler))
        .route("/:id", put(update_cast_member_handler).delete(delete_cast_member_handler));

    Router::new()
        // Public & Admin Settings
        .nest("/api/v1/settings", public_settings_router.clone())
        .nest("/api/settings", public_settings_router.clone())
        .nest("/settings", public_settings_router)
        .route("/api/v1/general_setting", get(get_public_settings_handler))
        .nest("/api/v1/admin/settings", settings_router.clone())
        .nest("/api/admin/settings", settings_router.clone())
        .nest("/admin/settings", settings_router)
        // CMS & Banners
        .nest("/api/v1/admin/cms", admin_cms_router.clone())
        .nest("/api/admin/cms", admin_cms_router.clone())
        .nest("/admin/cms", admin_cms_router)
        .nest("/api/v1/cms", public_cms_router.clone())
        .nest("/api/cms", public_cms_router.clone())
        .nest("/cms", public_cms_router)
        .route("/api/v1/sections", get(list_sections_handler))
        .route("/api/sections", get(list_sections_handler))
        .route("/sections", get(list_sections_handler))
        .nest("/api/v1/admin/banners", admin_banners_router.clone())
        .nest("/api/admin/banners", admin_banners_router.clone())
        .nest("/admin/banners", admin_banners_router)
        .nest("/api/v1/banners", public_banners_router.clone())
        .nest("/api/banners", public_banners_router.clone())
        .nest("/banners", public_banners_router)
        .nest("/api/v1/pages", public_pages_router.clone())
        .nest("/api/pages", public_pages_router.clone())
        .nest("/pages", public_pages_router)
        // Legal Pages (Public + Admin aliases)
        .nest("/api/v1/legal", public_legal_router.clone())
        .nest("/api/legal", public_legal_router.clone())
        .nest("/legal", public_legal_router.clone())
        .nest("/api/v1/admin/legal", public_legal_router.clone())
        .nest("/api/v1/admin/legal-pages", public_legal_router)
        // DRM Rules
        .nest("/api/v1/admin/drm/rules", drm_router.clone())
        .nest("/api/admin/drm/rules", drm_router.clone())
        .nest("/api/v1/admin/drm-rules", drm_router.clone())
        .nest("/api/admin/drm-rules", drm_router)
        // Admin Devices
        .nest("/api/v1/admin/devices", admin_devices_router.clone())
        .nest("/api/admin/devices", admin_devices_router.clone())
        .nest("/admin/devices", admin_devices_router)
        // Admin Security, RBAC & Audit Logs
        .nest("/api/v1/admin/security", admin_security_router.clone())
        .nest("/api/admin/security", admin_security_router.clone())
        .nest("/admin/security", admin_security_router)
        .route("/api/v1/admin/audit-logs", get(admin_audit_logs_handler))
        .route("/api/admin/audit-logs", get(admin_audit_logs_handler))
        // Admin Backup
        .nest("/api/v1/admin/backup", backup_router.clone())
        .nest("/api/admin/backup", backup_router.clone())
        .nest("/api/v1/backup", backup_router.clone())
        .nest("/api/backup", backup_router)
        // Cast Members (Name, Role, Bio, Profile Image)
        .nest("/api/v1/admin/cast", cast_router.clone())
        .nest("/api/admin/cast", cast_router.clone())
        .nest("/api/v1/cast", cast_router.clone())
        .nest("/api/cast", cast_router)
        // Basic Details Write Endpoints (Main Types, Categories, Genres, Languages — soft-delete)
        .route("/api/v1/admin/content-types", post(admin_create_content_type_handler))
        .route("/api/v1/admin/content-types/:id", put(admin_update_content_type_handler).delete(admin_delete_content_type_handler))
        .route("/api/v1/admin/categories", post(admin_create_category_handler))
        .route("/api/v1/admin/categories/:id", put(admin_update_category_handler).delete(admin_delete_category_handler))
        .route("/api/v1/admin/genres", post(admin_create_genre_handler))
        .route("/api/v1/admin/genres/:id", put(admin_update_genre_handler).delete(admin_delete_genre_handler))
        .route("/api/v1/admin/languages", post(admin_create_language_handler))
        .route("/api/v1/admin/languages/:code", put(admin_update_language_handler).delete(admin_delete_language_handler))
}


