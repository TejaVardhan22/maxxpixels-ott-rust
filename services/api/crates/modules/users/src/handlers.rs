use axum::{
    extract::{Multipart, Path, Query, State},
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
        AdminUpdateUserRequest, AdminUserQuery, CreateSubProfileRequest, LogoutOtherDevicesRequest,
        RegisterDeviceRequest, UpdateProfileRequest,
    },
    referrals::{apply_referral_code, get_my_referrals, ApplyReferralCodeRequest},
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

pub async fn upload_my_avatar_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    mut multipart: Multipart,
) -> Result<impl IntoResponse, AppError> {
    const MAX_AVATAR_BYTES: usize = 5 * 1024 * 1024;
    let user_id = parse_user_id(&claims)?;

    let mut file_name = String::from("avatar.jpg");
    let mut content_type = String::new();
    let mut bytes = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart payload: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" || name == "image" || name == "avatar" || bytes.is_empty() {
            if let Some(fname) = field.file_name() {
                file_name = fname.to_string();
            }
            if let Some(ct) = field.content_type() {
                content_type = ct.to_lowercase();
            }
            bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("Failed reading image bytes: {}", e)))?
                .to_vec();
        }
    }

    if bytes.is_empty() {
        return Err(AppError::BadRequest("No profile image uploaded.".to_string()));
    }
    if bytes.len() > MAX_AVATAR_BYTES {
        return Err(AppError::BadRequest("Profile image must be 5 MB or smaller.".to_string()));
    }

    let ext = if content_type.contains("png") || file_name.to_lowercase().ends_with(".png") {
        "png"
    } else if content_type.contains("webp") || file_name.to_lowercase().ends_with(".webp") {
        "webp"
    } else if content_type.contains("jpeg")
        || content_type.contains("jpg")
        || file_name.to_lowercase().ends_with(".jpg")
        || file_name.to_lowercase().ends_with(".jpeg")
    {
        "jpg"
    } else {
        return Err(AppError::BadRequest("Choose a JPG, PNG, or WEBP image.".to_string()));
    };

    let stored_name = format!(
        "u{}_{}.{}",
        user_id,
        &uuid::Uuid::new_v4().simple().to_string()[..12],
        ext
    );
    let mime = match ext {
        "png" => "image/png",
        "webp" => "image/webp",
        _ => "image/jpeg",
    };

    // Upload to Bunny.net Edge Storage (both local & production) when configured; fallback to local disk
    let bunny = maxx_integration_bunny::BunnyStorageClient::from_env();
    let bunny_res = bunny.upload_file("avatars", &stored_name, bytes.clone(), mime).await;
    let avatar_url = if let Some(url) = bunny_res
        .get("url")
        .or_else(|| bunny_res.get("fileUrl"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        url.to_string()
    } else {
        let dir = std::path::PathBuf::from("uploads").join("avatars");
        tokio::fs::create_dir_all(&dir)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to prepare avatar storage: {}", e)))?;
        tokio::fs::write(dir.join(&stored_name), &bytes)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to save avatar image: {}", e)))?;
        let public_base = std::env::var("PUBLIC_BASE_URL")
            .unwrap_or_default()
            .trim_end_matches('/')
            .to_string();
        if public_base.is_empty() {
            format!("/api/v1/uploads/avatars/{}", stored_name)
        } else {
            format!("{}/api/v1/uploads/avatars/{}", public_base, stored_name)
        }
    };

    let updated = service
        .update_profile(
            user_id,
            UpdateProfileRequest {
                full_name: None,
                name: None,
                email: None,
                phone: None,
                phone_number: None,
                avatar_url: Some(avatar_url.clone()),
                avatar_base64: None,
                image_type: None,
                preferred_language: None,
                preferred_audio_language: None,
                country: None,
            },
        )
        .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            serde_json::json!({
                "avatarUrl": avatar_url,
                "image": avatar_url,
                "user": updated,
            }),
            "Profile photo uploaded successfully",
            200,
        )),
    ))
}

pub async fn delete_my_avatar_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let updated = service.remove_my_avatar(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            serde_json::json!({
                "avatarUrl": null,
                "image": null,
                "user": updated,
            }),
            "Profile photo removed successfully",
            200,
        )),
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

pub async fn get_device_summary_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.get_user_device_summary(user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            res,
            "Device and plan summary retrieved successfully",
            200,
        )),
    ))
}

pub async fn register_device_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<RegisterDeviceRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = service.register_user_device(user_id, payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Device registered successfully", 200)),
    ))
}

pub async fn logout_other_devices_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<LogoutOtherDevicesRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let count = service
        .revoke_other_user_devices(user_id, payload.current_device_id.as_deref())
        .await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            serde_json::json!({ "revokedCount": count }),
            "Other devices signed out successfully",
            200,
        )),
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

pub async fn get_my_referrals_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = get_my_referrals(service.db(), user_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Referral details retrieved", 200)),
    ))
}

pub async fn apply_referral_code_handler(
    claims: Claims,
    State(service): State<Arc<UsersService>>,
    Json(payload): Json<ApplyReferralCodeRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = parse_user_id(&claims)?;
    let res = apply_referral_code(service.db(), user_id, &payload.referral_code).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(res, "Referral code applied successfully", 200)),
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

