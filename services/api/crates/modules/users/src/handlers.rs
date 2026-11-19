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
    validation::Validatable,
};

use crate::{
    dto::{
        AdminCreateUserRequest, AdminResetPasswordRequest, AdminStatusUpdateRequest,
        AdminUpdateUserRequest, AdminUserQuery, CreateSubProfileRequest, UpdateProfileRequest,
    },
    service::UsersService,
};

fn parse_user_id(claims: &Claims) -> Result<i64, AppError> {
    claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))
}

fn require_admin(claims: &Claims) -> Result<(), AppError> {
    if !claims.is_admin() {
        return Err(AppError::Forbidden("Admin privileges required".to_string()));
    }
    Ok(())
}

pub async fn update_my_profile_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<impl IntoResponse, AppError> {
    payload.validate()?;
    let user_id = parse_user_id(&claims)?;
    let res = service.update_profile(user_id, payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Profile updated successfully", 200)),
    ))
}

pub async fn get_sub_profiles_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_sub_profiles(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Sub-profiles retrieved successfully", 200)),
    ))
}

pub async fn create_sub_profile_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<CreateSubProfileRequest>,
) -> Result<impl IntoResponse, AppError> {
    payload.validate()?;
    let user_id = parse_user_id(&claims)?;
    let res = service.create_sub_profile(user_id, payload).await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(res, "Sub-profile created successfully", 201)),
    ))
}

pub async fn get_devices_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_user_devices(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Devices retrieved successfully", 200)),
    ))
}

pub async fn revoke_device_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(device_id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    service.revoke_user_device(user_id, &device_id).await?;
    let val = serde_json::json!({ "revoked": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Device revoked successfully", 200)),
    ))
}

pub async fn admin_list_users_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Query(query): Query<AdminUserQuery>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let res = service.list_users(query).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Users retrieved successfully", 200)),
    ))
}

pub async fn admin_get_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let res = service.get_user_by_id(id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User retrieved successfully", 200)),
    ))
}

pub async fn admin_patch_status_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
    payload: Option<Json<AdminStatusUpdateRequest>>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let status = payload
        .and_then(|p| p.0.status)
        .unwrap_or_else(|| "ACTIVE".to_string());
    let res = service.update_user_status(id, &status).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User status updated", 200)),
    ))
}

pub async fn admin_block_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let res = service.update_user_status(id, "BLOCKED").await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User blocked", 200)),
    ))
}

pub async fn admin_unblock_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let res = service.update_user_status(id, "ACTIVE").await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User unblocked", 200)),
    ))
}

pub async fn admin_reset_password_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
    Json(payload): Json<AdminResetPasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let new_pw = payload
        .new_password
        .or(payload.password)
        .filter(|p| !p.trim().is_empty())
        .ok_or_else(|| AppError::BadRequest("newPassword is required".to_string()))?;
    service.reset_user_password(id, &new_pw).await?;
    let val = serde_json::json!({ "passwordReset": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "User password reset", 200)),
    ))
}

pub async fn admin_create_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<AdminCreateUserRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    payload.validate()?;
    let res = service.create_user(payload).await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(res, "User created successfully", 201)),
    ))
}

pub async fn admin_update_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
    Json(payload): Json<AdminUpdateUserRequest>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    payload.validate()?;
    let res = service.update_user(id, payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User updated successfully", 200)),
    ))
}

pub async fn admin_toggle_status_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let res = service.toggle_user_status(id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "User status toggled", 200)),
    ))
}

pub async fn admin_revoke_devices_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    let count = service.revoke_all_user_devices(id).await?;
    let val = serde_json::json!({ "revokedCount": count });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "All user device sessions revoked", 200)),
    ))
}

pub async fn admin_delete_user_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Path(id): Path<i64>,
) -> Result<impl IntoResponse, AppError> {
    require_admin(&claims)?;
    service.soft_delete_user(id).await?;
    let val = serde_json::json!({ "deleted": true, "softDeleted": true, "id": id });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "User deactivated (soft-deleted)", 200)),
    ))
}

