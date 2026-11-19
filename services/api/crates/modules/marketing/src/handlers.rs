use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::Claims;
use maxx_core::AppState;

use crate::dto::{CreateMarketingAgentRequest, ValidateAgentQuery};
use crate::service::{validate_agent_code, MarketingService};

fn ensure_admin(claims: &Claims) -> Result<(), AppError> {
    if claims.is_admin() || claims.has_role("MARKETING") {
        Ok(())
    } else {
        Err(AppError::Forbidden(
            "Marketing agent management requires admin or marketing access".to_string(),
        ))
    }
}

pub async fn admin_list_agents_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = MarketingService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.list_agents().await?))
}

pub async fn admin_create_agent_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(req): Json<CreateMarketingAgentRequest>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = MarketingService::new(state.db.clone());
    let agent = service.create_agent(req).await?;
    Ok(Json(ApiResponse::created(agent)).into_response())
}

pub async fn admin_get_agent_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = MarketingService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.get_agent(id).await?))
}

pub async fn admin_toggle_agent_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = MarketingService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.toggle_status(id).await?))
}

pub async fn admin_list_members_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> Result<Response, AppError> {
    ensure_admin(&claims)?;
    let service = MarketingService::new(state.db.clone());
    Ok(ApiResponse::ok_response(service.list_members(id).await?))
}

pub async fn validate_agent_path_handler(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Response, AppError> {
    let agent = validate_agent_code(&state.db, &code).await?;
    Ok(ApiResponse::ok_response(agent))
}

pub async fn validate_agent_query_handler(
    State(state): State<AppState>,
    Query(query): Query<ValidateAgentQuery>,
) -> Result<Response, AppError> {
    let code = query.code.or(query.agent_code).unwrap_or_default();
    let agent = validate_agent_code(&state.db, &code).await?;
    Ok(ApiResponse::ok_response(agent))
}
