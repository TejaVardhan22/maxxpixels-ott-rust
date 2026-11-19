use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "ad_placements")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub code: String,
    pub name: String,
    pub format: Option<String>,
    pub platform: Option<String>,
    pub cue_point_seconds: Option<i32>,
    pub max_duration_seconds: Option<i32>,
    pub skip_offset_seconds: Option<i32>,
    pub frequency_cap_per_hour: Option<i32>,
    pub is_active: Option<bool>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

