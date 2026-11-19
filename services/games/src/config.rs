use anyhow::Result;
use serde::{Deserialize, Serialize};

/// A purchasable coin pack (default list or COIN_PACKS env override).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinPack {
    pub id: String,
    pub coins: i64,
    #[serde(alias = "amount_inr")]
    pub amount_inr: f64,
    #[serde(default)]
    pub label: String,
}

impl CoinPack {
    pub fn amount_paise(&self) -> i64 {
        (self.amount_inr * 100.0).round() as i64
    }
}

fn default_coin_packs() -> Vec<CoinPack> {
    vec![
        CoinPack { id: "starter".into(), coins: 100, amount_inr: 49.0, label: "Starter Pack".into() },
        CoinPack { id: "bronze".into(), coins: 500, amount_inr: 199.0, label: "Bronze Pack".into() },
        CoinPack { id: "silver".into(), coins: 1_200, amount_inr: 399.0, label: "Silver Pack".into() },
        CoinPack { id: "gold".into(), coins: 3_000, amount_inr: 899.0, label: "Gold Pack".into() },
        CoinPack { id: "vip".into(), coins: 7_500, amount_inr: 1_999.0, label: "VIP Pack".into() },
    ]
}

fn load_coin_packs() -> Vec<CoinPack> {
    match std::env::var("COIN_PACKS") {
        Ok(raw) if !raw.trim().is_empty() => serde_json::from_str::<Vec<CoinPack>>(&raw)
            .unwrap_or_else(|e| {
                eprintln!("COIN_PACKS env is invalid JSON ({e}) — falling back to defaults");
                default_coin_packs()
            }),
        _ => default_coin_packs(),
    }
}

#[derive(Debug, Clone)]
pub struct GamesConfig {
    /// SEPARATE games database (never the main OTT platform DB).
    pub games_database_url: String,
    /// Main NestJS API base — used ONLY to resolve user details via GET /api/v1/auth/me.
    pub main_api_url: String,
    /// JWT secret shared with NestJS (validates the same Bearer tokens the mobile app sends).
    pub jwt_secret: String,
    /// PlayforFun credentials (server-only; never exposed to clients).
    pub pff_tenant: String,
    pub pff_secret: String,
    /// HTTP listen port.
    pub port: u16,
    /// How long a mirrored player record is trusted before re-syncing from NestJS.
    pub player_ttl_seconds: i64,
    /// CORS origins (comma separated).
    pub cors_allowed_origins: String,
    /// Razorpay credentials (server-only).
    pub razorpay_key_id: String,
    pub razorpay_key_secret: String,
    pub razorpay_webhook_secret: String,
    pub razorpay_currency: String,
    /// Purchasable coin packs.
    pub coin_packs: Vec<CoinPack>,
    /// Coins credited automatically per subscription activation when the
    /// caller doesn't specify an amount (env SUBSCRIPTION_GRANT_COINS).
    pub subscription_grant_coins: i64,
    /// Coins credited once per calendar month while a subscription plan is
    /// valid (env SUBSCRIPTION_MONTHLY_COINS).
    pub subscription_monthly_coins: i64,
    pub env: String,
}

impl GamesConfig {
    pub fn from_env() -> Result<Self> {
        let port = std::env::var("GAMES_SERVICE_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8090);

        let pff_secret = std::env::var("PLAYFORFUN_SECRET")
            .or_else(|_| std::env::var("PFF_SECRET"))
            .unwrap_or_default()
            .trim()
            .to_string();

        let jwt_secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "maxxpixels_secret_key_change_in_production".to_string());

        Ok(Self {
            games_database_url: std::env::var("GAMES_DATABASE_URL")
                .unwrap_or_else(|_| std::env::var("DATABASE_URL").unwrap_or_default()),
            main_api_url: std::env::var("MAIN_API_URL")
                .unwrap_or_else(|_| "https://api.maxxpixels.com".to_string())
                .trim_end_matches('/')
                .to_string(),
            jwt_secret,
            pff_tenant: std::env::var("PLAYFORFUN_TENANT_ID")
                .unwrap_or_else(|_| "maxxpixels".to_string())
                .trim()
                .to_string(),
            pff_secret,
            port,
            player_ttl_seconds: std::env::var("PLAYER_TTL_SECONDS")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(86_400), // 24h
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            razorpay_key_id: std::env::var("RAZORPAY_KEY_ID").unwrap_or_default().trim().to_string(),
            razorpay_key_secret: std::env::var("RAZORPAY_KEY_SECRET")
                .unwrap_or_default()
                .trim()
                .to_string(),
            razorpay_webhook_secret: std::env::var("RAZORPAY_WEBHOOK_SECRET")
                .unwrap_or_default()
                .trim()
                .to_string(),
            razorpay_currency: std::env::var("RAZORPAY_CURRENCY")
                .unwrap_or_else(|_| "INR".to_string())
                .trim()
                .to_ascii_uppercase(),
            coin_packs: load_coin_packs(),
            subscription_grant_coins: std::env::var("SUBSCRIPTION_GRANT_COINS")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(1000),
            subscription_monthly_coins: std::env::var("SUBSCRIPTION_MONTHLY_COINS")
                .ok()
                .and_then(|v| v.parse::<i64>().ok())
                .unwrap_or(100),
            env: std::env::var("NODE_ENV").unwrap_or_else(|_| "production".to_string()),
        })
    }

    /// Parsed CORS origin list for tower-http CorsLayer.
    pub fn env_allowlist_origins(&self) -> Vec<String> {
        self.cors_allowed_origins
            .split(',')
            .map(str::trim)
            .filter(|o| !o.is_empty())
            .map(str::to_string)
            .collect()
    }
}
