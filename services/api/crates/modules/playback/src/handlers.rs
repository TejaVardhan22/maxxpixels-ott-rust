use axum::{
    extract::{Path, Query, State},
    http::{header::AUTHORIZATION, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use maxx_common::{
    error::AppError,
    response::ApiResponse,
    security::SecurityUtils,
};

use crate::{
    dto::{AuthorizePlaybackRequest, HeartbeatRequest, StopPlaybackRequest},
    service::PlaybackService,
};

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeQuery {
    pub episode_id: Option<i64>,
    pub trailer: Option<String>,
    pub device_id: Option<String>,
}

fn extract_optional_user_id(headers: &HeaderMap) -> Option<i64> {
    let auth_header = headers.get(AUTHORIZATION)?.to_str().ok()?;
    let token = if auth_header.starts_with("Bearer ") || auth_header.starts_with("bearer ") {
        auth_header[7..].trim()
    } else {
        auth_header.trim()
    };
    if token.is_empty() {
        return None;
    }
    let jwt_secret = std::env::var("JWT_SECRET").ok()?;
    let claims = SecurityUtils::validate_jwt(token, &jwt_secret).ok()?;
    claims.sub.parse::<i64>().ok()
}

fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-forwarded-for")
        .and_then(|val| val.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|val| val.to_str().ok())
                .map(|s| s.to_string())
        })
}

pub async fn authorize_playback_handler(
    State(service): State<Arc<PlaybackService>>,
    headers: HeaderMap,
    Json(payload): Json<AuthorizePlaybackRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = extract_optional_user_id(&headers);
    let ip = extract_client_ip(&headers);
    let res = service.authorize_playback(user_id, payload, ip).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Playback authorized", 200)),
    ))
}

pub async fn authorize_playback_get_handler(
    State(service): State<Arc<PlaybackService>>,
    headers: HeaderMap,
    Path(content_id): Path<i64>,
    Query(query): Query<AuthorizeQuery>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = extract_optional_user_id(&headers);
    let ip = extract_client_ip(&headers);
    let req = AuthorizePlaybackRequest {
        content_id: Some(content_id),
        episode_id: query.episode_id,
        is_trailer: Some(query.trailer.as_deref() == Some("true")),
        device_id: query.device_id,
        ..Default::default()
    };
    let res = service.authorize_playback(user_id, req, ip).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Playback authorized", 200)),
    ))
}

pub async fn heartbeat_handler(
    State(service): State<Arc<PlaybackService>>,
    Json(payload): Json<HeartbeatRequest>,
) -> Result<impl IntoResponse, AppError> {
    service.record_heartbeat(payload).await?;
    let val = serde_json::json!({ "ok": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Heartbeat recorded", 200)),
    ))
}

pub async fn session_heartbeat_handler(
    State(service): State<Arc<PlaybackService>>,
    Path(session_id): Path<String>,
    Json(mut payload): Json<HeartbeatRequest>,
) -> Result<impl IntoResponse, AppError> {
    if payload.session_id.is_none() {
        payload.session_id = Some(session_id);
    }
    service.record_heartbeat(payload).await?;
    let val = serde_json::json!({ "ok": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Heartbeat recorded", 200)),
    ))
}

pub async fn stop_playback_handler(
    State(service): State<Arc<PlaybackService>>,
    Json(payload): Json<StopPlaybackRequest>,
) -> Result<impl IntoResponse, AppError> {
    service.stop_playback(payload).await?;
    let val = serde_json::json!({ "stopped": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Playback stopped", 200)),
    ))
}

pub async fn list_sessions_handler() -> Result<impl IntoResponse, AppError> {
    let empty: Vec<serde_json::Value> = Vec::new();
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(empty, "Sessions retrieved", 200)),
    ))
}

