use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_content::{content_routes, router::admin_movies_write_routes};
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
async fn content_routes_integration() {
    let state = test_state().await;
    let app = content_routes().with_state(state);
    let tok = token();
    // movies admin
    for (m,p,b) in [
        ("GET","/api/v1/admin/movies", json!({})), ("POST","/api/v1/admin/movies", json!({"title":"T"})),
        ("GET","/api/v1/admin/movies/1", json!({})), ("PUT","/api/v1/admin/movies/1", json!({"title":"U"})),
        ("PATCH","/api/v1/admin/movies/1/status", json!({"status":"PUBLISHED"})), ("DELETE","/api/v1/admin/movies/1", json!({})),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if m!="GET" && m!="DELETE" { rb = rb.header("content-type","application/json"); }
        let body = if m=="GET" || m=="DELETE" { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
    // series/seasons/episodes/live/storage/media (smoke)
    for (m,p,b) in [
        ("GET","/api/v1/admin/series", json!({})), ("POST","/api/v1/admin/series", json!({"title":"S"})),
        ("GET","/api/v1/admin/series/1", json!({})), ("PUT","/api/v1/admin/series/1", json!({"title":"S2"})),
        ("GET","/api/v1/admin/series/1/seasons", json!({})), ("POST","/api/v1/admin/series/1/seasons", json!({"seasonNumber":1})),
        ("GET","/api/v1/admin/series/1/seasons/1/episodes", json!({})), ("POST","/api/v1/admin/series/1/seasons/1/episodes", json!({"title":"E"})),
        ("DELETE","/api/v1/admin/series/1/seasons/1/episodes/1", json!({})), ("DELETE","/api/v1/admin/series/1/seasons/1", json!({})), ("DELETE","/api/v1/admin/series/1", json!({})),
        ("GET","/api/v1/live/channels", json!({})), ("POST","/api/v1/live/channels", json!({"name":"C"})), ("DELETE","/api/v1/live/channels/1", json!({})),
        ("GET","/api/v1/live/events", json!({})), ("POST","/api/v1/live/events", json!({"title":"E"})), ("DELETE","/api/v1/live/events/1", json!({})),
        ("POST","/api/v1/admin/storage/upload", json!({})), ("POST","/api/v1/admin/storage/upload-video", json!({})),
        ("GET","/uploads/img/a.png", json!({})), ("GET","/posters/a.png", json!({})), ("GET","/banners/a.png", json!({})),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if matches!(m,"POST"|"PUT"|"PATCH") { rb = rb.header("content-type","application/json"); }
        let body = if matches!(m,"GET"|"DELETE") { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}

#[tokio::test]
async fn content_write_routes_integration() {
    let state = test_state().await;
    let app = admin_movies_write_routes().with_state(state);
    let tok = token();
    for (m,p,b) in [("POST","/", json!({"title":"T"})), ("PUT","/1", json!({"title":"U"})), ("DELETE","/1", json!({}))] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if m!="DELETE" { rb = rb.header("content-type","application/json"); }
        let body = if m=="DELETE" { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


