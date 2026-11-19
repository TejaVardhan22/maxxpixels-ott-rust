use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_advertising::advertising_routes;
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
fn token() -> String { maxx_common::security::SecurityUtils::generate_jwt(&maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into()], vec![], None, 3600), "test-secret-for-integration-1234567890").unwrap() }
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn advertising_routes_integration() {
    let state = test_state().await;
    let app = advertising_routes().with_state(state);
    let tok = token();
    // public ads routes
    for (m,p,b) in [
        ("GET","/api/v1/ads/config/1",json!({})), ("GET","/api/v1/ads/campaigns",json!({})), ("GET","/api/v1/ads/revenue",json!({})),
        ("GET","/api/v1/ads/vast",json!({})), ("GET","/api/v1/ads/vast.xml",json!({})), ("GET","/api/v1/ads/queue",json!({})),
        ("GET","/api/v1/ads/track/impression/1",json!({})), ("GET","/api/v1/ads/track/click/1",json!({})),
        ("POST","/api/v1/ads/session",json!({})), ("POST","/api/v1/ads/sessions",json!({})), ("POST","/api/v1/ads/events",json!({})), ("POST","/api/v1/ads/track",json!({})),
        ("GET","/ads.txt",json!({})), ("GET","/app-ads.txt",json!({})),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if m=="POST" { rb = rb.header("content-type","application/json"); }
        let body = if m=="POST" { Body::from(b.to_string()) } else { Body::empty() };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
    // admin + producer representative endpoints (routed; may require auth/schema)
    for (m,p,b) in [
        ("GET","/api/v1/admin/ads/providers",json!({})), ("POST","/api/v1/admin/ads/providers",json!({"name":"p"})), ("PUT","/api/v1/admin/ads/providers/1",json!({"name":"p"})),
        ("GET","/api/v1/admin/ads/placements",json!({})), ("POST","/api/v1/admin/ads/placements",json!({"name":"pl"})), ("PUT","/api/v1/admin/ads/placements/1",json!({"name":"pl"})),
        ("GET","/api/v1/admin/ads",json!({})), ("POST","/api/v1/admin/ads",json!({"name":"c"})), ("GET","/api/v1/admin/ads/1",json!({})), ("PUT","/api/v1/admin/ads/1",json!({"name":"c"})), ("POST","/api/v1/admin/ads/1/toggle",json!({})), ("DELETE","/api/v1/admin/ads/1",json!({})),
        ("GET","/api/v1/admin/producers",json!({})), ("GET","/api/v1/admin/producers/list",json!({})), ("GET","/api/v1/admin/producers/submissions",json!({})), ("GET","/api/v1/admin/content/submissions",json!({})),
        ("POST","/api/v1/admin/producers/onboard",json!({})), ("POST","/api/v1/admin/producers/onboardings/1/review",json!({})), ("POST","/api/v1/admin/producers/1/toggle-status",json!({})), ("POST","/api/v1/admin/producers/1/reset-password",json!({})), ("GET","/api/v1/admin/producers/1",json!({})), ("PUT","/api/v1/admin/producers/1",json!({})), ("DELETE","/api/v1/admin/producers/1",json!({})),
        ("POST","/api/v1/producer/register",json!({})), ("GET","/api/v1/producer/profile",json!({})), ("POST","/api/v1/producer/kyc/documents",json!({})), ("GET","/api/v1/producer/agreement",json!({})), ("POST","/api/v1/producer/agreement/upload",json!({})),
        ("GET","/api/v1/producer/analytics/movies",json!({})), ("GET","/api/v1/producer/analytics/dashboard",json!({})), ("GET","/api/v1/producer/analytics/ad-breakdown",json!({})), ("GET","/api/v1/producer/submissions",json!({})), ("POST","/api/v1/producer/submissions",json!({})),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if matches!(m,"POST"|"PUT") { rb = rb.header("content-type","application/json"); }
        let body = if matches!(m,"GET"|"DELETE") { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


