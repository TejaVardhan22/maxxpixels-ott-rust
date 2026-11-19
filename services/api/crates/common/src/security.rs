use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header::AUTHORIZATION, request::Parts},
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::error::AppError;

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Claims {
    pub sub: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub full_name: Option<String>,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub device_id: Option<String>,
    pub iat: usize,
    pub exp: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iss: Option<String>,
}

impl Claims {
    pub fn new(
        user_id: impl Into<String>,
        email: Option<String>,
        phone: Option<String>,
        full_name: Option<String>,
        roles: Vec<String>,
        permissions: Vec<String>,
        device_id: Option<String>,
        ttl_seconds: usize,
    ) -> Self {
        let now = Utc::now().timestamp() as usize;
        Self {
            sub: user_id.into(),
            email,
            phone,
            full_name,
            roles,
            permissions,
            device_id,
            iat: now,
            exp: now + ttl_seconds,
            iss: Some("maxxpixels.com".to_string()),
        }
    }

    pub fn has_role(&self, role: &str) -> bool {
        let needle = role.to_uppercase();
        let alt = if needle.starts_with("ROLE_") {
            needle.replace("ROLE_", "")
        } else {
            format!("ROLE_{}", needle)
        };
        self.roles.iter().any(|r| {
            let u = r.to_uppercase();
            u == needle || u == alt
        })
    }

    pub fn is_admin(&self) -> bool {
        self.sub == "1"
            || self.email.as_deref() == Some("admin@maxxpixels.com")
            || self.has_role("ADMIN")
            || self.has_role("SUPER_ADMIN")
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for Claims
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|val| val.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?;

        let token = if auth_header.starts_with("Bearer ") {
            auth_header[7..].trim()
        } else if auth_header.starts_with("bearer ") {
            auth_header[7..].trim()
        } else {
            auth_header.trim()
        };

        if token.is_empty() {
            return Err(AppError::Unauthorized("Empty bearer token".to_string()));
        }

        let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| {
            AppError::Internal("JWT_SECRET environment variable is not configured".to_string())
        })?;

        SecurityUtils::validate_jwt(token, &jwt_secret)
            .map_err(|e| AppError::Unauthorized(format!("Invalid or expired token: {}", e)))
    }
}

pub struct SecurityUtils;

impl SecurityUtils {
    /// Verifies plain text password against existing bcrypt or argon2 hash.
    /// Handles legacy Node.js bcryptjs hashes seamlessly without requiring password reset.
    pub fn verify_password(plain: &str, hash: &str) -> bool {
        if hash.starts_with("$2a$") || hash.starts_with("$2y$") || hash.starts_with("$2b$") {
            // Normalize $2y$ and $2b$ prefix to $2a$ if needed for standard bcrypt engine
            let normalized = if hash.starts_with("$2y$") {
                hash.replacen("$2y$", "$2a$", 1)
            } else if hash.starts_with("$2b$") {
                hash.replacen("$2b$", "$2a$", 1)
            } else {
                hash.to_string()
            };
            bcrypt::verify(plain, &normalized).unwrap_or(false)
        } else if hash.starts_with("$argon2") {
            if let Ok(parsed_hash) = PasswordHash::new(hash) {
                Argon2::default()
                    .verify_password(plain.as_bytes(), &parsed_hash)
                    .is_ok()
            } else {
                false
            }
        } else {
            false
        }
    }

    /// Offloads CPU-bound password verification to Tokio's blocking thread pool
    /// so login bursts never stall async I/O worker threads.
    pub async fn verify_password_async(plain: String, hash: String) -> bool {
        tokio::task::spawn_blocking(move || Self::verify_password(&plain, &hash))
            .await
            .unwrap_or(false)
    }

    /// Generates modern high-security Argon2id hash for new or updated passwords.
    pub fn hash_password(plain: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(plain.as_bytes(), &salt)
            .map_err(|e| anyhow!("Failed hashing password: {}", e))?
            .to_string();
        Ok(hash)
    }

    /// Offloads CPU-bound Argon2id password hashing to Tokio's blocking thread pool
    /// so registration/password-reset bursts never stall async I/O worker threads.
    pub async fn hash_password_async(plain: String) -> Result<String> {
        tokio::task::spawn_blocking(move || Self::hash_password(&plain))
            .await
            .map_err(|e| anyhow!("Password hashing task failed: {}", e))?
    }

    /// Generates signed JWT token matching NestJS format.
    pub fn generate_jwt(claims: &Claims, secret: &str) -> Result<String> {
        let header = Header::default();
        encode(&header, claims, &EncodingKey::from_secret(secret.as_bytes()))
            .map_err(|e| anyhow!("Failed encoding JWT: {}", e))
    }

    /// Decodes and validates JWT signature and expiry.
    pub fn validate_jwt(token: &str, secret: &str) -> Result<Claims> {
        let mut validation = Validation::default();
        validation.validate_exp = true;
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &validation,
        )
        .map_err(|e| anyhow!("Invalid JWT token: {}", e))?;
        Ok(token_data.claims)
    }

    /// Computes HMAC-SHA256 signature for webhooks (Razorpay) and Bunny.net auth.
    pub fn compute_hmac_sha256(secret: &str, payload: &str) -> Result<String> {
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .map_err(|e| anyhow!("Invalid HMAC key: {}", e))?;
        mac.update(payload.as_bytes());
        let result = mac.finalize();
        Ok(hex::encode(result.into_bytes()))
    }
}

