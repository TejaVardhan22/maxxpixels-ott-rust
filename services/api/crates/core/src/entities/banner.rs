use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "banners")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub action_url: Option<String>,
    pub display_order: Option<i32>,
    pub image_url: Option<String>,
    pub is_active: Option<bool>,
    pub title: String,
    pub content_id: Option<i64>,
    pub subtitle: Option<String>,
    pub mobile_image_url: Option<String>,
    pub trailer_url: Option<String>,
    pub target_url: Option<String>,
    pub placement: Option<String>,
    pub page_slug: Option<String>,
    pub start_time: Option<DateTimeWithTimeZone>,
    pub end_time: Option<DateTimeWithTimeZone>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

