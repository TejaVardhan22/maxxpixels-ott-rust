use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "notifications")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub action_url: Option<String>,
    pub channel: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub error_details: Option<String>,
    pub message: String,
    pub recipient_target: Option<String>,
    pub scheduled_at: Option<DateTimeWithTimeZone>,
    pub sent_at: Option<DateTimeWithTimeZone>,
    pub status: Option<String>,
    pub target_type: Option<String>,
    pub target_value: Option<String>,
    pub title: String,
    pub image_url: Option<String>,
    pub deep_link_url: Option<String>,
    pub target_audience: Option<String>,
    pub target_user_id: Option<String>,
    pub sent_count: Option<i32>,
    pub created_by: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

