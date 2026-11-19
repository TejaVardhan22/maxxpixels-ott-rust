use chrono::{DateTime, FixedOffset};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "coupons")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub code: String,
    pub description: Option<String>,
    pub discount_type: String,
    pub discount_value: Decimal,
    pub is_active: Option<bool>,
    pub maximum_discount: Option<Decimal>,
    pub max_discount_amount: Option<Decimal>,
    pub minimum_amount: Option<Decimal>,
    pub min_order_amount: Option<Decimal>,
    pub usage_limit: Option<i32>,
    pub usage_per_user: Option<i32>,
    pub used_count: Option<i32>,
    pub applicable_plan_id: Option<i64>,
    pub valid_from: Option<DateTime<FixedOffset>>,
    pub valid_until: Option<DateTime<FixedOffset>>,
    pub created_at: Option<DateTime<FixedOffset>>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

