use axum::{
    body::Bytes,
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;

use crate::coins::{
    CoinsOrderRequest, CoinsService, CoinsVerifyRequest, SubscriptionGrantRequest,
    WalletOrderRequest, WalletVerifyRequest,
};
use crate::error::AppError;
use crate::response::ApiResponse;
use crate::service::GamesService;
use crate::state::{AuthClaims, BearerToken, GamesState};

/// GET /api/v1/games/playforfun/launch?game=ludo|carrom|snooker|chess
/// Same JSON contract as the NestJS games module — clients need no changes.
pub async fn launch_handler(
    claims: AuthClaims,
    bearer: BearerToken,
    State(state): State<Arc<GamesState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, AppError> {
    if claims.0.sub.trim().is_empty() {
        return Err(AppError::Unauthorized(
            "Authenticated login user is required to launch games".to_string(),
        ));
    }

    let player = GamesService::resolve_player(&state, &bearer.0).await?;
    let result =
        GamesService.build_launch_url(&state, &player, params.get("game").map(String::as_str))?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Games launch URL generated", 200)),
    ))
}

/// GET /api/v1/games/playforfun/me — full gamer record:
/// profile, unique gamer UID, coin balance + lifetime totals, per-game stats,
/// recent sessions, transactions and recharges.
pub async fn me_handler(
    claims: AuthClaims,
    bearer: BearerToken,
    State(state): State<Arc<GamesState>>,
) -> Result<impl IntoResponse, AppError> {
    if claims.0.sub.trim().is_empty() {
        return Err(AppError::Unauthorized(
            "Authenticated login user is required".to_string(),
        ));
    }

    let player = GamesService::resolve_player(&state, &bearer.0).await?;
    let result = GamesService::player_snapshot(&state, &player).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Gamer record loaded", 200)),
    ))
}

/// POST /api/v1/games/playforfun/webhook (public, HMAC-verified against raw body)
pub async fn webhook_handler(
    State(state): State<Arc<GamesState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    let signature = headers
        .get("x-playforfun-signature")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let raw = String::from_utf8_lossy(&body).to_string();
    let result = GamesService
        .handle_webhook(&state, &raw, signature.as_deref())
        .await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Webhook processed", 200)),
    ))
}

/// GET /api/v1/games/coins/packs — recharge catalog (auth required).
pub async fn coin_packs_handler(
    _claims: AuthClaims,
    State(state): State<Arc<GamesState>>,
) -> Result<impl IntoResponse, AppError> {
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            CoinsService::packs(&state),
            "Coin packs loaded",
            200,
        )),
    ))
}

/// POST /api/v1/games/coins/order — create a Razorpay order for a coin pack.
pub async fn coin_order_handler(
    claims: AuthClaims,
    bearer: BearerToken,
    State(state): State<Arc<GamesState>>,
    Json(payload): Json<CoinsOrderRequest>,
) -> Result<impl IntoResponse, AppError> {
    if claims.0.sub.trim().is_empty() {
        return Err(AppError::Unauthorized("Authenticated login user is required".to_string()));
    }

    let result = CoinsService::create_order(&state, &bearer.0, &payload.pack_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Coin recharge order created", 200)),
    ))
}

/// POST /api/v1/games/coins/verify — Razorpay checkout callback verification.
pub async fn coin_verify_handler(
    claims: AuthClaims,
    bearer: BearerToken,
    State(state): State<Arc<GamesState>>,
    Json(payload): Json<CoinsVerifyRequest>,
) -> Result<impl IntoResponse, AppError> {
    if claims.0.sub.trim().is_empty() {
        return Err(AppError::Unauthorized("Authenticated login user is required".to_string()));
    }

    let result = CoinsService::verify_payment(&state, &bearer.0, &payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Coin recharge processed", 200)),
    ))
}

/// POST /api/v1/games/coins/webhook — Razorpay server events (signature-verified).
pub async fn coin_webhook_handler(
    State(state): State<Arc<GamesState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, AppError> {
    let signature = headers
        .get("x-razorpay-signature")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);

    let raw = String::from_utf8_lossy(&body).to_string();
    let result = CoinsService::handle_webhook(&state, &raw, signature.as_deref()).await?;

    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Razorpay webhook processed", 200)),
    ))
}

