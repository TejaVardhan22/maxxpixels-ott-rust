use maxx_common::error::AppResult;
use maxx_common::validation::{Validatable, ValidationBag};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub identifier: Option<String>,
    pub email: Option<String>,
    pub username: Option<String>,
    pub phone: Option<String>,
    pub mobile: Option<String>,
    pub mobile_number: Option<String>,
    pub phone_number: Option<String>,
    pub password: Option<String>,
    pub otp: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: Option<String>,
    pub phone: Option<String>,
    pub mobile: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub name: Option<String>,
    pub password: Option<String>,
    pub is_producer: Option<bool>,
    pub company_name: Option<String>,
    pub studio_name: Option<String>,
    #[serde(
        alias = "agent_code",
        alias = "referenceCode",
        alias = "reference_code",
        alias = "referralCode",
        alias = "referral_code",
        alias = "ref"
    )]
    pub agent_code: Option<String>,
    #[serde(
        alias = "recaptcha_token",
        alias = "recaptchaToken",
        alias = "captcha_token",
        alias = "captchaToken",
        alias = "g-recaptcha-response"
    )]
    pub recaptcha_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshTokenRequest {
    pub refresh_token: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutRequest {
    pub refresh_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordRequest {
    pub current_password: Option<String>,
    pub old_password: Option<String>,
    pub new_password: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOtpRequest {
    pub mobile_number: Option<String>,
    pub mobile: Option<String>,
    pub phone: Option<String>,
    pub phone_number: Option<String>,
    pub identifier: Option<String>,
    pub mode: Option<String>,
    #[serde(alias = "is_register", alias = "isRegister")]
    pub is_register: Option<serde_json::Value>,
    #[serde(
        alias = "agent_code",
        alias = "referenceCode",
        alias = "reference_code",
        alias = "referralCode",
        alias = "referral_code",
        alias = "ref"
    )]
    pub agent_code: Option<String>,
    #[serde(
        alias = "recaptcha_token",
        alias = "recaptchaToken",
        alias = "captcha_token",
        alias = "captchaToken",
        alias = "g-recaptcha-response"
    )]
    pub recaptcha_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyOtpRequest {
    pub mobile_number: Option<String>,
    pub mobile: Option<String>,
    pub phone: Option<String>,
    pub phone_number: Option<String>,
    pub identifier: Option<String>,
    pub otp: Option<String>,
    pub code: Option<String>,
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub fcm_token: Option<String>,
    pub full_name: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub date_of_birth: Option<String>,
    pub dob: Option<String>,
    pub profession: Option<String>,
    pub pincode: Option<String>,
    pub pin_code: Option<String>,
    pub platform: Option<String>,
    pub mode: Option<String>,
    pub is_register: Option<serde_json::Value>,
    #[serde(
        alias = "agent_code",
        alias = "referenceCode",
        alias = "reference_code",
        alias = "referralCode",
        alias = "referral_code",
        alias = "ref"
    )]
    pub agent_code: Option<String>,
    #[serde(
        alias = "recaptcha_token",
        alias = "recaptchaToken",
        alias = "captcha_token",
        alias = "captchaToken",
        alias = "g-recaptcha-response"
    )]
    pub recaptcha_token: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceTokenRequest {
    pub device_id: Option<String>,
    pub device_name: Option<String>,
    pub fcm_token: Option<String>,
    pub device_token: Option<String>,
    pub platform: Option<String>,
    pub os: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDto {
    pub id: i64,
    #[serde(rename = "userId")]
    pub user_id_camel: i64,
    #[serde(rename = "user_id")]
    pub user_id: i64,
    pub uuid: String,
    pub email: String,
    pub phone: String,
    pub mobile: String,
    #[serde(rename = "phoneNumber")]
    pub phone_number_camel: String,
    #[serde(rename = "phone_number")]
    pub phone_number: String,
    #[serde(rename = "mobileNumber")]
    pub mobile_number_camel: String,
    #[serde(rename = "mobile_number")]
    pub mobile_number: String,
    #[serde(rename = "fullName")]
    pub full_name_camel: String,
    #[serde(rename = "full_name")]
    pub full_name: String,
    pub name: String,
    #[serde(rename = "userName")]
    pub user_name_camel: String,
    #[serde(rename = "user_name")]
    pub user_name: String,
    #[serde(rename = "avatarUrl")]
    pub avatar_url_camel: Option<String>,
    #[serde(rename = "avatar_url")]
    pub avatar_url: Option<String>,
    pub image: Option<String>,
    pub status: String,
    pub roles: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(rename = "isSubscribed")]
    pub is_subscribed: bool,
    #[serde(rename = "is_subscribed")]
    pub is_subscribed_snake: bool,
    pub subscribed: bool,
    #[serde(rename = "isBuy")]
    pub is_buy: u8,
    #[serde(rename = "is_buy")]
    pub is_buy_snake: u8,
    #[serde(rename = "is_buy_package")]
    pub is_buy_package: u8,
    #[serde(rename = "packageName")]
    pub package_name: String,
    #[serde(rename = "package_name")]
    pub package_name_snake: String,
    #[serde(rename = "package_title")]
    pub package_title: String,
    #[serde(rename = "planName")]
    pub plan_name: String,
    #[serde(rename = "plan_name")]
    pub plan_name_snake: String,
    #[serde(rename = "planId")]
    pub plan_id: i64,
    #[serde(rename = "plan_id")]
    pub plan_id_snake: i64,
    #[serde(rename = "package_id")]
    pub package_id: i64,
    #[serde(rename = "expiryDate")]
    pub expiry_date: Option<String>,
    #[serde(rename = "expiry_date")]
    pub expiry_date_snake: Option<String>,
    #[serde(rename = "expire_date")]
    pub expire_date: Option<String>,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
    #[serde(rename = "end_date")]
    pub end_date_snake: Option<String>,
    #[serde(rename = "subscriptionEndDate")]
    pub subscription_end_date: Option<String>,
    #[serde(rename = "subscription_end_date")]
    pub subscription_end_date_snake: Option<String>,
    #[serde(rename = "subscriptionStatus")]
    pub subscription_status: String,
    #[serde(rename = "subscription_status")]
    pub subscription_status_snake: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subscription: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub access_token: String,
    pub token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: usize,
    pub is_new_user: bool,
    pub user: UserDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_subscribed: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_buy: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package_name: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GenerateTvCodeRequest {
    #[serde(alias = "device_id")]
    pub device_id: Option<String>,
    #[serde(alias = "device_name")]
    pub device_name: Option<String>,
    pub platform: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActivateTvCodeRequest {
    #[serde(alias = "unique_code", alias = "uniqueCode", alias = "tv_code", alias = "tvCode")]
    pub code: Option<String>,
    #[serde(alias = "device_name")]
    pub device_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TvPairSession {
    pub code: String,
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub status: String,
    pub user_id: Option<i64>,
    pub auth: Option<AuthResponse>,
    pub created_at: String,
}

impl Validatable for RegisterRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        let phone = self.phone.as_deref().or(self.mobile.as_deref());
        if phone.map(str::trim).filter(|s| !s.is_empty()).is_none()
            && self.email.as_deref().map(str::trim).filter(|s| !s.is_empty()).is_none()
        {
            v.add("identifier", "mobile number or email is required");
        }
        v.optional_phone("phone", phone);
        v.optional_email("email", self.email.as_deref());
        v.optional_text("firstName", self.first_name.as_deref(), 60);
        v.optional_text("lastName", self.last_name.as_deref(), 60);
        v.optional_text("fullName", self.full_name.as_deref().or(self.name.as_deref()), 120);
        v.finish()
    }
}

impl Validatable for ChangePasswordRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.require_text("newPassword", Some(self.new_password.as_str()), 6, 128);
        v.finish()
    }
}

impl Validatable for SendOtpRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        let raw = self
            .mobile_number
            .as_deref()
            .or(self.mobile.as_deref())
            .or(self.phone.as_deref())
            .or(self.phone_number.as_deref())
            .or(self.identifier.as_deref());
        v.require_text("mobileNumber", raw, 5, 120);
        v.finish()
    }
}

impl Validatable for VerifyOtpRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        let raw_id = self
            .mobile_number
            .as_deref()
            .or(self.mobile.as_deref())
            .or(self.phone.as_deref())
            .or(self.phone_number.as_deref())
            .or(self.identifier.as_deref());
        v.require_text("mobileNumber", raw_id, 5, 120);
        v.require_text("otp", self.otp.as_deref().or(self.code.as_deref()), 4, 10);
        v.optional_email("email", self.email.as_deref());
        v.optional_text("firstName", self.first_name.as_deref(), 60);
        v.optional_text("lastName", self.last_name.as_deref(), 60);
        v.finish()
    }
}

