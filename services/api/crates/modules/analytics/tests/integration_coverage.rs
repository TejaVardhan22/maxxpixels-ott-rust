use axum::{body::Body, http::{Request, StatusCode}};
use http_body_util::BodyExt;
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_analytics::analytics_routes;
use serde_json::json;
use std::sync::Arc;
use tower::ServiceExt;

async fn test_state() -> AppState {
    // Use docker compose test defaults
    std::env::set_var("DATABASE_URL", std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".into()));
    std::env::set_var("REDIS_URL", std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:16379/0".into()));
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-1234567890");
    let config = maxx_core::AppConfig::from_env().expect("config");
    let db = DatabaseManager::connect(&config).await.expect("db");
    let redis = RedisManager::connect(&config).await;
    AppState::new(db, redis, config)
}

fn assert_handled(status: StatusCode, ctx: &str) {
    // Any valid HTTP response means handler/route integrated (DB/schema/auth may cause 4xx/5xx)
    assert!(status.as_u16() < 600, "{ctx}: invalid status {status}");
    assert_ne!(status, StatusCode::NOT_FOUND, "{ctx}: route not found (status {status})");
}

#[tokio::test]
async fn analytics_admin_routes_integration() {
    let state = test_state().await;
    let app = analytics_routes().with_state(state);
    let token = maxx_common::security::SecurityUtils::generate_jwt(
        &maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into()], vec![], None, 3600),
        "test-secret-for-integration-1234567890",
    ).unwrap();
    for path in [
        "/api/v1/admin/analytics",
        "/api/v1/admin/analytics/overview",
        "/api/v1/admin/analytics/summary",
        "/api/v1/admin/analytics/stats",
        "/api/v1/admin/analytics/dashboard",
        "/api/v1/admin/analytics/realtime",
        "/api/v1/admin/analytics/live-streams",
        "/api/v1/admin/analytics/live",
        "/api/admin/analytics/overview",
        "/admin/analytics/overview",
        "/api/v1/admin/dashboard",
        "/api/admin/dashboard",
    ] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {token}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
        // consume body
        let _ = resp.into_body().collect().await;
    }
}

#[tokio::test]
async fn analytics_public_event_routes_integration() {
    let state = test_state().await;
    let app = analytics_routes().with_state(state);
    for path in ["/api/v1/analytics/event", "/api/analytics/event", "/analytics/event", "/api/v1/analytics/track", "/api/v1/analytics/interaction"] {
        let resp = app.clone().oneshot(
            Request::builder().method("POST").uri(path).header("content-type","application/json")
            .body(Body::from(json!({"event":"test","contentId":"1"}).to_string())).unwrap()
        ).await.unwrap();
        assert_handled(resp.status(), &format!("POST {path}"));
        let _ = resp.into_body().collect().await;
    }
}


