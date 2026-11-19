use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "producer_ad_revenue")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub producer_id: i64,
    pub content_id: i64,
    pub episode_id: Option<i64>,
    pub billing_period: String,
    pub total_impressions: Option<i64>,
    pub gross_revenue: Option<Decimal>,
    pub net_revenue: Option<Decimal>,
    pub producer_share_percent: Option<Decimal>,
    pub producer_amount: Option<Decimal>,
    pub platform_share_percent: Option<Decimal>,
    pub platform_amount: Option<Decimal>,
    pub currency: Option<String>,
    pub status: Option<String>,
    pub settled_at: Option<DateTimeWithTimeZone>,
    pub created_at: Option<DateTimeWithTimeZone>,
    pub updated_at: Option<DateTimeWithTimeZone>,
    pub settlement_date: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

