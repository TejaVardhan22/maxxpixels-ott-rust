mod coins;
mod config;
mod error;
mod response;
mod routes;
mod security;
mod service;
mod state;

use axum::{
    routing::{get, post},
    Router,
};
use sea_orm::ConnectionTrait;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::GamesConfig;
use crate::routes::{
    coin_order_handler, coin_packs_handler, coin_verify_handler, coin_webhook_handler,
    health_handler, launch_handler, me_handler, subscription_grant_handler, wallet_handler,
    wallet_order_handler, wallet_verify_handler, webhook_handler,
};
use crate::state::GamesState;

const MIGRATION_SQL: &str = include_str!("../migrations/001_init.sql");
const MIGRATION_SQL_002: &str = include_str!("../migrations/002_coin_orders.sql");

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| "info,maxx_games_service=debug".into()),
        )
        .init();

    let config = GamesConfig::from_env()?;
    let state = GamesState::connect(config.clone()).await?;

    // Idempotent schema bootstrap for the SEPARATE games DB.
    state.db.execute_unprepared(MIGRATION_SQL).await?;
    state.db.execute_unprepared(MIGRATION_SQL_002).await?;
    tracing::info!("Games database schema ensured (players, ledger, recharges, sessions, stats, coin_orders)");

    // Same public contract as the NestJS games module — mobile/web clients are
    // unaffected; nginx can route /api/v1/games/* here whenever we choose to
    // cut over (NestJS module stays in place as a fallback).
    let cors_origins = config
        .env_allowlist_origins()
        .into_iter()
        .filter_map(|o| o.parse::<axum::http::HeaderValue>().ok())
        .collect::<Vec<_>>();
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list(cors_origins))
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    let app = Router::new()
        // Launch (auth required)
        .route("/api/v1/games/playforfun/launch", get(launch_handler))
        .route("/api/games/playforfun/launch", get(launch_handler))
        .route("/games/playforfun/launch", get(launch_handler))
        .route("/api/v1/games/play-for-fun/launch", get(launch_handler))
        .route("/api/v1/games/launch", get(launch_handler))
        // Gamer record (auth required): profile + coins + stats + history
        .route("/api/v1/games/playforfun/me", get(me_handler))
        .route("/api/games/playforfun/me", get(me_handler))
        .route("/games/playforfun/me", get(me_handler))
        // Webhook (signature-verified)
        .route("/api/v1/games/playforfun/webhook", post(webhook_handler))
        .route("/api/games/playforfun/webhook", post(webhook_handler))
        .route("/games/playforfun/webhook", post(webhook_handler))
        .route("/api/v1/games/play-for-fun/webhook", post(webhook_handler))
        // Razorpay coin recharges
        .route("/api/v1/games/coins/packs", get(coin_packs_handler))
        .route("/api/games/coins/packs", get(coin_packs_handler))
        .route("/games/coins/packs", get(coin_packs_handler))
        .route("/api/v1/games/coins/order", post(coin_order_handler))
        .route("/api/games/coins/order", post(coin_order_handler))
        .route("/games/coins/order", post(coin_order_handler))
        .route("/api/v1/games/coins/verify", post(coin_verify_handler))
        .route("/api/games/coins/verify", post(coin_verify_handler))
        .route("/games/coins/verify", post(coin_verify_handler))
        .route("/api/v1/games/coins/webhook", post(coin_webhook_handler))
        .route("/api/games/coins/webhook", post(coin_webhook_handler))
        .route("/games/coins/webhook", post(coin_webhook_handler))
        // Subscription coin grants (mobile-driven; JWT-authed like all coin
        // routes). Purchase grant: +1000 on a Razorpay-verified payment.
        // Monthly claim: +100 once per calendar month while the plan is valid.
        .route("/api/v1/games/coins/subscription-grant", post(subscription_grant_handler))
        .route("/api/games/coins/subscription-grant", post(subscription_grant_handler))
        .route("/games/coins/subscription-grant", post(subscription_grant_handler))
        // Provider wallet API (server-to-server: x-pff-tenant / x-pff-secret).
        // Wallet lookup, order creation and checkout settlement for PFF's
        // Buy-coins flow.
        .route("/api/v1/games/wallet", get(wallet_handler))
        .route("/api/games/wallet", get(wallet_handler))
        .route("/games/wallet", get(wallet_handler))
        .route("/api/v1/games/wallet/order", post(wallet_order_handler))
        .route("/api/games/wallet/order", post(wallet_order_handler))
        .route("/games/wallet/order", post(wallet_order_handler))
        .route("/api/v1/games/wallet/verify", post(wallet_verify_handler))
        .route("/api/games/wallet/verify", post(wallet_verify_handler))
        .route("/games/wallet/verify", post(wallet_verify_handler))
        // Health
        .route("/healthz", get(health_handler))
        .route("/health", get(health_handler))
        .with_state(std::sync::Arc::new(state))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let port = config.port;
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("maxx-games-service listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
