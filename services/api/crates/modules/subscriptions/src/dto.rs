use maxx_common::error::AppResult;
use maxx_common::validation::{Validatable, ValidationBag};
use maxx_core::entities::{coupon, plan, subscription};
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ListPlansQuery {
    pub active: Option<String>,
    pub user_id: Option<i64>,
    #[serde(rename = "userId")]
    pub user_id_camel: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ValidateCouponRequest {
    pub code: Option<String>,
    pub amount: Option<f64>,
    pub plan_id: Option<i64>,
    #[serde(rename = "planId")]
    pub plan_id_camel: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDto {
    pub id: i64,
    pub code: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub billing_period: String,
    #[serde(rename = "billing_period")]
    pub billing_period_snake: String,
    pub billing_cycle: Option<String>,
    pub duration_days: Option<i32>,
    pub price: f64,
    pub discount_price: Option<f64>,
    pub effective_price: f64,
    pub currency: String,
    pub trial_days: Option<i32>,
    pub max_concurrent_streams: i32,
    pub max_devices: i32,
    pub max_profiles: i32,
    pub max_resolution: Option<String>,
    #[serde(rename = "max_resolution")]
    pub max_resolution_snake: Option<String>,
    pub ads_enabled: bool,
    #[serde(rename = "ads_enabled")]
    pub ads_enabled_snake: bool,
    pub downloads_enabled: bool,
    #[serde(rename = "downloads_enabled")]
    pub downloads_enabled_snake: bool,
    pub active: bool,
    pub is_active: bool,
    #[serde(rename = "is_active")]
    pub is_active_snake: bool,
    pub is_popular: bool,
    pub autopay_enabled: bool,
    #[serde(rename = "autopay_enabled")]
    pub autopay_enabled_snake: bool,
    pub is_autopay_eligible: bool,
    #[serde(rename = "is_autopay_eligible")]
    pub is_autopay_eligible_snake: bool,
    pub razorpay_plan_id: Option<String>,
    #[serde(rename = "razorpay_plan_id")]
    pub razorpay_plan_id_snake: Option<String>,
    pub single_use_only: bool,
    #[serde(rename = "single_use_only")]
    pub single_use_only_snake: bool,
    pub is_already_used: bool,
    #[serde(rename = "is_already_used")]
    pub is_already_used_snake: bool,
    pub already_used: bool,
    #[serde(rename = "already_used")]
    pub already_used_snake: bool,
    pub can_purchase: bool,
    #[serde(rename = "can_purchase")]
    pub can_purchase_snake: bool,
    pub features_json: Option<String>,
}

impl PlanDto {
    pub fn from_model(p: &plan::Model, is_already_used: bool) -> Self {
        let price = p.price.to_f64().unwrap_or(0.0);
        let discount_price = p.discount_price.and_then(|d| d.to_f64());
        let effective_price = discount_price.unwrap_or(price);
        let billing_period = if !p.billing_period.is_empty() {
            p.billing_period.clone()
        } else {
            p.billing_cycle
                .clone()
                .unwrap_or_else(|| "MONTHLY".to_string())
        };
        let max_resolution = p
            .max_resolution
            .clone()
            .or_else(|| p.max_video_quality.clone());
        let ads_enabled = p.ads_enabled.unwrap_or(false);
        let downloads_enabled = p.downloads_enabled.unwrap_or(true);
        let is_active = p.is_active.unwrap_or(true);
        let is_autopay_eligible = p.is_autopay_eligible.unwrap_or(false);
        let single_use_only = p.single_use_only.unwrap_or(false);
        let can_purchase = !is_already_used;

        Self {
            id: p.id,
            code: Some(p.code.clone()),
            name: p.name.clone(),
            description: p.description.clone(),
            billing_period: billing_period.clone(),
            billing_period_snake: billing_period,
            billing_cycle: p.billing_cycle.clone(),
            duration_days: p.duration_days,
            price,
            discount_price,
            effective_price,
            currency: p.currency.clone().unwrap_or_else(|| "INR".to_string()),
            trial_days: p.trial_days,
            max_concurrent_streams: p.max_concurrent_streams.unwrap_or(1),
            max_devices: p.max_devices.unwrap_or(2),
            max_profiles: p.max_profiles.unwrap_or(4),
            max_resolution: max_resolution.clone(),
            max_resolution_snake: max_resolution,
            ads_enabled,
            ads_enabled_snake: ads_enabled,
            downloads_enabled,
            downloads_enabled_snake: downloads_enabled,
            active: is_active,
            is_active,
            is_active_snake: is_active,
            is_popular: p.is_popular.unwrap_or(false),
            autopay_enabled: is_autopay_eligible,
            autopay_enabled_snake: is_autopay_eligible,
            is_autopay_eligible,
            is_autopay_eligible_snake: is_autopay_eligible,
            razorpay_plan_id: p.razorpay_plan_id.clone(),
            razorpay_plan_id_snake: p.razorpay_plan_id.clone(),
            single_use_only,
            single_use_only_snake: single_use_only,
            is_already_used,
            is_already_used_snake: is_already_used,
            already_used: is_already_used,
            already_used_snake: is_already_used,
            can_purchase,
            can_purchase_snake: can_purchase,
            features_json: p.features_json.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionWithPlanDto {
    #[serde(flatten)]
    pub subscription: subscription::Model,
    pub plan: Option<PlanDto>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CouponValidationResponse {
    pub valid: bool,
    pub coupon: coupon::Model,
    #[serde(rename = "discountAmount")]
    pub discount_amount: f64,
    #[serde(rename = "discount_amount")]
    pub discount_amount_snake: f64,
    #[serde(rename = "finalAmount")]
    pub final_amount: f64,
    #[serde(rename = "final_amount")]
    pub final_amount_snake: f64,
}

impl Validatable for ValidateCouponRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.require_text("code", self.code.as_deref(), 2, 50);
        v.optional_non_negative_f64("amount", self.amount);
        v.finish()
    }
}
