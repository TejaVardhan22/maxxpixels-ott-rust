use chrono::{DateTime, FixedOffset};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq, Serialize, Deserialize)]
#[sea_orm(table_name = "users")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub uuid: String,
    pub email: Option<String>,
    pub password_hash: Option<String>,
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub phone: Option<String>,
    pub auth_method: Option<String>,
    pub status: String,
    pub phone_verified: Option<bool>,
    pub email_verified: Option<bool>,
    pub country_code: Option<String>,
    pub pincode: Option<String>,
    pub profession: Option<String>,
    pub date_of_birth: Option<String>,
    pub avatar_url: Option<String>,
    pub preferred_languages: Option<String>,
    pub last_active_at: Option<DateTime<FixedOffset>>,
    pub last_login_at: Option<DateTime<FixedOffset>>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::user_role::Entity")]
    UserRole,
    #[sea_orm(has_many = "super::refresh_token::Entity")]
    RefreshToken,
}

impl Related<super::user_role::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::UserRole.def()
    }
}

impl Related<super::refresh_token::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::RefreshToken.def()
    }
}

impl Related<super::role::Entity> for Entity {
    fn to() -> RelationDef {
        super::user_role::Relation::Role.def()
    }
    fn via() -> Option<RelationDef> {
        Some(super::user_role::Relation::User.def().rev())
    }
}

impl ActiveModelBehavior for ActiveModel {}

