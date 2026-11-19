use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "legal_pages")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub content: String,
    pub created_at: DateTimeWithTimeZone,
    pub is_published: Option<bool>,
    #[sea_orm(unique)]
    pub slug: String,
    pub title: String,
    pub updated_at: DateTimeWithTimeZone,
    pub version: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

