use jsonwebtoken::{Algorithm, EncodingKey, Header};
use serde::Deserialize;
use serde_json::json;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
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
            info!(
                "EmailClient (dry-run, no API key): to={} subject={}",
                to, subject
            );
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

#[derive(Debug, Clone, Deserialize)]
struct ServiceAccount {
    project_id: Option<String>,
    client_email: String,
    private_key: String,
    #[serde(default = "default_token_uri")]
    token_uri: String,
}

fn default_token_uri() -> String {
    "https://oauth2.googleapis.com/token".to_string()
}

#[derive(Debug, Clone)]
struct FcmV1Config {
    project_id: String,
    client_email: String,
    private_key: String,
    token_uri: String,
}

#[derive(Debug, Clone)]
struct FcmLegacyConfig {
    server_key: String,
    endpoint: String,
}

#[derive(Debug, Clone)]
enum FcmMode {
    V1(FcmV1Config),
    Legacy(FcmLegacyConfig),
    DryRun,
}

#[derive(Debug, Clone)]
struct CachedToken {
    access_token: String,
    expires_at: Instant,
}

static FCM_TOKEN_CACHE: OnceLock<Mutex<Option<CachedToken>>> = OnceLock::new();

fn token_cache() -> &'static Mutex<Option<CachedToken>> {
    FCM_TOKEN_CACHE.get_or_init(|| Mutex::new(None))
}

fn read_nonempty_env(keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Ok(v) = std::env::var(k) {
            let t = v.trim().to_string();
            if !t.is_empty() {
                return Some(t);
            }
        }
    }
    None
}

fn read_service_account_json() -> Option<String> {
    let content_keys = [
        "FCM_SERVICE_ACCOUNT_JSON",
        "FIREBASE_SERVICE_ACCOUNT_JSON",
        "GOOGLE_CREDENTIALS_JSON",
        "FCM_CREDENTIALS_JSON",
    ];
    if let Some(v) = read_nonempty_env(&content_keys) {
        return Some(v);
    }
    let path_keys = [
        "FCM_SERVICE_ACCOUNT_PATH",
        "FIREBASE_SERVICE_ACCOUNT_PATH",
        "GOOGLE_APPLICATION_CREDENTIALS",
    ];
    if let Some(path) = read_nonempty_env(&path_keys) {
        match std::fs::read_to_string(&path) {
            Ok(s) if !s.trim().is_empty() => return Some(s),
            Ok(_) => warn!("FcmClient: service account file is empty: {}", path),
            Err(e) => warn!("FcmClient: failed to read service account file {}: {}", path, e),
        }
    }
    None
}

fn load_fcm_mode() -> FcmMode {
    if let Some(raw) = read_service_account_json() {
        match serde_json::from_str::<ServiceAccount>(&raw) {
            Ok(sa) => {
                let project_id = read_nonempty_env(&[
                    "FCM_PROJECT_ID",
                    "FIREBASE_PROJECT_ID",
                    "GOOGLE_CLOUD_PROJECT",
                ])
                .or(sa.project_id.clone())
                .unwrap_or_default();
                if project_id.trim().is_empty() {
                    warn!("FcmClient: service account configured but project_id is missing");
                } else if sa.client_email.trim().is_empty() || sa.private_key.trim().is_empty() {
                    warn!("FcmClient: service account is missing client_email/private_key");
                } else {
                    info!(
                        "FcmClient: using FCM HTTP v1 (project_id={})",
                        project_id.trim()
                    );
                    return FcmMode::V1(FcmV1Config {
                        project_id: project_id.trim().to_string(),
                        client_email: sa.client_email,
                        private_key: sa.private_key,
                        token_uri: sa.token_uri,
                    });
                }
            }
            Err(e) => warn!("FcmClient: failed to parse service account JSON: {}", e),
        }
    }

    if let Some(server_key) = read_nonempty_env(&["FCM_SERVER_KEY", "FIREBASE_SERVER_KEY"]) {
        let endpoint = read_nonempty_env(&["FCM_ENDPOINT"])
            .unwrap_or_else(|| "https://fcm.googleapis.com/fcm/send".to_string());
        info!(
            "FcmClient: using legacy FCM endpoint {} (HTTP v1 not configured)",
            endpoint
        );
        return FcmMode::Legacy(FcmLegacyConfig { server_key, endpoint });
    }

    FcmMode::DryRun
}

#[derive(serde::Serialize)]
struct JwtClaims<'a> {
    iss: &'a str,
    sub: &'a str,
    aud: &'a str,
    scope: &'a str,
    iat: i64,
    exp: i64,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    #[serde(default)]
    expires_in: Option<i64>,
}

