use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use maxx_common::{
    error::AppError,
    response::ApiResponse,
    security::Claims,
};

use crate::{
    dto::{SaveProgressRequest, WatchlistToggleRequest},
    service::WatchHistoryService,
};

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WatchQuery {
    pub profile_id: Option<i64>,
    pub limit: Option<u64>,
    pub content_id: Option<i64>,
}

fn parse_user_id(claims: &Claims) -> Result<i64, AppError> {
    claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))
}

pub async fn get_continue_watching_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    Query(query): Query<WatchQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_continue_watching(user_id, query.profile_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Continue watching retrieved", 200)),
    ))
}

pub async fn get_watch_history_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    Query(query): Query<WatchQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_watch_history(user_id, query.limit).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Watch history retrieved", 200)),
    ))
}

pub async fn save_progress_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    Json(payload): Json<SaveProgressRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.save_watch_progress(user_id, payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Watch progress saved", 200)),
    ))
}

pub async fn remove_history_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    service.remove_watch_progress(user_id, id).await?;
    let val = serde_json::json!({ "removed": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Watch history item removed", 200)),
    ))
}

pub async fn get_watchlist_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_watchlist(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Watchlist retrieved", 200)),
    ))
}

pub async fn toggle_watchlist_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    param_id: Option<Path<i64>>,
    payload: Option<Json<WatchlistToggleRequest>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let content_id = param_id
        .map(|p| p.0)
        .or_else(|| payload.as_ref().and_then(|p| p.content_id))
        .ok_or_else(|| AppError::BadRequest("contentId is required".to_string()))?;
    let profile_id = payload.and_then(|p| p.0.profile_id);
    let res = service.toggle_watchlist(user_id, content_id, profile_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Watchlist updated", 200)),
    ))
}

pub async fn remove_watchlist_handler(
    claims: Claims,
    State(service): State<Arc<WatchHistoryService>>,
    param_id: Option<Path<i64>>,
    Query(query): Query<WatchQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let content_id = param_id
        .map(|p| p.0)
        .or(query.content_id)
        .ok_or_else(|| AppError::BadRequest("contentId is required".to_string()))?;
    service.remove_from_watchlist(user_id, content_id).await?;
    let val = serde_json::json!({ "removed": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Removed from watchlist", 200)),
    ))
}

