use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use maxx_common::{
    error::{AppError, AppResult},
    response::ApiResponse,
    security::{Claims, SecurityUtils},
};
use maxx_core::{
    entities::{device, playback_session, role, system_setting},
    AppState, MigrationRunner,
};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter,
    QueryOrder, QuerySelect, Set, Statement,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::PathBuf;

fn require_admin(claims: &Claims) -> AppResult<()> {
    if !claims.is_admin() {
        return Err(AppError::Forbidden(
            "Admin privileges are required for this operation".into(),
        ));
    }
    Ok(())
}

async fn record_security_audit(state: &AppState, actor: &str, action: &str, details: &str) {
    let _ = state
        .db
        .execute(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            CREATE TABLE IF NOT EXISTS setting_audit_logs (
                id BIGSERIAL PRIMARY KEY,
                action VARCHAR(64) NOT NULL,
                user_email VARCHAR(255) NOT NULL,
                user_role VARCHAR(64) NOT NULL DEFAULT 'ADMIN',
                details TEXT NOT NULL,
                before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
                after_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#
            .to_string(),
        ))
        .await;

    let _ = state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO setting_audit_logs (action, user_email, user_role, details, before_snapshot, after_snapshot) VALUES ($1, $2, 'ADMIN', $3, '{}'::jsonb, '{}'::jsonb)",
            vec![action.into(), actor.into(), details.into()],
        ))
        .await;
}

#[derive(Debug, Deserialize)]
pub struct UserIdQuery {
    #[serde(rename = "userId")]
    pub user_id: Option<i64>,
}

fn opt_str(v: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(s) = v.get(*k).and_then(|x| x.as_str()) {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }
    None
}

// ─── DRM RULES ───────────────────────────────────────────────────────────────

pub async fn list_drm_rules_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    let rows = system_setting::Entity::find()
        .filter(system_setting::Column::SettingGroup.eq("DRM_RULES"))
        .all(&state.db)
        .await?;
    let parsed: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let mut val: Value = r
                .setting_value
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_else(|| json!({}));
            if let Some(obj) = val.as_object_mut() {
                obj.insert("id".to_string(), json!(r.id));
                obj.insert("key".to_string(), json!(r.setting_key));
            }
            val
        })
        .collect();
    Ok(ApiResponse::ok_response(parsed))
}

pub async fn create_drm_rule_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let name = opt_str(&body, &["name", "ruleName"]).unwrap_or_else(|| "DRM Rule".to_string());
    let key = format!("DRM_RULE_{}", Utc::now().timestamp_millis());
    let now = Utc::now().fixed_offset();
    let am = system_setting::ActiveModel {
        setting_key: Set(key),
        setting_value: Set(Some(body.to_string())),
        setting_group: Set(Some("DRM_RULES".into())),
        category: Set(Some("DRM".into())),
        description: Set(Some(name)),
        is_public: Set(Some(false)),
        is_secret: Set(Some(false)),
        updated_at: Set(now),
        ..Default::default()
    };
    let saved = am.insert(&state.db).await?;
    Ok(ApiResponse::ok_response(json!({ "id": saved.id, "rule": body })))
}

pub async fn update_drm_rule_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let existing = system_setting::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("DRM Rule not found".into()))?;
    let mut am: system_setting::ActiveModel = existing.into();
    am.setting_value = Set(Some(body.to_string()));
    am.updated_at = Set(Utc::now().fixed_offset());
    let saved = am.update(&state.db).await?;
    Ok(ApiResponse::ok_response(json!({ "id": saved.id, "rule": body })))
}

pub async fn delete_drm_rule_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let existing = system_setting::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("DRM rule not found".into()))?;
    let mut am: system_setting::ActiveModel = existing.into();
    am.setting_group = Set(Some("DRM_DELETED".into()));
    am.updated_at = Set(Utc::now().fixed_offset());
    am.update(&state.db).await?;
    Ok(ApiResponse::ok_response(json!({
        "deleted": true,
        "softDeleted": true,
        "id": id
    })))
}

// ─── ADMIN DEVICES ───────────────────────────────────────────────────────────

pub async fn admin_list_devices_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(q): Query<UserIdQuery>,
) -> AppResult<Response> {
    let mut query = device::Entity::find().order_by_desc(device::Column::CreatedAt);
    if let Some(uid) = q.user_id {
        query = query.filter(device::Column::UserId.eq(uid));
    }
    let devices = query.limit(200).all(&state.db).await?;
    Ok(ApiResponse::ok_response(devices))
}

pub async fn admin_delete_device_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let existing = device::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Device not found".into()))?;
    let dev_id = existing.device_id.clone();
    let mut am: device::ActiveModel = existing.into();
    am.is_active = Set(Some(false));
    am.update(&state.db).await?;

    let _ = playback_session::Entity::update_many()
        .col_expr(playback_session::Column::IsActive, sea_orm::sea_query::Expr::value(false))
        .filter(playback_session::Column::DeviceId.eq(dev_id))
        .exec(&state.db)
        .await;

    Ok(ApiResponse::ok_response(json!({
        "deleted": true,
        "softDeleted": true,
        "deactivated": true,
        "id": id
    })))
}

pub async fn admin_revoke_device_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let existing = device::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Device not found".into()))?;
    let dev_id = existing.device_id.clone();
    let mut am: device::ActiveModel = existing.into();
    am.is_active = Set(Some(false));
    am.update(&state.db).await?;

    let _ = playback_session::Entity::update_many()
        .col_expr(playback_session::Column::IsActive, sea_orm::sea_query::Expr::value(false))
        .filter(playback_session::Column::DeviceId.eq(dev_id))
        .exec(&state.db)
        .await;

    Ok(ApiResponse::ok_response(json!({ "revoked": true, "id": id })))
}

