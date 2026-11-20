use crate::service::NotificationService;
use axum::extract::{Path, Query, State};
use axum::response::Response;
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::security::Claims;
use maxx_core::AppState;
use serde::Deserialize;
use serde_json::{json, Value};

type AppResult<T> = Result<T, AppError>;

fn require_admin(claims: &Claims) -> AppResult<()> {
    if !claims.is_admin() {
        return Err(AppError::Forbidden("Admin privileges required".to_string()));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub limit: Option<u64>,
}

pub async fn list_history_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<HistoryQuery>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::list_history(&state, q.limit.unwrap_or(50)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_devices_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::list_registered_fcm_devices(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_config_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::get_channel_config(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn save_config_handler(
    State(state): State<AppState>,
    claims: Claims,
    channel: Option<Path<String>>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let ch = channel
        .map(|Path(c)| c)
        .or_else(|| {
            body.get("channel")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| "PUSH".to_string());
    let data = NotificationService::save_channel_config(&state, &ch, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_gateway_handler(
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let ch = body
        .get("channel")
        .and_then(|v| v.as_str())
        .unwrap_or("PUSH")
        .to_uppercase();
    let configured = match ch.as_str() {
        "PUSH" | "FCM" => std::env::var("FCM_SERVER_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false),
        "SMS" => std::env::var("MSG91_AUTH_KEY").map(|v| !v.trim().is_empty()).unwrap_or(false),
        "EMAIL" => std::env::var("SMTP_HOST").map(|v| !v.trim().is_empty()).unwrap_or(false),
        "WHATSAPP" => std::env::var("WHATSAPP_ACCESS_TOKEN").map(|v| !v.trim().is_empty()).unwrap_or(false),
        _ => false,
    };
    Ok(ApiResponse::ok_response(json!({
        "success": true,
        "channel": ch,
        "configured": configured,
        "status": if configured { "CONFIGURED" } else { "NOT_CONFIGURED_IN_ENV" }
    })))
}

pub async fn push_topic_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::send_notification(
        &state,
        "PUSH",
        body.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        body.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        body.get("topic")
            .or_else(|| body.get("targetAudience"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| Some("ALL".to_string())),
        None,
        body.get("imageUrl")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("actionUrl")
            .or_else(|| body.get("deepLinkUrl"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("scheduledAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        claims.email,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn push_user_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(user_id): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::send_notification(
        &state,
        "PUSH",
        body.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        body.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        None,
        Some(user_id),
        body.get("imageUrl")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("actionUrl")
            .or_else(|| body.get("deepLinkUrl"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("scheduledAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        claims.email,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn send_sms_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::send_notification(
        &state,
        "SMS",
        body.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("SMS Notification")
            .to_string(),
        body.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        body.get("targetAudience")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("phone")
            .or_else(|| body.get("userId"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        None,
        None,
        body.get("scheduledAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        claims.email,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn send_sms_template_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let mobile = body
        .get("phone")
        .or_else(|| body.get("mobile"))
        .or_else(|| body.get("mobileNumber"))
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let template_id = body
        .get("templateId")
        .or_else(|| body.get("template_id"))
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();
    let template_id = if template_id.is_empty() {
        std::env::var("MSG91_TRANSACTIONAL_TEMPLATE_ID").unwrap_or_default()
    } else {
        template_id
    };
    let mut vars = std::collections::BTreeMap::new();
    if let Some(obj) = body
        .get("variables")
        .or_else(|| body.get("vars"))
        .and_then(|v| v.as_object())
    {
        for (k, v) in obj {
            let value = match v {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                _ => v.to_string(),
            };
            vars.insert(k.clone(), value);
        }
    }
    let title = body.get("title").and_then(|v| v.as_str());
    let data = NotificationService::send_templated_sms(
        &state,
        mobile,
        &template_id,
        &vars,
        title,
        claims.email,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn send_whatsapp_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = NotificationService::send_notification(
        &state,
        "WHATSAPP",
        body.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("WhatsApp Notification")
            .to_string(),
        body.get("message")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        body.get("targetAudience")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("phone")
            .or_else(|| body.get("userId"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        body.get("imageUrl")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        None,
        body.get("scheduledAt")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        claims.email,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_my_notifications_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::Unauthorized("Invalid user token".to_string()))?;
    let data = NotificationService::get_user_notifications(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn unread_count_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::Unauthorized("Invalid user token".to_string()))?;
    let count = NotificationService::get_unread_count(&state, uid).await?;
    Ok(ApiResponse::ok_response(json!({ "unreadCount": count })))
}

pub async fn mark_read_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let uid = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::Unauthorized("Invalid user token".to_string()))?;
    let data = NotificationService::mark_as_read(&state, uid, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn mark_all_read_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::Unauthorized("Invalid user token".to_string()))?;
    let data = NotificationService::mark_all_as_read(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}
