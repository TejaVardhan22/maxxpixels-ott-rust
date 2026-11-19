use crate::handlers::*;
use axum::routing::{get, post};
use axum::Router;
use maxx_core::AppState;

pub fn payment_routes() -> Router<AppState> {
    let public_router = Router::new()
        .route("/create-order", post(create_order_handler))
        .route("/orders", post(create_order_handler))
        .route("/initiate", post(create_order_handler))
        .route("/verify", post(verify_payment_handler))
        .route("/verify-payment", post(verify_payment_handler))
        .route("/confirm", post(verify_payment_handler))
        .route("/my-transactions", get(get_my_transactions_handler))
        .route("/history", get(get_my_transactions_handler))
        .route("/my-subscription", get(get_my_subscription_handler))
        .route("/subscription", get(get_my_subscription_handler))
        .route("/webhook/razorpay", post(razorpay_webhook_handler))
        .route("/webhooks/razorpay", post(razorpay_webhook_handler))
        .route("/webhook/stripe", post(stripe_webhook_handler))
        .route("/webhooks/stripe", post(stripe_webhook_handler));

    let admin_router = Router::new()
        .route("/", get(admin_list_transactions_handler))
        .route("/analytics", get(admin_analytics_summary_handler))
        .route("/summary", get(admin_analytics_summary_handler))
        .route("/stats", get(admin_analytics_summary_handler))
        .route("/tvod", get(admin_list_tvod_handler))
        .route("/:id/refund", post(admin_refund_payment_handler));

    let tvod_router = Router::new()
        .route("/products", get(list_tvod_products_handler))
        .route("/purchases", get(list_user_tvod_purchases_handler))
        .route("/purchase", post(purchase_tvod_handler));

    Router::new()
        .nest("/api/v1/payments", public_router.clone())
        .nest("/api/payments", public_router.clone())
        .nest("/payments", public_router.clone())
        .nest("/api/v1/tvod", tvod_router.clone())
        .nest("/api/tvod", tvod_router.clone())
        .nest("/tvod", tvod_router)
        .nest("/api/v1/admin/payments", admin_router.clone())
        .nest("/api/admin/payments", admin_router.clone())
        .nest("/admin/payments", admin_router)
}

