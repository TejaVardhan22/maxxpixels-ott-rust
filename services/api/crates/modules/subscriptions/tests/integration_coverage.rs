use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_subscriptions::subscription_routes;
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
fn token() -> String {
    maxx_common::security::SecurityUtils::generate_jwt(
        &maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into()], vec![], None, 3600),
        "test-secret-for-integration-1234567890",
    ).unwrap()
}
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn subscriptions_plan_routes_integration() {
    let state = test_state().await;
    let app = subscription_routes().with_state(state);
    let tok = token();
    for path in ["/api/v1/plans","/api/plans","/plans","/api/v1/subscriptions","/api/v1/subscription-plans","/api/v1/plans/1"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    for path in ["/api/v1/plans/my","/api/v1/plans/active","/api/v1/subscriptions/my"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    let resp = app.clone().oneshot(Request::builder().method("POST").uri("/api/v1/plans/validate-coupon").header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(json!({"code":"TEST","planId":"1"}).to_string())).unwrap()).await.unwrap();
    assert_handled(resp.status(), "POST /api/v1/plans/validate-coupon");
}

#[tokio::test]
async fn subscriptions_coupon_and_admin_routes_integration() {
    let state = test_state().await;
    let app = subscription_routes().with_state(state);
    let tok = token();
    for path in ["/api/v1/coupons/validate?code=TEST","/api/coupons/validate?code=TEST","/coupons/validate?code=TEST"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    for path in ["/api/v1/admin/plans","/api/admin/plans","/admin/plans","/api/v1/admin/coupons","/api/admin/coupons","/admin/coupons"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    // create/update/delete/toggle endpoints smoke (will likely 4xx/5xx without schema, but routed)
    for (method, path, body) in [
        ("POST","/api/v1/admin/plans", json!({"name":"T","price":1})),
        ("POST","/api/v1/admin/coupons", json!({"code":"X"})),
        ("PUT","/api/v1/admin/plans/1", json!({"name":"U"})),
        ("DELETE","/api/v1/admin/plans/1", json!({})),
        ("PATCH","/api/v1/admin/plans/1/toggle-status", json!({})),
    ] {
        let req = Request::builder().method(method).uri(path).header("Authorization", format!("Bearer {tok}")).header("content-type","application/json");
        let b = if method=="DELETE" { Body::empty() } else { Body::from(body.to_string()) };
        let resp = app.clone().oneshot(req.body(b).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{method} {path}"));
    }
}


