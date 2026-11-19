use anyhow::Result;
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

/// HMAC-SHA256 instance used for launch signing + webhook verification.
type HmacSha256 = Hmac<Sha256>;

/// JWT claims matching the NestJS token format exactly (same `sub`, `exp`
/// validation, same secret) — the mobile app's existing tokens work as-is.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Claims {
    pub sub: String,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub full_name: Option<String>,
    #[serde(default)]
    pub roles: Vec<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    pub iat: usize,
    pub exp: usize,
}

pub struct SecurityUtils;

impl SecurityUtils {
    /// Validates signature + expiry, same contract as NestJS.
    pub fn validate_jwt(token: &str, secret: &str) -> Result<Claims> {
        let validation = Validation::default();
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &validation,
        )
        .map_err(|e| anyhow::anyhow!("Invalid JWT token: {e}"))?;
        Ok(data.claims)
    }

    /// HMAC-SHA256 hex digest (launch signing + webhook verification).
    pub fn compute_hmac_sha256(secret: &str, payload: &str) -> Result<String> {
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .map_err(|e| anyhow::anyhow!("Invalid HMAC key: {e}"))?;
        mac.update(payload.as_bytes());
        Ok(hex::encode(mac.finalize().into_bytes()))
    }
}
