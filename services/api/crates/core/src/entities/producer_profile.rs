use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "producer_profiles")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub agreement_status: Option<String>,
    pub bank_account_number: Option<String>,
    pub bank_account_payout_id: Option<String>,
    pub bank_doc_url: Option<String>,
    pub bank_name: Option<String>,
    pub bank_status: Option<String>,
    pub company_name: String,
    pub created_at: DateTimeWithTimeZone,
    pub gst_doc_url: Option<String>,
    pub gst_number: Option<String>,
    pub gst_status: Option<String>,
    pub ifsc_code: Option<String>,
    pub onboarding_status: Option<String>,
    pub pan_doc_url: Option<String>,
    pub pan_number: Option<String>,
    pub pan_status: Option<String>,
    pub aadhar_doc_url: Option<String>,
    pub aadhar_back_doc_url: Option<String>,
    pub aadhar_number: Option<String>,
    pub aadhar_status: Option<String>,
    pub rejection_reason: Option<String>,
    pub revenue_share: Option<Decimal>,
    pub signed_agreement_url: Option<String>,
    pub status: String,
    pub studio_registration_number: Option<String>,
    pub tax_id: Option<String>,
    #[sea_orm(unique)]
    pub user_id: i64,
    pub contact_person: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub revenue_share_percent: Option<Decimal>,
    pub kyc_status: Option<String>,
    pub bank_ifsc: Option<String>,
    pub agreement_url: Option<String>,
    pub is_active: Option<bool>,
    pub updated_at: Option<DateTimeWithTimeZone>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

