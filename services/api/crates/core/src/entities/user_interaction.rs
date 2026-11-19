use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "user_interactions")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub content_id: Option<i64>,
    pub content_title: Option<String>,
    pub created_at: DateTimeWithTimeZone,
    pub device_id: Option<String>,
    pub device_type: Option<String>,
    pub duration_seconds: Option<i32>,
    pub interaction_type: String,
    pub metadata: Option<String>,
    pub position_seconds: Option<i32>,
    pub profile_id: Option<i64>,
    pub session_id: Option<String>,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
    pub rating_value: Option<Decimal>,
    pub watch_duration_seconds: Option<i32>,
    pub country_code: Option<String>,
    pub ip_address: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

