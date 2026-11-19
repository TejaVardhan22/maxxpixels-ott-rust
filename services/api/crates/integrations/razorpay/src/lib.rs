use maxx_common::security::SecurityUtils;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Duration;
use uuid::Uuid;

fn shared_http_client() -> reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .pool_max_idle_per_host(16)
                .timeout(Duration::from_secs(15))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        })
        .clone()
}

#[derive(Debug, Clone)]
pub struct RazorpayOrderResult {
    pub order_id: String,
    pub is_live: bool,
    pub key_id: String,
}

pub struct RazorpayClient {
    key_id: String,
    key_secret: String,
    webhook_secret: String,
    http: reqwest::Client,
}

impl RazorpayClient {
    pub fn from_env() -> Self {
        Self {
            key_id: std::env::var("RAZORPAY_KEY_ID").unwrap_or_default(),
            key_secret: std::env::var("RAZORPAY_KEY_SECRET").unwrap_or_default(),
            webhook_secret: std::env::var("RAZORPAY_WEBHOOK_SECRET").unwrap_or_default(),
            http: shared_http_client(),
        }
    }

    pub fn key_id(&self) -> &str {
        &self.key_id
    }

    pub fn is_configured(&self) -> bool {
        !self.key_id.is_empty()
            && !self.key_secret.is_empty()
            && !self.key_id.contains("placeholder")
    }

    /// Initiates a real refund via Razorpay API (`POST /v1/payments/{id}/refund`).
    pub async fn refund_payment(
        &self,
        provider_payment_id: &str,
        amount_paise: i64,
        reason: Option<&str>,
    ) -> Result<Value, String> {
        if !self.is_configured() {
            return Err("Razorpay credentials not configured".to_string());
        }
        let url = format!(
            "https://api.razorpay.com/v1/payments/{}/refund",
            provider_payment_id.trim()
        );
        let mut body = json!({
            "amount": amount_paise.max(100),
            "speed": "normal"
        });
        if let Some(r) = reason.map(str::trim).filter(|s| !s.is_empty()) {
            body["notes"] = json!({ "reason": r });
        }
        let resp = self
            .http
            .post(&url)
            .basic_auth(&self.key_id, Some(&self.key_secret))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Razorpay refund network error: {}", e))?;

        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        if status.is_success() {
            Ok(serde_json::from_str(&text).unwrap_or_else(|_| json!({ "status": "processed" })))
        } else {
            Err(format!("Razorpay refund failed ({}): {}", status, text))
        }
    }

    pub async fn create_order(
        &self,
        amount_paise: i64,
        currency: &str,
        receipt: &str,
        notes: Value,
    ) -> RazorpayOrderResult {
        let fallback_id = format!("order_{}", &Uuid::new_v4().simple().to_string()[..14]);

        if self.key_id.is_empty()
            || self.key_secret.is_empty()
            || self.key_id.contains("placeholder")
        {
            return RazorpayOrderResult {
                order_id: fallback_id,
                is_live: false,
                key_id: self.key_id.clone(),
            };
        }

        let resp = self
            .http
            .post("https://api.razorpay.com/v1/orders")
            .basic_auth(&self.key_id, Some(&self.key_secret))
            .json(&json!({
                "amount": amount_paise.max(100),
                "currency": currency,
                "receipt": receipt,
                "notes": notes
            }))
            .send()
            .await;

        if let Ok(r) = resp {
            if r.status().is_success() {
                if let Ok(json_body) = r.json::<Value>().await {
                    if let Some(rzp_id) = json_body.get("id").and_then(|v| v.as_str()) {
                        return RazorpayOrderResult {
                            order_id: rzp_id.to_string(),
                            is_live: true,
                            key_id: self.key_id.clone(),
                        };
                    }
                }
            }
        }

        RazorpayOrderResult {
            order_id: fallback_id,
            is_live: false,
            key_id: self.key_id.clone(),
        }
    }

    fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        let mut diff = 0u8;
        for (&x, &y) in a.iter().zip(b.iter()) {
            diff |= x ^ y;
        }
        diff == 0
    }

    /// Strictly verifies Razorpay checkout signature (HMAC-SHA256, constant-time, fail-closed).
    pub fn verify_payment_signature(
        &self,
        order_id: Option<&str>,
        subscription_id: Option<&str>,
        payment_id: &str,
        signature: &str,
    ) -> bool {
        let sig = signature.trim();
        let pid = payment_id.trim();
        if sig.is_empty() || pid.is_empty() || self.key_secret.is_empty() {
            return false;
        }
        let payload = if let Some(sid) = subscription_id.filter(|s| !s.trim().is_empty()) {
            format!("{}|{}", pid, sid.trim())
        } else if let Some(oid) = order_id.filter(|s| !s.trim().is_empty()) {
            format!("{}|{}", oid.trim(), pid)
        } else {
            return false;
        };
        match SecurityUtils::compute_hmac_sha256(&self.key_secret, &payload) {
            Ok(expected) => Self::constant_time_eq(expected.as_bytes(), sig.as_bytes()),
            Err(_) => false,
        }
    }

    /// Strictly verifies Razorpay webhook X-Razorpay-Signature header (HMAC-SHA256, constant-time, fail-closed).
    pub fn verify_webhook_signature(&self, raw_body: &str, signature: Option<&str>) -> bool {
        if self.webhook_secret.is_empty() {
            return false;
        }
        let sig = match signature.map(str::trim).filter(|s| !s.is_empty()) {
            Some(s) => s,
            None => return false,
        };
        match SecurityUtils::compute_hmac_sha256(&self.webhook_secret, raw_body) {
            Ok(expected) => Self::constant_time_eq(expected.as_bytes(), sig.as_bytes()),
            Err(_) => false,
        }
    }
}
