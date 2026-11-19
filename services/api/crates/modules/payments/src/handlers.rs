use crate::dto::{AdminPaymentListQuery, AdminTvodListQuery};
use crate::service::PaymentService;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::security::{Claims, SecurityUtils};
use maxx_core::AppState;
use serde_json::Value;

type AppResult<T> = Result<T, AppError>;

fn extract_optional_user_id(headers: &HeaderMap, state: &AppState) -> Option<i64> {
    let auth_header = headers.get("authorization").and_then(|v| v.to_str().ok())?;
    let token = auth_header.strip_prefix("Bearer ").unwrap_or(auth_header).trim();
    if token.is_empty() {
        return None;
    }
    let claims = SecurityUtils::validate_jwt(token, &state.config.jwt_secret).ok()?;
    claims.sub.parse::<i64>().ok()
}

pub async fn create_order_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state)
        .or_else(|| {
            body.get("userId")
                .or_else(|| body.get("user_id"))
                .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
        })
        .ok_or_else(|| {
            AppError::Unauthorized("Authentication required to create a payment order".to_string())
        })?;

    let data = PaymentService::create_order(&state, uid, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn verify_payment_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state).or_else(|| {
        body.get("userId")
            .or_else(|| body.get("user_id"))
            .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
    });

    let data = PaymentService::verify_payment(&state, uid, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_my_transactions_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let data = PaymentService::get_user_transactions(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_my_subscription_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let data = PaymentService::get_user_active_subscription(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn razorpay_webhook_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    raw_body: String,
) -> AppResult<Response> {
    let sig = headers
        .get("x-razorpay-signature")
        .and_then(|v| v.to_str().ok());
    let payload: Value = serde_json::from_str(&raw_body).unwrap_or(Value::Null);
    let data = PaymentService::handle_webhook(&state, "RAZORPAY", &raw_body, sig, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn stripe_webhook_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    raw_body: String,
) -> AppResult<Response> {
    let sig = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok());
    let payload: Value = serde_json::from_str(&raw_body).unwrap_or(Value::Null);
    let data = PaymentService::handle_webhook(&state, "STRIPE", &raw_body, sig, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_transactions_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<AdminPaymentListQuery>,
) -> AppResult<Response> {
    let data = PaymentService::list_admin_transactions(&state, &query).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_analytics_summary_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    let data = PaymentService::get_payment_analytics_summary(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_tvod_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<AdminTvodListQuery>,
) -> AppResult<Response> {
    let data = PaymentService::list_admin_tvod_purchases(&state, &query).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_refund_payment_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let reason = body
        .get("reason")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let data = PaymentService::refund_payment(&state, id, reason).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_tvod_products_handler(
    State(state): State<AppState>,
) -> AppResult<Response> {
    let data = PaymentService::list_tvod_products(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_user_tvod_purchases_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state).unwrap_or(0);
    let data = PaymentService::list_user_tvod_purchases(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn purchase_tvod_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state)
        .or_else(|| {
            body.get("userId")
                .or_else(|| body.get("user_id"))
                .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse().ok())))
        })
        .ok_or_else(|| {
            AppError::Unauthorized("Authentication required for TVOD purchase".to_string())
        })?;

    let data = PaymentService::purchase_tvod_direct(&state, uid, &body).await?;
    Ok(ApiResponse::ok_response(data))
}
