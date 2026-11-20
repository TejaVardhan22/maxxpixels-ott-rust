//! MSG91 integration.
//!
//! The dispatch sequence mirrors the legacy NestJS `SmsService`:
//! 1. `POST https://control.msg91.com/api/v5/flow/` with the full templated payload.
//! 2. If that fails, fall back to `POST /api/v5/otp?...` with the same OTP.
//!
//! OTP generation and verification remain local in Redis; Firebase/FCM is never
//! used for SMS and stays push-notification only.

use std::{collections::BTreeMap, env, time::Duration};

use maxx_common::error::AppError;
use reqwest::StatusCode;
use serde_json::{json, Value};
use tracing::{info, warn};

const FLOW_URL: &str = "https://control.msg91.com/api/v5/flow/";
const OTP_URL: &str = "https://control.msg91.com/api/v5/otp";

pub type AppResult<T> = Result<T, AppError>;

#[derive(Clone, Debug)]
pub struct Msg91Result {
    /// `MSG91`, `FALLBACK_AFTER_ERROR`, or `noop`.
    pub kind: String,
    pub route: String,
    pub message: Option<String>,
    pub request_id: Option<String>,
}

impl Msg91Result {
    /// Matches the legacy NestJS behaviour: a delivery warning does not abort
    /// the user's login/signup request.
    pub fn is_success(&self) -> bool {
        matches!(self.kind.as_str(), "MSG91" | "FALLBACK_AFTER_ERROR")
    }

    pub fn provider(&self) -> &str {
        match self.kind.as_str() {
            "MSG91" | "FALLBACK_AFTER_ERROR" => "msg91",
            "noop" => "noop",
            other => other,
        }
    }
}

#[derive(Clone, Debug)]
pub struct Msg91Client {
    auth_key: String,
    otp_template_id: String,
    sender_id: String,
    transactional_template_id: String,
    http: reqwest::Client,
}

