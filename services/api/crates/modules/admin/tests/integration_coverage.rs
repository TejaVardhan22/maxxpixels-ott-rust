use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::{AppState, DatabaseManager, RedisManager};
use maxx_module_admin::admin_routes;
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
async fn admin_routes_integration_smoke() {
    let state = test_state().await;
    let app = admin_routes().with_state(state);
    let tok = token();
    // representative endpoints across settings/cms/banners/pages/legal/drm/devices/security/backup
    for (m,p,b) in [
        ("GET","/api/v1/settings",json!({})), ("GET","/api/v1/general_setting",json!({})), ("GET","/api/v1/admin/settings",json!({})),
        ("PUT","/api/v1/admin/settings",json!({})), ("GET","/api/v1/admin/settings/group/general",json!({})), ("GET","/api/v1/admin/settings/history",json!({})), ("POST","/api/v1/admin/settings/test-connection",json!({})),
        ("GET","/api/v1/cms/home",json!({})), ("GET","/api/v1/cms/pages/home",json!({})), ("GET","/api/v1/cms/pages/about",json!({})), ("GET","/api/v1/cms/banners",json!({})), ("GET","/api/v1/cms/sections",json!({})),
        ("GET","/api/v1/admin/cms/pages",json!({})), ("GET","/api/v1/admin/cms/sections",json!({})), ("POST","/api/v1/admin/cms/sections",json!({"title":"s"})), ("PUT","/api/v1/admin/cms/sections/1",json!({"title":"s"})), ("PATCH","/api/v1/admin/cms/sections/order",json!({"order":[]})), ("POST","/api/v1/admin/cms/sections/1/items",json!({})), ("DELETE","/api/v1/admin/cms/sections/1/items/1",json!({})), ("DELETE","/api/v1/admin/cms/sections/1",json!({})),
        ("GET","/api/v1/admin/banners",json!({})), ("POST","/api/v1/admin/banners",json!({"title":"b"})), ("PUT","/api/v1/admin/banners/1",json!({"title":"b"})), ("DELETE","/api/v1/admin/banners/1",json!({})),
        ("GET","/api/v1/pages",json!({})), ("GET","/api/v1/pages/home",json!({})), ("GET","/api/v1/pages/about",json!({})),
        ("GET","/api/v1/legal",json!({})), ("POST","/api/v1/admin/legal",json!({"slug":"terms","title":"T","content":"C"})), ("GET","/api/v1/legal/terms",json!({})), ("PUT","/api/v1/admin/legal/1",json!({"title":"U"})),
        ("GET","/api/v1/admin/drm/rules",json!({})), ("POST","/api/v1/admin/drm/rules",json!({"name":"r"})), ("PUT","/api/v1/admin/drm/rules/1",json!({"name":"r"})), ("DELETE","/api/v1/admin/drm/rules/1",json!({})),
        ("GET","/api/v1/admin/devices",json!({})), ("DELETE","/api/v1/admin/devices/1",json!({})), ("POST","/api/v1/admin/devices/1/revoke",json!({})), ("POST","/api/v1/admin/devices/user/1/disconnect-all",json!({})),
        ("GET","/api/v1/admin/security/roles",json!({})), ("POST","/api/v1/admin/security/roles",json!({"name":"R"})), ("DELETE","/api/v1/admin/security/roles/1",json!({})), ("GET","/api/v1/admin/security/settings",json!({})), ("PUT","/api/v1/admin/security/settings",json!({})),
        ("GET","/api/v1/admin/audit-logs",json!({})), ("GET","/api/v1/admin/backup",json!({})), ("GET","/api/v1/admin/backup/list",json!({})), ("POST","/api/v1/admin/backup/trigger",json!({})), ("POST","/api/v1/admin/backup/export",json!({})), ("POST","/api/v1/admin/backup/run",json!({})),
    ] {
        let mut rb = Request::builder().method(m).uri(p).header("Authorization", format!("Bearer {tok}"));
        if matches!(m,"POST"|"PUT"|"PATCH") { rb = rb.header("content-type","application/json"); }
        let body = if matches!(m,"GET"|"DELETE") { Body::empty() } else { Body::from(b.to_string()) };
        let resp = app.clone().oneshot(rb.body(body).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("{m} {p}"));
    }
}