async fn fetch_access_token(
    http: &reqwest::Client,
    cfg: &FcmV1Config,
) -> Result<CachedToken, String> {
    let now = chrono::Utc::now().timestamp();
    let claims = JwtClaims {
        iss: &cfg.client_email,
        sub: &cfg.client_email,
        aud: &cfg.token_uri,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        iat: now,
        exp: now + 3600,
    };
    let key = EncodingKey::from_rsa_pem(cfg.private_key.as_bytes())
        .map_err(|e| format!("invalid service account private key: {}", e))?;
    let jwt = jsonwebtoken::encode(&Header::new(Algorithm::RS256), &claims, &key)
        .map_err(|e| format!("failed to sign service account JWT: {}", e))?;

    let form_body = format!(
        "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion={}",
        jwt
    );
    let resp = http
        .post(&cfg.token_uri)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(form_body)
        .send()
        .await
        .map_err(|e| format!("token request failed: {}", e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .unwrap_or_else(|_| "<unreadable body>".to_string());
    if !status.is_success() {
        return Err(format!("token endpoint returned {}: {}", status, truncate_body(&body)));
    }

    let token: TokenResponse = serde_json::from_str(&body)
        .map_err(|e| format!("failed to parse token response: {}", e))?;
    let expires_in = token.expires_in.unwrap_or(3600).max(60) as u64;
    let ttl = expires_in.saturating_sub(60);
    Ok(CachedToken {
        access_token: token.access_token,
        expires_at: Instant::now() + Duration::from_secs(ttl),
    })
}

fn truncate_body(body: &str) -> String {
    const MAX: usize = 300;
    if body.len() <= MAX {
        body.to_string()
    } else {
        format!("{}...", &body[..MAX])
    }
}

pub struct FcmClient {
    mode: FcmMode,
    http: reqwest::Client,
}

impl FcmClient {
    pub fn from_env() -> Self {
        Self {
            mode: load_fcm_mode(),
            http: reqwest::Client::new(),
        }
    }

    /// Returns true if FCM can be configured (HTTP v1 service account or legacy server key present).
    pub fn is_configured() -> bool {
        if read_service_account_json().is_some() {
            return true;
        }
        read_nonempty_env(&["FCM_SERVER_KEY", "FIREBASE_SERVER_KEY"]).is_some()
    }

    pub async fn send_to_target(
        &self,
        to: &str,
        title: &str,
        body: &str,
        image_url: Option<&str>,
        action_url: Option<&str>,
    ) -> bool {
        match &self.mode {
            FcmMode::V1(cfg) => self.send_v1(cfg, to, title, body, image_url, action_url).await,
            FcmMode::Legacy(cfg) => {
                self.send_legacy(cfg, to, title, body, image_url, action_url)
                    .await
            }
            FcmMode::DryRun => {
                info!(
                    "FcmClient (dry-run, no FCM credentials configured): to={} title={}",
                    to, title
                );
                true
            }
        }
    }

    async fn get_access_token(&self, cfg: &FcmV1Config) -> Result<String, String> {
        {
            let cache = token_cache().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(t) = cache.as_ref() {
                if t.expires_at > Instant::now() {
                    return Ok(t.access_token.clone());
                }
            }
        }

        let fresh = fetch_access_token(&self.http, cfg).await?;
        let token = fresh.access_token.clone();
        let mut cache = token_cache().lock().unwrap_or_else(|e| e.into_inner());
        *cache = Some(fresh);
        Ok(token)
    }

    async fn send_v1(
        &self,
        cfg: &FcmV1Config,
        to: &str,
        title: &str,
        body: &str,
        image_url: Option<&str>,
        action_url: Option<&str>,
    ) -> bool {
        let access_token = match self.get_access_token(cfg).await {
            Ok(t) => t,
            Err(e) => {
                warn!("FcmClient (v1) auth error: {}", e);
                return false;
            }
        };

        let endpoint = format!(
            "https://fcm.googleapis.com/v1/projects/{}/messages:send",
            cfg.project_id
        );

        let mut message = json!({
            "notification": {
                "title": title,
                "body": body
            },
            "android": {
                "priority": "HIGH",
                "notification": {
                    "sound": "maxxpixels_notify",
                    "channelId": "maxxpixels_alerts",
                    "clickAction": "FLUTTER_NOTIFICATION_CLICK"
                }
            },
            "data": {
                "actionUrl": action_url.unwrap_or(""),
                "click_action": "FLUTTER_NOTIFICATION_CLICK",
                "sound": "maxxpixels_notify",
                "channelId": "maxxpixels_alerts"
            }
        });

        if let Some(img) = image_url.filter(|s| !s.trim().is_empty()) {
            message["notification"]["image"] = json!(img);
        }

        if let Some(topic) = to.strip_prefix("/topics/") {
            message["topic"] = json!(topic);
        } else if let Some(topic) = to.strip_prefix("topics/") {
            message["topic"] = json!(topic);
        } else {
            message["token"] = json!(to);
        }

        let payload = json!({ "message": message });

        let resp = self
            .http
            .post(&endpoint)
            .bearer_auth(access_token)
            .json(&payload)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => true,
            Ok(r) => {
                let status = r.status();
                let err_body = r
                    .text()
                    .await
                    .unwrap_or_else(|_| "<unreadable body>".to_string());
                warn!(
                    "FcmClient (v1) send failed with status {}: {}",
                    status,
                    truncate_body(&err_body)
                );
                false
            }
            Err(e) => {
                warn!("FcmClient (v1) request error: {}", e);
                false
            }
        }
    }

    async fn send_legacy(
        &self,
        cfg: &FcmLegacyConfig,
        to: &str,
        title: &str,
        body: &str,
        image_url: Option<&str>,
        action_url: Option<&str>,
    ) -> bool {
        let payload = json!({
            "to": to,
            "priority": "high",
            "notification": {
                "title": title,
                "body": body,
                "image": image_url,
                "sound": "maxxpixels_notify",
                "android_channel_id": "maxxpixels_alerts"
            },
            "data": {
                "actionUrl": action_url.unwrap_or(""),
                "click_action": "FLUTTER_NOTIFICATION_CLICK",
                "sound": "maxxpixels_notify",
                "channelId": "maxxpixels_alerts"
            }
        });

        let resp = self
            .http
            .post(&cfg.endpoint)
            .header("Authorization", format!("key={}", cfg.server_key))
            .json(&payload)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => true,
            Ok(r) => {
                let status = r.status();
                let err_body = r
                    .text()
                    .await
                    .unwrap_or_else(|_| "<unreadable body>".to_string());
                warn!(
                    "FcmClient (legacy) send failed with status {}: {}",
                    status,
                    truncate_body(&err_body)
                );
                false
            }
            Err(e) => {
                warn!("FcmClient (legacy) request error: {}", e);
                false
            }
        }
    }
}
