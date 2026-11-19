use crate::dto::{
    AdminListQuery, CouponValidationResponse, PlanDto, SubscriptionWithPlanDto,
};
use chrono::Utc;
use maxx_common::error::AppError;
use maxx_common::response::PageResponse;
use maxx_common::validation::ValidationBag;
type AppResult<T> = Result<T, AppError>;
use maxx_core::entities::{coupon, plan, subscription};
use maxx_core::AppState;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, ConnectionTrait, DatabaseBackend, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder, Set, Statement,
};
use serde_json::{json, Value};
use std::collections::HashSet;

pub struct SubscriptionService;

impl SubscriptionService {
    pub async fn list_plans(
        state: &AppState,
        only_active: bool,
        user_id: Option<i64>,
    ) -> AppResult<Vec<PlanDto>> {
        let mut query = plan::Entity::find();
        if only_active {
            query = query.filter(plan::Column::IsActive.eq(true));
        }
        let plans = query
            .order_by_asc(plan::Column::Price)
            .order_by_asc(plan::Column::Id)
            .all(&state.db)
            .await?;

        let mut used_plan_ids = HashSet::new();
        if let Some(uid) = user_id {
            let past_subs = subscription::Entity::find()
                .filter(subscription::Column::UserId.eq(uid))
                .all(&state.db)
                .await?;
            for s in past_subs {
                used_plan_ids.insert(s.plan_id);
            }
        }

        let result = plans
            .into_iter()
            .filter_map(|p| {
                let single_use = p.single_use_only.unwrap_or(false);
                let is_used = single_use && used_plan_ids.contains(&p.id);
                if only_active && is_used {
                    return None;
                }
                Some(PlanDto::from_model(&p, is_used))
            })
            .collect();

        Ok(result)
    }

    pub async fn list_admin_plans_paginated(
        state: &AppState,
        q: &AdminListQuery,
    ) -> AppResult<PageResponse<PlanDto>> {
        let page = q.page.unwrap_or(0);
        let size = q.size.unwrap_or(20).clamp(1, 100);

        let mut query = plan::Entity::find().order_by_asc(plan::Column::Price);
        if let Some(search) = q.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            query = query.filter(
                Condition::any()
                    .add(plan::Column::Name.contains(search))
                    .add(plan::Column::Description.contains(search))
                    .add(plan::Column::Code.contains(search)),
            );
        }

        let paginator = query.paginate(&state.db, size);
        let total = paginator.num_items().await?;
        let items = paginator.fetch_page(page).await?;
        let mapped = items
            .iter()
            .map(|p| PlanDto::from_model(p, false))
            .collect();

