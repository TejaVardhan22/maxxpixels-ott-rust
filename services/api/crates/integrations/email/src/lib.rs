use serde_json::json;
use tracing::{info, warn};

pub struct EmailClient {
    pub api_url: String,
    pub api_key: String,
    pub from_email: String,
    http: reqwest::Client,
}

impl EmailClient {
    pub fn from_env() -> Self {
        Self {
            api_url: std::env::var("EMAIL_API_URL")
                .unwrap_or_else(|_| "https://api.resend.com/emails".to_string()),
            api_key: std::env::var("RESEND_API_KEY")
                .or_else(|_| std::env::var("SMTP_PASSWORD"))
                .unwrap_or_default(),
            from_email: std::env::var("EMAIL_FROM")
                .unwrap_or_else(|_| "noreply@maxxpixels.com".to_string()),
            http: reqwest::Client::new(),
        }
    }

    pub async fn send_email(&self, to: &str, subject: &str, html: &str) -> bool {
        if self.api_key.is_empty() {
            info!("EmailClient (dry-run, no API key): to={} subject={}", to, subject);
            return true;
        }

        let resp = self
            .http
            .post(&self.api_url)
            .bearer_auth(&self.api_key)
            .json(&json!({
                "from": self.from_email,
                "to": [to],
                "subject": subject,
                "html": html
            }))
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => true,
            Ok(r) => {
                warn!("EmailClient send failed with status {}", r.status());
                false
            }
            Err(e) => {
                warn!("EmailClient request error: {}", e);
                false
            }
        }
    }
}

pub struct FcmClient {
    pub server_key: String,
    pub endpoint: String,
    http: reqwest::Client,
}

impl FcmClient {
    pub fn from_env() -> Self {
        Self {
            server_key: std::env::var("FCM_SERVER_KEY")
                .or_else(|_| std::env::var("FIREBASE_SERVER_KEY"))
                .unwrap_or_default(),
            endpoint: std::env::var("FCM_ENDPOINT")
                .unwrap_or_else(|_| "https://fcm.googleapis.com/fcm/send".to_string()),
            http: reqwest::Client::new(),
        }
    }

    pub async fn send_to_target(
        &self,
        to: &str,
        title: &str,
        body: &str,
        image_url: Option<&str>,
        action_url: Option<&str>,
    ) -> bool {
        if self.server_key.is_empty() {
            info!(
                "FcmClient (dry-run, no FCM_SERVER_KEY): to={} title={}",
                to, title
            );
            return true;
        }

        let payload = json!({
            "to": to,
            "notification": {
                "title": title,
                "body": body,
                "image": image_url
            },
            "data": {
                "actionUrl": action_url.unwrap_or(""),
                "click_action": "FLUTTER_NOTIFICATION_CLICK"
            }
        });

        let resp = self
            .http
            .post(&self.endpoint)
            .header("Authorization", format!("key={}", self.server_key))
            .json(&payload)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => true,
            Ok(r) => {
                warn!("FcmClient send failed with status {}", r.status());
                false
            }
            Err(e) => {
                warn!("FcmClient request error: {}", e);
                false
            }
        }
    }
}