/// POST /api/v1/games/coins/subscription-grant — mobile-driven subscription
/// coin grant (JWT-authed, same token as every other coins route). Purchase
/// grant sends `paymentId` (Razorpay-verified, +1000); monthly claim sends
/// nothing extra (+100 once per calendar month while the plan is valid).
pub async fn subscription_grant_handler(
    claims: AuthClaims,
    bearer: BearerToken,
    State(state): State<Arc<GamesState>>,
    Json(payload): Json<SubscriptionGrantRequest>,
) -> Result<impl IntoResponse, AppError> {
    if claims.0.sub.trim().is_empty() {
        return Err(AppError::Unauthorized("Authenticated login user is required".to_string()));
    }

    let result = CoinsService::grant_subscription(&state, &bearer.0, &payload).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Subscription coins granted", 200)),
    ))
}

/// GET /api/v1/games/wallet?userId=… — provider wallet API, SERVER-TO-SERVER:
/// the PlayforFun backend calls it with the same `x-pff-tenant` /
/// `x-pff-secret` headers we send on our coins/grant calls. Returns the
/// gamer identity, coin balance, Razorpay key + pack catalog and the
/// order/verify endpoints. No UI is served here.
pub async fn wallet_handler(
    State(state): State<Arc<GamesState>>,
    headers: HeaderMap,
    Query(params): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, AppError> {
    let tenant = headers.get("x-pff-tenant").and_then(|v| v.to_str().ok());
    let secret = headers.get("x-pff-secret").and_then(|v| v.to_str().ok());
    CoinsService::verify_wallet_s2s(&state, tenant, secret)?;

    let identifier = params
        .get("userId")
        .or_else(|| params.get("user"))
        .or_else(|| params.get("uid"))
        .or_else(|| params.get("gamer_uid"))
        .or_else(|| params.get("gamerUid"))
        .or_else(|| params.get("playerId"))
        .or_else(|| params.get("player_id"))
        .or_else(|| params.get("name"))
        .cloned()
        .unwrap_or_default();

    let result = CoinsService::wallet(&state, &identifier).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Wallet loaded", 200)),
    ))
}

/// POST /api/v1/games/wallet/order — server-to-server Razorpay order for a
/// pack on behalf of the identified gamer.
pub async fn wallet_order_handler(
    State(state): State<Arc<GamesState>>,
    headers: HeaderMap,
    Json(payload): Json<WalletOrderRequest>,
) -> Result<impl IntoResponse, AppError> {
    let tenant = headers.get("x-pff-tenant").and_then(|v| v.to_str().ok());
    let secret = headers.get("x-pff-secret").and_then(|v| v.to_str().ok());
    CoinsService::verify_wallet_s2s(&state, tenant, secret)?;

    let result =
        CoinsService::wallet_order(&state, &payload.user_id, &payload.pack_id).await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(
            result,
            "Coin recharge order created",
            200,
        )),
    ))
}

/// POST /api/v1/games/wallet/verify — server-to-server checkout settlement:
/// Razorpay signature check, order ownership, ledger + PFF mirror once.
pub async fn wallet_verify_handler(
    State(state): State<Arc<GamesState>>,
    headers: HeaderMap,
    Json(payload): Json<WalletVerifyRequest>,
) -> Result<impl IntoResponse, AppError> {
    let tenant = headers.get("x-pff-tenant").and_then(|v| v.to_str().ok());
    let secret = headers.get("x-pff-secret").and_then(|v| v.to_str().ok());
    CoinsService::verify_wallet_s2s(&state, tenant, secret)?;

    let result = CoinsService::wallet_verify(
        &state,
        &payload.user_id,
        &payload.razorpay_order_id,
        &payload.razorpay_payment_id,
        &payload.razorpay_signature,
    )
    .await?;
    Ok((
        StatusCode::OK,
        Json(ApiResponse::success(result, "Coin recharge processed", 200)),
    ))
}

/// GET /healthz | /health — liveness for nginx / monitoring.
pub async fn health_handler(State(state): State<Arc<GamesState>>) -> impl IntoResponse {
    let db_ok = sqlx_health(&state.db).await;
    let configured = !state.config.pff_secret.is_empty();
    let body = serde_json::json!({
        "status": if db_ok { "UP" } else { "DEGRADED" },
        "service": "maxx-games-service",
        "gamesDb": if db_ok { "UP" } else { "DOWN" },
        "playforfunConfigured": configured,
        "mainApiUrl": state.config.main_api_url,
    });
    let status = if db_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(body))
}

async fn sqlx_health(db: &sea_orm::DatabaseConnection) -> bool {
    use sea_orm::ConnectionTrait;
    db.query_one(sea_orm::Statement::from_string(
        sea_orm::DatabaseBackend::Postgres,
        "SELECT 1",
    ))
    .await
    .is_ok()
}
