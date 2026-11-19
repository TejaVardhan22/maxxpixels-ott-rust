use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::DatabaseManager;
use maxx_module_watch_history::{watch_routes, watchlist_routes, WatchHistoryService};
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
        &maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["USER".into()], vec![], None, 3600),
        "test-secret-for-integration-1234567890",
    ).unwrap()
}
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn watch_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(WatchHistoryService::new(db, "http://localhost".into()));
    let app = watch_routes(svc);
    let tok = token();
    for path in ["/","/history","/continue-watching","/continue","/watchlist"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
    for (m,p,b) in [("POST","/history", json!({"contentId":1,"progress":10})), ("POST","/progress", json!({"contentId":1,"progress":10})), ("POST","/watchlist", json!({"contentId":1})), ("POST","/watchlist/1", json!({})), ("DELETE","/history/1", json!({})), ("DELETE","/watchlist/1", json!({}))] {
        let body = if m=="DELETE" { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}")).header("content-type","application/json").body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}

#[tokio::test]
async fn watchlist_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(WatchHistoryService::new(db, "http://localhost".into()));
    let app = watchlist_routes(svc);
    let tok = token();
    for (m,p,b) in [("GET","/", json!({})), ("POST","/", json!({"contentId":1})), ("DELETE","/", json!({"contentId":1})), ("POST","/1", json!({})), ("DELETE","/1", json!({}))] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if m!="GET" { rb = rb.header("content-type","application/json"); }
        let body = if m=="GET" || m=="DELETE" && p=="/1" { Body::empty() } else if m=="DELETE" { Body::from(b.to_string()) } else if m=="POST" { Body::from(b.to_string()) } else { Body::empty() };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


