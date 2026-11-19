use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "movies")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: i64,
    pub video_asset_id: Option<String>,
    pub video_url: Option<String>,
    pub bunny_video_guid: Option<String>,
    pub duration_minutes: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub director: Option<String>,
    pub writers: Option<String>,
    pub production_house: Option<String>,
    pub country_of_origin: Option<String>,
    pub is_tvod_available: Option<bool>,
    pub drm_enabled: Option<bool>,
    pub content_id: Option<i64>,
    pub stream_url: Option<String>,
    pub hls_url: Option<String>,
    pub dash_url: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

