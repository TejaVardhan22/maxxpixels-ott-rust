use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "ad_campaigns")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub ad_break_type: Option<String>,
    pub advertiser_name: Option<String>,
    pub campaign_name: String,
    pub click_url: Option<String>,
    pub cpm_rate: Option<f64>,
    pub created_at: DateTimeWithTimeZone,
    pub duration_seconds: Option<i32>,
    pub impressions_delivered: Option<i64>,
    pub impressions_target: Option<i64>,
    pub provider: Option<String>,
    pub spent_budget: Option<f64>,
    pub status: Option<String>,
    pub stream_video_id: Option<String>,
    pub target_devices: Option<String>,
    pub thumbnail_url: Option<String>,
    pub total_budget: Option<f64>,
    pub vast_tag_url: Option<String>,
    pub video_url: Option<String>,
    pub name: Option<String>,
    pub bunny_video_guid: Option<String>,
    pub ad_type: Option<String>,
    pub skip_offset_seconds: Option<i32>,
    pub target_content_type: Option<String>,
    pub target_language: Option<String>,
    pub budget_amount: Option<String>,
    pub impressions_count: Option<i64>,
    pub clicks_count: Option<i64>,
    pub start_date: Option<DateTimeWithTimeZone>,
    pub end_date: Option<DateTimeWithTimeZone>,
    pub is_active: Option<bool>,
    pub click_through_url: Option<String>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

