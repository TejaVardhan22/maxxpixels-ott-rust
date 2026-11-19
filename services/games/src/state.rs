use anyhow::Result;
use axum::{async_trait, extract::FromRequestParts, http::header::AUTHORIZATION, http::request::Parts};
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::info;

use crate::config::GamesConfig;
use crate::error::AppError;
use crate::security::Claims;

/// Player record mirrored from the NestJS main API into the games DB.
/// Mirrors the full gamer profile row from `row_to_json(players)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    #[serde(default)]
    pub gamer_uid: Option<String>,
    pub user_id: String,
    pub external_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub mobile_number: Option<String>,
    #[serde(default)]
    pub age: Option<i64>,
    #[serde(default = "default_display_name")]
    pub display_name: String,
    #[serde(default)]
    pub coins: i64,
}

fn default_display_name() -> String {
    "maxpx_player".to_string()
}

pub struct GamesState {
    pub db: DatabaseConnection,
    pub http: reqwest::Client,
    pub config: GamesConfig,
}

impl GamesState {
    pub async fn connect(config: GamesConfig) -> Result<Self> {
        let mut opt = ConnectOptions::new(&config.games_database_url);
        opt.max_connections(10)
            .min_connections(1)
            .connect_timeout(Duration::from_secs(10))
            .sqlx_logging(config.env == "development");

        let db = Database::connect(opt)
            .await
            .map_err(|e| anyhow::anyhow!("Failed connecting to games database: {e}"))?;
        info!("Connected to separate games database");

        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(8))
            .build()?;

        Ok(Self { db, http, config })
    }
}

/// Re-usable Bearer token (the same token the mobile app sends; validated once
/// via Claims, forwarded to the main API for user details).
pub struct BearerToken(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for BearerToken
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

        let token = auth_header
            .strip_prefix("Bearer ")
            .or_else(|| auth_header.strip_prefix("bearer "))
            .map(str::trim)
            .unwrap_or(auth_header.trim());

        if token.is_empty() {
            return Err(AppError::Unauthorized("Empty bearer token".to_string()));
        }

        Ok(BearerToken(token.to_string()))
    }
}

/// Type-safe JWT extractor with the same error contract as maxx-common.
pub struct AuthClaims(pub Claims);

#[async_trait]
impl<S> FromRequestParts<S> for AuthClaims
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

        let token = auth_header
            .strip_prefix("Bearer ")
            .or_else(|| auth_header.strip_prefix("bearer "))
            .map(str::trim)
            .unwrap_or(auth_header.trim());

        let jwt_secret =
            std::env::var("JWT_SECRET").unwrap_or_else(|_| "maxxpixels_secret_key_change_in_production".to_string());

        let claims = SecurityUtils::validate_jwt(token, &jwt_secret)
            .map_err(|e| AppError::Unauthorized(format!("Invalid or expired token: {e}")))?;

        Ok(AuthClaims(claims))
    }
}

use crate::security::SecurityUtils;
