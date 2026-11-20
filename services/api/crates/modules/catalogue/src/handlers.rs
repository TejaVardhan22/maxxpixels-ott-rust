use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use maxx_common::{
    error::AppError,
    response::ApiResponse,
    security::Claims,
};

use crate::{dto::CatalogBrowseQuery, service::CatalogueService};

pub async fn browse_catalog_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Catalog retrieved successfully", 200)),
    ))
}

pub async fn browse_movies_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.content_type = Some("MOVIE".to_string());
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Movies retrieved successfully", 200)),
    ))
}

pub async fn browse_series_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.content_type = Some("SERIES".to_string());
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Series retrieved successfully", 200)),
    ))
}

pub async fn get_trending_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.trending = Some("true".to_string());
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Trending content retrieved", 200)),
    ))
}

pub async fn get_shorts_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.content_type = Some("SHORT".to_string());
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Shorts retrieved successfully", 200)),
    ))
}

pub async fn get_featured_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.featured = Some("true".to_string());
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Featured content retrieved", 200)),
    ))
}

pub async fn get_by_language_handler(
    State(service): State<Arc<CatalogueService>>,
    Path(language): Path<String>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.language = Some(language);
    if query.size.is_none() {
        query.size = Some(50);
    }
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Content by language retrieved", 200)),
    ))
}

pub async fn get_non_kannada_handler(
    State(service): State<Arc<CatalogueService>>,
    Query(mut query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    query.language = Some("non-kannada".to_string());
    if query.size.is_none() {
        query.size = Some(50);
    }
    let res = service.browse_catalog(query, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Non-Kannada content retrieved", 200)),
    ))
}

pub async fn get_metadata_handler(
    State(service): State<Arc<CatalogueService>>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_public_metadata().await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Metadata retrieved successfully", 200)),
    ))
}

pub async fn get_languages_handler(
    State(service): State<Arc<CatalogueService>>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_public_metadata().await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res.languages, "Languages retrieved", 200)),
    ))
}

pub async fn get_categories_handler(
    State(service): State<Arc<CatalogueService>>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_public_metadata().await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res.categories, "Categories retrieved", 200)),
    ))
}

pub async fn get_genres_handler(
    State(service): State<Arc<CatalogueService>>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_public_metadata().await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res.genres, "Genres retrieved", 200)),
    ))
}

pub async fn get_content_types_handler(
    State(service): State<Arc<CatalogueService>>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_public_metadata().await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res.content_types, "Content types retrieved", 200)),
    ))
}

pub async fn get_content_detail_handler(
    State(service): State<Arc<CatalogueService>>,
    Path(id_or_slug): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.get_content_detail(&id_or_slug, false).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Content detail retrieved", 200)),
    ))
}

pub async fn get_content_by_category_handler(
    State(service): State<Arc<CatalogueService>>,
    Path(id_or_slug): Path<String>,
    Query(query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.browse_by_category(&id_or_slug, query).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Category content retrieved successfully", 200)),
    ))
}

pub async fn admin_list_movies_handler(
    claims: Claims,
    State(service): State<Arc<CatalogueService>>,
    Query(query): Query<CatalogBrowseQuery>,
) -> Result<impl IntoResponse, AppError> {
    if !claims.is_admin() && !claims.has_role("CONTENT_MANAGER") && !claims.has_role("PRODUCER") {
        return Err(AppError::Forbidden("Admin or Producer privileges required".to_string()));
    }
    let res = service.browse_catalog(query, true).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Movies retrieved successfully", 200)),
    ))
}

pub async fn admin_get_movie_handler(
    claims: Claims,
    State(service): State<Arc<CatalogueService>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    if !claims.is_admin() && !claims.has_role("CONTENT_MANAGER") && !claims.has_role("PRODUCER") {
        return Err(AppError::Forbidden("Admin or Producer privileges required".to_string()));
    }
    let res = service.get_content_detail(&id, true).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Movie retrieved successfully", 200)),
    ))
}

