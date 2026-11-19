use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "live_events")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub end_time: DateTimeWithTimeZone,
    pub is_drm_protected: Option<bool>,
    pub is_premium: Option<bool>,
    pub poster_url: Option<String>,
    #[sea_orm(unique)]
    pub slug: String,
    pub start_time: DateTimeWithTimeZone,
    pub status: String,
    pub stream_url: String,
    pub title: String,
    pub description: Option<String>,
    pub hls_stream_url: Option<String>,
    pub channel_id: Option<i64>,
    pub scheduled_start: Option<DateTimeWithTimeZone>,
    pub scheduled_end: Option<DateTimeWithTimeZone>,
    pub access_type: Option<String>,
    pub is_ppv: Option<bool>,
    pub ppv_price: Option<Decimal>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

