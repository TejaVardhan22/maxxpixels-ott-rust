use crate::service::AnalyticsService;
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::Response;
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::security::{Claims, SecurityUtils};
use maxx_core::AppState;
use serde_json::Value;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_stream::wrappers::IntervalStream;
use tokio_stream::StreamExt;

type AppResult<T> = Result<T, AppError>;

fn extract_optional_user_id(headers: &HeaderMap, state: &AppState) -> Option<i64> {
    let auth_header = headers.get("authorization").and_then(|v| v.to_str().ok())?;
    let token = auth_header
        .strip_prefix("Bearer ")
        .unwrap_or(auth_header)
        .trim();
    if token.is_empty() {
        return None;
    }
    let claims = SecurityUtils::validate_jwt(token, &state.config.jwt_secret).ok()?;
    claims.sub.parse::<i64>().ok()
}

pub async fn get_overview_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Response> {
    let timeframe = params.get("timeframe").map(|s| s.as_str());
    let data = AnalyticsService::get_dashboard_overview(&state, timeframe).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_realtime_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    let data = AnalyticsService::get_realtime_stream_telemetry(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_ops_chat_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Response> {
    let room = params.get("room").map(|s| s.as_str());
    let data = AnalyticsService::list_ops_chat_messages(&state, room).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn post_ops_chat_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let sender_id = claims.sub.parse::<i64>().ok();
    let sender_name = claims
        .email
        .as_deref()
        .and_then(|e| e.split('@').next())
        .filter(|s| !s.is_empty())
        .unwrap_or("Admin");
    let role = if claims.roles.iter().any(|r| r.to_uppercase().contains("SUPER")) {
        "SuperAdmin"
    } else {
        "Admin"
    };
    let data = AnalyticsService::post_ops_chat_message(&state, sender_id, sender_name, role, body).await?;
    Ok(ApiResponse::ok_response(data))
}

/// Server-sent events stream for live view/watch counters.
///
/// EventSource cannot attach an Authorization header, so the JWT is accepted as
/// a short-lived query parameter on this route only. It is validated with the
/// same secret as the header-based admin analytics endpoints.
pub async fn live_analytics_stream_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>> {
    let token = params
        .get("token")
        .or_else(|| params.get("access_token"))
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::Unauthorized("Missing access token".to_string()))?;

    SecurityUtils::validate_jwt(token, &state.config.jwt_secret)
        .map_err(|e| AppError::Unauthorized(format!("Invalid or expired token: {e}")))?;

    let last_version = Arc::new(AtomicI64::new(-1));
    let stream_state = state.clone();
    let stream = IntervalStream::new(tokio::time::interval(Duration::from_secs(1))).then(
        move |_| {
            let state = stream_state.clone();
            let last_version = last_version.clone();
            async move {
                let version = maxx_core::realtime::analytics_version().await;
                if last_version.swap(version, Ordering::SeqCst) == version {
                    return Ok(Event::default().comment("keepalive"));
                }
                match AnalyticsService::get_live_counters(&state).await {
                    Ok(counters) => {
                        Ok(Event::default().event("counters").data(counters.to_string()))
                    }
                    Err(err) => Ok(Event::default()
                        .event("error")
                        .data(format!("Counter refresh failed: {err}"))),
                }
            }
        },
    );

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    ))
}

pub async fn record_event_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state);
    let data = AnalyticsService::record_interaction(&state, uid, body).await?;
    Ok(ApiResponse::ok_response(data))
}

