use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::Claims;
use maxx_core::AppState;

use crate::dto::{IntroVideoRequest, PortalBannerQuery, PortalBannerRequest};
use crate::service::HomeContentService;

fn ensure_admin(claims: &Claims) -> Result<(), AppError> {
    if claims.is_admin() {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Admin access is required to manage home content".to_string(),
        ))
    }
}

// ------------------------------ Intro video ------------------------------

pub async fn public_list_intro_videos_handler(State(state): State<AppState>) -> Result<Response, AppError> {
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.list_active_intro_videos().await?,
    ))
}

pub async fn public_active_intro_video_handler(
    State(state): State<AppState>,
) -> Result<Response, AppError> {
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.get_active_intro_video().await?,
    ))
}

pub async fn admin_list_intro_videos_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.list_intro_videos().await?))
}

pub async fn admin_get_intro_video_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.get_intro_video(id).await?))
}

pub async fn admin_create_intro_video_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<IntroVideoRequest>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(Json(ApiResponse::created(
        service.create_intro_video(req).await?,
    ))
    .into_response())
}

pub async fn admin_update_intro_video_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
    Json(req): Json<IntroVideoRequest>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.update_intro_video(id, req).await?,
    ))
}

pub async fn admin_activate_intro_video_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.activate_intro_video(id).await?,
    ))
}

pub async fn admin_delete_intro_video_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.delete_intro_video(id).await?,
    ))
}

// ---------------------------- Portal banners -----------------------------

pub async fn public_list_portal_banners_handler(
    State(state): State<AppState>,
    Query(query): Query<PortalBannerQuery>,
) -> Result<Response, AppError> {
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service
            .list_public_portal_banners(query.portal_key)
            .await?,
    ))
}

pub async fn admin_list_portal_banners_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.list_portal_banners().await?,
    ))
}

pub async fn admin_get_portal_banner_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.get_portal_banner(id).await?))
}

pub async fn admin_create_portal_banner_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<PortalBannerRequest>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(Json(ApiResponse::created(
        service.create_portal_banner(req).await?,
    ))
    .into_response())
}

pub async fn admin_update_portal_banner_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
    Json(req): Json<PortalBannerRequest>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.update_portal_banner(id, req).await?,
    ))
}

pub async fn admin_toggle_portal_banner_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.toggle_portal_banner(id).await?,
    ))
}

pub async fn admin_delete_portal_banner_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = HomeContentService::new(state.db.clone());
    Ok(ApiResponse::ok_response(
        service.delete_portal_banner(id).await?,
    ))
}
