use axum::{
    body::Body,
    extract::State,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use maxx_common::security::SecurityUtils;
use maxx_core::AppState;
use sea_orm::{ConnectionTrait, DbBackend, Statement};
use serde::{Deserialize, Serialize};
use serde_json::json;

const MAINTENANCE_CACHE_KEY: &str = "maxx:maintenance_status:v1";
const MAINTENANCE_CACHE_TTL_SECS: u64 = 5;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MaintenanceStatus {
    enabled: bool,
    message: String,
}

fn is_bypass_path(path: &str) -> bool {
    let p = path.to_lowercase();
    p == "/ping"
        || p == "/api/ping"
        || p == "/api/v1/ping"
        || p == "/health"
        || p == "/api/health"
        || p == "/api/v1/health"
        || p.starts_with("/actuator")
        || p.starts_with("/api/actuator")
        || p.starts_with("/api/v1/actuator")
        || p == "/metrics"
        || p == "/prometheus"
        || p.starts_with("/api/v1/admin")
        || p.starts_with("/api/admin")
        || p.starts_with("/admin")
        || p.starts_with("/api/v1/auth")
        || p.starts_with("/api/auth")
        || p.starts_with("/auth")
        || p.starts_with("/api/v1/settings")
        || p.starts_with("/api/settings")
        || p.starts_with("/settings")
        || p.starts_with("/api/v1/general_setting")
        || p.starts_with("/api/general_setting")
        || p.starts_with("/general_setting")
        || p.starts_with("/api/v1/branding")
        || p.starts_with("/branding")
}

fn is_admin_request(req: &Request<Body>, jwt_secret: &str) -> bool {
    let Some(auth) = req
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
    else {
        return false;
    };
    let Some(token) = auth.strip_prefix("Bearer ").or_else(|| auth.strip_prefix("bearer ")) else {
        return false;
    };
    let Ok(claims) = SecurityUtils::validate_jwt(token.trim(), jwt_secret) else {
        return false;
    };
    claims.is_admin()
}

async fn load_maintenance_status(state: &AppState) -> MaintenanceStatus {
    if let Some(cached) = state.redis.get::<MaintenanceStatus>(MAINTENANCE_CACHE_KEY).await {
        return cached;
    }

    let mut enabled = false;
    let mut message =
        "We are currently performing scheduled maintenance. Please check back shortly."
            .to_string();

    let stmt = Statement::from_string(
        DbBackend::Postgres,
        "SELECT setting_key, setting_value \
         FROM system_settings \
         WHERE LOWER(setting_key) IN (\
             'maintenancemode', 'maintenance_mode', 'maintenance_mode_enabled',\
             'maintenancemessage', 'maintenance_message'\
         ) \
         ORDER BY updated_at ASC NULLS FIRST, id ASC"
            .to_string(),
    );

    if let Ok(rows) = state.db.query_all(stmt).await {
        for row in rows {
            let key: String = row.try_get("", "setting_key").unwrap_or_default();
            let val: String = row.try_get("", "setting_value").unwrap_or_default();
            let k = key.to_lowercase();
            let v = val.trim();
            if k == "maintenancemode" || k == "maintenance_mode" || k == "maintenance_mode_enabled"
            {
                enabled = matches!(v.to_lowercase().as_str(), "true" | "1" | "yes" | "on");
            } else if (k == "maintenancemessage" || k == "maintenance_message") && !v.is_empty() {
                message = v.to_string();
            }
        }
    }

    let status = MaintenanceStatus { enabled, message };
    let _ = state
        .redis
        .set(MAINTENANCE_CACHE_KEY, &status, MAINTENANCE_CACHE_TTL_SECS)
        .await;
    status
}

pub async fn maintenance_mode_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    if req.method() == Method::OPTIONS || is_bypass_path(req.uri().path()) {
        return next.run(req).await;
    }

    let status = load_maintenance_status(&state).await;
    if !status.enabled {
        return next.run(req).await;
    }

    if is_admin_request(&req, &state.config.jwt_secret) {
        return next.run(req).await;
    }

    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "success": false,
            "maintenanceMode": true,
            "code": "MAINTENANCE_MODE",
            "message": status.message,
        })),
    )
        .into_response()
}
