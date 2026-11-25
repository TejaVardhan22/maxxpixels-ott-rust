use chrono::Utc;
use maxx_common::error::AppError;
use maxx_core::entities::{banner, content, legal_page, page, section, system_setting};
use maxx_core::AppState;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter,
    QueryOrder, Set, Statement, TransactionTrait,
};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

type AppResult<T> = Result<T, AppError>;

const PUBLIC_SETTINGS_CACHE_KEY: &str = "settings:public:v1";
const PUBLIC_SETTINGS_CACHE_TTL_SECS: u64 = 60;

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .pool_max_idle_per_host(8)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn is_secret_key(key: &str) -> bool {
    let k = key.to_lowercase();
    k.contains("secret")
        || k.contains("password")
        || k.contains("api_key")
        || k.contains("apikey")
        || k.contains("auth_key")
        || k.contains("authkey")
        || k.contains("token_key")
        || k.contains("private_key")
        || k.contains("server_key")
        || k.contains("serverkey")
        || k.contains("access_key")
        || k.contains("accesskey")
}

fn mask_secret_value(v: &str) -> String {
    let trimmed = v.trim();
    if trimmed.is_empty() {
        String::new()
    } else if trimmed.len() > 6 {
        format!("{}***{}", &trimmed[..3], &trimmed[trimmed.len() - 2..])
    } else {
        "***".to_string()
    }
}

fn infer_setting_group(key: &str) -> &'static str {
    let k = key.to_lowercase();
    if k.contains("bunny") || k.contains("s3") || k.contains("storage") || k.contains("cdn") {
        "STORAGE"
    } else if k.contains("razorpay")
        || k.contains("stripe")
        || k.contains("payment")
        || k.contains("currency")
        || k.contains("renewal")
    {
        "PAYMENTS"
    } else if k.contains("smtp")
        || k.contains("msg91")
        || k.contains("sms")
        || k.contains("fcm")
        || k.contains("push")
    {
        "NOTIFICATIONS"
    } else if k.contains("admob") || k.contains("vast") || k.contains("inmobi") {
        "ADMOB"
    } else if k.contains("maintenance") || k.contains("feature") {
        "MAINTENANCE"
    } else if k.contains("player") || k.contains("watermark") {
        "PLAYER"
    } else if k.contains("device") || k.contains("concurrent") || k.contains("screen_recording") || k.contains("screenrecording") {
        "RESTRICTIONS"
    } else if k.contains("apk") || k.contains("game") {
        "GAMES_APK"
    } else {
        "BRANDING"
    }
}

async fn ensure_audit_table(state: &AppState) {
    let sql = r#"
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
    "#;
    let _ = state
        .db
        .execute(Statement::from_string(DatabaseBackend::Postgres, sql.to_string()))
        .await;
}

fn to_camel_case(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut result = String::with_capacity(lower.len());
    let mut capitalize_next = false;
    for ch in lower.chars() {
        if ch == '_' || ch == '-' {
            capitalize_next = true;
        } else if capitalize_next {
            result.extend(ch.to_uppercase());
            capitalize_next = false;
        } else {
            result.push(ch);
        }
    }
    result
}

fn camel_to_screaming_snake(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for (i, ch) in s.chars().enumerate() {
        if ch.is_uppercase() && i > 0 {
            out.push('_');
        }
        out.extend(ch.to_uppercase());
    }
    out
}

pub struct AdminService;

impl AdminService {
    pub async fn get_public_settings(state: &AppState) -> AppResult<Value> {
        // Fast path: serve from Redis cache
        if let Some(cached) = state.redis.get::<Value>(PUBLIC_SETTINGS_CACHE_KEY).await {
            return Ok(cached);
        }

        let rows = system_setting::Entity::find()
            .order_by_asc(system_setting::Column::UpdatedAt)
            .order_by_asc(system_setting::Column::Id)
            .all(&state.db)
            .await
            .unwrap_or_default();

        let mut map = Map::new();
        map.insert("APP_NAME".into(), json!("MaxxPixels OTT"));
        map.insert("app_name".into(), json!("MaxxPixels OTT"));
        map.insert("appName".into(), json!("MaxxPixels OTT"));
        map.insert("platform_name".into(), json!("MaxxPixels OTT"));
        map.insert("app_short_name".into(), json!("MaxxPixels"));
        map.insert("appShortName".into(), json!("MaxxPixels"));
        map.insert("logo_url".into(), json!("assets/logo.png"));
        map.insert("logoUrl".into(), json!("assets/logo.png"));
        map.insert("dark_logo_url".into(), json!("assets/logo.png"));
        map.insert("darkLogoUrl".into(), json!("assets/logo.png"));
        map.insert("DEFAULT_CURRENCY".into(), json!("INR"));
        map.insert("default_currency".into(), json!("INR"));
        map.insert("defaultCurrency".into(), json!("INR"));
        map.insert("DEFAULT_LANGUAGE".into(), json!("hi"));
        map.insert("default_language".into(), json!("hi"));
        map.insert("defaultLanguage".into(), json!("hi"));
        map.insert("admob_enabled".into(), json!("false"));
        map.insert("admobEnabled".into(), json!("false"));
        map.insert("maintenance_mode".into(), json!("false"));
        map.insert("maintenanceMode".into(), json!("false"));

        // Non-secret runtime infrastructure config sourced from backend env (DB settings below can override)
        let public_base_url = std::env::var("PUBLIC_BASE_URL").unwrap_or_default();
        if !public_base_url.is_empty() {
            map.insert("publicBaseUrl".into(), json!(public_base_url));
            map.insert("public_base_url".into(), json!(public_base_url));
        }
        if !state.config.bunny_stream_library_id.is_empty() {
            map.insert("bunnyStreamLibraryId".into(), json!(state.config.bunny_stream_library_id));
            map.insert("bunny_stream_library_id".into(), json!(state.config.bunny_stream_library_id));
        }
        if !state.config.bunny_stream_cdn_hostname.is_empty() {
            map.insert("bunnyStreamCdnHostname".into(), json!(state.config.bunny_stream_cdn_hostname));
            map.insert("bunny_stream_cdn_hostname".into(), json!(state.config.bunny_stream_cdn_hostname));
        }
        if !state.config.bunny_storage_zone_name.is_empty() {
            map.insert("bunnyStorageZoneName".into(), json!(state.config.bunny_storage_zone_name));
            map.insert("bunny_storage_zone_name".into(), json!(state.config.bunny_storage_zone_name));
        }

        for r in rows {
            let secret = r.is_secret.unwrap_or(false) || is_secret_key(&r.setting_key);
            if !secret {
                if let Some(val) = r.setting_value {
                    let lower = r.setting_key.to_lowercase();
                    let camel = to_camel_case(&r.setting_key);
                    map.insert(r.setting_key, json!(val));
                    map.insert(lower, json!(val));
                    map.insert(camel, json!(val));
                }
            }
        }

        let result = Value::Object(map);
        let _ = state
            .redis
            .set(PUBLIC_SETTINGS_CACHE_KEY, &result, PUBLIC_SETTINGS_CACHE_TTL_SECS)
            .await;
        Ok(result)
    }

