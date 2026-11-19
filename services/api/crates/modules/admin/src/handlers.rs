use crate::service::AdminService;
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
        return Err(AppError::Forbidden(
            "Admin privileges are required for this operation".to_string(),
        ));
    }
    Ok(())
}

#[derive(Debug, Deserialize)]
pub struct SettingsQuery {
    pub group: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SectionQuery {
    #[serde(rename = "pageId")]
    pub page_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct LegalUpdateQuery {
    pub title: Option<String>,
}

pub async fn get_public_settings_handler(
    State(state): State<AppState>,
) -> AppResult<Response> {
    let data = AdminService::get_public_settings(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_all_settings_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<SettingsQuery>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::get_all_settings(&state, q.group.as_deref()).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_settings_by_group_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(group): Path<String>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::get_all_settings(&state, Some(&group)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_setting_by_key_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(key): Path<String>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::get_setting_by_key(&state, &key).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn upsert_setting_by_key_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(key): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let actor = claims
        .email
        .unwrap_or_else(|| "admin@maxxpixels.com".to_string());
    let data = AdminService::upsert_setting_by_key(&state, &key, body, &actor).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_setting_by_key_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(key): Path<String>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let actor = claims
        .email
        .unwrap_or_else(|| "admin@maxxpixels.com".to_string());
    let data = AdminService::delete_setting_by_key(&state, &key, &actor).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn update_settings_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let actor = claims
        .email
        .unwrap_or_else(|| "admin@maxxpixels.com".to_string());
    let data = AdminService::update_settings(&state, body, &actor).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_settings_history_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::get_settings_history(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn rollback_setting_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(audit_id): Path<i64>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let actor = claims
        .email
        .unwrap_or_else(|| "admin@maxxpixels.com".to_string());
    let data = AdminService::rollback_setting(&state, audit_id, &actor).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_connection_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, None, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_bunny_storage_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, Some("BUNNY_STORAGE"), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_bunny_stream_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, Some("BUNNY_STREAM"), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_s3_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, Some("S3"), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_razorpay_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, Some("RAZORPAY"), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn test_stripe_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let data = AdminService::test_connection(&state, Some("STRIPE"), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_public_banners_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = AdminService::list_banners(&state, true).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_banners_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    let data = AdminService::list_banners(&state, false).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_create_banner_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_banner(&state, body, None).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_update_banner_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_banner(&state, body, Some(id)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_delete_banner_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = AdminService::delete_banner(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_pages_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = AdminService::list_pages_with_sections(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_home_page_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = AdminService::get_page_by_slug(&state, "home").await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_page_by_slug_handler(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Response> {
    let data = AdminService::get_page_by_slug(&state, &slug).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_sections_handler(
    State(state): State<AppState>,
    Query(q): Query<SectionQuery>,
) -> AppResult<Response> {
    let data = AdminService::list_sections(&state, q.page_id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_create_section_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_section(&state, body, None).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_update_section_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_section(&state, body, Some(id)).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_delete_section_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = AdminService::delete_section(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_reorder_sections_handler(
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(json!({ "reordered": true, "payload": body })))
}

pub async fn admin_add_section_item_handler(
    _claims: Claims,
    Path(section_id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(json!({ "sectionId": section_id, "added": true, "item": body })))
}

pub async fn admin_remove_section_item_handler(
    _claims: Claims,
    Path((section_id, item_id)): Path<(i64, i64)>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(json!({ "sectionId": section_id, "itemId": item_id, "removed": true })))
}

pub async fn list_legal_pages_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = AdminService::list_legal_pages(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_legal_page_handler(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<Response> {
    let data = AdminService::get_legal_page_by_slug(&state, &slug).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_legal_page_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(q): Query<LegalUpdateQuery>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_legal_page(&state, None, q.title.as_deref(), body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn update_legal_page_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(slug): Path<String>,
    Query(q): Query<LegalUpdateQuery>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdminService::upsert_legal_page(&state, Some(&slug), q.title.as_deref(), body).await?;
    Ok(ApiResponse::ok_response(data))
}


