use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::DatabaseManager;
use maxx_module_playback::{playback_routes, PlaybackService};
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
fn token() -> String {
    maxx_common::security::SecurityUtils::generate_jwt(
        &maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into(), "USER".into()], vec![], None, 3600),
        "test-secret-for-integration-1234567890",
    ).unwrap()
}
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn playback_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(PlaybackService::new(db));
    let app = playback_routes(svc);
    let tok = token();
    for path in ["/authorize","/sessions","/start","/init","/play","/heartbeat","/stop","/sessions/abc/heartbeat"] {
        let resp = app.clone().oneshot(Request::builder().method("POST").uri(path).header("content-type","application/json").header("Authorization", format!("Bearer {tok}")).body(Body::from(json!({"contentId":1}).to_string())).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("POST {path}"));
    }
    for path in ["/authorize/1","/stream/1"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
}