    pub async fn get_all_settings(
        state: &AppState,
        group: Option<&str>,
    ) -> AppResult<Value> {
        let mut q = system_setting::Entity::find()
            .order_by_asc(system_setting::Column::UpdatedAt)
            .order_by_asc(system_setting::Column::Id);
        if let Some(g) = group.filter(|s| !s.is_empty()) {
            q = q.filter(system_setting::Column::SettingGroup.eq(g.to_uppercase()));
        }
        let rows = q.all(&state.db).await?;
        let mut items = Vec::with_capacity(rows.len());
        let mut map = Map::new();

        // Non-secret runtime env fallbacks so Admin Settings reflects live server config dynamically (DB rows below override)
        let env_fallbacks: [(&str, Option<String>); 10] = [
            ("publicBaseUrl", std::env::var("PUBLIC_BASE_URL").ok()),
            ("bunnyStreamLibraryId", Some(state.config.bunny_stream_library_id.clone())),
            ("bunnyStreamCdnHostname", Some(state.config.bunny_stream_cdn_hostname.clone())),
            ("bunnyStorageZoneName", Some(state.config.bunny_storage_zone_name.clone())),
            ("bunnyCdnHostname", std::env::var("BUNNY_PULL_ZONE_DOMAIN").ok()),
            ("bunnyStorageRegion", std::env::var("BUNNY_STORAGE_REGION").ok()),
            ("razorpayKeyId", Some(state.config.razorpay_key_id.clone())),
            ("smsProvider", std::env::var("SMS_PROVIDER").ok()),
            ("msg91TemplateId", std::env::var("MSG91_TEMPLATE_ID").ok()),
            ("fcmProjectId", std::env::var("FCM_PROJECT_ID").ok()),
        ];
        for (key, val_opt) in env_fallbacks {
            if let Some(val) = val_opt.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
                map.entry(key.to_string()).or_insert_with(|| json!(val));
            }
        }
        if let Ok(val) = std::env::var("EMAIL_FROM") {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                map.entry("smtpFromEmail".to_string()).or_insert_with(|| json!(trimmed));
            }
        }

        for r in rows {
            let secret = r.is_secret.unwrap_or(false) || is_secret_key(&r.setting_key);
            let masked = if secret {
                r.setting_value.as_deref().map(mask_secret_value)
            } else {
                r.setting_value.clone()
            };

            if let Some(ref val) = masked {
                let lower = r.setting_key.to_lowercase();
                let camel = to_camel_case(&r.setting_key);
                map.insert(r.setting_key.clone(), json!(val));
                map.insert(lower, json!(val));
                map.insert(camel, json!(val));
            }

            items.push(json!({
                "id": r.id,
                "settingKey": r.setting_key,
                "settingValue": masked,
                "category": r.category,
                "settingGroup": r.setting_group.unwrap_or_else(|| infer_setting_group(&r.setting_key).to_string()),
                "description": r.description,
                "isSecret": secret,
                "isPublic": r.is_public.unwrap_or(!secret),
                "updatedAt": r.updated_at,
                "updatedBy": r.updated_by
            }));
        }

        if group.filter(|s| !s.is_empty()).is_some() {
            Ok(Value::Array(items))
        } else {
            map.insert("items".into(), Value::Array(items));
            Ok(Value::Object(map))
        }
    }

    pub async fn get_setting_by_key(state: &AppState, key: &str) -> AppResult<Value> {
        let snake_key = if key.chars().any(|c| c.is_lowercase()) && !key.contains('_') {
            camel_to_screaming_snake(key)
        } else {
            key.to_string()
        };
        let row = system_setting::Entity::find()
            .filter(
                system_setting::Column::SettingKey
                    .eq(key)
                    .or(system_setting::Column::SettingKey.eq(&snake_key)),
            )
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Setting '{}' not found", key)))?;

        let secret = row.is_secret.unwrap_or(false) || is_secret_key(&row.setting_key);
        let value = if secret {
            row.setting_value.as_deref().map(mask_secret_value)
        } else {
            row.setting_value
        };
        Ok(json!({
            "id": row.id,
            "settingKey": row.setting_key,
            "settingValue": value,
            "settingGroup": row.setting_group.unwrap_or_else(|| infer_setting_group(&row.setting_key).to_string()),
            "description": row.description,
            "isSecret": secret,
            "isPublic": row.is_public.unwrap_or(!secret),
            "updatedAt": row.updated_at,
            "updatedBy": row.updated_by
        }))
    }

    pub async fn upsert_setting_by_key(
        state: &AppState,
        key: &str,
        body: Value,
        updated_by: &str,
    ) -> AppResult<Value> {
        let value = body
            .get("value")
            .or_else(|| body.get("settingValue"))
            .cloned()
            .ok_or_else(|| AppError::BadRequest("Setting value is required".to_string()))?;
        let mut payload = Map::new();
        payload.insert(key.to_string(), value);
        Self::update_settings(state, Value::Object(payload), updated_by).await?;
        Self::get_setting_by_key(state, key).await
    }

    pub async fn delete_setting_by_key(
        state: &AppState,
        key: &str,
        updated_by: &str,
    ) -> AppResult<Value> {
        let snake_key = if key.chars().any(|c| c.is_lowercase()) && !key.contains('_') {
            camel_to_screaming_snake(key)
        } else {
            key.to_string()
        };
        let existing = system_setting::Entity::find()
            .filter(
                system_setting::Column::SettingKey
                    .eq(key)
                    .or(system_setting::Column::SettingKey.eq(&snake_key)),
            )
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Setting '{}' not found", key)))?;

        // Soft-reset value to NULL so row history is preserved
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let prev_val = existing.setting_value.clone().unwrap_or_default();
        let key_name = existing.setting_key.clone();
        let secret = existing.is_secret.unwrap_or(false) || is_secret_key(&key_name);

        let mut am: system_setting::ActiveModel = existing.into();
        am.setting_value = Set(None);
        am.updated_at = Set(now);
        am.updated_by = Set(Some(updated_by.to_string()));
        am.update(&state.db).await?;

        ensure_audit_table(state).await;
        let mut before = Map::new();
        let mut after = Map::new();
        if !secret {
            before.insert(key_name.clone(), json!(prev_val));
            after.insert(key_name.clone(), json!(""));
        }
        let details = if secret {
            format!("Reset secret key '{}'", key_name)
        } else {
            format!("Reset '{}' (was '{}')", key_name, prev_val)
        };
        let _ = state
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "INSERT INTO setting_audit_logs (action, user_email, user_role, details, before_snapshot, after_snapshot) VALUES ($1, $2, 'ADMIN', $3, $4, $5)",
                vec![
                    "RESET_SETTING".into(),
                    updated_by.into(),
                    details.into(),
                    Value::Object(before).into(),
                    Value::Object(after).into(),
                ],
            ))
            .await;

        let _ = state.redis.del(PUBLIC_SETTINGS_CACHE_KEY).await;
        Ok(json!({ "deleted": true, "settingKey": key_name }))
    }

    pub async fn update_settings(
        state: &AppState,
        body: Value,
        updated_by: &str,
    ) -> AppResult<Value> {
        let obj = match body.as_object() {
            Some(o) => o,
            None => return Ok(json!({ "updated": 0 })),
        };

        // Load all existing settings in 1 query and group ALL alias rows (e.g. logoUrl, logo_url, LOGO_URL)
        // so updating a key keeps every legacy/alias row in sync and prevents stale rows from overwriting fresh values.
        let existing_rows = system_setting::Entity::find().all(&state.db).await?;
        let mut by_canonical: HashMap<String, Vec<system_setting::Model>> =
            HashMap::with_capacity(existing_rows.len());
        for row in existing_rows {
            let norm = camel_to_screaming_snake(&row.setting_key);
            by_canonical.entry(norm.clone()).or_default().push(row.clone());
            // Keep APP_LOGO_URL in sync when logoUrl / LOGO_URL is saved
            if norm == "APP_LOGO_URL" {
                by_canonical.entry("LOGO_URL".to_string()).or_default().push(row);
            }
        }

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let txn = state.db.begin().await?;
        let mut updated_count = 0usize;
        let mut diff_lines: Vec<String> = Vec::new();
        let mut before_snapshot = Map::new();
        let mut after_snapshot = Map::new();
        let mut processed_keys: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut updated_row_ids: std::collections::HashSet<i64> = std::collections::HashSet::new();

        for (k, v) in obj {
            if k == "items" || v.is_null() {
                continue;
            }
            let val_str = if let Some(s) = v.as_str() {
                s.to_string()
            } else {
                v.to_string()
            };
            // Never overwrite a real secret with its masked placeholder
            if val_str.contains("***") {
                continue;
            }

            let snake_key = if k.chars().any(|c| c.is_lowercase()) && !k.contains('_') {
                camel_to_screaming_snake(k)
            } else {
                k.to_uppercase()
            };

            // Avoid duplicate updates/inserts for alias keys in the same payload
            if !processed_keys.insert(snake_key.clone()) {
                continue;
            }

            let matching_rows = by_canonical.get(&snake_key).cloned().unwrap_or_default();

            let secret = matching_rows
                .iter()
                .any(|e| e.is_secret.unwrap_or(false))
                || is_secret_key(k)
                || is_secret_key(&snake_key);

            if !matching_rows.is_empty() {
                let mut any_changed = false;
                for existing in matching_rows {
                    if !updated_row_ids.insert(existing.id) {
                        continue;
                    }
                    let prev = existing.setting_value.clone().unwrap_or_default();
                    if prev == val_str {
                        continue;
                    }
                    let canonical_key = existing.setting_key.clone();
                    let group = existing
                        .setting_group
                        .clone()
                        .unwrap_or_else(|| infer_setting_group(&canonical_key).to_string());
                    let category = existing
                        .category
                        .clone()
                        .unwrap_or_else(|| group.clone());

                    let mut am: system_setting::ActiveModel = existing.into();
                    am.setting_value = Set(Some(val_str.clone()));
                    am.category = Set(Some(category));
                    am.setting_group = Set(Some(group));
                    am.is_secret = Set(Some(secret));
                    am.is_public = Set(Some(!secret));
                    am.updated_at = Set(now);
                    am.updated_by = Set(Some(updated_by.to_string()));
                    am.update(&txn).await?;

                    if !any_changed {
                        if secret {
                            diff_lines.push(format!("{}: [REDACTED] -> [UPDATED]", canonical_key));
                        } else {
                            diff_lines.push(format!("{}: '{}' -> '{}'", canonical_key, prev, val_str));
                            before_snapshot.insert(canonical_key.clone(), json!(prev));
                            after_snapshot.insert(canonical_key, json!(val_str));
                        }
                        any_changed = true;
                        updated_count += 1;
                    }
                }
            } else {
                // Skip inserting empty brand-new keys that were never configured
                if val_str.is_empty() {
                    continue;
                }
                let group = infer_setting_group(&snake_key).to_string();
                let am = system_setting::ActiveModel {
                    setting_key: Set(snake_key.clone()),
                    setting_value: Set(Some(val_str.clone())),
                    category: Set(Some(group.clone())),
                    setting_group: Set(Some(group)),
                    is_secret: Set(Some(secret)),
                    is_public: Set(Some(!secret)),
                    updated_at: Set(now),
                    updated_by: Set(Some(updated_by.to_string())),
                    ..Default::default()
                };
                am.insert(&txn).await?;

                if secret {
                    diff_lines.push(format!("{}: [SET]", snake_key));
                } else {
                    diff_lines.push(format!("{}: '' -> '{}'", snake_key, val_str));
                    before_snapshot.insert(snake_key.clone(), json!(""));
                    after_snapshot.insert(snake_key, json!(val_str));
                }
                updated_count += 1;
            }
        }

        txn.commit().await?;

        if updated_count > 0 {
            ensure_audit_table(state).await;
            let details = diff_lines.join(" | ");
            let _ = state
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "INSERT INTO setting_audit_logs (action, user_email, user_role, details, before_snapshot, after_snapshot) VALUES ($1, $2, 'ADMIN', $3, $4, $5)",
                    vec![
                        "UPDATE_SETTINGS".into(),
                        updated_by.into(),
                        details.into(),
                        Value::Object(before_snapshot).into(),
                        Value::Object(after_snapshot).into(),
                    ],
                ))
                .await;
            // Invalidate cached public settings
            let _ = state.redis.del(PUBLIC_SETTINGS_CACHE_KEY).await;
        }

        Ok(json!({ "updated": updated_count }))
    }

    pub async fn get_settings_history(state: &AppState) -> AppResult<Vec<Value>> {
        ensure_audit_table(state).await;
        let rows = state
            .db
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                "SELECT id, action, user_email, user_role, details, created_at FROM setting_audit_logs ORDER BY created_at DESC LIMIT 50".to_string(),
            ))
            .await
            .unwrap_or_default();

        let mut list = Vec::with_capacity(rows.len());
        for row in rows {
            let id: i64 = row.try_get("", "id").unwrap_or(0);
            let action: String = row.try_get("", "action").unwrap_or_else(|_| "UPDATE_SETTINGS".into());
            let user_email: String = row.try_get("", "user_email").unwrap_or_else(|_| "admin".into());
            let user_role: String = row.try_get("", "user_role").unwrap_or_else(|_| "ADMIN".into());
            let details: String = row.try_get("", "details").unwrap_or_default();
            let created_at: chrono::DateTime<chrono::FixedOffset> = row
                .try_get("", "created_at")
                .unwrap_or_else(|_| Utc::now().into());

            list.push(json!({
                "id": id,
                "action": action,
                "entityName": "SystemSettings",
                "entityId": id.to_string(),
                "userEmail": user_email,
                "userRole": user_role,
                "details": details,
                "ipAddress": "admin-panel",
                "createdAt": created_at
            }));
        }
        Ok(list)
    }

    pub async fn rollback_setting(
        state: &AppState,
        audit_id: i64,
        updated_by: &str,
    ) -> AppResult<Value> {
        ensure_audit_table(state).await;
        let row = state
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT before_snapshot FROM setting_audit_logs WHERE id = $1",
                vec![audit_id.into()],
            ))
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Audit record #{} not found", audit_id)))?;

        let snapshot: Value = row
            .try_get("", "before_snapshot")
            .unwrap_or_else(|_| json!({}));

        let obj = snapshot.as_object().ok_or_else(|| {
            AppError::BadRequest("Audit record does not contain a restorable snapshot".to_string())
        })?;
        if obj.is_empty() {
            return Err(AppError::BadRequest(
                "Audit record only modified secret fields and cannot be auto-rolled back".to_string(),
            ));
        }

        let res = Self::update_settings(state, Value::Object(obj.clone()), updated_by).await?;
        let restored = res.get("updated").and_then(|v| v.as_u64()).unwrap_or(0);

        Ok(json!({
            "rolledBackFromAuditId": audit_id,
            "restoredKeys": restored,
            "status": "OK"
        }))
    }

    async fn resolve_setting_or_env(
        state: &AppState,
        provided: Option<&str>,
        db_keys: &[&str],
        env_fallback: &str,
    ) -> String {
        if let Some(v) = provided.map(str::trim).filter(|s| !s.is_empty() && !s.contains("***")) {
            return v.to_string();
        }
        for key in db_keys {
            if let Ok(Some(row)) = system_setting::Entity::find()
                .filter(system_setting::Column::SettingKey.eq(*key))
                .one(&state.db)
                .await
            {
                if let Some(val) = row.setting_value.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
                    return val;
                }
            }
        }
        env_fallback.to_string()
    }

    pub async fn test_connection(
        state: &AppState,
        provider_hint: Option<&str>,
        body: Value,
    ) -> AppResult<Value> {
        let provider = provider_hint
            .map(|s| s.to_uppercase())
            .or_else(|| {
                body.get("provider")
                    .or_else(|| body.get("type"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_uppercase())
            })
            .unwrap_or_else(|| "BUNNY_STREAM".to_string());

        let client = http_client();

        match provider.as_str() {
            "BUNNY_STREAM" | "BUNNY" => {
                let library_id = Self::resolve_setting_or_env(
                    state,
                    body.get("libraryId").and_then(|v| v.as_str()),
                    &["bunnyStreamLibraryId", "BUNNY_STREAM_LIBRARY_ID"],
                    &state.config.bunny_stream_library_id,
                )
                .await;
                let api_key = Self::resolve_setting_or_env(
                    state,
                    body.get("apiKey").and_then(|v| v.as_str()),
                    &["bunnyStreamApiKey", "BUNNY_STREAM_API_KEY"],
                    &state.config.bunny_stream_api_key,
                )
                .await;

                if library_id.is_empty() || api_key.is_empty() {
                    return Err(AppError::BadRequest(
                        "Bunny Stream Library ID and API Key are required".to_string(),
                    ));
                }

                let url = format!(
                    "https://video.bunnycdn.com/library/{}/videos?itemsPerPage=1",
                    library_id
                );
                let resp = client
                    .get(&url)
                    .header("AccessKey", &api_key)
                    .header("accept", "application/json")
                    .send()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Bunny Stream unreachable: {}", e)))?;

                if !resp.status().is_success() {
                    return Err(AppError::BadRequest(format!(
                        "Bunny Stream rejected credentials (HTTP {})",
                        resp.status().as_u16()
                    )));
                }
                let payload: Value = resp.json().await.unwrap_or_else(|_| json!({}));
                let total_videos = payload.get("totalItems").and_then(|v| v.as_i64()).unwrap_or(0);
                Ok(json!({
                    "success": true,
                    "connected": true,
                    "provider": "BUNNY_STREAM",
                    "status": "OK",
                    "message": format!("Bunny Stream Library {} connected ({} videos indexed)", library_id, total_videos)
                }))
            }
            "BUNNY_STORAGE" => {
                let zone = Self::resolve_setting_or_env(
                    state,
                    body.get("storageZone").and_then(|v| v.as_str()),
                    &["bunnyStorageZoneName", "BUNNY_STORAGE_ZONE_NAME"],
                    &state.config.bunny_storage_zone_name,
                )
                .await;
                let access_key = Self::resolve_setting_or_env(
                    state,
                    body.get("accessKey").and_then(|v| v.as_str()),
                    &["bunnyStorageZonePassword", "BUNNY_STORAGE_ZONE_PASSWORD"],
                    &state.config.bunny_storage_zone_password,
                )
                .await;
                let region = Self::resolve_setting_or_env(
                    state,
                    body.get("region").and_then(|v| v.as_str()),
                    &["bunnyStorageRegion", "BUNNY_STORAGE_REGION"],
                    &std::env::var("BUNNY_STORAGE_REGION").unwrap_or_default(),
                )
                .await;

                if zone.is_empty() || access_key.is_empty() {
                    return Err(AppError::BadRequest(
                        "Bunny Storage Zone Name and Password/AccessKey are required".to_string(),
                    ));
                }

                let prefix = if region.is_empty() || region.eq_ignore_ascii_case("de") || region.eq_ignore_ascii_case("eu") {
                    String::new()
                } else {
                    format!("{}.", region.to_lowercase())
                };
                let url = format!("https://{}storage.bunnycdn.com/{}/", prefix, zone);
                let resp = client
                    .get(&url)
                    .header("AccessKey", &access_key)
                    .send()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Bunny Storage unreachable: {}", e)))?;

                if !resp.status().is_success() {
                    return Err(AppError::BadRequest(format!(
                        "Bunny Storage rejected credentials (HTTP {})",
                        resp.status().as_u16()
                    )));
                }
                Ok(json!({
                    "success": true,
                    "connected": true,
                    "provider": "BUNNY_STORAGE",
                    "status": "OK",
                    "message": format!("Bunny Storage zone '{}' connected successfully!", zone)
                }))
            }
            "RAZORPAY" => {
                let key_id = Self::resolve_setting_or_env(
                    state,
                    body.get("keyId").and_then(|v| v.as_str()),
                    &["razorpayKeyId", "RAZORPAY_KEY_ID"],
                    &state.config.razorpay_key_id,
                )
                .await;
                let key_secret = Self::resolve_setting_or_env(
                    state,
                    body.get("keySecret").and_then(|v| v.as_str()),
                    &["razorpayKeySecret", "RAZORPAY_KEY_SECRET"],
                    &state.config.razorpay_key_secret,
                )
                .await;

                if key_id.is_empty() || key_secret.is_empty() {
                    return Err(AppError::BadRequest(
                        "Razorpay Key ID and Key Secret are required".to_string(),
                    ));
                }

                let resp = client
                    .get("https://api.razorpay.com/v1/orders?count=1")
                    .basic_auth(&key_id, Some(&key_secret))
                    .send()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Razorpay API unreachable: {}", e)))?;

                if !resp.status().is_success() {
                    return Err(AppError::BadRequest(format!(
                        "Razorpay authentication failed (HTTP {})",
                        resp.status().as_u16()
                    )));
                }
                let mode = if key_id.starts_with("rzp_live_") { "LIVE" } else { "TEST" };
                Ok(json!({
                    "success": true,
                    "connected": true,
                    "provider": "RAZORPAY",
                    "status": "OK",
                    "message": format!("Razorpay {} mode authenticated successfully!", mode)
                }))
            }
            "STRIPE" => {
                let secret_key = Self::resolve_setting_or_env(
                    state,
                    body.get("secretKey").and_then(|v| v.as_str()),
                    &["stripeSecretKey", "STRIPE_SECRET_KEY"],
                    &std::env::var("STRIPE_SECRET_KEY").unwrap_or_default(),
                )
                .await;

                if secret_key.is_empty() {
                    return Err(AppError::BadRequest(
                        "Stripe Secret Key is required".to_string(),
                    ));
                }

                let resp = client
                    .get("https://api.stripe.com/v1/balance")
                    .bearer_auth(&secret_key)
                    .send()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Stripe API unreachable: {}", e)))?;

                if !resp.status().is_success() {
                    return Err(AppError::BadRequest(format!(
                        "Stripe authentication failed (HTTP {})",
                        resp.status().as_u16()
                    )));
                }
                let mode = if secret_key.starts_with("sk_live_") { "LIVE" } else { "TEST" };
                Ok(json!({
                    "success": true,
                    "connected": true,
                    "provider": "STRIPE",
                    "status": "OK",
                    "message": format!("Stripe {} mode authenticated successfully!", mode)
                }))
            }
            "S3" | "AWS" => {
                let bucket = Self::resolve_setting_or_env(
                    state,
                    body.get("bucket").and_then(|v| v.as_str()),
                    &["s3MasterBucket", "S3_MASTER_BUCKET"],
                    &std::env::var("S3_MASTER_BUCKET").unwrap_or_default(),
                )
                .await;
                let region = Self::resolve_setting_or_env(
                    state,
                    body.get("region").and_then(|v| v.as_str()),
                    &["s3AwsRegion", "S3_AWS_REGION"],
                    &std::env::var("AWS_REGION").unwrap_or_default(),
                )
                .await;
                let access_key = Self::resolve_setting_or_env(
                    state,
                    body.get("accessKey").and_then(|v| v.as_str()),
                    &["s3AccessKey", "S3_ACCESS_KEY"],
                    &std::env::var("AWS_ACCESS_KEY_ID").unwrap_or_default(),
                )
                .await;
                let secret_key = Self::resolve_setting_or_env(
                    state,
                    body.get("secretKey").and_then(|v| v.as_str()),
                    &["s3SecretKey", "S3_SECRET_KEY"],
                    &std::env::var("AWS_SECRET_ACCESS_KEY").unwrap_or_default(),
                )
                .await;

                if bucket.is_empty() || region.is_empty() || access_key.is_empty() || secret_key.is_empty() {
                    return Err(AppError::BadRequest(
                        "S3 Bucket, Region, Access Key, and Secret Key are all required".to_string(),
                    ));
                }

                let probe_url = format!("https://{}.s3.{}.amazonaws.com/", bucket, region);
                let resp = client
                    .head(&probe_url)
                    .send()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("S3 endpoint unreachable: {}", e)))?;

                // 200 (public) or 403 (private bucket exists) both confirm bucket & region exist
                let code = resp.status().as_u16();
                if code == 404 {
                    return Err(AppError::BadRequest(format!(
                        "S3 bucket '{}' not found in region '{}'",
                        bucket, region
                    )));
                }
                Ok(json!({
                    "success": true,
                    "connected": true,
                    "provider": "S3",
                    "status": "OK",
                    "message": format!("S3 bucket '{}' in '{}' reachable (HTTP {})", bucket, region, code)
                }))
            }
            other => Err(AppError::BadRequest(format!(
                "Unsupported provider '{}' for connection test",
                other
            ))),
        }
    }

    pub async fn list_banners(state: &AppState, only_active: bool) -> AppResult<Vec<banner::Model>> {
        let mut q = banner::Entity::find().order_by_asc(banner::Column::DisplayOrder);
        if only_active {
            q = q.filter(banner::Column::IsActive.eq(true));
        }
        Ok(q.all(&state.db).await?)
    }

    pub async fn list_banners_with_platform(
        state: &AppState,
        only_active: bool,
        platform_filter: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        let mut q = banner::Entity::find()
            .order_by_asc(banner::Column::DisplayOrder)
            .order_by_desc(banner::Column::Id);
        if only_active {
            q = q.filter(banner::Column::IsActive.eq(true));
        }
        let rows = q.all(&state.db).await?;

        let target_plat = platform_filter
            .map(|p| p.trim().to_uppercase())
            .filter(|p| !p.is_empty() && p != "ALL");

        let filtered: Vec<banner::Model> = rows
            .into_iter()
            .filter(|b| {
                let Some(ref tp) = target_plat else {
                    return true;
                };
                let b_plat = b
                    .placement
                    .as_deref()
                    .unwrap_or("ALL")
                    .trim()
                    .to_uppercase();
                b_plat.is_empty() || b_plat == "ALL" || b_plat == *tp
            })
            .collect();

        let content_ids: Vec<i64> = filtered.iter().filter_map(|b| b.content_id).collect();
        let mut content_map: HashMap<i64, content::Model> = HashMap::new();
        if !content_ids.is_empty() {
            if let Ok(contents) = content::Entity::find()
                .filter(content::Column::Id.is_in(content_ids))
                .all(&state.db)
                .await
            {
                for c in contents {
                    content_map.insert(c.id, c);
                }
            }
        }

        let public_base = std::env::var("PUBLIC_BASE_URL")
            .unwrap_or_default()
            .trim_end_matches('/')
            .to_string();
        let abs_url = |opt: Option<&str>| -> String {
            let Some(raw) = opt.map(str::trim).filter(|s| !s.is_empty()) else {
                return String::new();
            };
            if raw.starts_with("http://") || raw.starts_with("https://") || raw.starts_with("data:") {
                raw.to_string()
            } else if public_base.is_empty() {
                raw.to_string()
            } else if raw.starts_with('/') {
                format!("{}{}", public_base, raw)
            } else {
                format!("{}/{}", public_base, raw)
            }
        };

        let out = filtered
            .into_iter()
            .map(|b| {
                let linked = b.content_id.and_then(|cid| content_map.get(&cid));
                let fallback_img = linked.and_then(|c| {
                    c.banner_image_url
                        .as_deref()
                        .filter(|s| !s.trim().is_empty())
                        .or_else(|| c.landscape_image_url.as_deref().filter(|s| !s.trim().is_empty()))
                        .or_else(|| c.backdrop_url.as_deref().filter(|s| !s.trim().is_empty()))
                        .or_else(|| c.poster_url.as_deref().filter(|s| !s.trim().is_empty()))
                });
                let web_img = abs_url(b.image_url.as_deref().filter(|s| !s.trim().is_empty()).or(fallback_img));
                let mob_img = abs_url(
                    b.mobile_image_url
                        .as_deref()
                        .filter(|s| !s.trim().is_empty())
                        .or_else(|| linked.and_then(|c| c.poster_url.as_deref()))
                        .or(if !web_img.is_empty() { Some(web_img.as_str()) } else { None }),
                );
                let platform = b
                    .placement
                    .as_deref()
                    .map(|s| s.trim().to_uppercase())
                    .filter(|s| !s.is_empty())
                    .unwrap_or_else(|| "ALL".to_string());
                let content_type = linked
                    .and_then(|c| c.content_type.clone().or_else(|| c.r#type.clone()))
                    .unwrap_or_else(|| "MOVIE".to_string());
                let slug = linked.map(|c| c.slug.clone()).unwrap_or_default();
                let lang_code = linked
                    .and_then(|c| c.original_language_code.clone())
                    .unwrap_or_default();

                json!({
                    "id": b.id,
                    "title": b.title,
                    "name": b.title,
                    "subtitle": b.subtitle,
                    "description": b.subtitle,
                    "contentId": b.content_id,
                    "content_id": b.content_id,
                    "videoId": b.content_id,
                    "video_id": b.content_id,
                    "slug": slug,
                    "contentTitle": linked.map(|c| c.title.clone()),
                    "contentType": content_type,
                    "originalLanguageCode": lang_code,
                    "language": lang_code,
                    "releaseYear": linked.and_then(|c| c.release_year),
                    "ageRating": linked.and_then(|c| c.age_rating.clone()),
                    "maturityRating": linked.and_then(|c| c.age_rating.clone()),
                    "durationSeconds": linked.and_then(|c| c.duration_seconds),
                    "isPremium": linked.and_then(|c| c.is_premium).unwrap_or(false),
                    "imageUrl": web_img,
                    "bannerUrl": web_img,
                    "bannerImageUrl": web_img,
                    "landscapeImageUrl": web_img,
                    "mobileImageUrl": mob_img,
                    "actionUrl": b.action_url.or(b.target_url.clone()),
                    "targetUrl": b.target_url,
                    "platform": platform,
                    "placement": platform,
                    "pageSlug": b.page_slug.unwrap_or_else(|| "all".to_string()),
                    "displayOrder": b.display_order.unwrap_or(0),
                    "isActive": b.is_active.unwrap_or(true),
                    "createdAt": b.created_at.map(|dt| dt.to_rfc3339()),
                })
            })
            .collect();

        Ok(out)
    }

    pub async fn upsert_banner(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<banner::Model> {
        let existing = if let Some(bid) = id {
            banner::Entity::find_by_id(bid).one(&state.db).await?
        } else {
            None
        };
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        let platform_val = body
            .get("platform")
            .or_else(|| body.get("placement"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty());

        let content_id_val = body
            .get("contentId")
            .or_else(|| body.get("content_id"))
            .and_then(|v| v.as_i64())
            .filter(|&cid| cid > 0);

        if let Some(b) = existing {
            let mut am: banner::ActiveModel = b.into();
            if let Some(t) = body.get("title").and_then(|v| v.as_str()) {
                am.title = Set(t.trim().to_string());
            }
            if let Some(sub) = body.get("subtitle").and_then(|v| v.as_str()) {
                am.subtitle = Set(Some(sub.trim().to_string()));
            }
            if let Some(u) = body.get("imageUrl").and_then(|v| v.as_str()) {
                am.image_url = Set(Some(u.trim().to_string()));
            }
            if let Some(mu) = body.get("mobileImageUrl").and_then(|v| v.as_str()) {
                am.mobile_image_url = Set(Some(mu.trim().to_string()));
            }
            if let Some(au) = body.get("actionUrl").and_then(|v| v.as_str()) {
                am.action_url = Set(Some(au.trim().to_string()));
            }
            if let Some(tu) = body.get("targetUrl").and_then(|v| v.as_str()) {
                am.target_url = Set(Some(tu.trim().to_string()));
            }
            if body.get("contentId").is_some() || body.get("content_id").is_some() {
                am.content_id = Set(content_id_val);
            }
            if let Some(p) = platform_val {
                am.placement = Set(Some(p));
            }
            if let Some(ps) = body.get("pageSlug").and_then(|v| v.as_str()) {
                am.page_slug = Set(Some(ps.trim().to_lowercase()));
            }
            if let Some(a) = body.get("isActive").and_then(|v| v.as_bool()) {
                am.is_active = Set(Some(a));
            }
            if let Some(o) = body.get("displayOrder").and_then(|v| v.as_i64()) {
                am.display_order = Set(Some(o as i32));
            }
            Ok(am.update(&state.db).await?)
        } else {
            let am = banner::ActiveModel {
                title: Set(body
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Banner")
                    .trim()
                    .to_string()),
                subtitle: Set(body
                    .get("subtitle")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                image_url: Set(body
                    .get("imageUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                mobile_image_url: Set(body
                    .get("mobileImageUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                action_url: Set(body
                    .get("actionUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                target_url: Set(body
                    .get("targetUrl")
                    .or_else(|| body.get("actionUrl"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                content_id: Set(content_id_val),
                placement: Set(Some(platform_val.unwrap_or_else(|| "ALL".to_string()))),
                page_slug: Set(Some(
                    body.get("pageSlug")
                        .and_then(|v| v.as_str())
                        .map(|s| s.trim().to_lowercase())
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| "all".to_string()),
                )),
                display_order: Set(Some(
                    body.get("displayOrder")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32,
                )),
                is_active: Set(Some(
                    body.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true),
                )),
                created_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn delete_banner(state: &AppState, id: i64) -> AppResult<Value> {
        let existing = banner::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Banner {} not found", id)))?;
        let mut am: banner::ActiveModel = existing.into();
        am.is_active = Set(Some(false));
        am.update(&state.db).await?;
        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true
        }))
    }

    pub async fn list_pages_with_sections(state: &AppState) -> AppResult<Vec<Value>> {
        let pages = page::Entity::find()
            .filter(page::Column::IsActive.eq(true))
            .order_by_asc(page::Column::DisplayOrder)
            .all(&state.db)
            .await?;

        let mut out = Vec::with_capacity(pages.len());
        for p in pages {
            let secs = section::Entity::find()
                .filter(section::Column::PageId.eq(p.id))
                .filter(section::Column::IsActive.eq(true))
                .order_by_asc(section::Column::DisplayOrder)
                .all(&state.db)
                .await?;
            out.push(json!({
                "page": p,
                "sections": secs
            }));
        }
        Ok(out)
    }

    pub async fn get_page_by_slug(state: &AppState, slug: &str) -> AppResult<Value> {
        let p = page::Entity::find()
            .filter(page::Column::Slug.eq(slug))
            .one(&state.db)
            .await?;
        let banners = Self::list_banners(state, true).await.unwrap_or_default();
        let secs = if let Some(ref pg) = p {
            section::Entity::find()
                .filter(section::Column::PageId.eq(pg.id))
                .filter(section::Column::IsActive.eq(true))
                .order_by_asc(section::Column::DisplayOrder)
                .all(&state.db)
                .await
                .unwrap_or_default()
        } else {
            section::Entity::find()
                .filter(section::Column::IsActive.eq(true))
                .order_by_asc(section::Column::DisplayOrder)
                .all(&state.db)
                .await
                .unwrap_or_default()
        };
        Ok(json!({
            "slug": slug,
            "page": p,
            "banners": banners,
            "sections": secs
        }))
    }

    pub async fn list_sections(state: &AppState, page_id: Option<i64>) -> AppResult<Vec<section::Model>> {
        let mut q = section::Entity::find().order_by_asc(section::Column::DisplayOrder);
        if let Some(pid) = page_id {
            q = q.filter(section::Column::PageId.eq(pid));
        }
        Ok(q.all(&state.db).await?)
    }

    pub async fn upsert_section(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<section::Model> {
        let existing = if let Some(sid) = id {
            section::Entity::find_by_id(sid).one(&state.db).await?
        } else {
            None
        };
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(s) = existing {
            let mut am: section::ActiveModel = s.into();
            if let Some(t) = body.get("title").and_then(|v| v.as_str()) {
                am.title = Set(t.to_string());
            }
            if let Some(sub) = body.get("subtitle").and_then(|v| v.as_str()) {
                am.subtitle = Set(Some(sub.to_string()));
            }
            if let Some(st) = body.get("type").or_else(|| body.get("sectionType")).and_then(|v| v.as_str()) {
                am.r#type = Set(st.to_string());
                am.section_type = Set(Some(st.to_string()));
            }
            if let Some(l) = body.get("layout").or_else(|| body.get("layoutStyle")).and_then(|v| v.as_str()) {
                am.layout = Set(Some(l.to_string()));
                am.layout_style = Set(Some(l.to_string()));
            }
            if let Some(a) = body.get("isActive").and_then(|v| v.as_bool()) {
                am.is_active = Set(Some(a));
            }
            if let Some(o) = body.get("displayOrder").and_then(|v| v.as_i64()) {
                am.display_order = Set(Some(o as i32));
            }
            Ok(am.update(&state.db).await?)
        } else {
            let default_page = page::Entity::find()
                .order_by_asc(page::Column::Id)
                .one(&state.db)
                .await?
                .map(|p| p.id)
                .unwrap_or(1);
            let page_id = body.get("pageId").and_then(|v| v.as_i64()).unwrap_or(default_page);
            let sec_type = body
                .get("type")
                .or_else(|| body.get("sectionType"))
                .and_then(|v| v.as_str())
                .unwrap_or("CURATED")
                .to_string();
            let layout = body
                .get("layout")
                .or_else(|| body.get("layoutStyle"))
                .and_then(|v| v.as_str())
                .unwrap_or("HORIZONTAL")
                .to_string();
            let title_str = body
                .get("title")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("Featured Rail")
                .to_string();
            let base_slug = maxx_common::validation::slugify(&title_str);
            let slug_str = body
                .get("slug")
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| {
                    if base_slug.is_empty() {
                        format!("section-{}", Utc::now().timestamp_millis())
                    } else {
                        format!("{}-{}", base_slug, Utc::now().timestamp() % 100000)
                    }
                });
            let am = section::ActiveModel {
                title: Set(title_str),
                slug: Set(Some(slug_str)),
                subtitle: Set(body.get("subtitle").and_then(|v| v.as_str()).map(|s| s.to_string())),
                r#type: Set(sec_type.clone()),
                section_type: Set(Some(sec_type)),
                layout: Set(Some(layout.clone())),
                layout_style: Set(Some(layout)),
                page_id: Set(page_id),
                display_order: Set(Some(
                    body.get("displayOrder").and_then(|v| v.as_i64()).unwrap_or(0) as i32,
                )),
                is_active: Set(Some(
                    body.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true),
                )),
                created_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn delete_section(state: &AppState, id: i64) -> AppResult<Value> {
        let existing = section::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Section {} not found", id)))?;
        let mut am: section::ActiveModel = existing.into();
        am.is_active = Set(Some(false));
        am.update(&state.db).await?;
        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true
        }))
    }

    pub async fn list_legal_pages(state: &AppState) -> AppResult<Vec<legal_page::Model>> {
        Ok(legal_page::Entity::find()
            .order_by_asc(legal_page::Column::Slug)
            .all(&state.db)
            .await?)
    }

    pub async fn get_legal_page_by_slug(
        state: &AppState,
        slug: &str,
    ) -> AppResult<legal_page::Model> {
        if let Some(row) = legal_page::Entity::find()
            .filter(legal_page::Column::Slug.eq(slug))
            .one(&state.db)
            .await?
        {
            return Ok(row);
        }
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        Ok(legal_page::Model {
            id: 0,
            slug: slug.to_string(),
            title: slug.replace('-', " ").to_uppercase(),
            content: String::new(),
            version: Some("1.0".to_string()),
            is_published: Some(true),
            is_active: Some(true),
            created_at: now,
            updated_at: now,
        })
    }

    pub async fn upsert_legal_page(
        state: &AppState,
        slug_or_id: Option<&str>,
        title_query: Option<&str>,
        body: Value,
    ) -> AppResult<legal_page::Model> {
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let slug = slug_or_id
            .or_else(|| body.get("slug").and_then(|v| v.as_str()))
            .unwrap_or("privacy-policy")
            .to_string();
        let title = title_query
            .or_else(|| body.get("title").and_then(|v| v.as_str()))
            .unwrap_or(&slug)
            .to_string();
        let content = body
            .get("content")
            .or_else(|| body.get("html"))
            .or_else(|| body.get("body"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let existing = if let Ok(id) = slug.parse::<i64>() {
            legal_page::Entity::find_by_id(id).one(&state.db).await?
        } else {
            legal_page::Entity::find()
                .filter(legal_page::Column::Slug.eq(&slug))
                .one(&state.db)
                .await?
        };

        if let Some(lp) = existing {
            let mut am: legal_page::ActiveModel = lp.into();
            am.title = Set(title);
            am.content = Set(content);
            am.updated_at = Set(now);
            Ok(am.update(&state.db).await?)
        } else {
            let am = legal_page::ActiveModel {
                slug: Set(slug),
                title: Set(title),
                content: Set(content),
                version: Set(Some("1.0".to_string())),
                is_published: Set(Some(true)),
                is_active: Set(Some(true)),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }
}


