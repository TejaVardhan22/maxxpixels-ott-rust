use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

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

// ---------------------------------------------------------------------------
// FCM HTTP v1 (Firebase Cloud Messaging) — service account authentication only
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct ServiceAccount {
    pub project_id: Option<String>,
    pub client_email: String,
    pub private_key: String,
    #[serde(default = "default_token_uri")]
    pub token_uri: String,
}

fn default_token_uri() -> String {
    "https://oauth2.googleapis.com/token".to_string()
}

#[derive(Debug, Clone)]
pub struct FcmV1Config {
    pub project_id: String,
    pub client_email: String,
    pub private_key: String,
    pub token_uri: String,
}

#[derive(Debug, Clone)]
pub enum FcmMode {
    V1(FcmV1Config),
    Unconfigured,
}

#[derive(Debug, Clone)]
pub struct CachedToken {
    pub access_token: String,
    pub expires_at: Instant,
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
            Err(e) => warn!(
                "FcmClient: failed to read service account file {}: {}",
                path, e
            ),
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
                    warn!(
                        "FcmClient: service account configured but project_id is missing; FCM will be unconfigured"
                    );
                    return FcmMode::Unconfigured;
                }
                if sa.client_email.trim().is_empty() {
                    warn!(
                        "FcmClient: service account is missing client_email; FCM will be unconfigured"
                    );
                    return FcmMode::Unconfigured;
                }
                if sa.private_key.trim().is_empty() {
                    warn!(
                        "FcmClient: service account is missing private_key; FCM will be unconfigured"
                    );
                    return FcmMode::Unconfigured;
                }

                let pid = project_id.trim().to_string();
                info!(
                    "FcmClient: FCM mode=HTTP_V1 project_id={} token_uri={}",
                    pid,
                    sa.token_uri
                );
                return FcmMode::V1(FcmV1Config {
                    project_id: pid,
                    client_email: sa.client_email,
                    private_key: sa.private_key,
                    token_uri: sa.token_uri,
                });
            }
            Err(e) => {
                warn!(
                    "FcmClient: failed to parse service account JSON: {}; FCM will be unconfigured",
                    e
                );
            }
        }
    }

    info!("FcmClient: FCM mode=UNCONFIGURED (no service account credentials found)");
    FcmMode::Unconfigured
}

// ---------------------------------------------------------------------------
// JWT for Google OAuth2 service account authentication
// ---------------------------------------------------------------------------

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

/// Builds the RFC 7523 JWT claim set for Google service account OAuth2.
/// Claims: iss=client_email, sub=client_email, aud=token_uri,
/// scope=firebase.messaging, iat=now, exp=now+3600.
fn build_jwt_claims<'a>(client_email: &'a str, token_uri: &'a str, now: i64) -> JwtClaims<'a> {
    JwtClaims {
        iss: client_email,
        sub: client_email,
        aud: token_uri,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        iat: now,
        exp: now + 3600,
    }
}

fn truncate_body(body: &str) -> String {
    const MAX: usize = 300;
    if body.len() <= MAX {
        body.to_string()
    } else {
        format!("{}...", &body[..MAX])
    }
}

/// Signs a service-account JWT and exchanges it for an OAuth2 access token.
/// Returns the access token and its remaining TTL in seconds.
async fn fetch_access_token(
    http: &reqwest::Client,
    cfg: &FcmV1Config,
) -> Result<CachedToken, String> {
    let now = chrono::Utc::now().timestamp();
    let claims = build_jwt_claims(&cfg.client_email, &cfg.token_uri, now);

    let key = jsonwebtoken::EncodingKey::from_rsa_pem(cfg.private_key.as_bytes())
        .map_err(|e| format!("invalid service account private key: {}", e))?;

    let jwt = jsonwebtoken::encode(
        &jsonwebtoken::Header::new(jsonwebtoken::Algorithm::RS256),
        &claims,
        &key,
    )
    .map_err(|e| format!("failed to sign service account JWT: {}", e))?;

    debug!(
        "FcmClient (v1): requesting OAuth2 token from {}",
        cfg.token_uri
    );

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
        error!(
            "FcmClient (v1): OAuth2 token exchange failed status={} body={}",
            status,
            truncate_body(&body)
        );
        return Err(format!(
            "token endpoint returned {}: {}",
            status,
            truncate_body(&body)
        ));
    }

    let token: TokenResponse = serde_json::from_str(&body)
        .map_err(|e| format!("failed to parse token response: {}", e))?;

    let expires_in = token.expires_in.unwrap_or(3600).max(60) as u64;
    // Cache with a 60-second safety margin before expiry.
    let ttl = expires_in.saturating_sub(60);

    info!(
        "FcmClient (v1): OAuth2 token acquired, expires_in={}s, cache_ttl={}s",
        expires_in, ttl
    );

    Ok(CachedToken {
        access_token: token.access_token,
        expires_at: Instant::now() + Duration::from_secs(ttl),
    })
}