impl Msg91Client {
    pub fn from_env() -> Self {
        Self {
            auth_key: env::var("MSG91_AUTH_KEY").unwrap_or_default().trim().to_string(),
            otp_template_id: env::var("MSG91_TEMPLATE_ID").unwrap_or_default().trim().to_string(),
            sender_id: env::var("MSG91_SENDER_ID")
                .unwrap_or_else(|_| "MAXXPX".to_string())
                .trim()
                .to_string(),
            transactional_template_id: env::var("MSG91_TRANSACTIONAL_TEMPLATE_ID")
                .unwrap_or_default()
                .trim()
                .to_string(),
            http: reqwest::Client::builder()
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    pub fn is_otp_configured(&self) -> bool {
        !self.auth_key.is_empty() && !self.otp_template_id.is_empty()
    }

    pub fn is_transactional_configured(&self) -> bool {
        !self.auth_key.is_empty() && !self.transactional_template_id.is_empty()
    }

    pub fn transactional_template_id(&self) -> &str {
        &self.transactional_template_id
    }

    /// Send a locally-generated OTP using the exact NestJS dispatch sequence:
    /// Flow API first, direct OTP API fallback.
    pub async fn send_otp(&self, mobile: &str, otp: &str) -> AppResult<Msg91Result> {
        if !self.is_otp_configured() {
            warn!("MSG91 config missing; OTP generated but SMS not sent");
            return Ok(Msg91Result {
                kind: "noop".to_string(),
                route: "none".to_string(),
                message: Some("MSG91_CONFIG_MISSING".to_string()),
                request_id: None,
            });
        }

        let formatted_mobile = Self::format_mobile(mobile);
        let mut vars = BTreeMap::new();
        for key in ["otp", "OTP", "var1", "VAR1", "code"] {
            vars.insert(key.to_string(), otp.to_string());
        }

        // 1. Primary: MSG91 Flow API, same payload shape as the NestJS service.
        match self
            .send_flow(&formatted_mobile, &self.otp_template_id, &vars, Some(otp))
            .await
        {
            Ok(result) if result.is_success() => return Ok(result),
            Ok(result) => warn!("MSG91 Flow API rejected OTP: {:?}", result.message),
            Err(e) => warn!("MSG91 Flow API network error: {}", e),
        }

        // 2. Fallback: direct OTP API, exactly as the NestJS service did.
        let direct = self
            .send_direct_otp(&formatted_mobile, &self.otp_template_id, otp)
            .await;
        if let Ok(result) = &direct {
            if result.is_success() {
                return Ok(result.clone());
            }
        }

        let detail = match direct {
            Ok(result) => result
                .message
                .unwrap_or_else(|| "MSG91 rejected both dispatch routes".to_string()),
            Err(e) => e.to_string(),
        };
        warn!("MSG91 gateway exhausted for {}; continuing without fatal error", formatted_mobile);

        Ok(Msg91Result {
            kind: "FALLBACK_AFTER_ERROR".to_string(),
            route: "none".to_string(),
            message: Some(detail),
            request_id: None,
        })
    }

    /// Send a template-based transactional SMS through the same Flow API.
    /// `vars` uses MSG91 variable names such as `VAR1`, `VAR2`.
    pub async fn send_template_sms(
        &self,
        mobile: &str,
        template_id: &str,
        vars: &BTreeMap<String, String>,
    ) -> AppResult<Msg91Result> {
        let template_id = template_id.trim();
        if self.auth_key.is_empty() || template_id.is_empty() {
            warn!("MSG91 transactional SMS config missing; notification skipped");
            return Ok(Msg91Result {
                kind: "noop".to_string(),
                route: "none".to_string(),
                message: Some("MSG91_TRANSACTIONAL_CONFIG_MISSING".to_string()),
                request_id: None,
            });
        }
        self.send_flow(&Self::format_mobile(mobile), template_id, vars, None)
            .await
    }

    /// Send using the configured default transactional template.
    pub async fn send_transactional_sms(
        &self,
        mobile: &str,
        vars: &BTreeMap<String, String>,
    ) -> AppResult<Msg91Result> {
        self.send_template_sms(mobile, self.transactional_template_id(), vars)
            .await
    }

    async fn send_flow(
        &self,
        formatted_mobile: &str,
        template_id: &str,
        vars: &BTreeMap<String, String>,
        otp: Option<&str>,
    ) -> AppResult<Msg91Result> {
        let mut recipient = serde_json::Map::new();
        recipient.insert(
            "mobiles".to_string(),
            Value::String(formatted_mobile.to_string()),
        );
        for (key, value) in vars {
            recipient.insert(key.clone(), Value::String(value.clone()));
        }

        let mut payload = serde_json::Map::new();
        payload.insert("template_id".to_string(), Value::String(template_id.to_string()));
        payload.insert("flow_id".to_string(), Value::String(template_id.to_string()));
        payload.insert("sender".to_string(), Value::String(self.sender_id.clone()));
        payload.insert("short_url".to_string(), Value::String("0".to_string()));
        payload.insert(
            "mobiles".to_string(),
            Value::String(formatted_mobile.to_string()),
        );
        if let Some(otp) = otp {
            for key in ["otp", "OTP", "var1", "VAR1", "code"] {
                payload.insert(key.to_string(), Value::String(otp.to_string()));
            }
        }
        for (key, value) in vars {
            payload.insert(key.clone(), Value::String(value.clone()));
        }
        payload.insert("recipients".to_string(), json!([recipient]));

        let resp = self
            .http
            .post(FLOW_URL)
            .header("authkey", &self.auth_key)
            .header("Content-Type", "application/json")
            .header("accept", "application/json")
            .json(&Value::Object(payload))
            .send()
            .await
            .map_err(|e| AppError::BadRequest(format!("MSG91 Flow API network error: {e}")))?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        info!("[MSG91 FLOW API] Status: {}, body: {}", status, body);
        Ok(Self::classify(status, &body, "flow"))
    }

    async fn send_direct_otp(
        &self,
        formatted_mobile: &str,
        template_id: &str,
        otp: &str,
    ) -> AppResult<Msg91Result> {
        let resp = self
            .http
            .post(OTP_URL)
            .header("accept", "application/json")
            .query(&[
                ("template_id", template_id),
                ("mobile", formatted_mobile),
                ("otp", otp),
                ("authkey", self.auth_key.as_str()),
            ])
            .send()
            .await
            .map_err(|e| AppError::BadRequest(format!("MSG91 Direct OTP network error: {e}")))?;

        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        info!("[MSG91 DIRECT OTP] Status: {}, body: {}", status, body);
        Ok(Self::classify(status, &body, "otp"))
    }

    fn classify(status: StatusCode, body: &str, route: &str) -> Msg91Result {
        let parsed: Value = serde_json::from_str(body).unwrap_or(Value::Null);
        let kind = parsed
            .get("type")
            .or_else(|| parsed.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_lowercase();
        let failed = !status.is_success() || kind == "error";
        let message = parsed
            .get("message")
            .and_then(|v| v.as_str())
            .filter(|m| !m.is_empty())
            .map(|m| m.to_string())
            .or_else(|| Some(body.to_string()));
        let request_id = parsed
            .get("request_id")
            .and_then(|v| v.as_str())
            .map(|m| m.to_string())
            .or_else(|| {
                parsed
                    .get("message")
                    .and_then(|v| v.as_str())
                    .filter(|m| m.len() >= 20 && !m.contains(' '))
                    .map(|m| m.to_string())
            });

        Msg91Result {
            kind: if failed {
                "ERROR".to_string()
            } else {
                "MSG91".to_string()
            },
            route: route.to_string(),
            message,
            request_id,
        }
    }

    /// Mirrors the NestJS formatter: strip `+`, take the last 10 digits, prefix 91.
    pub fn format_mobile(mobile: &str) -> String {
        let digits: String = mobile.chars().filter(|c| c.is_ascii_digit()).collect();
        let last10 = if digits.len() >= 10 {
            digits[digits.len() - 10..].to_string()
        } else {
            digits
        };
        format!("91{last10}")
    }

    /// Backwards-compatible alias used by notification fan-out.
    pub fn normalize_mobile(mobile: &str) -> String {
        Self::format_mobile(mobile)
    }
}

#[cfg(test)]
mod tests {
    use super::Msg91Client;

    #[test]
    fn formats_indian_mobile_like_nestjs() {
        assert_eq!(Msg91Client::format_mobile("+91 89042 14607"), "918904214607");
        assert_eq!(Msg91Client::format_mobile("8904214607"), "918904214607");
        assert_eq!(Msg91Client::format_mobile("918904214607"), "918904214607");
    }
}
