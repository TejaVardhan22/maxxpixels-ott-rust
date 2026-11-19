use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "episodes")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub description: Option<String>,
    pub duration_seconds: Option<i32>,
    pub episode_number: i32,
    pub is_premium: Option<bool>,
    pub published_at: Option<DateTimeWithTimeZone>,
    pub still_image_url: Option<String>,
    pub title: String,
    pub video_asset_id: Option<String>,
    pub season_id: i64,
    pub synopsis: Option<String>,
    pub duration_minutes: Option<i32>,
    pub thumbnail_url: Option<String>,
    pub video_url: Option<String>,
    pub bunny_video_guid: Option<String>,
    pub access_type: Option<String>,
    pub is_free_preview: Option<bool>,
    pub status: Option<String>,
    pub release_date: Option<Date>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

