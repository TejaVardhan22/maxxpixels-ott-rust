use chrono::Utc;
use serde::Serialize;

/// Standard response envelope matching the NestJS ApiResponseInterceptor
/// (`{ success, status, message, data, result, timestamp }`) so the existing
/// mobile/web clients keep unwrapping `data`/`result` without any change.
#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Clone> {
    pub success: bool,
    pub status: u16,
    pub message: String,
    pub data: Option<T>,
    pub result: Option<T>,
    pub timestamp: String,
}

impl<T: Clone> ApiResponse<T> {
    pub fn success(data: T, message: impl Into<String>, status: u16) -> Self {
        Self {
            success: true,
            status,
            message: message.into(),
            data: Some(data.clone()),
            result: Some(data),
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}