pub async fn admin_disconnect_user_devices_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(user_id): Path<i64>,
) -> AppResult<Response> {
    let _ = device::Entity::update_many()
        .col_expr(device::Column::IsActive, sea_orm::sea_query::Expr::value(false))
        .filter(device::Column::UserId.eq(user_id))
        .exec(&state.db)
        .await?;
    let _ = playback_session::Entity::update_many()
        .col_expr(playback_session::Column::IsActive, sea_orm::sea_query::Expr::value(false))
        .filter(playback_session::Column::UserId.eq(user_id))
        .exec(&state.db)
        .await?;
    Ok(ApiResponse::ok_response(json!({ "disconnected": true, "userId": user_id })))
}

// ─── ADMIN SECURITY, RBAC ROLES & AUDIT LOGS ────────────────────────────────

fn role_display_name(code: &str) -> String {
    match code {
        "ROLE_SUPER_ADMIN" => "Super Administrator".to_string(),
        "ROLE_ADMIN" => "Platform Administrator".to_string(),
        "ROLE_CONTENT_MANAGER" => "Content Operations Manager".to_string(),
        "ROLE_PRODUCER" => "Studio Content Producer".to_string(),
        "ROLE_FINANCE" => "Finance & Billing Specialist".to_string(),
        "ROLE_ANALYST" => "Business Intelligence Analyst".to_string(),
        "ROLE_USER" => "OTT Viewer".to_string(),
        other => other
            .trim_start_matches("ROLE_")
            .split('_')
            .filter(|p| !p.is_empty())
            .map(|p| {
                let mut chs = p.chars();
                match chs.next() {
                    Some(first) => format!("{}{}", first.to_uppercase(), chs.as_str().to_lowercase()),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

pub async fn admin_list_roles_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let rows = role::Entity::find()
        .filter(role::Column::Name.not_like("DELETED_%"))
        .order_by_asc(role::Column::Id)
        .all(&state.db)
        .await?;

    // Batch count assigned users per role in 1 SQL query
    let count_rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT role_id, COUNT(*)::bigint AS cnt FROM user_roles GROUP BY role_id".to_string(),
        ))
        .await
        .unwrap_or_default();

    let mut counts: HashMap<i64, i64> = HashMap::with_capacity(count_rows.len());
    for r in count_rows {
        if let (Ok(rid), Ok(cnt)) = (r.try_get::<i64>("", "role_id"), r.try_get::<i64>("", "cnt")) {
            counts.insert(rid, cnt);
        }
    }

    let formatted: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            let code = r.name.clone();
            let user_count = *counts.get(&r.id).unwrap_or(&0);
            let is_sys = r.is_system_role.unwrap_or(false)
                || matches!(
                    code.as_str(),
                    "ROLE_SUPER_ADMIN" | "ROLE_ADMIN" | "ROLE_USER" | "ROLE_PRODUCER"
                );
            json!({
                "id": r.id,
                "code": code,
                "name": role_display_name(&r.name),
                "description": r.description.unwrap_or_else(|| format!("Access control role {}", r.name)),
                "userCount": user_count,
                "systemRole": is_sys,
                "createdAt": r.created_at
            })
        })
        .collect();

    Ok(ApiResponse::ok_response(formatted))
}

pub async fn admin_create_role_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let raw_code = opt_str(&body, &["code", "name"])
        .ok_or_else(|| AppError::BadRequest("Role code/name is required".into()))?
        .to_uppercase()
        .replace(' ', "_");
    let normalized_code = if raw_code.starts_with("ROLE_") {
        raw_code
    } else {
        format!("ROLE_{}", raw_code)
    };

    if let Some(_) = role::Entity::find()
        .filter(role::Column::Name.eq(&normalized_code))
        .one(&state.db)
        .await?
    {
        return Err(AppError::Conflict(format!(
            "Role '{}' already exists",
            normalized_code
        )));
    }

    let desc = opt_str(&body, &["description"]);
    let am = role::ActiveModel {
        name: Set(normalized_code.clone()),
        description: Set(desc.clone()),
        is_system_role: Set(Some(false)),
        created_at: Set(Some(Utc::now().fixed_offset())),
        ..Default::default()
    };
    let saved = am.insert(&state.db).await?;
    let actor = claims.email.as_deref().unwrap_or("admin");
    record_security_audit(
        &state,
        actor,
        "CREATE_ROLE",
        &format!("Created custom RBAC role '{}'", normalized_code),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({
        "id": saved.id,
        "code": saved.name,
        "name": role_display_name(&saved.name),
        "description": saved.description.unwrap_or_default(),
        "userCount": 0,
        "systemRole": false,
        "createdAt": saved.created_at
    })))
}

pub async fn admin_update_role_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let existing = role::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".into()))?;
    let is_sys = existing.is_system_role.unwrap_or(false)
        || matches!(
            existing.name.as_str(),
            "ROLE_SUPER_ADMIN" | "ROLE_ADMIN" | "ROLE_USER" | "ROLE_PRODUCER"
        );

    let prev_name = existing.name.clone();
    let mut am: role::ActiveModel = existing.into();

    if !is_sys {
        if let Some(raw_code) = opt_str(&body, &["code"]) {
            let norm = raw_code.to_uppercase().replace(' ', "_");
            let code = if norm.starts_with("ROLE_") {
                norm
            } else {
                format!("ROLE_{}", norm)
            };
            am.name = Set(code);
        }
    }
    if let Some(desc) = opt_str(&body, &["description"]) {
        am.description = Set(Some(desc));
    }

    let saved = am.update(&state.db).await?;
    let actor = claims.email.as_deref().unwrap_or("admin");
    record_security_audit(
        &state,
        actor,
        "UPDATE_ROLE",
        &format!("Updated RBAC role '{}' (#{})", prev_name, id),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({
        "id": saved.id,
        "code": saved.name,
        "name": role_display_name(&saved.name),
        "description": saved.description.unwrap_or_default(),
        "systemRole": is_sys,
        "createdAt": saved.created_at
    })))
}

