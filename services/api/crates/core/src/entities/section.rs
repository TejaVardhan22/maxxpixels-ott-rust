use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "sections")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub display_order: Option<i32>,
    pub is_active: Option<bool>,
    pub layout: Option<String>,
    pub title: String,
    pub slug: Option<String>,
    pub r#type: String,
    pub page_id: i64,
    pub subtitle: Option<String>,
    pub section_type: Option<String>,
    pub layout_style: Option<String>,
    pub content_type_filter: Option<String>,
    pub category_id: Option<i64>,
    pub genre_id: Option<i64>,
    pub language_code: Option<String>,
    pub auto_fetch_limit: Option<i32>,
    pub rule_json: Option<String>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

