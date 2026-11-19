use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "system_settings")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    #[sea_orm(unique)]
    pub setting_key: String,
    pub setting_value: Option<String>,
    pub updated_at: DateTimeWithTimeZone,
    pub category: Option<String>,
    pub setting_group: Option<String>,
    pub description: Option<String>,
    pub is_secret: Option<bool>,
    pub is_public: Option<bool>,
    pub updated_by: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