pub async fn admin_delete_role_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let existing = role::Entity::find_by_id(id)
        .one(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Role not found".into()))?;
    let is_sys = existing.is_system_role.unwrap_or(false)
        || matches!(
            existing.name.as_str(),
            "ROLE_SUPER_ADMIN" | "ROLE_ADMIN" | "ROLE_USER" | "ROLE_PRODUCER"
        );
    if is_sys {
        return Err(AppError::BadRequest("System roles cannot be deleted".into()));
    }
    let prev_name = existing.name.clone();
    let archived_name = if existing.name.starts_with("DELETED_") {
        existing.name.clone()
    } else {
        format!("DELETED_{}_{}", id, existing.name)
    };
    let mut am: role::ActiveModel = existing.into();
    am.name = Set(archived_name);
    am.update(&state.db).await?;

    let actor = claims.email.as_deref().unwrap_or("admin");
    record_security_audit(
        &state,
        actor,
        "DELETE_ROLE",
        &format!("Soft-deleted custom RBAC role '{}' (#{})", prev_name, id),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({
        "deleted": true,
        "softDeleted": true,
        "id": id
    })))
}

pub async fn admin_get_permission_matrix_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let row = system_setting::Entity::find()
        .filter(system_setting::Column::SettingKey.eq("RBAC_PERMISSION_MATRIX"))
        .one(&state.db)
        .await?;

    let parsed: Value = row
        .and_then(|r| r.setting_value)
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_array())
        .unwrap_or_else(|| json!([]));

    Ok(ApiResponse::ok_response(parsed))
}

pub async fn admin_update_permission_matrix_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    if !body.is_array() {
        return Err(AppError::BadRequest(
            "Permission matrix payload must be an array".into(),
        ));
    }

    let now = Utc::now().fixed_offset();
    let actor = claims.email.as_deref().unwrap_or("admin").to_string();
    let key = "RBAC_PERMISSION_MATRIX".to_string();
    let serialized = body.to_string();

    if let Some(existing) = system_setting::Entity::find()
        .filter(system_setting::Column::SettingKey.eq(&key))
        .one(&state.db)
        .await?
    {
        let mut am: system_setting::ActiveModel = existing.into();
        am.setting_value = Set(Some(serialized));
        am.updated_at = Set(now);
        am.updated_by = Set(Some(actor.clone()));
        am.update(&state.db).await?;
    } else {
        let am = system_setting::ActiveModel {
            setting_key: Set(key),
            setting_value: Set(Some(serialized)),
            setting_group: Set(Some("SECURITY".into())),
            category: Set(Some("SECURITY".into())),
            is_secret: Set(Some(false)),
            is_public: Set(Some(false)),
            updated_at: Set(now),
            updated_by: Set(Some(actor.clone())),
            ..Default::default()
        };
        am.insert(&state.db).await?;
    }

    let count = body.as_array().map(|a| a.len()).unwrap_or(0);
    record_security_audit(
        &state,
        &actor,
        "UPDATE_PERMISSION_MATRIX",
        &format!("Updated RBAC permission matrix ({} permission keys)", count),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({
        "saved": true,
        "count": count,
        "matrix": body
    })))
}

pub async fn admin_get_security_settings_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let row = system_setting::Entity::find()
        .filter(system_setting::Column::SettingKey.eq("SECURITY_POLICY_CONFIG"))
        .one(&state.db)
        .await?;

    let defaults = json!({
        "jwtExpirationHours": 24,
        "refreshTokenExpirationDays": 30,
        "enforceMfaAdmin": true,
        "enforceMfaProducer": false,
        "maxFailedLoginAttempts": 5,
        "allowedIpCidrBlocks": "0.0.0.0/0"
    });

    let parsed = row
        .and_then(|r| r.setting_value)
        .and_then(|s| serde_json::from_str::<Value>(&s).ok())
        .filter(|v| v.is_object())
        .unwrap_or(defaults);

    Ok(ApiResponse::ok_response(parsed))
}

pub async fn admin_update_security_settings_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    if !body.is_object() {
        return Err(AppError::BadRequest(
            "Security settings payload must be a JSON object".into(),
        ));
    }

    if let Some(h) = body.get("jwtExpirationHours").and_then(|v| v.as_i64()) {
        if !(1..=720).contains(&h) {
            return Err(AppError::BadRequest(
                "jwtExpirationHours must be between 1 and 720".into(),
            ));
        }
    }
    if let Some(d) = body.get("refreshTokenExpirationDays").and_then(|v| v.as_i64()) {
        if !(1..=365).contains(&d) {
            return Err(AppError::BadRequest(
                "refreshTokenExpirationDays must be between 1 and 365".into(),
            ));
        }
    }
    if let Some(m) = body.get("maxFailedLoginAttempts").and_then(|v| v.as_i64()) {
        if !(1..=20).contains(&m) {
            return Err(AppError::BadRequest(
                "maxFailedLoginAttempts must be between 1 and 20".into(),
            ));
        }
    }

    let now = Utc::now().fixed_offset();
    let actor = claims.email.as_deref().unwrap_or("admin").to_string();
    let key = "SECURITY_POLICY_CONFIG".to_string();
    if let Some(existing) = system_setting::Entity::find()
        .filter(system_setting::Column::SettingKey.eq(&key))
        .one(&state.db)
        .await?
    {
        let mut am: system_setting::ActiveModel = existing.into();
        am.setting_value = Set(Some(body.to_string()));
        am.updated_at = Set(now);
        am.updated_by = Set(Some(actor.clone()));
        am.update(&state.db).await?;
    } else {
        let am = system_setting::ActiveModel {
            setting_key: Set(key),
            setting_value: Set(Some(body.to_string())),
            setting_group: Set(Some("SECURITY".into())),
            category: Set(Some("SECURITY".into())),
            is_secret: Set(Some(false)),
            is_public: Set(Some(false)),
            updated_at: Set(now),
            updated_by: Set(Some(actor.clone())),
            ..Default::default()
        };
        am.insert(&state.db).await?;
    }

    record_security_audit(
        &state,
        &actor,
        "UPDATE_SECURITY_POLICY",
        &format!(
            "JWT={}h, Refresh={}d, MaxFailed={}, MFA(Admin={}, Producer={})",
            body.get("jwtExpirationHours").and_then(|v| v.as_i64()).unwrap_or(24),
            body.get("refreshTokenExpirationDays").and_then(|v| v.as_i64()).unwrap_or(30),
            body.get("maxFailedLoginAttempts").and_then(|v| v.as_i64()).unwrap_or(5),
            body.get("enforceMfaAdmin").and_then(|v| v.as_bool()).unwrap_or(false),
            body.get("enforceMfaProducer").and_then(|v| v.as_bool()).unwrap_or(false),
        ),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({ "saved": true, "settings": body })))
}

