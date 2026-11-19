use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "live_channels")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub epg_url: Option<String>,
    pub is_active: Option<bool>,
    pub is_drm_protected: Option<bool>,
    pub logo_url: Option<String>,
    pub name: String,
    #[sea_orm(unique)]
    pub slug: String,
    pub stream_url: String,
    pub description: Option<String>,
    pub poster_url: Option<String>,
    pub hls_stream_url: Option<String>,
    pub drm_license_url: Option<String>,
    pub category: Option<String>,
    pub language_code: Option<String>,
    pub access_type: Option<String>,
    pub channel_number: Option<i32>,
    pub is_live: Option<bool>,
    pub is_premium: Option<bool>,
    pub display_order: Option<i32>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

