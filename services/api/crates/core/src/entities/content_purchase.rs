use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "content_purchases")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub price: Decimal,
    pub purchase_type: String,
    pub purchased_at: DateTimeWithTimeZone,
    pub tvod_product_id: Option<i64>,
    pub valid_until: Option<DateTimeWithTimeZone>,
    pub content_id: i64,
    pub user_id: i64,
    pub amount_paid: Option<Decimal>,
    pub currency: Option<String>,
    pub payment_id: Option<String>,
    pub status: Option<String>,
    pub expires_at: Option<DateTimeWithTimeZone>,
    pub first_watched_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

