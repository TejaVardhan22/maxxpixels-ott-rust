use axum::{body::Body, http::{Request, StatusCode}};
use maxx_core::DatabaseManager;
use maxx_module_catalogue::{admin_movies_routes, catalog_routes, taxonomy_routes, CatalogueService};
use std::sync::Arc;
use tower::ServiceExt;

async fn test_db() -> sea_orm::DatabaseConnection {
    std::env::set_var("DATABASE_URL", std::env::var("TEST_DATABASE_URL").unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:15432/maxxpixels_ott".into()));
    std::env::set_var("REDIS_URL", std::env::var("TEST_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:16379/0".into()));
    std::env::set_var("JWT_SECRET", "test-secret-for-integration-1234567890");
    let config = maxx_core::AppConfig::from_env().expect("config");
    DatabaseManager::connect(&config).await.expect("db")
}
fn token() -> String { maxx_common::security::SecurityUtils::generate_jwt(&maxx_common::security::Claims::new("1".to_string(), Some("admin@maxxpixels.com".into()), None, Some("Admin".into()), vec!["ADMIN".into()], vec![], None, 3600), "test-secret-for-integration-1234567890").unwrap() }
fn assert_handled(status: StatusCode, ctx: &str) { assert!(status.as_u16() < 600 && status != StatusCode::NOT_FOUND, "{ctx}: {status}"); }

#[tokio::test]
async fn catalogue_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(CatalogueService::new(db, "http://localhost".into()));
    let app = catalog_routes(svc);
    let tok = token();
    for path in ["/","/content","/movies","/series","/trending","/featured","/search","/non-kannada","/metadata","/languages","/categories","/genres","/content-types","/by-language/en","/content/id/1","/content/test-slug","/id/1","/test-slug"] {
        let resp = app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET {path}"));
    }
}

#[tokio::test]
async fn catalogue_admin_and_taxonomy_routes_integration() {
    let db = test_db().await;
    let svc = Arc::new(CatalogueService::new(db, "http://localhost".into()));
    let admin_app = admin_movies_routes(svc.clone());
    let tax_app = taxonomy_routes(svc);
    let tok = token();
    for path in ["/","/1"] {
        let resp = admin_app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET admin_movies {path}"));
    }
    for path in ["/api/v1/languages","/api/languages","/api/v1/categories","/api/categories","/api/v1/admin/categories","/api/v1/genres","/api/genres","/api/v1/content-types","/api/content-types","/api/v1/search","/api/search","/api/v1/content/non-kannada","/api/content/non-kannada","/api/v1/content/by-language/en","/api/content/by-language/en"] {
        let resp = tax_app.clone().oneshot(Request::builder().uri(path).header("Authorization", format!("Bearer {tok}")).body(Body::empty()).unwrap()).await.unwrap();
        assert_handled(resp.status(), &format!("GET taxonomy {path}"));
    }
}


