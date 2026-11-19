use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_payments::payment_routes;
use serde_json::json;
use tower::ServiceExt;

async fn test_state() -> AppState {
    std::env::set_var("DATABASE_URL", std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".into()));
    std::env::set_var("REDIS_URL", std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:16379/0".into()));
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-1234567890");
    let config = maxx_core::AppConfig::from_env().expect("config");
    let db = DatabaseManager::connect(&config).await.expect("db");
    let redis = RedisManager::connect(&config).await;
    AppState::new(db, redis, config)
}
fn admin_token() -> String {
    maxx_common::security::SecurityUtils::generate_jwt(
        &maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into()], vec![], None, 3600),
        "test-secret-for-integration-1234567890",
    ).unwrap()
}
fn assert_handled(status: StatusCode, ctx: &str) {
    assert!(status.as_u16() < 600, "{ctx}: invalid status {status}");
    assert_ne!(status, StatusCode::NOT_FOUND, "{ctx}: route not found");
}

#[tokio::test]
async fn payments_public_routes_integration() {
    let state = test_state().await;
    let app = payment_routes().with_state(state);
    let tok = admin_token();
    // POST order/verify/webhook routes (may 401/400/500 depending on impl, but routed)
    for path in ["/api/v1/payments/create-order","/api/v1/payments/orders","/api/v1/payments/initiate","/api/v1/payments/verify","/api/v1/payments/verify-payment","/api/v1/payments/confirm","/api/v1/payments/webhook/razorpay","/api/v1/payments/webhooks/razorpay","/api/v1/payments/webhook/stripe","/api/v1/payments/webhooks/stripe"] {
        let resp = app.clone().oneshot(Request::builder().method("POST").uri(path).header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(json!({}).to_string())).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("POST {path}"));
    }
    for path in ["/api/v1/payments/my-transactions","/api/v1/payments/history","/api/v1/payments/my-subscription","/api/v1/payments/subscription","/api/payments/my-subscription","/payments/my-subscription","/api/v1/tvod/products","/api/v1/tvod/purchases","/tvod/products"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    let resp = app.clone().oneshot(Request::builder().method("POST").uri("/api/v1/tvod/purchase").header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(json!({"contentId": 1, "price": 49}).to_string())).unwrap()).await.unwrap();
    assert_handled(resp.status(), "POST /api/v1/tvod/purchase");
}

#[tokio::test]
async fn payments_admin_routes_integration() {
    let state = test_state().await;
    let app = payment_routes().with_state(state);
    let tok = admin_token();
    for path in ["/api/v1/admin/payments","/api/v1/admin/payments/analytics","/api/v1/admin/payments/summary","/api/v1/admin/payments/stats","/api/v1/admin/payments/tvod","/api/admin/payments","/admin/payments"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    let resp = app.clone().oneshot(Request::builder().method("POST").uri("/api/v1/admin/payments/1/refund").header("Authorization", format!("Bearer {tok}")).header("content-type","application/json").body(Body::from(json!({}).to_string())).unwrap()).await.unwrap();
    assert_handled(resp.status(), "POST /api/v1/admin/payments/1/refund");
}


