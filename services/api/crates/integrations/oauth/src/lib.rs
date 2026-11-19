use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleTokenInfo {
    pub sub: String,
    pub email: Option<String>,
    pub email_verified: Option<String>,
    pub name: Option<String>,
    pub picture: Option<String>,
    pub aud: Option<String>,
}

pub struct OAuthClient {
    pub google_client_id: String,
    http: reqwest::Client,
}

impl OAuthClient {
    pub fn from_env() -> Self {
        Self {
            google_client_id: std::env::var("GOOGLE_CLIENT_ID").unwrap_or_default(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn verify_google_id_token(&self, id_token: &str) -> Result<GoogleTokenInfo, String> {
        let url = format!(
            "https://oauth2.googleapis.com/tokeninfo?id_token={}",
            id_token.trim()
        );
        let resp = self
            .http
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Google OAuth request failed: {}", e))?;

        if !resp.status().is_success() {
            return Err("Invalid Google ID token".to_string());
        }

        let info = resp
            .json::<GoogleTokenInfo>()
            .await
            .map_err(|e| format!("Failed to parse Google tokeninfo: {}", e))?;

        if !self.google_client_id.is_empty() {
            if let Some(ref aud) = info.aud {
                if aud != &self.google_client_id {
                    return Err("Google token audience mismatch".to_string());
                }
            }
        }

        Ok(info)
    }
}
