use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMarketingAgentRequest {
    #[serde(alias = "name", alias = "agentName")]
    pub full_name: Option<String>,
    #[serde(alias = "mobile", alias = "phone", alias = "phone_number", alias = "phoneNumber")]
    pub mobile_number: Option<String>,
    pub email: Option<String>,
    #[serde(alias = "aadhar_number", alias = "aadharNumber")]
    pub aadhaar_number: Option<String>,
    #[serde(alias = "pan", alias = "panCardNumber")]
    pub pan_number: Option<String>,
    #[serde(alias = "aadharDocUrl", alias = "aadhar_doc_url", alias = "aadhaarDoc")]
    pub aadhaar_doc_url: Option<String>,
    #[serde(alias = "panDocUrl", alias = "pan_doc_url", alias = "panCardUrl")]
    pub pan_doc_url: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketingAgentResponse {
    pub id: i64,
    pub agent_code: String,
    pub full_name: String,
    pub mobile_number: String,
    pub email: String,
    pub aadhaar_number: Option<String>,
    pub pan_number: Option<String>,
    pub aadhaar_doc_url: Option<String>,
    pub pan_doc_url: Option<String>,
    pub status: String,
    pub member_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketingMemberResponse {
    pub id: i64,
    pub agent_id: i64,
    pub agent_code: Option<String>,
    pub user_id: i64,
    pub phone_number: Option<String>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub joined_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidateAgentQuery {
    pub code: Option<String>,
    #[serde(alias = "agent_code")]
    pub agent_code: Option<String>,
}
