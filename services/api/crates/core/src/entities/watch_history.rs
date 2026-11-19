use chrono::{DateTime, FixedOffset};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "watch_history")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub completed: Option<bool>,
    pub duration_seconds: Option<i32>,
    pub last_watched_at: Option<DateTime<FixedOffset>>,
    pub percentage: Option<Decimal>,
    pub position_seconds: Option<i32>,
    pub content_id: i64,
    pub episode_id: Option<i64>,
    pub profile_id: i64,
    pub user_id: Option<i64>,
    pub watched_seconds: Option<i32>,
    pub watched_duration_seconds: Option<i32>,
    pub total_duration_seconds: Option<i32>,
    pub is_completed: Option<bool>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

