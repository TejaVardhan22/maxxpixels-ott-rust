use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "payment_orders")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub amount: Option<Decimal>,
    pub content_id: Option<i64>,
    pub created_at: DateTimeWithTimeZone,
    pub currency: Option<String>,
    #[sea_orm(unique)]
    pub order_id: Option<String>,
    pub order_type: Option<String>,
    pub provider: String,
    pub status: String,
    pub validity_hours: Option<i32>,
    pub plan_id: Option<i64>,
    pub user_id: i64,
    pub original_amount: Option<Decimal>,
    pub discount_amount: Option<Decimal>,
    pub tax_amount: Option<Decimal>,
    pub final_amount: Option<Decimal>,
    pub coupon_code: Option<String>,
    pub provider_order_id: Option<String>,
    pub receipt_number: Option<String>,
    pub updated_at: Option<DateTimeWithTimeZone>,
    pub subscription_id: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