pub async fn admin_audit_logs_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT id, action, user_email, user_role, details, created_at FROM setting_audit_logs ORDER BY created_at DESC LIMIT 100".to_string(),
        ))
        .await
        .unwrap_or_default();

    let logs: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i64>("", "id").unwrap_or(0),
                "action": r.try_get::<String>("", "action").unwrap_or_default(),
                "userEmail": r.try_get::<String>("", "user_email").unwrap_or_else(|_| "admin".into()),
                "userRole": r.try_get::<String>("", "user_role").unwrap_or_else(|_| "ADMIN".into()),
                "details": r.try_get::<String>("", "details").unwrap_or_default(),
                "target": r.try_get::<String>("", "details").unwrap_or_default(),
                "createdAt": r.try_get::<Option<chrono::DateTime<chrono::FixedOffset>>>("", "created_at").ok().flatten(),
            })
        })
        .collect();
    Ok(ApiResponse::ok_response(logs))
}

// ─── ADMIN DATABASE BACKUP (FULL .sql.gz) & SCHEMA MIGRATIONS ────────────────

fn backup_dir() -> PathBuf {
    PathBuf::from("./backups")
}

fn format_bytes(bytes: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let b = bytes as f64;
    if b >= GB {
        format!("{:.2} GB", b / GB)
    } else if b >= MB {
        format!("{:.2} MB", b / MB)
    } else if b >= KB {
        format!("{:.2} KB", b / KB)
    } else {
        format!("{} B", bytes)
    }
}

/// Strips Prisma/TypeORM-only `?schema=public` query params that `pg_dump` rejects.
fn sanitize_pg_url(raw: &str) -> String {
    if let Some((base, qs)) = raw.split_once('?') {
        let kept: Vec<&str> = qs
            .split('&')
            .filter(|kv| {
                let k = kv.split('=').next().unwrap_or("");
                !k.eq_ignore_ascii_case("schema") && !k.is_empty()
            })
            .collect();
        if kept.is_empty() {
            base.to_string()
        } else {
            format!("{}?{}", base, kept.join("&"))
        }
    } else {
        raw.to_string()
    }
}

/// Version-agnostic full PostgreSQL SQL dump (all public tables, all rows, all sequences)
/// used automatically if `pg_dump` is unavailable or has a major-version mismatch.
async fn export_full_sql_fallback(state: &AppState) -> AppResult<(Vec<u8>, usize)> {
    let tables = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name ASC".to_string(),
        ))
        .await?;

    let mut sql = String::with_capacity(256 * 1024);
    sql.push_str("-- MaxxPixels Full PostgreSQL Database Backup\n");
    sql.push_str(&format!("-- Generated at: {}\n", Utc::now().to_rfc3339()));
    sql.push_str("SET standard_conforming_strings = on;\n");
    sql.push_str("SET session_replication_role = 'replica';\nBEGIN;\n\n");

    let mut table_count = 0usize;
    for t_row in tables {
        let table_name = match t_row.try_get::<String>("", "table_name") {
            Ok(n) if !n.is_empty() => n,
            _ => continue,
        };
        table_count += 1;

        let cols = state
            .db
            .query_all(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position ASC",
                vec![table_name.clone().into()],
            ))
            .await
            .unwrap_or_default();

        if cols.is_empty() {
            continue;
        }

        let col_names: Vec<String> = cols
            .into_iter()
            .filter_map(|c| c.try_get::<String>("", "column_name").ok())
            .collect();
        let quoted_cols = col_names
            .iter()
            .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ");
        let val_exprs = col_names
            .iter()
            .map(|c| format!("quote_nullable(\"{}\"::text)", c.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" || ', ' || ");

        let safe_table = table_name.replace('"', "\"\"");
        let dump_query = format!(
            "SELECT 'INSERT INTO \"public\".\"{}\" ({}) VALUES (' || ({}) || ');' AS stmt FROM \"public\".\"{}\"",
            safe_table, quoted_cols, val_exprs, safe_table
        );

        sql.push_str(&format!("-- Table: public.\"{}\"\n", safe_table));
        sql.push_str(&format!("TRUNCATE TABLE \"public\".\"{}\" CASCADE;\n", safe_table));

        if let Ok(rows) = state
            .db
            .query_all(Statement::from_string(DatabaseBackend::Postgres, dump_query))
            .await
        {
            for r in rows {
                if let Ok(stmt) = r.try_get::<String>("", "stmt") {
                    sql.push_str(&stmt);
                    sql.push('\n');
                }
            }
        }
        sql.push('\n');
    }

    // Export all sequence states so BIGSERIAL / SERIAL primary keys continue cleanly
    if let Ok(seqs) = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT sequencename, COALESCE(last_value, 1)::bigint AS last_val, (last_value IS NOT NULL) AS is_called FROM pg_sequences WHERE schemaname = 'public'".to_string(),
        ))
        .await
    {
        sql.push_str("-- Sequences\n");
        for s in seqs {
            if let Ok(seq_name) = s.try_get::<String>("", "sequencename") {
                let last_val = s.try_get::<i64>("", "last_val").unwrap_or(1);
                let is_called = s.try_get::<bool>("", "is_called").unwrap_or(false);
                sql.push_str(&format!(
                    "SELECT setval('public.\"{}\"', {}, {});\n",
                    seq_name.replace('"', "\"\""),
                    last_val,
                    is_called
                ));
            }
        }
    }

    sql.push_str("\nCOMMIT;\nSET session_replication_role = 'origin';\n");
    Ok((sql.into_bytes(), table_count))
}

