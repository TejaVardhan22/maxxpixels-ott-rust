use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::DatabaseManager;
use maxx_module_users::{admin_users_routes, user_profile_routes, UsersService};
use serde_json::json;
use std::sync::Arc;
use tower::ServiceExt;

async fn test_db() -> sea_orm::DatabaseConnection {
    std::env::set_var("DATABASE_URL", std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".into()));
    std::env::set_var("REDIS_URL", std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:16379/0".into()));
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-1234567890");
    let config = maxx_core::AppConfig::from_env().expect("config");
    DatabaseManager::connect(&config).await.expect("db")
}
fn token() -> String { maxx_common::security::SecurityUtils::generate_jwt(&maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into(),"USER".into()], vec![], None, 3600), "test-secret-for-integration-1234567890").unwrap() }
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn user_profile_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(UsersService::new(db));
    let app = user_profile_routes(svc);
    let tok = token();
    for (m,p,b) in [("PUT","/me", json!({"fullName":"Test"})), ("PUT","/profile", json!({"fullName":"Test"})), ("GET","/profiles", json!({})), ("POST","/profiles", json!({"name":"Kid"})), ("GET","/devices", json!({})), ("DELETE","/devices/dev1", json!({}))] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if matches!(m,"PUT"|"POST") { rb = rb.header("content-type","application/json"); }
        let body = if matches!(m,"GET"|"DELETE") { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}

#[tokio::test]
async fn admin_users_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(UsersService::new(db));
    let app = admin_users_routes(svc);
    let tok = token();
    for (m,p,b) in [("GET","/", json!({})), ("GET","/1", json!({})), ("PATCH","/1/status", json!({"status":"ACTIVE"})), ("POST","/1/block", json!({})), ("POST","/1/unblock", json!({})), ("POST","/1/reset-password", json!({"password":"x"})), ("POST","/1/password", json!({"password":"x"}))] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if matches!(m,"PATCH"|"POST") { rb = rb.header("content-type","application/json"); }
        let body = if m=="GET" { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


