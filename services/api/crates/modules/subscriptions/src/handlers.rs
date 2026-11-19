use crate::dto::{AdminListQuery, ListPlansQuery, ValidateCouponRequest};
use crate::service::SubscriptionService;
use axum::extract::{Path, Query, State};
use axum::http::HeaderMap;
use axum::response::Response;
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::security::{Claims, SecurityUtils};
use maxx_common::validation::Validatable;
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

pub async fn list_plans_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListPlansQuery>,
) -> AppResult<Response> {
    let only_active = query.active.as_deref() != Some("false");
    let uid = extract_optional_user_id(&headers, &state)
        .or(query.user_id)
        .or(query.user_id_camel);
    let data = SubscriptionService::list_plans(&state, only_active, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_my_subscriptions_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let data = SubscriptionService::get_user_subscriptions(&state, uid).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn validate_coupon_post_handler(
    State(state): State<AppState>,
    Json(body): Json<ValidateCouponRequest>,
) -> AppResult<Response> {
    body.validate()?;
    let code = body.code.unwrap_or_default();
    let amount = body.amount.unwrap_or(0.0);
    let plan_id = body.plan_id.or(body.plan_id_camel);
    let data = SubscriptionService::validate_and_calculate_coupon(&state, &code, amount, plan_id)
        .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn validate_coupon_get_handler(
    State(state): State<AppState>,
    Query(query): Query<ValidateCouponRequest>,
) -> AppResult<Response> {
    query.validate()?;
    let code = query.code.unwrap_or_default();
    let amount = query.amount.unwrap_or(0.0);
    let plan_id = query.plan_id.or(query.plan_id_camel);
    let data = SubscriptionService::validate_and_calculate_coupon(&state, &code, amount, plan_id)
        .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_plan_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::get_plan_by_id(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_plans_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<AdminListQuery>,
) -> AppResult<Response> {
    if query.page.is_some() {
        let data = SubscriptionService::list_admin_plans_paginated(&state, &query).await?;
        Ok(ApiResponse::ok_response(data))
    } else {
        let data = SubscriptionService::list_plans(&state, false, None).await?;
        Ok(ApiResponse::ok_response(data))
    }
}

pub async fn admin_create_plan_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = SubscriptionService::upsert_plan(&state, body, None).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_update_plan_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = SubscriptionService::upsert_plan(&state, body, Some(id)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_toggle_plan_status_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::toggle_plan_status(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_delete_plan_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::delete_plan(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_coupons_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(query): Query<AdminListQuery>,
) -> AppResult<Response> {
    if query.page.is_some() {
        let data = SubscriptionService::list_admin_coupons_paginated(&state, &query).await?;
        Ok(ApiResponse::ok_response(data))
    } else {
        let data = SubscriptionService::list_coupons(&state).await?;
        Ok(ApiResponse::ok_response(data))
    }
}

pub async fn admin_get_coupon_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::get_coupon_by_id(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_create_coupon_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = SubscriptionService::upsert_coupon(&state, body, None).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_update_coupon_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = SubscriptionService::upsert_coupon(&state, body, Some(id)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_toggle_coupon_status_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::toggle_coupon_status(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_delete_coupon_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = SubscriptionService::delete_coupon(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}
