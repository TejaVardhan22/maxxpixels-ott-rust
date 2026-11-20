use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use thiserror::Error;
use tracing::error;

use crate::response::ApiResponse;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("Bad Request: {0}")]
    BadRequest(String),

    #[error("Validation Error: {0}")]
    Validation(String, Option<serde_json::Value>),

    #[error("Unprocessable Entity: {0}")]
    UnprocessableEntity(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Rate Limit Exceeded: {0}")]
    RateLimitExceeded(String),

    #[error("Business Rule Violation: {0} ({1})")]
    Business(String, String),

    #[error("Database Error: {0}")]
    Database(String),

    #[error("Internal Server Error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, code, errors) = match self {
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                msg,
                Some("NOT_FOUND".to_string()),
                None,
            ),
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                msg,
                Some("BAD_REQUEST".to_string()),
                None,
            ),
            AppError::Validation(msg, errs) => (
                StatusCode::BAD_REQUEST,
                msg,
                Some("VALIDATION_ERROR".to_string()),
                errs,
            ),
            AppError::UnprocessableEntity(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                msg,
                Some("UNPROCESSABLE_ENTITY".to_string()),
                None,
            ),
            AppError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                msg,
                Some("UNAUTHORIZED".to_string()),
                None,
            ),
            AppError::Forbidden(msg) => (
                StatusCode::FORBIDDEN,
                msg,
                Some("FORBIDDEN".to_string()),
                None,
            ),
            AppError::Conflict(msg) => (
                StatusCode::CONFLICT,
                msg,
                Some("CONFLICT".to_string()),
                None,
            ),
            AppError::RateLimitExceeded(msg) => (
                StatusCode::TOO_MANY_REQUESTS,
                msg,
                Some("RATE_LIMIT_EXCEEDED".to_string()),
                None,
            ),
            AppError::Business(msg, err_code) => (
                StatusCode::BAD_REQUEST,
                msg,
                Some(err_code),
                None,
            ),
            AppError::Database(err) => {
                error!("Database error occurred: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "A database error occurred. Please try again later.".to_string(),
                    Some("DATABASE_ERROR".to_string()),
                    None,
                )
            }
            AppError::Internal(err) => {
                error!("Internal system error: {}", err);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "An unexpected internal error occurred.".to_string(),
                    Some("INTERNAL_SERVER_ERROR".to_string()),
                    None,
                )
            }
        };

        let body = ApiResponse::error(status.as_u16(), message, code, errors);
        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl From<sea_orm::DbErr> for AppError {
    fn from(err: sea_orm::DbErr) -> Self {
        AppError::Database(err.to_string())
    }
}

