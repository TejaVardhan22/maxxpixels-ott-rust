use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use thiserror::Error;

/// Errors mirroring the NestJS/`maxx-common` AppError contract so every client
/// receives the same status codes and messages as before.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Not Found: {0}")]
    NotFound(String),

    #[error("Bad Request: {0}")]
    BadRequest(String),

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: {0}")]
    Forbidden(String),

    #[error("Database Error: {0}")]
    Database(String),

    #[error("Internal Server Error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, code) = match &self {
            AppError::NotFound(m) => (StatusCode::NOT_FOUND, m.clone(), "NOT_FOUND"),
            AppError::BadRequest(m) => (StatusCode::BAD_REQUEST, m.clone(), "BAD_REQUEST"),
            AppError::Unauthorized(m) => (StatusCode::UNAUTHORIZED, m.clone(), "UNAUTHORIZED"),
            AppError::Forbidden(m) => (StatusCode::FORBIDDEN, m.clone(), "FORBIDDEN"),
            AppError::Database(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.clone(), "DATABASE_ERROR"),
            AppError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, m.clone(), "INTERNAL_ERROR"),
        };

        let body = serde_json::json!({
            "success": false,
            "status": status.as_u16(),
            "message": message,
            "code": code,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        (status, Json(body)).into_response()
    }
}
