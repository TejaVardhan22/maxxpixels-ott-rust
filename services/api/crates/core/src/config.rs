use anyhow::{Context, Result};
use std::env;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub env: String,
    pub host: String,
    pub port: u16,
    pub cors_allowed_origins: String,

    // Database
    pub database_url: String,
    pub db_max_connections: u32,
    pub db_min_connections: u32,
    pub db_connect_timeout_sec: u64,
    pub db_idle_timeout_sec: u64,

    // Redis
    pub redis_url: String,

    // Kafka
    pub kafka_brokers: String,
    pub kafka_client_id: String,
    pub kafka_consumer_group: String,
    pub kafka_enabled: bool,

    // Security & JWT
    pub jwt_secret: String,
    pub jwt_expiration_seconds: usize,
    pub jwt_refresh_expiration_seconds: usize,

    // Bunny.net
    pub bunny_stream_library_id: String,
    pub bunny_stream_api_key: String,
    pub bunny_stream_cdn_hostname: String,
    pub bunny_stream_token_auth_key: String,
    pub bunny_storage_zone_name: String,
    pub bunny_storage_zone_password: String,
    pub bunny_pull_zone_domain: String,

    // Razorpay
    pub razorpay_key_id: String,
    pub razorpay_key_secret: String,
    pub razorpay_webhook_secret: String,

    // MSG91
    pub sms_provider: String,
    pub msg91_auth_key: String,
    pub msg91_template_id: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        // Load .env if present
        let _ = dotenvy::dotenv();

        let env_mode = env::var("RUST_ENV").unwrap_or_else(|_| "development".to_string());
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let port = env::var("PORT")
            .unwrap_or_else(|_| "8081".to_string())
            .parse::<u16>()
            .context("PORT must be a valid u16")?;

        let cors_allowed_origins = env::var("CORS_ALLOWED_ORIGINS").unwrap_or_else(|_| {
            "http://localhost:3000,http://localhost:4200,http://localhost:5173,http://localhost:8080".to_string()
        });

        let database_url = env::var("DATABASE_URL")
            .context("DATABASE_URL environment variable is required")?;
        let db_max_connections = env::var("DATABASE_MAX_CONNECTIONS")
            .unwrap_or_else(|_| "25".to_string())
            .parse::<u32>()
            .unwrap_or(25);
        let db_min_connections = env::var("DATABASE_MIN_CONNECTIONS")
            .unwrap_or_else(|_| "5".to_string())
            .parse::<u32>()
            .unwrap_or(5);
        let db_connect_timeout_sec = env::var("DATABASE_CONNECT_TIMEOUT_SEC")
            .unwrap_or_else(|_| "10".to_string())
            .parse::<u64>()
            .unwrap_or(10);
        let db_idle_timeout_sec = env::var("DATABASE_IDLE_TIMEOUT_SEC")
            .unwrap_or_else(|_| "300".to_string())
            .parse::<u64>()
            .unwrap_or(300);

        let redis_url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379/0".to_string());

        let kafka_brokers = env::var("KAFKA_BROKERS").unwrap_or_else(|_| "kafka:9092".to_string());
        let kafka_client_id = env::var("KAFKA_CLIENT_ID").unwrap_or_else(|_| "maxxott-rust-backend".to_string());
        let kafka_consumer_group = env::var("KAFKA_CONSUMER_GROUP")
            .unwrap_or_else(|_| "maxx-ott-group-rust-shadow".to_string());
        let kafka_enabled = env::var("KAFKA_ENABLED").unwrap_or_else(|_| "true".to_string()) == "true";

        let jwt_secret = env::var("JWT_SECRET")
            .context("JWT_SECRET environment variable is required")?;
        let jwt_expiration_seconds = env::var("JWT_EXPIRATION_SECONDS")
            .unwrap_or_else(|_| "86400".to_string())
            .parse::<usize>()
            .unwrap_or(86400);
        let jwt_refresh_expiration_seconds = env::var("JWT_REFRESH_EXPIRATION_SECONDS")
            .unwrap_or_else(|_| "2592000".to_string())
            .parse::<usize>()
            .unwrap_or(2592000);

        let bunny_stream_library_id = env::var("BUNNY_STREAM_LIBRARY_ID").unwrap_or_default();
        let bunny_stream_api_key = env::var("BUNNY_STREAM_API_KEY").unwrap_or_default();
        let bunny_stream_cdn_hostname = env::var("BUNNY_STREAM_CDN_HOSTNAME").unwrap_or_default();
        let bunny_stream_token_auth_key = env::var("BUNNY_STREAM_TOKEN_AUTH_KEY").unwrap_or_default();
        let bunny_storage_zone_name = env::var("BUNNY_STORAGE_ZONE_NAME").unwrap_or_default();
        let bunny_storage_zone_password = env::var("BUNNY_STORAGE_ZONE_PASSWORD").unwrap_or_default();
        let bunny_pull_zone_domain = env::var("BUNNY_PULL_ZONE_DOMAIN").unwrap_or_default();

        let razorpay_key_id = env::var("RAZORPAY_KEY_ID").unwrap_or_default();
        let razorpay_key_secret = env::var("RAZORPAY_KEY_SECRET").unwrap_or_default();
        let razorpay_webhook_secret = env::var("RAZORPAY_WEBHOOK_SECRET").unwrap_or_default();

        let sms_provider = env::var("SMS_PROVIDER").unwrap_or_else(|_| "MSG91".to_string());
        let msg91_auth_key = env::var("MSG91_AUTH_KEY").unwrap_or_default();
        let msg91_template_id = env::var("MSG91_TEMPLATE_ID").unwrap_or_default();

        Ok(Self {
            env: env_mode,
            host,
            port,
            cors_allowed_origins,
            database_url,
            db_max_connections,
            db_min_connections,
            db_connect_timeout_sec,
            db_idle_timeout_sec,
            redis_url,
            kafka_brokers,
            kafka_client_id,
            kafka_consumer_group,
            kafka_enabled,
            jwt_secret,
            jwt_expiration_seconds,
            jwt_refresh_expiration_seconds,
            bunny_stream_library_id,
            bunny_stream_api_key,
            bunny_stream_cdn_hostname,
            bunny_stream_token_auth_key,
            bunny_storage_zone_name,
            bunny_storage_zone_password,
            bunny_pull_zone_domain,
            razorpay_key_id,
            razorpay_key_secret,
            razorpay_webhook_secret,
            sms_provider,
            msg91_auth_key,
            msg91_template_id,
        })
    }
}

