use crate::handlers::*;
use axum::routing::{get, patch, post, put};
use axum::Router;
use maxx_core::AppState;

pub fn subscription_routes() -> Router<AppState> {
    let plan_router = Router::new()
        .route("/", get(list_plans_handler))
        .route("/my", get(get_my_subscriptions_handler))
        .route("/active", get(get_my_subscriptions_handler))
        .route(
            "/validate-coupon",
            post(validate_coupon_post_handler).get(validate_coupon_get_handler),
        )
        .route("/:id", get(get_plan_handler));

    let coupon_router = Router::new().route(
        "/validate",
        get(validate_coupon_get_handler).post(validate_coupon_post_handler),
    );

    let admin_plan_router = Router::new()
        .route("/", get(admin_list_plans_handler).post(admin_create_plan_handler))
        .route(
            "/coupons",
            get(admin_list_coupons_handler).post(admin_create_coupon_handler),
        )
        .route(
            "/coupons/:id",
            put(admin_update_coupon_handler).delete(admin_delete_coupon_handler),
        )
        .route(
            "/:id",
            get(get_plan_handler)
                .put(admin_update_plan_handler)
                .delete(admin_delete_plan_handler),
        )
        .route("/:id/toggle-status", patch(admin_toggle_plan_status_handler));

    let admin_coupon_router = Router::new()
        .route("/", get(admin_list_coupons_handler).post(admin_create_coupon_handler))
        .route(
            "/:id",
            get(admin_get_coupon_handler)
                .put(admin_update_coupon_handler)
                .delete(admin_delete_coupon_handler),
        )
        .route("/:id/toggle-status", patch(admin_toggle_coupon_status_handler));

    Router::new()
        .nest("/api/v1/plans", plan_router.clone())
        .nest("/api/plans", plan_router.clone())
        .nest("/plans", plan_router.clone())
        .nest("/api/v1/subscriptions", plan_router.clone())
        .nest("/api/subscriptions", plan_router.clone())
        .nest("/subscriptions", plan_router.clone())
        .nest("/api/v1/subscription-plans", plan_router.clone())
        .nest("/api/subscription-plans", plan_router.clone())
        .nest("/subscription-plans", plan_router)
        .nest("/api/v1/coupons", coupon_router.clone())
        .nest("/api/coupons", coupon_router.clone())
        .nest("/coupons", coupon_router)
        .nest("/api/v1/admin/plans", admin_plan_router.clone())
        .nest("/api/admin/plans", admin_plan_router.clone())
        .nest("/admin/plans", admin_plan_router)
        .nest("/api/v1/admin/coupons", admin_coupon_router.clone())
        .nest("/api/admin/coupons", admin_coupon_router.clone())
        .nest("/admin/coupons", admin_coupon_router)
}

