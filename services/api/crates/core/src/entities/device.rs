use chrono::{DateTime, FixedOffset};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "devices")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub user_id: i64,
    pub device_id: String,
    pub device_name: Option<String>,
    pub device_model: Option<String>,
    pub device_type: Option<String>,
    pub platform: Option<String>,
    pub os_version: Option<String>,
    pub app_version: Option<String>,
    pub fcm_token: Option<String>,
    pub ip_address: Option<String>,
    pub is_active: Option<bool>,
    pub last_seen: Option<DateTime<FixedOffset>>,
    pub last_active_at: Option<DateTime<FixedOffset>>,
    pub created_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

