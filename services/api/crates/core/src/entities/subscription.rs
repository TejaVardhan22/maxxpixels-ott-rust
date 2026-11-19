use chrono::{DateTime, FixedOffset};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "subscriptions")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub user_id: i64,
    pub plan_id: i64,
    pub status: String,
    pub amount: Option<Decimal>,
    pub auto_renew: Option<bool>,
    pub autopay_enabled: Option<bool>,
    pub start_date: DateTime<FixedOffset>,
    pub end_date: DateTime<FixedOffset>,
    pub cancelled_at: Option<DateTime<FixedOffset>>,
    pub razorpay_customer_id: Option<String>,
    pub razorpay_subscription_id: Option<String>,
    pub payment_gateway_sub_id: Option<String>,
    pub payment_id: Option<String>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

