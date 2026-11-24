use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::sync::Arc;

use maxx_common::{
    error::AppError,
    response::ApiResponse,
    security::Claims,
};

use crate::{
    dto::{
        ChangePasswordRequest, DeviceTokenRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, SendOtpRequest, VerifyOtpRequest,
    },
    service::AuthService,
};

pub async fn login_handler(
    State(service): State<Arc<AuthService>>,
    headers: HeaderMap,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|val| val.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or("").trim().to_string())
        .or_else(|| {
            headers
                .get("x-real-ip")
                .and_then(|val| val.to_str().ok())
                .map(|s| s.to_string())
        });

    let res = service.login(payload, client_ip).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Login successful", 200)),
    ))
}

pub async fn register_handler(
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.register(payload).await?;
    Ok((
        StatusCode::CREATED,
        Json(ApiResponse::success(res, "User registered successfully", 201)),
    ))
}

pub async fn refresh_handler(
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<RefreshTokenRequest>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.refresh(payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Access token refreshed", 200)),
    ))
}

pub async fn logout_handler(
    claims: Claims,
    State(service): State<Arc<AuthService>>,
    headers: HeaderMap,
    payload: Option<Json<RefreshTokenRequest>>,
) -> Result<impl IntoResponse, AppError> {
    let raw_access = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| {
            if s.starts_with("Bearer ") || s.starts_with("bearer ") {
                s[7..].trim().to_string()
            } else {
                s.trim().to_string()
            }
        });

    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))?;

    let refresh_token_str = payload.as_ref().and_then(|p| p.refresh_token.as_deref());

    service
        .logout(user_id, raw_access.as_deref(), refresh_token_str)
        .await?;

    let val = serde_json::json!({ "loggedOut": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Logged out successfully", 200)),
    ))
}

pub async fn get_profile_handler(
    claims: Claims,
    State(service): State<Arc<AuthService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))?;

    let user_dto = service.get_profile(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(user_dto, "Profile retrieved successfully", 200)),
    ))
}

pub async fn change_password_handler(
    claims: Claims,
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))?;

    service.change_password(user_id, payload).await?;

    let val = serde_json::json!({ "passwordChanged": true });
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(val, "Password updated successfully", 200)),
    ))
}

pub async fn send_otp_handler(
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<SendOtpRequest>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.send_otp(payload).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "OTP sent successfully", 200))))
}

pub async fn verify_otp_handler(
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<VerifyOtpRequest>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.verify_otp(payload).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "OTP verified successfully", 200))))
}

pub async fn device_token_handler(
    claims: Claims,
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<DeviceTokenRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))?;
    let res = service.update_device_token(user_id, payload).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "Device token updated", 200))))
}

pub async fn generate_tv_code_handler(
    State(service): State<Arc<AuthService>>,
    payload: Option<Json<crate::dto::GenerateTvCodeRequest>>,
) -> Result<impl IntoResponse, AppError> {
    let req = payload.map(|Json(p)| p).unwrap_or_default();
    let res = service.generate_tv_code(req).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "TV pairing code generated", 200))))
}

pub async fn poll_tv_code_handler(
    State(service): State<Arc<AuthService>>,
    axum::extract::Path(code): axum::extract::Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let res = service.poll_tv_code(&code).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "TV pairing status retrieved", 200))))
}

pub async fn activate_tv_code_handler(
    claims: Claims,
    State(service): State<Arc<AuthService>>,
    Json(payload): Json<crate::dto::ActivateTvCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = claims
        .sub
        .parse::<i64>()
        .map_err(|_| AppError::BadRequest("Invalid user ID in token claim".to_string()))?;
    let res = service.activate_tv_code(user_id, payload).await?;
    Ok((StatusCode::OK, Json(ApiResponse::success(res, "TV activated successfully", 200))))
}