async fn gzip_bytes(raw: &[u8]) -> AppResult<Vec<u8>> {
    use tokio::io::AsyncWriteExt;
    use tokio::process::Command;

    let mut child = Command::new("gzip")
        .arg("-c")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| AppError::Internal(format!("Failed to launch gzip: {}", e)))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(raw)
            .await
            .map_err(|e| AppError::Internal(format!("gzip stdin error: {}", e)))?;
    }
    let output = child
        .wait_with_output()
        .await
        .map_err(|e| AppError::Internal(format!("gzip wait error: {}", e)))?;
    if !output.status.success() {
        return Err(AppError::Internal(format!(
            "gzip failed: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }
    Ok(output.stdout)
}

#[derive(Debug, Deserialize)]
pub struct DownloadTokenQuery {
    pub token: Option<String>,
}

pub async fn list_migrations_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let list = MigrationRunner::list_status(&state.db).await;
    Ok(ApiResponse::ok_response(list))
}

pub async fn list_backups_handler(claims: Claims) -> AppResult<Response> {
    require_admin(&claims)?;
    let dir = backup_dir();
    let _ = tokio::fs::create_dir_all(&dir).await;
    let mut entries_list: Vec<(u64, Value)> = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_file() {
                    let filename = entry.file_name().to_string_lossy().to_string();
                    let size_bytes = meta.len();
                    let modified_secs = meta
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs())
                        .unwrap_or(0);
                    let dt = chrono::DateTime::<Utc>::from_timestamp(modified_secs as i64, 0)
                        .unwrap_or_else(Utc::now);
                    entries_list.push((
                        modified_secs,
                        json!({
                            "filename": filename,
                            "sizeBytes": size_bytes,
                            "sizeFormatted": format_bytes(size_bytes),
                            "lastModified": modified_secs * 1000,
                            "lastModifiedDate": dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
                            "downloadUrl": format!("/api/v1/backup/download/{}", filename),
                            "storedLocally": true,
                            "storedOnBunny": false,
                            "storageProvider": "LOCAL"
                        }),
                    ));
                }
            }
        }
    }
    entries_list.sort_by(|a, b| b.0.cmp(&a.0));
    let files: Vec<Value> = entries_list.into_iter().map(|(_, v)| v).collect();
    Ok(ApiResponse::ok_response(files))
}

async fn resolve_bunny_setting(state: &AppState, keys: &[&str], fallback: &str) -> String {
    for key in keys {
        if let Ok(Some(row)) = system_setting::Entity::find()
            .filter(system_setting::Column::SettingKey.eq(*key))
            .one(&state.db)
            .await
        {
            if let Some(val) = row
                .setting_value
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty() && !s.contains("***"))
            {
                return val;
            }
        }
    }
    fallback.trim().to_string()
}

