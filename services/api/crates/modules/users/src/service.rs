use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set,
};
use tracing::info;

use maxx_common::{
    error::AppError,
    response::PageResponse,
    security::SecurityUtils,
};
use maxx_core::entities::{
    content_purchase, device, plan, playback_session, profile, role, subscription, user, user_role,
};

use crate::dto::{
    AccountUsageDto, AdminCreateUserRequest, AdminUpdateUserRequest, AdminUserDto, AdminUserQuery,
    CreateSubProfileRequest, DeviceDto, DeviceSummaryDto, DeviceSummaryItemDto, PlanLimitsDto,
    RegisterDeviceRequest, SubProfileDto, UpdateProfileRequest,
};

pub struct UsersService {
    db: DatabaseConnection,
}

impl UsersService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub fn db(&self) -> &DatabaseConnection {
        &self.db
    }

    pub async fn update_profile(
        &self,
        user_id: i64,
        req: UpdateProfileRequest,
    ) -> Result<AdminUserDto, AppError> {
        let user_model = user::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let mut active: user::ActiveModel = user_model.into();
        if let Some(full_name) = req.full_name.or(req.name) {
            let trimmed = full_name.trim().to_string();
            if !trimmed.is_empty() {
                active.full_name = Set(Some(trimmed));
            }
        }
        if let Some(email) = req.email {
            let trimmed = email.trim().to_lowercase();
            if !trimmed.is_empty() {
                active.email = Set(Some(trimmed));
            }
        }
        if let Some(phone) = req.phone_number.or(req.phone) {
            active.phone_number = Set(Some(phone));
        }
        if let Some(b64_raw) = req.avatar_base64.filter(|s| !s.trim().is_empty()) {
            let (detected_mime, payload_b64) = if let Some(rest) = b64_raw.trim().strip_prefix("data:") {
                if let Some((meta, data)) = rest.split_once(',') {
                    (meta.to_lowercase(), data.trim())
                } else {
                    (String::new(), b64_raw.trim())
                }
            } else {
                (
                    req.image_type.as_deref().unwrap_or("").to_lowercase(),
                    b64_raw.trim(),
                )
            };
            let bytes = decode_base64_bytes(payload_b64)
                .map_err(|e| AppError::BadRequest(format!("Invalid avatar image data: {}", e)))?;
            if bytes.is_empty() {
                return Err(AppError::BadRequest("Uploaded avatar image is empty.".to_string()));
            }
            if bytes.len() > 5 * 1024 * 1024 {
                return Err(AppError::BadRequest("Profile image must be 5 MB or smaller.".to_string()));
            }
            let ext = if detected_mime.contains("png") {
                "png"
            } else if detected_mime.contains("webp") {
                "webp"
            } else {
                "jpg"
            };
            let stored_name = format!(
                "u{}_{}.{}",
                user_id,
                &uuid::Uuid::new_v4().simple().to_string()[..12],
                ext
            );
            let mime = match ext {
                "png" => "image/png",
                "webp" => "image/webp",
                _ => "image/jpeg",
            };
            let bunny = maxx_integration_bunny::BunnyStorageClient::from_env();
            let bunny_res = bunny.upload_file("avatars", &stored_name, bytes.clone(), mime).await;
            let saved_url = if let Some(url) = bunny_res
                .get("url")
                .or_else(|| bunny_res.get("fileUrl"))
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                url.to_string()
            } else {
                let dir = std::path::PathBuf::from("uploads").join("avatars");
                tokio::fs::create_dir_all(&dir)
                    .await
                    .map_err(|e| AppError::Internal(format!("Failed to prepare avatar storage: {}", e)))?;
                tokio::fs::write(dir.join(&stored_name), &bytes)
                    .await
                    .map_err(|e| AppError::Internal(format!("Failed to save avatar image: {}", e)))?;
                let public_base = std::env::var("PUBLIC_BASE_URL")
                    .unwrap_or_default()
                    .trim_end_matches('/')
                    .to_string();
                if public_base.is_empty() {
                    format!("/api/v1/uploads/avatars/{}", stored_name)
                } else {
                    format!("{}/api/v1/uploads/avatars/{}", public_base, stored_name)
                }
            };
            active.avatar_url = Set(Some(saved_url));
        } else if let Some(avatar) = req.avatar_url {
            let trimmed = avatar.trim();
            if trimmed.is_empty() {
                active.avatar_url = Set(None);
            } else {
                active.avatar_url = Set(Some(trimmed.to_string()));
            }
        }
        if let Some(lang) = req.preferred_language.or(req.preferred_audio_language) {
            active.preferred_languages = Set(Some(lang));
        }
        if let Some(country) = req.country {
            active.country_code = Set(Some(country));
        }
        active.updated_at = Set(Utc::now().into());

        let updated = active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        self.to_admin_user_dto(updated).await
    }

    pub async fn remove_my_avatar(&self, user_id: i64) -> Result<AdminUserDto, AppError> {
        let user_model = user::Entity::find_by_id(user_id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

        let mut active: user::ActiveModel = user_model.into();
        active.avatar_url = Set(None);
        active.updated_at = Set(Utc::now().into());
        let updated = active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        self.to_admin_user_dto(updated).await
    }

    pub async fn get_sub_profiles(&self, user_id: i64) -> Result<Vec<SubProfileDto>, AppError> {
        let rows = profile::Entity::find()
            .filter(profile::Column::UserId.eq(user_id))
            .order_by_asc(profile::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|p| SubProfileDto {
                id: p.id,
                user_id: p.user_id,
                name: p.name,
                avatar_url: p.avatar_url,
                is_kids: p.is_kids.or(p.is_kids_profile).or(p.kids_profile).unwrap_or(false),
                is_default: p.is_default.unwrap_or(false),
                maturity_level: p.maturity_level.or(p.maturity_rating_limit).unwrap_or_else(|| "ALL".to_string()),
                preferred_language: p.preferred_language.unwrap_or_else(|| "kn".to_string()),
            })
            .collect())
    }

    pub async fn create_sub_profile(
        &self,
        user_id: i64,
        req: CreateSubProfileRequest,
    ) -> Result<SubProfileDto, AppError> {
        let now = Utc::now().into();
        let is_kids = req.is_kids.or(req.is_kids_profile).unwrap_or(false);
        let pin_hash = match req.pin {
            Some(p) if !p.trim().is_empty() => Some(
                SecurityUtils::hash_password_async(p.trim().to_string())
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?,
            ),
            _ => None,
        };

        let new_profile = profile::ActiveModel {
            user_id: Set(user_id),
            name: Set(req.name.trim().to_string()),
            avatar_url: Set(req.avatar_url),
            is_kids: Set(Some(is_kids)),
            is_kids_profile: Set(Some(is_kids)),
            kids_profile: Set(Some(is_kids)),
            is_default: Set(Some(false)),
            pin_hash: Set(pin_hash.clone()),
            pin_code_hash: Set(pin_hash),
            preferred_language: Set(req.preferred_language.clone().or(Some("kn".to_string()))),
            preferred_languages: Set(req.preferred_language.or(Some("kn".to_string()))),
            maturity_level: Set(req.maturity_level.clone().or(Some(if is_kids { "U" } else { "ALL" }.to_string()))),
            maturity_rating_limit: Set(req.maturity_level.or(Some(if is_kids { "U" } else { "ALL" }.to_string()))),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        let p = new_profile
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(SubProfileDto {
            id: p.id,
            user_id: p.user_id,
            name: p.name,
            avatar_url: p.avatar_url,
            is_kids: p.is_kids.unwrap_or(false),
            is_default: p.is_default.unwrap_or(false),
            maturity_level: p.maturity_level.unwrap_or_else(|| "ALL".to_string()),
            preferred_language: p.preferred_language.unwrap_or_else(|| "kn".to_string()),
        })
    }

    pub async fn get_user_devices(&self, user_id: i64) -> Result<Vec<DeviceDto>, AppError> {
        let rows = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .order_by_desc(device::Column::LastActiveAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|d| DeviceDto {
                id: d.id,
                device_id: d.device_id,
                device_name: d.device_name,
                device_model: d.device_model,
                device_type: d.device_type,
                platform: d.platform,
                is_active: d.is_active.unwrap_or(true),
                last_active_at: d.last_active_at.map(|dt| dt.to_rfc3339()),
                created_at: d.created_at.to_rfc3339(),
            })
            .collect())
    }

    pub async fn get_user_device_summary(
        &self,
        user_id: i64,
    ) -> Result<DeviceSummaryDto, AppError> {
        let now = Utc::now();

        // 1. Resolve active subscription & opted plan limits
        let mut plan_limits = PlanLimitsDto {
            plan_id: None,
            plan_name: "Free Plan".to_string(),
            plan_status: "FREE".to_string(),
            expires_at: None,
            max_devices: 2,
            max_concurrent_streams: 1,
            max_profiles: 1,
            max_resolution: Some("720p".to_string()),
        };

        if let Ok(subs) = subscription::Entity::find()
            .filter(subscription::Column::UserId.eq(user_id))
            .filter(subscription::Column::Status.eq("ACTIVE"))
            .order_by_desc(subscription::Column::EndDate)
            .all(&self.db)
            .await
        {
            if let Some(active_sub) = subs.into_iter().find(|s| s.end_date.with_timezone(&Utc) > now)
            {
                plan_limits.plan_status = "ACTIVE".to_string();
                plan_limits.expires_at = Some(active_sub.end_date.to_rfc3339());
                if let Ok(Some(p)) = plan::Entity::find_by_id(active_sub.plan_id)
                    .one(&self.db)
                    .await
                {
                    plan_limits.plan_id = Some(p.id);
                    plan_limits.plan_name = p.name;
                    plan_limits.max_devices = p.max_devices.unwrap_or(2).max(1);
                    plan_limits.max_concurrent_streams =
                        p.max_concurrent_streams.unwrap_or(1).max(1);
                    plan_limits.max_profiles = p.max_profiles.unwrap_or(4).max(1);
                    plan_limits.max_resolution = p.max_resolution.or(p.max_video_quality);
                }
            }
        }

        // 2. Live concurrent playback sessions (heartbeat within last 2 minutes)
        let cutoff = now - chrono::Duration::minutes(2);
        let mut streaming_device_ids = std::collections::HashSet::new();
        let mut active_concurrent_streams: usize = 0;

        if let Ok(sessions) = playback_session::Entity::find()
            .filter(playback_session::Column::UserId.eq(user_id))
            .filter(playback_session::Column::IsActive.eq(true))
            .all(&self.db)
            .await
        {
            for s in sessions {
                let recent = s
                    .last_heartbeat_at
                    .or(s.last_heartbeat)
                    .or(s.started_at)
                    .map(|t| t.with_timezone(&Utc) > cutoff)
                    .unwrap_or(false);
                if recent {
                    active_concurrent_streams += 1;
                    if let Some(did) = s.device_id {
                        if !did.trim().is_empty() {
                            streaming_device_ids.insert(did);
                        }
                    }
                }
            }
        }

        // 3. Registered & active devices
        let rows = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .order_by_desc(device::Column::IsActive)
            .order_by_desc(device::Column::LastActiveAt)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let total_devices_count = rows.len();
        let active_devices_count = rows.iter().filter(|d| d.is_active.unwrap_or(true)).count();

        let devices: Vec<DeviceSummaryItemDto> = rows
            .into_iter()
            .map(|d| {
                let is_active = d.is_active.unwrap_or(true);
                let is_streaming = is_active && streaming_device_ids.contains(&d.device_id);
                DeviceSummaryItemDto {
                    id: d.id,
                    device_id: d.device_id,
                    device_name: d.device_name,
                    device_model: d.device_model,
                    device_type: d.device_type,
                    platform: d.platform,
                    os_version: d.os_version,
                    is_active,
                    is_streaming,
                    last_active_at: d.last_active_at.or(d.last_seen).map(|dt| dt.to_rfc3339()),
                    created_at: d.created_at.to_rfc3339(),
                }
            })
            .collect();

        // 4. Profiles count (at least 1 for primary account)
        let profiles_db_count = profile::Entity::find()
            .filter(profile::Column::UserId.eq(user_id))
            .count(&self.db)
            .await
            .unwrap_or(0) as usize;
        let profiles_count = profiles_db_count.max(1);

        Ok(DeviceSummaryDto {
            plan: plan_limits,
            usage: AccountUsageDto {
                active_devices_count,
                total_devices_count,
                active_concurrent_streams,
                profiles_count,
            },
            devices,
        })
    }

    pub async fn register_user_device(
        &self,
        user_id: i64,
        req: RegisterDeviceRequest,
    ) -> Result<DeviceDto, AppError> {
        let did = req.device_id.trim().to_string();
        if did.is_empty() {
            return Err(AppError::BadRequest("deviceId is required".to_string()));
        }

        let now = Utc::now().into();
        let plat = req
            .platform
            .as_deref()
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "WEB".to_string());
        let dtype = req
            .device_type
            .as_deref()
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty());

        let existing = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .filter(device::Column::DeviceId.eq(&did))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let saved = if let Some(dev) = existing {
            let mut am: device::ActiveModel = dev.into();
            am.last_seen = Set(Some(now));
            am.last_active_at = Set(Some(now));
            am.is_active = Set(Some(true));
            am.platform = Set(Some(plat));
            if let Some(name) = req.device_name.filter(|s| !s.trim().is_empty()) {
                am.device_name = Set(Some(name.trim().to_string()));
            }
            if let Some(model) = req.device_model.filter(|s| !s.trim().is_empty()) {
                am.device_model = Set(Some(model.trim().to_string()));
            }
            if let Some(dt) = dtype {
                am.device_type = Set(Some(dt));
            }
            if let Some(osv) = req.os_version.filter(|s| !s.trim().is_empty()) {
                am.os_version = Set(Some(osv.trim().to_string()));
            }
            if let Some(appv) = req.app_version.filter(|s| !s.trim().is_empty()) {
                am.app_version = Set(Some(appv.trim().to_string()));
            }
            if let Some(tok) = req.fcm_token.filter(|s| !s.trim().is_empty()) {
                am.fcm_token = Set(Some(tok));
            }
            am.update(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        } else {
            let am = device::ActiveModel {
                user_id: Set(user_id),
                device_id: Set(did),
                device_name: Set(req
                    .device_name
                    .filter(|s| !s.trim().is_empty())
                    .or_else(|| Some("Web Browser".to_string()))),
                device_model: Set(req.device_model.filter(|s| !s.trim().is_empty())),
                device_type: Set(dtype.or_else(|| Some("WEB".to_string()))),
                platform: Set(Some(plat)),
                os_version: Set(req.os_version.filter(|s| !s.trim().is_empty())),
                app_version: Set(req.app_version.filter(|s| !s.trim().is_empty())),
                fcm_token: Set(req.fcm_token.filter(|s| !s.trim().is_empty())),
                ip_address: Set(None),
                is_active: Set(Some(true)),
                last_seen: Set(Some(now)),
                last_active_at: Set(Some(now)),
                created_at: Set(now),
                ..Default::default()
            };
            let inserted = am
                .insert(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

            // Enforce opted plan max_devices: auto-evict oldest active device(s) if over limit
            let mut max_devices: usize = 2;
            let now_utc = Utc::now();
            if let Ok(subs) = subscription::Entity::find()
                .filter(subscription::Column::UserId.eq(user_id))
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .all(&self.db)
                .await
            {
                if let Some(active_sub) = subs.iter().find(|s| s.end_date.with_timezone(&Utc) > now_utc) {
                    if let Ok(Some(p)) = plan::Entity::find_by_id(active_sub.plan_id).one(&self.db).await {
                        max_devices = p.max_devices.unwrap_or(2).max(1) as usize;
                    }
                }
            }
            if let Ok(active_devs) = device::Entity::find()
                .filter(device::Column::UserId.eq(user_id))
                .filter(device::Column::IsActive.eq(true))
                .order_by_asc(device::Column::LastActiveAt)
                .all(&self.db)
                .await
            {
                if active_devs.len() > max_devices {
                    let to_evict = active_devs.len() - max_devices;
                    for old_dev in active_devs.into_iter().take(to_evict) {
                        if old_dev.id == inserted.id {
                            continue;
                        }
                        let mut dam: device::ActiveModel = old_dev.into();
                        dam.is_active = Set(Some(false));
                        let _ = dam.update(&self.db).await;
                    }
                }
            }
            inserted
        };

        Ok(DeviceDto {
            id: saved.id,
            device_id: saved.device_id,
            device_name: saved.device_name,
            device_model: saved.device_model,
            device_type: saved.device_type,
            platform: saved.platform,
            is_active: saved.is_active.unwrap_or(true),
            last_active_at: saved.last_active_at.map(|dt| dt.to_rfc3339()),
            created_at: saved.created_at.to_rfc3339(),
        })
    }

    pub async fn revoke_user_device(&self, user_id: i64, device_id: &str) -> Result<(), AppError> {
        let mut found = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .filter(device::Column::DeviceId.eq(device_id))
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if found.is_none() {
            if let Ok(numeric_id) = device_id.parse::<i64>() {
                found = device::Entity::find_by_id(numeric_id)
                    .filter(device::Column::UserId.eq(user_id))
                    .one(&self.db)
                    .await
                    .map_err(|e| AppError::Database(e.to_string()))?;
            }
        }

        if let Some(d) = found {
            let target_device_id = d.device_id.clone();
            let mut active: device::ActiveModel = d.into();
            active.is_active = Set(Some(false));
            active
                .update(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

            // Also end any active playback sessions on this device so concurrent stream slot frees immediately
            if let Ok(sessions) = playback_session::Entity::find()
                .filter(playback_session::Column::UserId.eq(user_id))
                .filter(playback_session::Column::DeviceId.eq(target_device_id))
                .filter(playback_session::Column::IsActive.eq(true))
                .all(&self.db)
                .await
            {
                for s in sessions {
                    let mut sam: playback_session::ActiveModel = s.into();
                    sam.is_active = Set(Some(false));
                    let _ = sam.update(&self.db).await;
                }
            }
        }
        Ok(())
    }

    pub async fn revoke_other_user_devices(
        &self,
        user_id: i64,
        current_device_id: Option<&str>,
    ) -> Result<usize, AppError> {
        let current = current_device_id.unwrap_or("").trim();
        let rows = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .filter(device::Column::IsActive.eq(true))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut revoked_count = 0usize;
        for d in rows {
            if !current.is_empty() && d.device_id == current {
                continue;
            }
            let target_did = d.device_id.clone();
            let mut am: device::ActiveModel = d.into();
            am.is_active = Set(Some(false));
            if am.update(&self.db).await.is_ok() {
                revoked_count += 1;
            }
            if let Ok(sessions) = playback_session::Entity::find()
                .filter(playback_session::Column::UserId.eq(user_id))
                .filter(playback_session::Column::DeviceId.eq(target_did))
                .filter(playback_session::Column::IsActive.eq(true))
                .all(&self.db)
                .await
            {
                for s in sessions {
                    let mut sam: playback_session::ActiveModel = s.into();
                    sam.is_active = Set(Some(false));
                    let _ = sam.update(&self.db).await;
                }
            }
        }
        Ok(revoked_count)
    }

    pub async fn list_users(
        &self,
        query: AdminUserQuery,
    ) -> Result<PageResponse<AdminUserDto>, AppError> {
        let page = query.page.unwrap_or(0);
        let size = query.size.unwrap_or(50).min(200);

        let mut select = user::Entity::find()
            .filter(user::Column::Status.ne("DELETED"))
            .order_by_desc(user::Column::Id);

        if let Some(status) = query.status.as_deref() {
            let s = status.trim().to_uppercase();
            if !s.is_empty() && s != "ALL" {
                select = select.filter(user::Column::Status.eq(s));
            }
        }

        if let Some(search) = query.search.as_deref() {
            let s = search.trim();
            if !s.is_empty() {
                select = select.filter(
                    user::Column::Email
                        .contains(s)
                        .or(user::Column::FullName.contains(s))
                        .or(user::Column::PhoneNumber.contains(s)),
                );
            }
        }

        let role_filter = query
            .role
            .as_deref()
            .map(|r| r.trim().to_uppercase())
            .filter(|r| !r.is_empty() && r != "ALL");

        if role_filter.is_some() {
            let all_users = select
                .all(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            let mut filtered = Vec::new();
            for u in all_users {
                let dto = self.to_admin_user_dto(u).await?;
                let is_privileged = dto.roles.iter().any(|r| {
                    let ru = r.to_uppercase();
                    ru.contains("ADMIN") || ru.contains("PRODUCER") || ru.contains("STAFF") || ru.contains("MODERATOR")
                });
                let matches = match role_filter.as_deref() {
                    Some("USER") | Some("SUBSCRIBER") | Some("SUBSCRIBERS") => !is_privileged,
                    Some(target) => dto.roles.iter().any(|r| r.to_uppercase().contains(target)),
                    None => true,
                };
                if matches {
                    filtered.push(dto);
                }
            }
            let total = filtered.len() as u64;
            let start = (page * size) as usize;
            let slice = if start < filtered.len() {
                filtered[start..(start + size as usize).min(filtered.len())].to_vec()
            } else {
                vec![]
            };
            return Ok(PageResponse::of(slice, total, page, size));
        }

        let paginator = select.paginate(&self.db, size);
        let total = paginator
            .num_items()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let users = paginator
            .fetch_page(page)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut dtos = Vec::with_capacity(users.len());
        for u in users {
            dtos.push(self.to_admin_user_dto(u).await?);
        }

        Ok(PageResponse::of(dtos, total, page, size))
    }

    pub async fn create_user(&self, req: AdminCreateUserRequest) -> Result<AdminUserDto, AppError> {
        let now = Utc::now().fixed_offset();
        let combined = match (
            req.first_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            req.last_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        ) {
            (Some(f), Some(l)) => format!("{} {}", f, l),
            (Some(f), None) => f.to_string(),
            (None, Some(l)) => l.to_string(),
            (None, None) => req
                .full_name
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("OTT Viewer")
                .to_string(),
        };
        let phone = req
            .phone_number
            .or(req.phone)
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty());
        let email = req
            .email
            .map(|e| e.trim().to_lowercase())
            .filter(|e| !e.is_empty());

        if phone.is_none() && email.is_none() {
            return Err(AppError::BadRequest(
                "Mobile number is required".to_string(),
            ));
        }

        let pw_hash = match req.password.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            Some(p) => Some(
                SecurityUtils::hash_password_async(p.to_string())
                    .await
                    .map_err(|e| AppError::Internal(e.to_string()))?,
            ),
            None => None,
        };

        let new_user = user::ActiveModel {
            uuid: Set(uuid::Uuid::new_v4().to_string()),
            full_name: Set(Some(combined)),
            email: Set(email),
            phone_number: Set(phone.clone()),
            phone: Set(phone.clone()),
            password_hash: Set(pw_hash),
            auth_method: Set(Some("SMS_OTP".to_string())),
            status: Set(req
                .status
                .as_deref()
                .map(|s| s.trim().to_uppercase())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "ACTIVE".to_string())),
            phone_verified: Set(Some(phone.is_some())),
            email_verified: Set(Some(false)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };

        let saved = new_user
            .insert(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        // Assign ROLE_USER by default
        if let Ok(Some(user_role_row)) = role::Entity::find()
            .filter(role::Column::Name.eq("ROLE_USER"))
            .one(&self.db)
            .await
        {
            let ur = user_role::ActiveModel {
                user_id: Set(saved.id),
                role_id: Set(user_role_row.id),
                ..Default::default()
            };
            let _ = ur.insert(&self.db).await;
        }

        self.to_admin_user_dto(saved).await
    }

    pub async fn update_user(
        &self,
        id: i64,
        req: AdminUpdateUserRequest,
    ) -> Result<AdminUserDto, AppError> {
        let u = user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let mut active: user::ActiveModel = u.into();
        let combined = match (
            req.first_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            req.last_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        ) {
            (Some(f), Some(l)) => Some(format!("{} {}", f, l)),
            (Some(f), None) => Some(f.to_string()),
            (None, Some(l)) => Some(l.to_string()),
            (None, None) => req
                .full_name
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        };
        if let Some(name) = combined {
            active.full_name = Set(Some(name));
        }
        if let Some(email) = req.email {
            let trimmed = email.trim().to_lowercase();
            active.email = Set(if trimmed.is_empty() { None } else { Some(trimmed) });
        }
        if let Some(phone) = req.phone_number.or(req.phone) {
            let trimmed = phone.trim().to_string();
            if !trimmed.is_empty() {
                active.phone_number = Set(Some(trimmed.clone()));
                active.phone = Set(Some(trimmed));
            }
        }
        if let Some(status) = req.status {
            let clean = status.trim().to_uppercase();
            if !clean.is_empty() {
                active.status = Set(clean);
            }
        }
        active.updated_at = Set(Utc::now().into());

        let updated = active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        self.to_admin_user_dto(updated).await
    }

    pub async fn toggle_user_status(&self, id: i64) -> Result<AdminUserDto, AppError> {
        let u = user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;
        let next = if u.status.eq_ignore_ascii_case("ACTIVE") {
            "SUSPENDED"
        } else {
            "ACTIVE"
        };
        self.update_user_status(id, next).await
    }

    pub async fn revoke_all_user_devices(&self, user_id: i64) -> Result<usize, AppError> {
        let rows = device::Entity::find()
            .filter(device::Column::UserId.eq(user_id))
            .filter(device::Column::IsActive.eq(true))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let count = rows.len();
        for d in rows {
            let mut active: device::ActiveModel = d.into();
            active.is_active = Set(Some(false));
            let _ = active.update(&self.db).await;
        }
        Ok(count)
    }

    pub async fn soft_delete_user(&self, id: i64) -> Result<(), AppError> {
        let _ = self.revoke_all_user_devices(id).await;
        let _ = self.update_user_status(id, "DELETED").await?;
        Ok(())
    }

    pub async fn get_user_by_id(&self, id: i64) -> Result<AdminUserDto, AppError> {
        let u = user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        self.to_admin_user_dto(u).await
    }

    pub async fn update_user_status(
        &self,
        id: i64,
        status: &str,
    ) -> Result<AdminUserDto, AppError> {
        let u = user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let clean_status = status.trim().to_uppercase();
        let mut active: user::ActiveModel = u.into();
        active.status = Set(clean_status.clone());
        active.updated_at = Set(Utc::now().into());

        let updated = active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        info!("User {} status updated to {}", id, clean_status);
        self.to_admin_user_dto(updated).await
    }

    pub async fn reset_user_password(
        &self,
        id: i64,
        new_password: &str,
    ) -> Result<(), AppError> {
        let u = user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let hash = SecurityUtils::hash_password_async(new_password.to_string())
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let mut active: user::ActiveModel = u.into();
        active.password_hash = Set(Some(hash));
        active.updated_at = Set(Utc::now().into());

        active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        info!("Password force-reset for user {}", id);
        Ok(())
    }

    async fn to_admin_user_dto(&self, u: user::Model) -> Result<AdminUserDto, AppError> {
        let ur_list = user_role::Entity::find()
            .filter(user_role::Column::UserId.eq(u.id))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let role_ids: Vec<i64> = ur_list.into_iter().map(|ur| ur.role_id).collect();
        let mut role_names = Vec::new();
        if !role_ids.is_empty() {
            let roles = role::Entity::find()
                .filter(role::Column::Id.is_in(role_ids))
                .all(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            role_names = roles.into_iter().map(|r| r.name).collect();
        }
        if role_names.is_empty() {
            role_names.push("ROLE_USER".to_string());
        }

        // Active devices
        let user_devices = self.get_user_devices(u.id).await.unwrap_or_default();
        let active_devices_count = user_devices.len();

        // Active subscription + plan name
        let now = Utc::now();
        let mut subscription_tier = "Free".to_string();
        let mut subscription_status: Option<String> = None;
        let mut subscription_amount: Option<String> = None;
        let mut subscription_expiry_date: Option<String> = None;
        if let Ok(subs) = subscription::Entity::find()
            .filter(subscription::Column::UserId.eq(u.id))
            .order_by_desc(subscription::Column::Id)
            .all(&self.db)
            .await
        {
            if let Some(active_sub) = subs
                .iter()
                .find(|s| s.status.eq_ignore_ascii_case("ACTIVE") && s.end_date.with_timezone(&Utc) > now)
                .or_else(|| subs.first())
            {
                let is_live = active_sub.status.eq_ignore_ascii_case("ACTIVE")
                    && active_sub.end_date.with_timezone(&Utc) > now;
                subscription_status = Some(if is_live {
                    "ACTIVE".to_string()
                } else {
                    active_sub.status.clone()
                });
                subscription_expiry_date = Some(active_sub.end_date.to_rfc3339());
                if let Some(amt) = active_sub.amount {
                    subscription_amount = Some(format!("₹{}", amt));
                }
                if is_live {
                    if let Ok(Some(p)) = plan::Entity::find_by_id(active_sub.plan_id).one(&self.db).await {
                        subscription_tier = p.name;
                    } else {
                        subscription_tier = "Premium".to_string();
                    }
                }
            }
        }

        // TVOD rentals count
        let rentals_count = content_purchase::Entity::find()
            .filter(content_purchase::Column::UserId.eq(u.id))
            .all(&self.db)
            .await
            .map(|r| r.len())
            .unwrap_or(0);

        let full_str = u.full_name.clone().unwrap_or_default();
        let mut parts = full_str.split_whitespace();
        let first_name = parts.next().unwrap_or("").to_string();
        let last_name = parts.collect::<Vec<&str>>().join(" ");

        Ok(AdminUserDto {
            id: u.id,
            email: u.email,
            phone_number: u.phone_number.or(u.phone),
            first_name,
            last_name,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            status: u.status,
            auth_method: u.auth_method.unwrap_or_else(|| "SMS_OTP".to_string()),
            roles: role_names,
            email_verified: u.email_verified.unwrap_or(false),
            phone_verified: u.phone_verified.unwrap_or(false),
            subscription_tier,
            subscription_status,
            subscription_amount,
            subscription_expiry_date,
            active_devices_count,
            rentals_count,
            devices: user_devices,
            last_login_at: u.last_login_at.or(u.last_active_at).map(|dt| dt.to_rfc3339()),
            created_at: u.created_at.to_rfc3339(),
        })
    }
}

fn decode_base64_bytes(input: &str) -> Result<Vec<u8>, &'static str> {
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u8 = 0;
    for b in input.bytes() {
        let val = match b {
            b'A'..=b'Z' => b - b'A',
            b'a'..=b'z' => b - b'a' + 26,
            b'0'..=b'9' => b - b'0' + 52,
            b'+' | b'-' => 62,
            b'/' | b'_' => 63,
            b'=' | b'\n' | b'\r' | b' ' | b'\t' => continue,
            _ => return Err("unexpected base64 character"),
        };
        buf = (buf << 6) | (val as u32);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}
