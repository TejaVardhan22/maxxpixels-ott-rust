use chrono::{DateTime, FixedOffset};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "plans")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub billing_period: String,
    pub billing_cycle: Option<String>,
    pub duration_days: Option<i32>,
    pub price: Decimal,
    pub discount_price: Option<Decimal>,
    pub currency: Option<String>,
    pub trial_days: Option<i32>,
    pub max_concurrent_streams: Option<i32>,
    pub max_devices: Option<i32>,
    pub max_registered_devices: Option<i32>,
    pub max_profiles: Option<i32>,
    pub max_resolution: Option<String>,
    pub max_video_quality: Option<String>,
    pub ads_enabled: Option<bool>,
    pub has_ads: Option<bool>,
    pub downloads_enabled: Option<bool>,
    pub download_allowed: Option<bool>,
    pub allow_downloads: Option<bool>,
    pub is_active: Option<bool>,
    pub is_popular: Option<bool>,
    pub is_autopay_eligible: Option<bool>,
    pub single_use_only: Option<bool>,
    pub features_json: Option<String>,
    pub razorpay_plan_id: Option<String>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: Option<DateTime<FixedOffset>>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

