use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "ad_events")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub session_token: String,
    pub campaign_id: Option<i64>,
    pub provider_code: Option<String>,
    pub event_type: String,
    pub content_id: Option<i64>,
    pub producer_id: Option<i64>,
    #[sea_orm(unique)]
    pub dedup_key: String,
    pub revenue_paise: Option<i32>,
    pub metadata: Option<String>,
    pub created_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