/// Removes local backup files older than `retention_days` (default 30 days).
async fn prune_old_local_backups(dir: &PathBuf, retention_days: u64) {
    let max_age = std::time::Duration::from_secs(retention_days * 86_400);
    let now = std::time::SystemTime::now();
    if let Ok(mut entries) = tokio::fs::read_dir(dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                if meta.is_file() {
                    if let Ok(modified) = meta.modified() {
                        if let Ok(age) = now.duration_since(modified) {
                            if age > max_age {
                                let _ = tokio::fs::remove_file(entry.path()).await;
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Executes a full PostgreSQL database backup (.sql.gz), saves it locally,
/// uploads to Bunny.net Storage (`db-backups/<filename>`), prunes >30d local archives,
/// and logs the run in `setting_audit_logs`.
pub async fn run_full_database_backup(state: &AppState, actor: &str) -> AppResult<Value> {
    let dir = backup_dir();
    tokio::fs::create_dir_all(&dir)
        .await
        .map_err(|e| AppError::Internal(format!("Backup dir error: {}", e)))?;

    let filename = format!(
        "maxxpixels-full-backup-{}.sql.gz",
        Utc::now().format("%Y%m%d-%H%M%S")
    );
    let pg_url = sanitize_pg_url(&state.config.database_url);

    // Primary strategy: full native pg_dump (schema + data + constraints + indexes + sequences)
    let pg_dump_attempt = tokio::process::Command::new("pg_dump")
        .arg("--no-owner")
        .arg("--no-privileges")
        .arg("--clean")
        .arg("--if-exists")
        .arg("--format=plain")
        .arg(&pg_url)
        .output()
        .await;

    let (raw_sql, method, table_count) = match pg_dump_attempt {
        Ok(out) if out.status.success() && !out.stdout.is_empty() => {
            let tbl_cnt = state
                .db
                .query_one(Statement::from_string(
                    DatabaseBackend::Postgres,
                    "SELECT COUNT(*)::bigint AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'".to_string(),
                ))
                .await
                .ok()
                .flatten()
                .and_then(|r| r.try_get::<i64>("", "cnt").ok())
                .unwrap_or(0) as usize;
            (out.stdout, "pg_dump", tbl_cnt)
        }
        _ => {
            // Automatic fallback: version-agnostic full SQL dump of ALL public tables + sequences
            let (sql_bytes, tbl_cnt) = export_full_sql_fallback(state).await?;
            (sql_bytes, "full_sql_exporter", tbl_cnt)
        }
    };

    let gz_bytes = gzip_bytes(&raw_sql).await?;
    let path = dir.join(&filename);
    tokio::fs::write(&path, &gz_bytes)
        .await
        .map_err(|e| AppError::Internal(format!("Backup write error: {}", e)))?;

    // Upload to Bunny.net Storage (reads DB system_settings first, then env fallback)
    let mut stored_on_bunny = false;
    let mut cdn_url: Option<String> = None;
    let mut bunny_error: Option<String> = None;

    let zone = resolve_bunny_setting(
        state,
        &["bunnyStorageZoneName", "BUNNY_STORAGE_ZONE_NAME"],
        &state.config.bunny_storage_zone_name,
    )
    .await;
    let pass = resolve_bunny_setting(
        state,
        &["bunnyStorageZonePassword", "BUNNY_STORAGE_ZONE_PASSWORD"],
        &state.config.bunny_storage_zone_password,
    )
    .await;
    let region = resolve_bunny_setting(
        state,
        &["bunnyStorageRegion", "BUNNY_STORAGE_REGION"],
        &std::env::var("BUNNY_STORAGE_REGION").unwrap_or_default(),
    )
    .await;
    let pull_domain = resolve_bunny_setting(
        state,
        &["bunnyCdnHostname", "BUNNY_CDN_HOSTNAME"],
        &state.config.bunny_pull_zone_domain,
    )
    .await;

    if !zone.is_empty() && !pass.is_empty() {
        let prefix = if region.is_empty()
            || region.eq_ignore_ascii_case("de")
            || region.eq_ignore_ascii_case("eu")
        {
            String::new()
        } else {
            format!("{}.", region.to_lowercase())
        };
        let upload_url = format!(
            "https://{}storage.bunnycdn.com/{}/db-backups/{}",
            prefix, zone, filename
        );
        if let Ok(client) = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
        {
            match client
                .put(&upload_url)
                .header("AccessKey", &pass)
                .header("Content-Type", "application/gzip")
                .body(gz_bytes.clone())
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    stored_on_bunny = true;
                    if !pull_domain.is_empty() {
                        cdn_url = Some(format!(
                            "https://{}/db-backups/{}",
                            pull_domain
                                .trim_start_matches("https://")
                                .trim_start_matches("http://"),
                            filename
                        ));
                    }
                }
                Ok(resp) => {
                    bunny_error = Some(format!("HTTP {}", resp.status().as_u16()));
                }
                Err(e) => {
                    bunny_error = Some(e.to_string());
                }
            }
        }
    }

    // Prune local archives older than 30 days
    prune_old_local_backups(&dir, 30).await;

    let size_bytes = gz_bytes.len() as u64;
    let size_formatted = format_bytes(size_bytes);
    record_security_audit(
        state,
        actor,
        "DATABASE_BACKUP",
        &format!(
            "Full DB backup '{}' ({}, {} tables, method={}, bunny={}{})",
            filename,
            size_formatted,
            table_count,
            method,
            stored_on_bunny,
            bunny_error
                .as_ref()
                .map(|e| format!(", bunnyErr={}", e))
                .unwrap_or_default()
        ),
    )
    .await;

    Ok(json!({
        "filename": filename,
        "sizeBytes": size_bytes,
        "sizeFormatted": size_formatted,
        "tableCount": table_count,
        "method": method,
        "storedLocally": true,
        "storedOnBunny": stored_on_bunny,
        "cdnUrl": cdn_url,
        "bunnyError": bunny_error,
        "status": "COMPLETED"
    }))
}

pub async fn trigger_backup_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    require_admin(&claims)?;
    let actor = claims.email.as_deref().unwrap_or("admin");
    let data = run_full_database_backup(&state, actor).await?;
    Ok(ApiResponse::ok_response(data))
}

/// Spawns a daily 1:00 AM IST background cron job that runs `run_full_database_backup`
/// and uploads the `.sql.gz` archive to Bunny.net Storage.
/// Uses PostgreSQL advisory lock (7742027) so multi-replica deployments never duplicate runs.
pub fn spawn_daily_backup_cron(state: AppState) {
    tokio::spawn(async move {
        let target_hour_ist: u32 = std::env::var("BACKUP_CRON_HOUR_IST")
            .ok()
            .and_then(|v| v.parse().ok())
            .filter(|h| *h < 24)
            .unwrap_or(1);

        // IST is UTC+05:30 (19800 seconds)
        let ist_offset = chrono::FixedOffset::east_opt(5 * 3600 + 30 * 60)
            .expect("valid IST offset");

        loop {
            let now_ist = Utc::now().with_timezone(&ist_offset);
            let today_target = now_ist
                .date_naive()
                .and_hms_opt(target_hour_ist, 0, 0)
                .unwrap()
                .and_local_timezone(ist_offset)
                .unwrap();
            let next_run = if now_ist < today_target {
                today_target
            } else {
                today_target + chrono::Duration::days(1)
            };
            let wait_secs = (next_run.timestamp() - now_ist.timestamp()).max(1) as u64;
            tracing::info!(
                "db-backup-cron: next scheduled full backup to Bunny.net at {} (in {}s)",
                next_run.to_rfc3339(),
                wait_secs
            );

            tokio::time::sleep(std::time::Duration::from_secs(wait_secs)).await;

            // Acquire non-blocking PostgreSQL advisory lock so only 1 replica executes
            let locked = state
                .db
                .query_one(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "SELECT pg_try_advisory_lock($1) AS locked",
                    vec![7742027_i64.into()],
                ))
                .await
                .ok()
                .flatten()
                .and_then(|r| r.try_get::<bool>("", "locked").ok())
                .unwrap_or(false);

            if locked {
                match run_full_database_backup(&state, "cron-1am-daily").await {
                    Ok(res) => tracing::info!("db-backup-cron: daily 1 AM backup completed: {}", res),
                    Err(e) => tracing::error!("db-backup-cron: daily 1 AM backup failed: {}", e),
                }
                let _ = state
                    .db
                    .execute(Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        "SELECT pg_advisory_unlock($1)",
                        vec![7742027_i64.into()],
                    ))
                    .await;
            }
        }
    });
}

pub async fn download_backup_handler(
    headers: axum::http::HeaderMap,
    Query(q): Query<DownloadTokenQuery>,
    Path(filename): Path<String>,
) -> Response {
    // Support both Authorization header and ?token= query param (used by <a href> download links)
    let raw_token = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_start_matches("Bearer ").trim_start_matches("bearer ").trim().to_string())
        .or_else(|| q.token.map(|t| t.trim().to_string()))
        .unwrap_or_default();

    let jwt_secret = match std::env::var("JWT_SECRET") {
        Ok(s) if !s.is_empty() => s,
        _ => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };

    let claims = match SecurityUtils::validate_jwt(&raw_token, &jwt_secret) {
        Ok(c) if c.is_admin() => c,
        Ok(_) => return StatusCode::FORBIDDEN.into_response(),
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };
    let _ = claims;

    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let path = backup_dir().join(&filename);
    let content_type = if filename.ends_with(".gz") {
        "application/gzip"
    } else if filename.ends_with(".sql") {
        "application/sql"
    } else {
        "application/octet-stream"
    };

    match tokio::fs::read(&path).await {
        Ok(bytes) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, content_type)
            .header(
                header::CONTENT_DISPOSITION,
                format!("attachment; filename=\"{}\"", filename),
            )
            .body(Body::from(bytes))
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response()),
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

