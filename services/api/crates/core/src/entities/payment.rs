use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "payments")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub payment_id: Option<String>,
    pub order_id: Option<String>,
    pub amount: Decimal,
    pub created_at: DateTimeWithTimeZone,
    pub payment_method: Option<String>,
    pub provider_payment_id: Option<String>,
    pub status: String,
    #[sea_orm(unique)]
    pub transaction_id: String,
    pub payment_order_id: i64,
    pub user_id: Option<i64>,
    pub provider: Option<String>,
    pub provider_order_id: Option<String>,
    pub provider_signature: Option<String>,
    pub tax_amount: Option<Decimal>,
    pub refunded_amount: Option<Decimal>,
    pub currency: Option<String>,
    pub error_code: Option<String>,
    pub error_description: Option<String>,
    pub failure_reason: Option<String>,
    pub paid_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