        Ok(PageResponse::of(mapped, total, page, size))
    }

    pub async fn get_plan_by_id(state: &AppState, id: i64) -> AppResult<PlanDto> {
        let p = plan::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Plan {} not found", id)))?;
        Ok(PlanDto::from_model(&p, false))
    }

    pub async fn toggle_plan_status(state: &AppState, id: i64) -> AppResult<plan::Model> {
        let p = plan::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Plan {} not found", id)))?;
        let next_active = !p.is_active.unwrap_or(true);
        let mut active_model: plan::ActiveModel = p.into();
        active_model.is_active = Set(Some(next_active));
        active_model.updated_at = Set(Some(Utc::now().into()));
        let saved = active_model.update(&state.db).await?;
        let _ = state.redis.del("plans:list:true:public").await;
        let _ = state.redis.del("plans:list:false:public").await;
        Ok(saved)
    }

    pub async fn upsert_plan(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<plan::Model> {
        let existing = if let Some(plan_id) = id {
            plan::Entity::find_by_id(plan_id).one(&state.db).await?
        } else {
            None
        };

        let name = body
            .get("name")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        if existing.is_none() {
            let mut v = ValidationBag::new();
            v.require_text("name", Some(name.as_str()), 2, 120);
            v.optional_non_negative_f64("price", body.get("price").and_then(|x| x.as_f64()));
            v.optional_range_i32(
                "durationDays",
                body.get("durationDays").or_else(|| body.get("duration_days")).and_then(|x| x.as_i64()).map(|n| n as i32),
                1,
                3650,
            );
            v.finish()?;
        } else {
            let mut v = ValidationBag::new();
            v.optional_non_negative_f64("price", body.get("price").and_then(|x| x.as_f64()));
            v.finish()?;
        }

        let price_val = body.get("price").and_then(|v| v.as_f64()).unwrap_or(99.0);
        let discount_val = body
            .get("discountPrice")
            .or_else(|| body.get("discount_price"))
            .and_then(|v| v.as_f64())
            .unwrap_or(price_val);

        let billing_period = body
            .get("billingPeriod")
            .or_else(|| body.get("billing_period"))
            .or_else(|| body.get("billingCycle"))
            .or_else(|| body.get("billing_cycle"))
            .and_then(|v| v.as_str())
            .unwrap_or("MONTHLY")
            .to_uppercase();

        let max_resolution = body
            .get("maxResolution")
            .or_else(|| body.get("max_resolution"))
            .or_else(|| body.get("maxVideoQuality"))
            .or_else(|| body.get("max_video_quality"))
            .and_then(|v| v.as_str())
            .unwrap_or("1080p")
            .to_string();

        let ads_enabled = body
            .get("adsEnabled")
            .or_else(|| body.get("ads_enabled"))
            .or_else(|| body.get("hasAds"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let downloads_enabled = body
            .get("downloadsEnabled")
            .or_else(|| body.get("downloads_enabled"))
            .or_else(|| body.get("allowDownloads"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let autopay_enabled = body
            .get("autopayEnabled")
            .or_else(|| body.get("autopay_enabled"))
            .or_else(|| body.get("isAutopayEligible"))
            .or_else(|| body.get("is_autopay_eligible"))
            .and_then(|v| v.as_bool())
            .unwrap_or_else(|| existing.as_ref().and_then(|p| p.is_autopay_eligible).unwrap_or(false));

        let single_use_only = body
            .get("singleUseOnly")
            .or_else(|| body.get("single_use_only"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let active = body
            .get("active")
            .or_else(|| body.get("isActive"))
            .or_else(|| body.get("is_active"))
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let code = body
            .get("code")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase())
            .filter(|s| !s.is_empty())
            .or_else(|| {
                if !name.is_empty() {
                    Some(
                        name.to_uppercase()
                            .chars()
                            .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
                            .collect(),
                    )
                } else {
                    None
                }
            });

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        let saved = if let Some(p) = existing {
            let mut am: plan::ActiveModel = p.into();
            if !name.is_empty() {
                am.name = Set(name);
            }
            if let Some(c) = code {
                am.code = Set(c);
            }
            if let Some(desc) = body.get("description") {
                am.description = Set(desc.as_str().map(|s| s.to_string()));
            }
            if let Some(price) = body.get("price").and_then(|v| v.as_f64()) {
                am.price = Set(Decimal::from_f64_retain(price).unwrap_or_default());
            }
            if body.get("discountPrice").is_some() || body.get("discount_price").is_some() {
                am.discount_price = Set(Decimal::from_f64_retain(discount_val));
            }
            if let Some(currency) = body.get("currency").and_then(|v| v.as_str()) {
                am.currency = Set(Some(currency.to_string()));
            }
            if let Some(days) = body
                .get("durationDays")
                .or_else(|| body.get("duration_days"))
                .and_then(|v| v.as_i64())
            {
                am.duration_days = Set(Some(days as i32));
            }
            if let Some(streams) = body
                .get("maxConcurrentStreams")
                .or_else(|| body.get("max_concurrent_streams"))
                .and_then(|v| v.as_i64())
            {
                am.max_concurrent_streams = Set(Some(streams as i32));
            }
            if let Some(devices) = body
                .get("maxDevices")
                .or_else(|| body.get("max_devices"))
                .and_then(|v| v.as_i64())
            {
                am.max_devices = Set(Some(devices as i32));
                am.max_registered_devices = Set(Some(devices as i32));
            }
            if let Some(profiles) = body
                .get("maxProfiles")
                .or_else(|| body.get("max_profiles"))
                .and_then(|v| v.as_i64())
            {
                am.max_profiles = Set(Some(profiles as i32));
            }
            if let Some(trial) = body
                .get("trialDays")
                .or_else(|| body.get("trial_days"))
                .and_then(|v| v.as_i64())
            {
                am.trial_days = Set(Some(trial as i32));
            }
            if let Some(pop) = body
                .get("isPopular")
                .or_else(|| body.get("is_popular"))
                .and_then(|v| v.as_bool())
            {
                am.is_popular = Set(Some(pop));
            }
            if body.get("razorpayPlanId").is_some() || body.get("razorpay_plan_id").is_some() {
                let rzp_id = body
                    .get("razorpayPlanId")
                    .or_else(|| body.get("razorpay_plan_id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty());
                am.razorpay_plan_id = Set(rzp_id);
            }
            if let Some(fj) = body.get("featuresJson") {
                am.features_json = Set(Some(if let Some(s) = fj.as_str() {
                    s.to_string()
                } else {
                    fj.to_string()
                }));
            }
            am.billing_period = Set(billing_period.clone());
            am.billing_cycle = Set(Some(billing_period));
            am.max_resolution = Set(Some(max_resolution.clone()));
            am.max_video_quality = Set(Some(max_resolution));
            am.ads_enabled = Set(Some(ads_enabled));
            am.has_ads = Set(Some(ads_enabled));
            am.downloads_enabled = Set(Some(downloads_enabled));
            am.download_allowed = Set(Some(downloads_enabled));
            am.allow_downloads = Set(Some(downloads_enabled));
            am.is_active = Set(Some(active));
            am.is_autopay_eligible = Set(Some(autopay_enabled));
            am.single_use_only = Set(Some(single_use_only));
            am.updated_at = Set(Some(now));
            am.update(&state.db).await?
        } else {
            let max_devices = body
                .get("maxDevices")
                .or_else(|| body.get("max_devices"))
                .and_then(|v| v.as_i64())
                .unwrap_or(2) as i32;
            let max_streams = body
                .get("maxConcurrentStreams")
                .or_else(|| body.get("max_concurrent_streams"))
                .and_then(|v| v.as_i64())
                .unwrap_or(1) as i32;

            let am = plan::ActiveModel {
                name: Set(name),
                code: Set(code.unwrap_or_else(|| format!("PLAN_{}", Utc::now().timestamp_millis()))),
                description: Set(body
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                price: Set(Decimal::from_f64_retain(price_val).unwrap_or_default()),
                discount_price: Set(Decimal::from_f64_retain(discount_val)),
                currency: Set(Some(
                    body.get("currency")
                        .and_then(|v| v.as_str())
                        .unwrap_or("INR")
                        .to_string(),
                )),
                billing_period: Set(billing_period.clone()),
                billing_cycle: Set(Some(billing_period)),
                duration_days: Set(body
                    .get("durationDays")
                    .or_else(|| body.get("duration_days"))
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32)),
                max_concurrent_streams: Set(Some(max_streams)),
                max_devices: Set(Some(max_devices)),
                max_registered_devices: Set(Some(max_devices)),
                max_profiles: Set(Some(
                    body.get("maxProfiles")
                        .or_else(|| body.get("max_profiles"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(4) as i32,
                )),
                max_resolution: Set(Some(max_resolution.clone())),
                max_video_quality: Set(Some(max_resolution)),
                ads_enabled: Set(Some(ads_enabled)),
                has_ads: Set(Some(ads_enabled)),
                downloads_enabled: Set(Some(downloads_enabled)),
                download_allowed: Set(Some(downloads_enabled)),
                allow_downloads: Set(Some(downloads_enabled)),
                is_popular: Set(Some(
                    body.get("isPopular")
                        .or_else(|| body.get("is_popular"))
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                )),
                is_active: Set(Some(active)),
                is_autopay_eligible: Set(Some(autopay_enabled)),
                razorpay_plan_id: Set(body
                    .get("razorpayPlanId")
                    .or_else(|| body.get("razorpay_plan_id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())),
                single_use_only: Set(Some(single_use_only)),
                trial_days: Set(Some(
                    body.get("trialDays")
                        .or_else(|| body.get("trial_days"))
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32,
                )),
                features_json: Set(body.get("featuresJson").map(|v| {
                    if let Some(s) = v.as_str() {
                        s.to_string()
                    } else {
                        v.to_string()
                    }
                })),
                created_at: Set(now),
                updated_at: Set(Some(now)),
                ..Default::default()
            };
            am.insert(&state.db).await?
        };

        let _ = state.redis.del("plans:list:true:public").await;
        let _ = state.redis.del("plans:list:false:public").await;
        Ok(saved)
    }

    pub async fn delete_plan(state: &AppState, id: i64) -> AppResult<Value> {
        let p = plan::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Plan {} not found", id)))?;

        // Detach any coupons targeting this plan
        let detach_coupons = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE coupons SET applicable_plan_id = NULL WHERE applicable_plan_id = $1",
            [id.into()],
        );
        let _ = state.db.execute(detach_coupons).await;

        // Soft-delete: always deactivate instead of hard-deleting the plan row
        let mut am: plan::ActiveModel = p.into();
        am.is_active = Set(Some(false));
        am.updated_at = Set(Some(Utc::now().into()));
        am.update(&state.db).await?;

        let _ = state.redis.del("plans:list:true:public").await;
        let _ = state.redis.del("plans:list:false:public").await;

        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true,
            "message": "Plan has been soft-deleted (deactivated)."
        }))
    }

    pub async fn get_user_subscriptions(
        state: &AppState,
        user_id: i64,
    ) -> AppResult<Vec<SubscriptionWithPlanDto>> {
        let subs = subscription::Entity::find()
            .filter(subscription::Column::UserId.eq(user_id))
            .order_by_desc(subscription::Column::CreatedAt)
            .all(&state.db)
            .await?;

        let mut out = Vec::with_capacity(subs.len());
        for s in subs {
            let p = plan::Entity::find_by_id(s.plan_id)
                .one(&state.db)
                .await?
                .map(|m| PlanDto::from_model(&m, false));
            out.push(SubscriptionWithPlanDto {
                subscription: s,
                plan: p,
            });
        }
        Ok(out)
    }

    pub async fn list_coupons(state: &AppState) -> AppResult<Vec<coupon::Model>> {
        let list = coupon::Entity::find()
            .order_by_desc(coupon::Column::CreatedAt)
            .all(&state.db)
            .await?;
        Ok(list)
    }

    pub async fn list_admin_coupons_paginated(
        state: &AppState,
        q: &AdminListQuery,
    ) -> AppResult<PageResponse<coupon::Model>> {
        let page = q.page.unwrap_or(0);
        let size = q.size.unwrap_or(20).clamp(1, 100);

        let mut query = coupon::Entity::find().order_by_desc(coupon::Column::CreatedAt);
        if let Some(search) = q.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            query = query.filter(
                Condition::any()
                    .add(coupon::Column::Code.contains(search))
                    .add(coupon::Column::Description.contains(search)),
            );
        }

        let paginator = query.paginate(&state.db, size);
        let total = paginator.num_items().await?;
        let items = paginator.fetch_page(page).await?;
        Ok(PageResponse::of(items, total, page, size))
    }

    pub async fn get_coupon_by_id(state: &AppState, id: i64) -> AppResult<coupon::Model> {
        coupon::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Coupon {} not found", id)))
    }

    pub async fn toggle_coupon_status(state: &AppState, id: i64) -> AppResult<coupon::Model> {
        let c = Self::get_coupon_by_id(state, id).await?;
        let next = !c.is_active.unwrap_or(true);
        let mut am: coupon::ActiveModel = c.into();
        am.is_active = Set(Some(next));
        Ok(am.update(&state.db).await?)
    }

    pub async fn upsert_coupon(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<coupon::Model> {
        let code = body
            .get("code")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase())
            .unwrap_or_default();

        let existing = if let Some(cid) = id {
            coupon::Entity::find_by_id(cid).one(&state.db).await?
        } else if !code.is_empty() {
            coupon::Entity::find()
                .filter(coupon::Column::Code.eq(&code))
                .one(&state.db)
                .await?
        } else {
            None
        };

        let discount_type = body
            .get("discountType")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase());
        let discount_val = body.get("discountValue").and_then(|v| v.as_f64());

        let mut v = ValidationBag::new();
        if existing.is_none() {
            v.require_text("code", Some(code.as_str()), 2, 50);
        }
        if let Some(dv) = discount_val {
            if dv <= 0.0 {
                v.add("discountValue", "must be greater than 0");
            } else if discount_type.as_deref() == Some("PERCENTAGE") && dv > 100.0 {
                v.add("discountValue", "percentage discount cannot exceed 100%");
            }
        }
        v.finish()?;

        let min_amt_opt = body
            .get("minOrderAmount")
            .or_else(|| body.get("minimumAmount"))
            .and_then(|v| v.as_f64())
            .and_then(Decimal::from_f64_retain);
        let max_disc_opt = body
            .get("maxDiscountAmount")
            .or_else(|| body.get("maximumDiscount"))
            .and_then(|v| v.as_f64())
            .and_then(Decimal::from_f64_retain);
        let usage_limit_opt = body
            .get("usageLimit")
            .or_else(|| body.get("maxUses"))
            .and_then(|v| v.as_i64())
            .map(|x| x as i32);
        let per_user_opt = body
            .get("usagePerUser")
            .or_else(|| body.get("perUserLimit"))
            .and_then(|v| v.as_i64())
            .map(|x| x as i32);
        let applicable_plan_opt = body
            .get("applicablePlanId")
            .and_then(|v| v.as_i64())
            .filter(|&pid| pid > 0);
        let valid_from_opt = body
            .get("validFrom")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        let valid_until_opt = body
            .get("validUntil")
            .or_else(|| body.get("expiryDate"))
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok());
        let active_opt = body
            .get("isActive")
            .or_else(|| body.get("active"))
            .and_then(|v| v.as_bool());

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(c) = existing {
            let mut am: coupon::ActiveModel = c.into();
            if !code.is_empty() {
                am.code = Set(code);
            }
            if let Some(desc) = body.get("description") {
                am.description = Set(desc.as_str().map(|s| s.to_string()));
            }
            if let Some(dt) = discount_type {
                am.discount_type = Set(dt);
            }
            if let Some(dv) = discount_val {
                am.discount_value = Set(Decimal::from_f64_retain(dv).unwrap_or_default());
            }
            if max_disc_opt.is_some() {
                am.max_discount_amount = Set(max_disc_opt);
                am.maximum_discount = Set(max_disc_opt);
            }
            if min_amt_opt.is_some() {
                am.min_order_amount = Set(min_amt_opt);
                am.minimum_amount = Set(min_amt_opt);
            }
            if usage_limit_opt.is_some() {
                am.usage_limit = Set(usage_limit_opt);
            }
            if per_user_opt.is_some() {
                am.usage_per_user = Set(per_user_opt);
            }
            if body.get("applicablePlanId").is_some() {
                am.applicable_plan_id = Set(applicable_plan_opt);
            }
            if valid_from_opt.is_some() {
                am.valid_from = Set(valid_from_opt);
            }
            if body.get("validUntil").is_some() || body.get("expiryDate").is_some() {
                am.valid_until = Set(valid_until_opt);
            }
            if let Some(active) = active_opt {
                am.is_active = Set(Some(active));
            }
            Ok(am.update(&state.db).await?)
        } else {
            let am = coupon::ActiveModel {
                code: Set(code),
                description: Set(body
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                discount_type: Set(discount_type.unwrap_or_else(|| "PERCENTAGE".to_string())),
                discount_value: Set(
                    Decimal::from_f64_retain(discount_val.unwrap_or(10.0)).unwrap_or_default(),
                ),
                max_discount_amount: Set(max_disc_opt),
                maximum_discount: Set(max_disc_opt),
                min_order_amount: Set(min_amt_opt.or_else(|| Decimal::from_f64_retain(0.0))),
                minimum_amount: Set(min_amt_opt.or_else(|| Decimal::from_f64_retain(0.0))),
                usage_limit: Set(usage_limit_opt),
                usage_per_user: Set(per_user_opt.or(Some(1))),
                used_count: Set(Some(0)),
                applicable_plan_id: Set(applicable_plan_opt),
                valid_from: Set(valid_from_opt.or(Some(now))),
                valid_until: Set(valid_until_opt),
                is_active: Set(Some(active_opt.unwrap_or(true))),
                created_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn delete_coupon(state: &AppState, id: i64) -> AppResult<Value> {
        let existing = coupon::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Coupon {} not found", id)))?;
        let mut am: coupon::ActiveModel = existing.into();
        am.is_active = Set(Some(false));
        am.update(&state.db).await?;
        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true
        }))
    }

    pub async fn validate_and_calculate_coupon(
        state: &AppState,
        code: &str,
        order_amount: f64,
        plan_id: Option<i64>,
    ) -> AppResult<CouponValidationResponse> {
        let clean_code = code.trim().to_uppercase();
        let c = coupon::Entity::find()
            .filter(coupon::Column::Code.eq(&clean_code))
            .filter(coupon::Column::IsActive.eq(true))
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::BadRequest("Invalid or inactive coupon code".to_string()))?;

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        if let Some(vf) = c.valid_from {
            if vf > now {
                return Err(AppError::BadRequest("Coupon is not yet active".to_string()));
            }
        }
        if let Some(vu) = c.valid_until {
            if vu < now {
                return Err(AppError::BadRequest("Coupon has expired".to_string()));
            }
        }
        if let Some(limit) = c.usage_limit {
            if c.used_count.unwrap_or(0) >= limit {
                return Err(AppError::BadRequest("Coupon usage limit reached".to_string()));
            }
        }
        if let (Some(app_plan_id), Some(pid)) = (c.applicable_plan_id, plan_id) {
            if app_plan_id != pid {
                return Err(AppError::BadRequest(
                    "Coupon is not applicable to the selected plan".to_string(),
                ));
            }
        }
        let min_amt = c
            .min_order_amount
            .or(c.minimum_amount)
            .and_then(|d| d.to_f64())
            .unwrap_or(0.0);
        if order_amount < min_amt {
            return Err(AppError::BadRequest(format!(
                "Minimum order amount of {} required for this coupon",
                min_amt
            )));
        }

        let discount_val = c.discount_value.to_f64().unwrap_or(0.0);
        let mut discount_amount = if c.discount_type == "PERCENTAGE" {
            let mut d = ((order_amount * discount_val) / 100.0 * 100.0).round() / 100.0;
            if let Some(max_d) = c
                .max_discount_amount
                .or(c.maximum_discount)
                .and_then(|m| m.to_f64())
            {
                if d > max_d {
                    d = max_d;
                }
            }
            d
        } else {
            discount_val
        };

        if discount_amount > order_amount {
            discount_amount = order_amount;
        }
        let final_amount = (((order_amount - discount_amount).max(0.0)) * 100.0).round() / 100.0;

        Ok(CouponValidationResponse {
            valid: true,
            coupon: c,
            discount_amount,
            discount_amount_snake: discount_amount,
            final_amount,
            final_amount_snake: final_amount,
        })
    }
}