pub async fn delete_backup_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(filename): Path<String>,
) -> AppResult<Response> {
    require_admin(&claims)?;
    if filename.contains("..") || filename.contains('/') || filename.contains('\\') {
        return Err(AppError::BadRequest("Invalid backup filename".into()));
    }
    let path = backup_dir().join(&filename);
    if !path.exists() {
        return Err(AppError::NotFound(format!("Backup '{}' not found", filename)));
    }
    tokio::fs::remove_file(&path)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete backup: {}", e)))?;

    let actor = claims.email.as_deref().unwrap_or("admin");
    record_security_audit(
        &state,
        actor,
        "DELETE_DATABASE_BACKUP",
        &format!("Deleted local backup archive '{}'", filename),
    )
    .await;

    Ok(ApiResponse::ok_response(json!({
        "deleted": true,
        "filename": filename
    })))
}

// ─── CAST MEMBERS (NAME, PROFILE PHOTO, ROLE, BIO) ──────────────────────────

pub async fn list_cast_members_handler(
    State(state): State<AppState>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let rows = state
        .db
        .query_all(Statement::from_string(
            DatabaseBackend::Postgres,
            "SELECT id, name, COALESCE(role, 'Actor') AS role, COALESCE(bio, '') AS bio, COALESCE(image_url, '') AS image_url \
             FROM cast_members WHERE COALESCE(is_active, true) = true ORDER BY name ASC"
                .to_string(),
        ))
        .await?;

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            let id: i64 = row.try_get("", "id").unwrap_or(0);
            let name: String = row.try_get("", "name").unwrap_or_default();
            let role: String = row.try_get("", "role").unwrap_or_else(|_| "Actor".into());
            let bio: String = row.try_get("", "bio").unwrap_or_default();
            let image_url: String = row.try_get("", "image_url").unwrap_or_default();
            json!({
                "id": id,
                "name": name,
                "role": role,
                "bio": bio,
                "image": image_url,
                "imageUrl": image_url,
                "photoUrl": image_url
            })
        })
        .collect();

    Ok(ApiResponse::ok_response(items))
}

pub async fn create_cast_member_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"])
        .ok_or_else(|| AppError::BadRequest("Cast person name is required".into()))?;
    let role = opt_str(&body, &["role"]).unwrap_or_else(|| "Actor".into());
    let bio = opt_str(&body, &["bio"]).unwrap_or_default();
    let image_url = opt_str(&body, &["imageUrl", "image_url", "image", "photoUrl", "profileImageUrl"])
        .unwrap_or_default();

    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO cast_members (name, role, bio, image_url, is_active, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, true, NOW(), NOW()) RETURNING id",
            [name.clone().into(), role.clone().into(), bio.clone().into(), image_url.clone().into()],
        ))
        .await?
        .ok_or_else(|| AppError::Internal("Failed to create cast member".into()))?;

    let id: i64 = row.try_get("", "id").unwrap_or(0);
    Ok(ApiResponse::ok_response(json!({
        "id": id,
        "name": name,
        "role": role,
        "bio": bio,
        "image": image_url,
        "imageUrl": image_url,
        "photoUrl": image_url
    })))
}

pub async fn update_cast_member_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"]).unwrap_or_default();
    let role = opt_str(&body, &["role"]).unwrap_or_else(|| "Actor".into());
    let bio = opt_str(&body, &["bio"]).unwrap_or_default();
    let image_url = opt_str(&body, &["imageUrl", "image_url", "image", "photoUrl", "profileImageUrl"])
        .unwrap_or_default();

    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE cast_members SET \
             name = COALESCE(NULLIF($1, ''), name), \
             role = COALESCE(NULLIF($2, ''), role), \
             bio = $3, \
             image_url = COALESCE(NULLIF($4, ''), image_url), \
             updated_at = NOW() \
             WHERE id = $5",
            [name.clone().into(), role.clone().into(), bio.clone().into(), image_url.clone().into(), id.into()],
        ))
        .await?;

    Ok(ApiResponse::ok_response(json!({
        "id": id,
        "name": name,
        "role": role,
        "bio": bio,
        "image": image_url,
        "imageUrl": image_url,
        "photoUrl": image_url
    })))
}

pub async fn delete_cast_member_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE cast_members SET is_active = false, updated_at = NOW() WHERE id = $1",
            [id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({
        "id": id,
        "deleted": true,
        "softDeleted": true
    })))
}

// ─── BASIC DETAILS CRUD (MAIN TYPES, CATEGORIES, GENRES, LANGUAGES) ─────────

fn make_slug(s: &str) -> String {
    let out: String = s
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    out.split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-")
}

