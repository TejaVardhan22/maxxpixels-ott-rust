use chrono::{DateTime, FixedOffset};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "playback_sessions")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub current_position_seconds: Option<i32>,
    pub device_id: Option<String>,
    pub device_type: Option<String>,
    pub ip_address: Option<String>,
    pub last_heartbeat: Option<DateTime<FixedOffset>>,
    #[sea_orm(unique)]
    pub session_id: String,
    pub started_at: Option<DateTime<FixedOffset>>,
    pub status: Option<String>,
    pub total_duration_seconds: Option<i32>,
    pub content_id: i64,
    pub profile_id: Option<i64>,
    pub user_id: Option<i64>,
    pub session_token: Option<String>,
    pub episode_id: Option<i64>,
    pub last_heartbeat_at: Option<DateTime<FixedOffset>>,
    pub is_active: Option<bool>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