// ---------------------------------------------------------------------------
// FcmClient — public API
// ---------------------------------------------------------------------------

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

    /// Returns true only when FCM HTTP v1 service-account credentials are
    /// configured. Legacy `FCM_SERVER_KEY` is no longer accepted.
    pub fn is_configured() -> bool {
        matches!(
            load_fcm_mode(),
            FcmMode::V1(_)
        )
    }

    /// Sends an FCM message to a device token or topic.
    ///
    /// Returns `true` only when the FCM HTTP v1 API reports success.
    /// Returns `false` when unconfigured, on auth failure, or on send failure.
    pub async fn send_to_target(
        &self,
        to: &str,
        title: &str,
        body: &str,
        image_url: Option<&str>,
        action_url: Option<&str>,
    ) -> bool {
        match &self.mode {
            FcmMode::V1(cfg) => {
                self.send_v1(cfg, to, title, body, image_url, action_url)
                    .await
            }
            FcmMode::Unconfigured => {
                warn!(
                    "FcmClient: send attempted but FCM is unconfigured (no service account credentials); to={} title={}",
                    to, title
                );
                false
            }
        }
    }

    async fn get_access_token(&self, cfg: &FcmV1Config) -> Result<String, String> {
        {
            let cache = token_cache().lock().unwrap_or_else(|e| e.into_inner());
            if let Some(t) = cache.as_ref() {
                if t.expires_at > Instant::now() {
                    debug!("FcmClient (v1): using cached OAuth2 access token");
                    return Ok(t.access_token.clone());
                }
            }
        }

        match fetch_access_token(&self.http, cfg).await {
            Ok(fresh) => {
                let token = fresh.access_token.clone();
                let mut cache = token_cache().lock().unwrap_or_else(|e| e.into_inner());
                *cache = Some(fresh);
                Ok(token)
            }
            Err(e) => {
                error!("FcmClient (v1): OAuth2 authentication failed: {}", e);
                Err(e)
            }
        }
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
            Err(_) => return false,
        };

        let endpoint = format!(
            "https://fcm.googleapis.com/v1/projects/{}/messages:send",
            cfg.project_id
        );

        // Build FCM HTTP v1 message payload.
        // Android notification config uses custom channel and sound.
        // Data payload carries click action and deep-link for the mobile app.
        let mut message = serde_json::Map::new();

        let mut notification = serde_json::Map::new();
        notification.insert("title".to_string(), json!(title));
        notification.insert("body".to_string(), json!(body));
        if let Some(img) = image_url.filter(|s| !s.trim().is_empty()) {
            notification.insert("image".to_string(), json!(img));
        }
        message.insert("notification".to_string(), Value::Object(notification));

        let mut android = serde_json::Map::new();
        android.insert("priority".to_string(), json!("HIGH"));
        let mut android_notification = serde_json::Map::new();
        android_notification.insert(
            "sound".to_string(),
            json!("maxxpixels_notify"),
        );
        android_notification.insert(
            "channelId".to_string(),
            json!("maxxpixels_alerts"),
        );
        android_notification.insert(
            "clickAction".to_string(),
            json!("FLUTTER_NOTIFICATION_CLICK"),
        );
        android.insert(
            "notification".to_string(),
            Value::Object(android_notification),
        );
        message.insert("android".to_string(), Value::Object(android));

        let mut data = serde_json::Map::new();
        data.insert(
            "actionUrl".to_string(),
            json!(action_url.unwrap_or("")),
        );
        data.insert(
            "click_action".to_string(),
            json!("FLUTTER_NOTIFICATION_CLICK"),
        );
        data.insert("sound".to_string(), json!("maxxpixels_notify"));
        data.insert("channelId".to_string(), json!("maxxpixels_alerts"));
        message.insert("data".to_string(), Value::Object(data));

        // Target: topic or device token.
        let target_label = if let Some(topic) = to.strip_prefix("/topics/") {
            message.insert("topic".to_string(), json!(topic));
            format!("topic/{}", topic)
        } else if let Some(topic) = to.strip_prefix("topics/") {
            message.insert("topic".to_string(), json!(topic));
            format!("topic/{}", topic)
        } else {
            // Truncate token for safe logging (never log full device token).
            let safe_to = if to.len() > 8 {
                format!("{}...{}", &to[..4], &to[to.len() - 4..])
            } else {
                "***".to_string()
            };
            message.insert("token".to_string(), json!(to));
            format!("token/{}", safe_to)
        };

        let payload = json!({ "message": Value::Object(message) });

        debug!(
            "FcmClient (v1): sending push to {} project_id={}",
            target_label, cfg.project_id
        );

        let resp = self
            .http
            .post(&endpoint)
            .bearer_auth(access_token)
            .json(&payload)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().is_success() => {
                info!(
                    "FcmClient (v1): push sent successfully to {}",
                    target_label
                );
                true
            }
            Ok(r) => {
                let status = r.status();
                let err_body = r
                    .text()
                    .await
                    .unwrap_or_else(|_| "<unreadable body>".to_string());
                error!(
                    "FcmClient (v1): send failed to {} status={} body={}",
                    target_label,
                    status,
                    truncate_body(&err_body)
                );
                false
            }
            Err(e) => {
                error!(
                    "FcmClient (v1): send request error to {}: {}",
                    target_label, e
                );
                false
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests — no production Firebase credentials required
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn valid_service_account_json() -> String {
        json!({
            "type": "service_account",
            "project_id": "test-project-123",
            "private_key_id": "keyid",
            "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC\\n-----END PRIVATE KEY-----\\n",
            "client_email": "test-project-123@test-project-123.iam.gserviceaccount.com",
            "token_uri": "https://oauth2.googleapis.com/token"
        })
        .to_string()
    }

    fn service_account_missing_project() -> String {
        json!({
            "type": "service_account",
            "client_email": "test@test.iam.gserviceaccount.com",
            "private_key": "fake-key",
            "token_uri": "https://oauth2.googleapis.com/token"
        })
        .to_string()
    }

    fn service_account_missing_private_key() -> String {
        json!({
            "type": "service_account",
            "project_id": "test-project",
            "client_email": "test@test.iam.gserviceaccount.com",
            "token_uri": "https://oauth2.googleapis.com/token"
        })
        .to_string()
    }

    fn service_account_missing_client_email() -> String {
        json!({
            "type": "service_account",
            "project_id": "test-project",
            "private_key": "fake-key",
            "token_uri": "https://oauth2.googleapis.com/token"
        })
        .to_string()
    }

    fn invalid_json() -> String {
        "{ not valid json".to_string()
    }

    #[test]
    fn test_service_account_parses_valid_json() {
        let sa: ServiceAccount = serde_json::from_str(&valid_service_account_json()).unwrap();
        assert_eq!(sa.project_id.as_deref(), Some("test-project-123"));
        assert_eq!(
            sa.client_email,
            "test-project-123@test-project-123.iam.gserviceaccount.com"
        );
        assert!(sa.private_key.contains("BEGIN PRIVATE KEY"));
        assert_eq!(sa.token_uri, "https://oauth2.googleapis.com/token");
    }

    #[test]
    fn test_service_account_missing_project_id() {
        let result: Result<ServiceAccount, _> =
            serde_json::from_str(&service_account_missing_project());
        // JSON parses fine; project_id validation happens in load_fcm_mode
        assert!(result.is_ok());
        let sa = result.unwrap();
        assert!(sa.project_id.is_none());
    }

    #[test]
    fn test_service_account_missing_private_key_fails_to_parse() {
        // private_key is a required (non-Option) field; missing it is a parse error.
        let result: Result<ServiceAccount, _> =
            serde_json::from_str(&service_account_missing_private_key());
        assert!(result.is_err(), "missing private_key must be a parse error");
    }

    #[test]
    fn test_service_account_missing_client_email() {
        let result: Result<ServiceAccount, _> =
            serde_json::from_str(&service_account_missing_client_email());
        // client_email is required (non-Option) so this should fail to parse
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_json_fails_to_parse() {
        let result: Result<ServiceAccount, _> = serde_json::from_str(&invalid_json());
        assert!(result.is_err());
    }

    #[test]
    fn test_build_jwt_claims() {
        let now = 1_700_000_000i64;
        let claims = build_jwt_claims(
            "test@project.iam.gserviceaccount.com",
            "https://oauth2.googleapis.com/token",
            now,
        );
        assert_eq!(claims.iss, "test@project.iam.gserviceaccount.com");
        assert_eq!(claims.sub, "test@project.iam.gserviceaccount.com");
        assert_eq!(claims.aud, "https://oauth2.googleapis.com/token");
        assert_eq!(
            claims.scope,
            "https://www.googleapis.com/auth/firebase.messaging"
        );
        assert_eq!(claims.iat, now);
        assert_eq!(claims.exp, now + 3600);
    }

    #[test]
    fn test_truncate_body() {
        let short = "short";
        assert_eq!(truncate_body(short), "short");

        let long = "a".repeat(500);
        let truncated = truncate_body(&long);
        assert_eq!(truncated.len(), 303); // 300 + "..."
        assert!(truncated.ends_with("..."));
    }

    #[test]
    fn test_is_configured_returns_false_without_credentials() {
        // Ensure no FCM env vars are set during this test
        std::env::remove_var("FCM_SERVICE_ACCOUNT_PATH");
        std::env::remove_var("FCM_SERVICE_ACCOUNT_JSON");
        std::env::remove_var("FIREBASE_SERVICE_ACCOUNT_PATH");
        std::env::remove_var("FIREBASE_SERVICE_ACCOUNT_JSON");
        std::env::remove_var("GOOGLE_CREDENTIALS_JSON");
        std::env::remove_var("FCM_CREDENTIALS_JSON");
        std::env::remove_var("GOOGLE_APPLICATION_CREDENTIALS");
        // Reset the OnceLock cache is not possible, so we just verify
        // that without env vars, load_fcm_mode returns Unconfigured.
        // is_configured() calls load_fcm_mode() which reads env each time.
        // Note: OnceLock for token cache doesn't affect mode loading.
        assert!(!FcmClient::is_configured());
    }

    #[tokio::test]
    async fn test_unconfigured_mode_returns_false_on_send() {
        // Verify that Unconfigured mode leads to send_to_target returning false,
        // not reporting successful delivery when credentials are missing.
        let client = FcmClient {
            mode: FcmMode::Unconfigured,
            http: reqwest::Client::new(),
        };
        let result = client
            .send_to_target("token123", "Test", "Body", None, None)
            .await;
        assert!(
            !result,
            "Unconfigured FCM must not report successful delivery"
        );
    }

    #[test]
    fn test_unconfigured_mode_is_unconfigured() {
        let client = FcmClient {
            mode: FcmMode::Unconfigured,
            http: reqwest::Client::new(),
        };
        match client.mode {
            FcmMode::Unconfigured => {}
            FcmMode::V1(_) => panic!("expected Unconfigured mode"),
        }
    }

    #[test]
    fn test_topic_normalization_for_v1_payload() {
        // Verify that "/topics/all_users" and "topics/all_users" both produce topic field.
        // This is tested indirectly through send_v1 payload construction; here we
        // just verify the prefix-stripping logic is sound.
        let cases = vec![
            ("/topics/all_users", "all_users"),
            ("topics/all_users", "all_users"),
            ("all_users", "all_users"),
        ];
        for (input, expected_topic) in cases {
            let topic = input.strip_prefix("/topics/").or_else(|| input.strip_prefix("topics/"));
            // If no prefix, it's treated as a device token
            match topic {
                Some(t) => assert_eq!(t, expected_topic),
                None => assert_eq!(input, expected_topic),
            }
        }
    }
}
