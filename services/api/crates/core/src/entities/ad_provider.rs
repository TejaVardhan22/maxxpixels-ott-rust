use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "ad_providers")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub code: String,
    pub name: String,
    pub r#type: Option<String>,
    pub network_code: Option<String>,
    pub publisher_id: Option<String>,
    pub app_id: Option<String>,
    pub account_id: Option<String>,
    pub is_active: Option<bool>,
    pub is_bidding_enabled: Option<bool>,
    pub status: Option<String>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

