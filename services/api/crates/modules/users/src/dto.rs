use maxx_common::error::AppResult;
use maxx_common::validation::{Validatable, ValidationBag, ALLOWED_USER_STATUS};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProfileRequest {
    pub full_name: Option<String>,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub phone_number: Option<String>,
    pub avatar_url: Option<String>,
    pub preferred_language: Option<String>,
    pub preferred_audio_language: Option<String>,
    pub country: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubProfileRequest {
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_kids: Option<bool>,
    pub is_kids_profile: Option<bool>,
    pub maturity_level: Option<String>,
    pub preferred_language: Option<String>,
    pub pin: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubProfileDto {
    pub id: i64,
    pub user_id: i64,
    pub name: String,
    pub avatar_url: Option<String>,
    pub is_kids: bool,
    pub is_default: bool,
    pub maturity_level: String,
    pub preferred_language: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceDto {
    pub id: i64,
    pub device_id: String,
    pub device_name: Option<String>,
    pub device_model: Option<String>,
    pub device_type: Option<String>,
    pub platform: Option<String>,
    pub is_active: bool,
    pub last_active_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub search: Option<String>,
    pub status: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminCreateUserRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub phone: Option<String>,
    pub roles: Option<Vec<String>>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUpdateUserRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub phone_number: Option<String>,
    pub phone: Option<String>,
    pub status: Option<String>,
    pub roles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminStatusUpdateRequest {
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminResetPasswordRequest {
    pub new_password: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserDto {
    pub id: i64,
    pub email: Option<String>,
    pub phone_number: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub status: String,
    pub auth_method: String,
    pub roles: Vec<String>,
    pub email_verified: bool,
    pub phone_verified: bool,
    pub subscription_tier: String,
    pub subscription_status: Option<String>,
    pub subscription_amount: Option<String>,
    pub subscription_expiry_date: Option<String>,
    pub active_devices_count: usize,
    pub rentals_count: usize,
    pub devices: Vec<DeviceDto>,
    pub last_login_at: Option<String>,
    pub created_at: String,
}

impl Validatable for UpdateProfileRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.optional_text("fullName", self.full_name.as_deref().or(self.name.as_deref()), 120);
        v.optional_phone("phoneNumber", self.phone_number.as_deref().or(self.phone.as_deref()));
        v.optional_url("avatarUrl", self.avatar_url.as_deref());
        v.finish()
    }
}

impl Validatable for CreateSubProfileRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.require_text("name", Some(self.name.as_str()), 1, 50);
        v.optional_url("avatarUrl", self.avatar_url.as_deref());
        v.finish()
    }
}

impl Validatable for AdminCreateUserRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.require_phone("phoneNumber", self.phone_number.as_deref().or(self.phone.as_deref()));
        v.optional_email("email", self.email.as_deref());
        v.optional_text("firstName", self.first_name.as_deref(), 60);
        v.optional_text("lastName", self.last_name.as_deref(), 60);
        v.optional_text("fullName", self.full_name.as_deref(), 120);
        v.optional_enum("status", self.status.as_deref(), ALLOWED_USER_STATUS);
        v.finish()
    }
}

impl Validatable for AdminUpdateUserRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.optional_phone("phoneNumber", self.phone_number.as_deref().or(self.phone.as_deref()));
        v.optional_email("email", self.email.as_deref());
        v.optional_text("firstName", self.first_name.as_deref(), 60);
        v.optional_text("lastName", self.last_name.as_deref(), 60);
        v.optional_text("fullName", self.full_name.as_deref(), 120);
        v.optional_enum("status", self.status.as_deref(), ALLOWED_USER_STATUS);
        v.finish()
    }
}

