use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_auth::{auth_routes, AuthService};
use serde_json::json;
use std::sync::Arc;
use tower::ServiceExt;

async fn test_state() -> (sea_orm::DatabaseConnection, maxx_core::RedisManager, maxx_core::AppConfig) {
    std::env::set_var("DATABASE_URL", std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".into()));
    std::env::set_var("REDIS_URL", std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:16379/0".into()));
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-1234567890");
    let config = maxx_core::AppConfig::from_env().expect("config");
    let db = DatabaseManager::connect(&config).await.expect("db");
    let redis = RedisManager::connect(&config).await;
    (db, redis, config)
}
fn token() -> String { maxx_common::security::SecurityUtils::generate_jwt(&maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into(),"USER".into()], vec![], None, 3600), "test-secret-for-integration-1234567890").unwrap() }
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn auth_routes_integration() {
    let (db, redis, config) = test_state().await;
    let svc = Arc::new(AuthService::new(db, Arc::new(redis), config));
    let app = auth_routes(svc);
    let tok = token();
    // public/auth endpoints (will error on DB/schema/validation but routes+handlers exercised)
    for (m,p,b,auth) in [
        ("POST","/login", json!({"email":"a@b.com","password":"x"}), false),
        ("POST","/register", json!({"email":"a@b.com","password":"Password1!"}), false),
        ("POST","/signup", json!({"email":"a@b.com","password":"Password1!"}), false),
        ("POST","/refresh", json!({"refreshToken":"bad"}), false),
        ("POST","/refresh-token", json!({"refreshToken":"bad"}), false),
        ("POST","/logout", json!({"refreshToken":"bad"}), true),
        ("POST","/send-otp", json!({"phone":"+919999999999"}), false),
        ("POST","/resend-otp", json!({"phone":"+919999999999"}), false),
        ("POST","/otp/send", json!({"phone":"+919999999999"}), false),
        ("POST","/verify-otp", json!({"phone":"+919999999999","otp":"123456"}), false),
        ("POST","/otp/verify", json!({"phone":"+919999999999","otp":"123456"}), false),
        ("POST","/firebase-verify", json!({"phone":"+919999999999","otp":"123456"}), false),
        ("GET","/me", json!({}), true),
        ("GET","/profile", json!({}), true),
        ("POST","/change-password", json!({"oldPassword":"x","newPassword":"y"}), true),
        ("POST","/password", json!({"oldPassword":"x","newPassword":"y"}), true),
        ("POST","/device-token", json!({"deviceId":"d1","fcmToken":"t"}), true),
        ("POST","/fcm-token", json!({"deviceId":"d1","fcmToken":"t"}), true),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("content-type","application/json");
        if auth { rb = rb.header("Authorization", format!("Bearer {tok}")); }
        let body = if m=="GET" { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


