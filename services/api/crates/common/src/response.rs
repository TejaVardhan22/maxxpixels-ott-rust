use chrono::Utc;
use serde::{Deserialize, Serialize};

/// Standard API response envelope strictly matching NestJS ApiResponseInterceptor & ApiResponse DTO.
/// Contains both `data` and `result` keys for dual-key compatibility across Web, Flutter, and Smart TV clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse<T> {
    pub success: bool,
    pub status: u16,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub errors: Option<serde_json::Value>,
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
            code: None,
            errors: None,
            timestamp: Utc::now().to_rfc3339(),
        }
    }

    pub fn ok(data: T) -> Self {
        Self::success(data, "Success", 200)
    }

    pub fn created(data: T) -> Self {
        Self::success(data, "Resource created successfully", 201)
    }
}

impl ApiResponse<()> {
    pub fn ok_response<S: Serialize>(data: S) -> axum::response::Response {
        use axum::response::IntoResponse;
        let val = serde_json::to_value(data).unwrap_or(serde_json::Value::Null);
        axum::Json(ApiResponse::ok(val)).into_response()
    }
    pub fn error(status: u16, message: impl Into<String>, code: Option<String>, errors: Option<serde_json::Value>) -> Self {
        Self {
            success: false,
            status,
            message: message.into(),
            data: None,
            result: None,
            code,
            errors,
            timestamp: Utc::now().to_rfc3339(),
        }
    }
}

/// Standard pagination model matching NestJS PageResponse<T>.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageResponse<T> {
    pub content: Vec<T>,
    pub page: u64,
    pub size: u64,
    pub total_elements: u64,
    pub total_pages: u64,
    pub last: bool,
}

impl<T> PageResponse<T> {
    pub fn of(content: Vec<T>, total_elements: u64, page: u64, size: u64) -> Self {
        let safe_size = if size > 0 { size } else { 20 };
        let total_pages = (total_elements as f64 / safe_size as f64).ceil() as u64;
        let last = page >= total_pages.saturating_sub(1) || total_pages == 0;

        Self {
            content,
            page,
            size: safe_size,
            total_elements,
            total_pages,
            last,
        }
    }
}

