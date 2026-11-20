use axum::{routing::get, Router};
use std::sync::Arc;

use crate::{
    handlers::{
        admin_get_movie_handler, admin_list_movies_handler, browse_catalog_handler,
        browse_movies_handler, browse_series_handler, get_by_language_handler,
        get_categories_handler, get_content_by_category_handler, get_content_detail_handler,
        get_content_types_handler, get_featured_handler, get_genres_handler, get_languages_handler,
        get_metadata_handler, get_non_kannada_handler, get_shorts_handler, get_trending_handler,
    },
    service::CatalogueService,
};

pub fn catalog_routes(service: Arc<CatalogueService>) -> Router {
    Router::new()
        .route("/", get(browse_catalog_handler))
        .route("/content", get(browse_catalog_handler))
        .route("/movies", get(browse_movies_handler))
        .route("/series", get(browse_series_handler))
        .route("/trending", get(get_trending_handler))
        .route("/featured", get(get_featured_handler))
        .route("/shorts", get(get_shorts_handler))
        .route("/search", get(browse_catalog_handler))
        .route("/non-kannada", get(get_non_kannada_handler))
        .route("/metadata", get(get_metadata_handler))
        .route("/languages", get(get_languages_handler))
        .route("/categories", get(get_categories_handler))
        .route("/genres", get(get_genres_handler))
        .route("/content-types", get(get_content_types_handler))
        .route("/by-language/:language", get(get_by_language_handler))
        .route("/content/id/:id", get(get_content_detail_handler))
        .route("/content/:id_or_slug", get(get_content_detail_handler))
        .route("/id/:id", get(get_content_detail_handler))
        .route("/:id_or_slug", get(get_content_detail_handler))
        .with_state(service)
}

pub fn admin_movies_routes(service: Arc<CatalogueService>) -> Router {
    Router::new()
        .route("/", get(admin_list_movies_handler))
        .route("/:id", get(admin_get_movie_handler))
        .with_state(service)
}

pub fn taxonomy_routes(service: Arc<CatalogueService>) -> Router {
    Router::new()
        .route("/api/v1/languages", get(get_languages_handler))
        .route("/api/languages", get(get_languages_handler))
        .route("/api/v1/categories", get(get_categories_handler))
        .route("/api/categories", get(get_categories_handler))
        .route("/api/v1/admin/categories", get(get_categories_handler))
        .route("/api/v1/categories/:id_or_slug/content", get(get_content_by_category_handler))
        .route("/api/v1/categories/:id_or_slug", get(get_content_by_category_handler))
        .route("/api/v1/categories/:id_or_slug/movies", get(get_content_by_category_handler))
        .route("/api/categories/:id_or_slug/content", get(get_content_by_category_handler))
        .route("/api/categories/:id_or_slug", get(get_content_by_category_handler))
        .route("/api/categories/:id_or_slug/movies", get(get_content_by_category_handler))
        .route("/categories/:id_or_slug/content", get(get_content_by_category_handler))
        .route("/categories/:id_or_slug", get(get_content_by_category_handler))
        .route("/categories/:id_or_slug/movies", get(get_content_by_category_handler))
        .route("/api/v1/genres", get(get_genres_handler))
        .route("/api/genres", get(get_genres_handler))
        .route("/api/v1/content-types", get(get_content_types_handler))
        .route("/api/content-types", get(get_content_types_handler))
        .route("/api/v1/search", get(browse_catalog_handler))
        .route("/api/search", get(browse_catalog_handler))
        .with_state(service)
}