pub async fn admin_create_content_type_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name", "title"])
        .ok_or_else(|| AppError::BadRequest("Type name is required".into()))?;
    let slug = opt_str(&body, &["slug"]).unwrap_or_else(|| make_slug(&name));
    let desc = opt_str(&body, &["description"]).unwrap_or_default();
    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO content_types (slug, title, name, description, is_active, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, true, NOW(), NOW()) \
             ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, name = EXCLUDED.name, description = EXCLUDED.description, is_active = true, updated_at = NOW() \
             RETURNING id",
            [slug.clone().into(), name.clone().into(), name.clone().into(), desc.clone().into()],
        ))
        .await?
        .ok_or_else(|| AppError::Internal("Failed to create main type".into()))?;
    let id: i64 = row.try_get("", "id").unwrap_or(0);
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "title": name, "slug": slug, "description": desc, "isActive": true })))
}

pub async fn admin_update_content_type_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name", "title"]).unwrap_or_default();
    let slug = opt_str(&body, &["slug"]).unwrap_or_else(|| if name.is_empty() { String::new() } else { make_slug(&name) });
    let desc = opt_str(&body, &["description"]).unwrap_or_default();
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE content_types SET \
             name = COALESCE(NULLIF($1, ''), name), \
             title = COALESCE(NULLIF($1, ''), title), \
             slug = COALESCE(NULLIF($2, ''), slug), \
             description = $3, updated_at = NOW() WHERE id = $4",
            [name.clone().into(), slug.clone().into(), desc.into(), id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "slug": slug })))
}

pub async fn admin_delete_content_type_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE content_types SET is_active = false, updated_at = NOW() WHERE id = $1",
            [id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "deleted": true, "softDeleted": true })))
}

pub async fn admin_create_category_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"])
        .ok_or_else(|| AppError::BadRequest("Category name is required".into()))?;
    let slug = opt_str(&body, &["slug"]).unwrap_or_else(|| make_slug(&name));
    let desc = opt_str(&body, &["description"]).unwrap_or_default();
    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO categories (name, slug, description, is_active) VALUES ($1, $2, $3, true) \
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, is_active = true \
             RETURNING id",
            [name.clone().into(), slug.clone().into(), desc.clone().into()],
        ))
        .await?
        .ok_or_else(|| AppError::Internal("Failed to create category".into()))?;
    let id: i64 = row.try_get("", "id").unwrap_or(0);
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "slug": slug, "description": desc, "isActive": true })))
}

pub async fn admin_update_category_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"]).unwrap_or_default();
    let slug = opt_str(&body, &["slug"]).unwrap_or_default();
    let desc = opt_str(&body, &["description"]).unwrap_or_default();
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE categories SET name = COALESCE(NULLIF($1, ''), name), slug = COALESCE(NULLIF($2, ''), slug), description = $3 WHERE id = $4",
            [name.clone().into(), slug.clone().into(), desc.into(), id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "slug": slug })))
}

pub async fn admin_delete_category_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE categories SET is_active = false WHERE id = $1",
            [id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "deleted": true, "softDeleted": true })))
}

pub async fn admin_create_genre_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"])
        .ok_or_else(|| AppError::BadRequest("Genre name is required".into()))?;
    let slug = opt_str(&body, &["slug"]).unwrap_or_else(|| make_slug(&name));
    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO genres (name, slug, is_active) VALUES ($1, $2, true) \
             ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, is_active = true \
             RETURNING id",
            [name.clone().into(), slug.clone().into()],
        ))
        .await?
        .ok_or_else(|| AppError::Internal("Failed to create genre".into()))?;
    let id: i64 = row.try_get("", "id").unwrap_or(0);
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "slug": slug, "isActive": true })))
}

pub async fn admin_update_genre_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"]).unwrap_or_default();
    let slug = opt_str(&body, &["slug"]).unwrap_or_default();
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE genres SET name = COALESCE(NULLIF($1, ''), name), slug = COALESCE(NULLIF($2, ''), slug) WHERE id = $3",
            [name.clone().into(), slug.clone().into(), id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "slug": slug })))
}

pub async fn admin_delete_genre_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE genres SET is_active = false WHERE id = $1",
            [id.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "id": id, "deleted": true, "softDeleted": true })))
}

pub async fn admin_create_language_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"])
        .ok_or_else(|| AppError::BadRequest("Language name is required".into()))?;
    let code = opt_str(&body, &["code"])
        .unwrap_or_else(|| name.chars().take(2).collect::<String>().to_lowercase())
        .to_lowercase();
    let native_name = opt_str(&body, &["nativeName", "native_name"]).unwrap_or_else(|| name.clone());
    let row = state
        .db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO languages (name, code, native_name, is_active) VALUES ($1, $2, $3, true) \
             ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, native_name = EXCLUDED.native_name, is_active = true \
             RETURNING id",
            [name.clone().into(), code.clone().into(), native_name.clone().into()],
        ))
        .await?
        .ok_or_else(|| AppError::Internal("Failed to create language".into()))?;
    let id: i64 = row.try_get("", "id").unwrap_or(0);
    Ok(ApiResponse::ok_response(json!({ "id": id, "name": name, "code": code, "nativeName": native_name, "isActive": true })))
}

pub async fn admin_update_language_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(code): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    let name = opt_str(&body, &["name"]).unwrap_or_default();
    let new_code = opt_str(&body, &["code"]).unwrap_or_else(|| code.clone()).to_lowercase();
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE languages SET name = COALESCE(NULLIF($1, ''), name), code = COALESCE(NULLIF($2, ''), code) WHERE code = $3 OR id::text = $3",
            [name.clone().into(), new_code.clone().into(), code.into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "name": name, "code": new_code })))
}

pub async fn admin_delete_language_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(code): Path<String>,
) -> AppResult<Response> {
    use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
    state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE languages SET is_active = false WHERE code = $1 OR id::text = $1",
            [code.clone().into()],
        ))
        .await?;
    Ok(ApiResponse::ok_response(json!({ "code": code, "deleted": true, "softDeleted": true })))
}
