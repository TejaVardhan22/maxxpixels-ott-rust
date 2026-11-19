use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_notifications::notification_routes;
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
async fn notifications_routes_integration() {
    let state = test_state().await;
    let app = notification_routes().with_state(state);
    let tok = token();
    // user routes
    for path in ["/api/v1/notifications/my","/api/notifications/my","/notifications/my"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    for (method,path,body) in [("POST","/api/v1/notifications/1/read", json!({}))] {
        let resp = app.clone().oneshot(Request::builder().method(method).uri(path).header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(body.to_string())).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{method} {path}"));
    }
    // admin routes
    for path in ["/api/v1/admin/notifications/history","/api/v1/admin/notifications/devices","/api/v1/admin/notifications/config","/api/admin/notifications/history","/admin/notifications/history"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    for (method,path,body) in [
        ("POST","/api/v1/admin/notifications/config", json!({"channel":"sms"})),
        ("POST","/api/v1/admin/notifications/config/sms", json!({})),
        ("POST","/api/v1/admin/notifications/test", json!({})),
        ("POST","/api/v1/admin/notifications/push/topic", json!({"topic":"t"})),
        ("POST","/api/v1/admin/notifications/push/user/1", json!({"title":"t"})),
        ("POST","/api/v1/admin/notifications/sms/send", json!({"to":"x"})),
        ("POST","/api/v1/admin/notifications/sms/bulk", json!({"to":["x"]})),
        ("POST","/api/v1/admin/notifications/whatsapp/send", json!({"to":"x"})),
        ("POST","/api/v1/admin/notifications/whatsapp/bulk", json!({"to":["x"]})),
    ] {
        let resp = app.clone().oneshot(Request::builder().method(method).uri(path).header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(body.to_string())).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{method} {path}"));
    }
}


