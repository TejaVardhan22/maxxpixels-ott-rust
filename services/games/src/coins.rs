use sea_orm::TransactionTrait;
use serde::Deserialize;
use serde_json::Value as Json;
use tracing::{info, warn};
use uuid::Uuid;

use crate::config::CoinPack;
use crate::error::AppError;
use crate::security::SecurityUtils;
use crate::service::{
    constant_time_eq, exec, query_json_rows, query_player_json, GamesService, BASE_URL,
};
use crate::state::GamesState;

/// Plan expiry parser — accepts ISO-8601 instants ("2026-12-15T18:30:00.000Z")
/// and plain dates ("2026-12-15", treated as end-of-day IST-friendly UTC).
fn parse_valid_until(s: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&chrono::Utc));
    }
    let day = s.get(..10).unwrap_or(s);
    chrono::NaiveDate::parse_from_str(day, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.and_hms_opt(23, 59, 59))
        .map(|dt| dt.and_utc())
}

const RAZORPAY_API: &str = "https://api.razorpay.com/v1";
const PFF_GRANT_PATH: &str = "/api/public/coins/grant";

// ---------------------------------------------------------------------------
// Request DTOs (accept both camelCase and Razorpay's snake_case keys)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinsOrderRequest {
    #[serde(alias = "pack")]
    pub pack_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoinsVerifyRequest {
    #[serde(alias = "razorpay_order_id")]
    pub razorpay_order_id: String,
    #[serde(alias = "razorpay_payment_id")]
    pub razorpay_payment_id: String,
    #[serde(alias = "razorpay_signature")]
    pub razorpay_signature: String,
}

/// Body for POST /games/wallet/order — provider wallet API (server-to-server;
/// authenticated by the x-pff-tenant / x-pff-secret headers).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletOrderRequest {
    #[serde(alias = "user", alias = "uid", alias = "gamer_uid", alias = "gamerUid")]
    pub user_id: String,
    #[serde(alias = "pack")]
    pub pack_id: String,
}

/// Body for POST /games/wallet/verify — provider wallet API (server-to-server).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WalletVerifyRequest {
    #[serde(alias = "user", alias = "uid", alias = "gamer_uid", alias = "gamerUid")]
    pub user_id: String,
    #[serde(alias = "razorpay_order_id")]
    pub razorpay_order_id: String,
    #[serde(alias = "razorpay_payment_id")]
    pub razorpay_payment_id: String,
    #[serde(alias = "razorpay_signature")]
    pub razorpay_signature: String,
}

/// Body for POST /games/coins/subscription-grant (JWT-authed, mobile-driven).
#[derive(Debug, Deserialize)]
pub struct SubscriptionGrantRequest {
    /// Razorpay payment id — present on the purchase grant; verified against
    /// the Razorpay API (status = captured) before crediting.
    #[serde(default, alias = "payment_id", alias = "razorpay_payment_id")]
    pub payment_id: Option<String>,
    /// OTT subscription id — audit only (monthly top-ups key on the gamer).
    #[serde(default, alias = "subscription_id")]
    pub subscription_id: Option<String>,
    /// Plan expiry (ISO date) from the verified subscription — monthly top-ups
    /// stop after it.
    #[serde(default, alias = "valid_until", alias = "endDate", alias = "end_date")]
    pub valid_until: Option<String>,
    /// Coin amount override for the purchase grant (default 1000).
    #[serde(default)]
    pub coins: Option<i64>,
}

pub struct CoinsService;

impl CoinsService {
    fn find_pack(state: &GamesState, pack_id: &str) -> Result<CoinPack, AppError> {
        state
            .config
            .coin_packs
            .iter()
            .find(|p| p.id.eq_ignore_ascii_case(pack_id))
            .cloned()
            .ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Unknown coin pack '{pack_id}'. Available: {}",
                    state
                        .config
                        .coin_packs
                        .iter()
                        .map(|p| p.id.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                ))
            })
    }

    /// GET /coins/packs — purchasable catalog for the recharge screen.
    pub fn packs(state: &GamesState) -> Json {
        serde_json::json!({
            "currency": state.config.razorpay_currency,
            "keyId": state.config.razorpay_key_id,
            "packs": state.config.coin_packs,
        })
    }

    /// POST /coins/order — creates a Razorpay order and records it (CREATED).
    pub async fn create_order(
        state: &GamesState,
        bearer: &str,
        pack_id: &str,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_key_id.is_empty() || state.config.razorpay_key_secret.is_empty() {
            return Err(AppError::BadRequest(
                "Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service."
                    .to_string(),
            ));
        }

        let pack = Self::find_pack(state, pack_id)?;
        let player = GamesService::resolve_player(state, bearer).await?;

        // Player UUID from the mirror record. Match by any known games identity
        // (user_id, gamer_uid, external_id) so the lookup stays robust even if
        // the resolved token identity and stored sync identity differ.
        let gamer_uid = player.gamer_uid.clone().unwrap_or_default();
        let prow = query_player_json(
            &state.db,
            r#"
            SELECT row_to_json(p) AS row FROM players p
            WHERE p.user_id = $1
               OR ($2 <> '' AND p.gamer_uid = $2)
               OR p.external_id = $3
            ORDER BY (p.user_id = $1) DESC, p.last_synced_at DESC NULLS LAST
            LIMIT 1
            "#
            .to_string(),
            vec![
                Json::String(player.user_id.clone()),
                Json::String(gamer_uid),
                Json::String(player.external_id.clone()),
            ],
        )
        .await?
        .ok_or_else(|| AppError::Internal("Gamer record not found after sync".to_string()))?;

        Self::create_order_core(state, &prow, &pack).await
    }

    /// Razorpay order creation + `coin_orders` record for an already-resolved
    /// player row — shared by the JWT checkout flow and the browser wallet page.
    pub async fn create_order_core(
        state: &GamesState,
        prow: &Json,
        pack: &CoinPack,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_key_id.is_empty() || state.config.razorpay_key_secret.is_empty() {
            return Err(AppError::BadRequest(
                "Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service."
                    .to_string(),
            ));
        }

        let player_user_id = prow
            .get("user_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let player_id = Uuid::parse_str(
            prow.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
        )
        .map_err(|_| AppError::Internal("Gamer record missing id".to_string()))?;
        let gamer_uid = prow
            .get("gamer_uid")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();

        let amount_paise = pack.amount_paise();
        let receipt = format!("coins_{}_{}", gamer_uid, chrono::Utc::now().timestamp());

        let body = serde_json::json!({
            "amount": amount_paise,
            "currency": state.config.razorpay_currency,
            "receipt": receipt,
            "notes": {
                "player_user_id": player_user_id,
                "gamer_uid": gamer_uid,
                "pack_id": pack.id,
                "coins": pack.coins,
            },
        });

        let resp = state
            .http
            .post(format!("{RAZORPAY_API}/orders"))
            .basic_auth(&state.config.razorpay_key_id, Some(&state.config.razorpay_key_secret))
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed reaching Razorpay: {e}")))?;

        let status = resp.status();
        let rzp: Json = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid Razorpay response: {e}")))?;
        if !status.is_success() {
            warn!("Razorpay order creation failed (HTTP {status}): {rzp}");
            return Err(AppError::Internal(format!(
                "Razorpay rejected the order (HTTP {})",
                status.as_u16()
            )));
        }

        let rzp_order_id = rzp
            .get("id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Internal("Razorpay order response missing id".to_string()))?
            .to_string();

        exec(
            &state.db,
            r#"
            INSERT INTO coin_orders (player_id, razorpay_order_id, pack_id, coins, amount_paise,
                                     currency, status, receipt, notes, payload)
            VALUES ($1::uuid, $2, $3, $4::bigint, $5::bigint, $6, 'CREATED', $7, to_jsonb($8::text), $9::jsonb)
            ON CONFLICT (razorpay_order_id) DO NOTHING
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::String(rzp_order_id.clone()),
                Json::String(pack.id.clone()),
                Json::from(pack.coins),
                Json::from(amount_paise),
                Json::String(state.config.razorpay_currency.clone()),
                Json::String(receipt),
                Json::String(gamer_uid.clone()),
                rzp.clone(),
            ],
        )
        .await?;

        info!("Coin order created: pack={} coins={} paise={} razorpay={}", pack.id, pack.coins, amount_paise, rzp_order_id);

        Ok(serde_json::json!({
            "razorpayOrderId": rzp_order_id,
            "packId": pack.id,
            "coins": pack.coins,
            "amount": amount_paise,
            "amountInr": pack.amount_inr,
            "currency": state.config.razorpay_currency,
            "keyId": state.config.razorpay_key_id,
            "gamerUid": gamer_uid,
            "userId": player_user_id,
        }))
    }

    /// POST /coins/verify — checkout callback: verify `order_id|payment_id`
    /// HMAC with the KEY SECRET, then settle (credit coins) exactly once.
    pub async fn verify_payment(
        state: &GamesState,
        bearer: &str,
        req: &CoinsVerifyRequest,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_key_secret.is_empty() {
            return Err(AppError::BadRequest("Razorpay is not configured".to_string()));
        }

        let player = GamesService::resolve_player(state, bearer).await?;

        let order_row = query_player_json(
            &state.db,
            "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1"
                .to_string(),
            vec![Json::String(req.razorpay_order_id.clone())],
        )
        .await?
        .ok_or_else(|| AppError::BadRequest("Unknown Razorpay order".to_string()))?;

        // The order must belong to the calling gamer.
        let order_player = order_row
            .get("player_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let gamer_uid = player.gamer_uid.clone().unwrap_or_default();
        let prow = query_player_json(
            &state.db,
            r#"
            SELECT row_to_json(p) AS row FROM players p
            WHERE p.user_id = $1
               OR ($2 <> '' AND p.gamer_uid = $2)
               OR p.external_id = $3
            ORDER BY (p.user_id = $1) DESC, p.last_synced_at DESC NULLS LAST
            LIMIT 1
            "#
            .to_string(),
            vec![
                Json::String(player.user_id.clone()),
                Json::String(gamer_uid),
                Json::String(player.external_id.clone()),
            ],
        )
        .await?
        .ok_or_else(|| AppError::BadRequest("Gamer record not found".to_string()))?;
        let player_id = Uuid::parse_str(
            prow.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
        )
        .map_err(|_| AppError::Internal("Gamer record missing id".to_string()))?;
        if order_player != player_id.to_string() {
            return Err(AppError::Forbidden("Order does not belong to this gamer".to_string()));
        }

        // Razorpay checkout signature: HMAC_SHA256(KEY_SECRET, "order|payment")
        let payload = format!("{}|{}", req.razorpay_order_id, req.razorpay_payment_id);
        let expected = SecurityUtils::compute_hmac_sha256(&state.config.razorpay_key_secret, &payload)
            .map_err(|e| AppError::Internal(format!("HMAC failure: {e}")))?;
        if !constant_time_eq(req.razorpay_signature.trim().as_bytes(), expected.as_bytes()) {
            warn!("Rejected coin payment with invalid signature: order {}", req.razorpay_order_id);
            exec(
                &state.db,
                "UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'",
                vec![Json::String(req.razorpay_order_id.clone())],
            )
            .await?;
            return Err(AppError::Unauthorized("Invalid Razorpay payment signature".to_string()));
        }

        Self::settle_order(state, &order_row, &req.razorpay_payment_id, "checkout").await
    }

    /// POST /coins/webhook — Razorpay server events
    /// (`payment.captured`, `order.paid`), signature-checked against the
    /// WEBHOOK secret; settles the recorded order exactly once.
    pub async fn handle_webhook(
        state: &GamesState,
        raw_body: &str,
        signature: Option<&str>,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_webhook_secret.is_empty() {
            return Err(AppError::BadRequest(
                "Razorpay webhook secret is not configured".to_string(),
            ));
        }
        let signature = signature
            .ok_or_else(|| AppError::Unauthorized("Missing x-razorpay-signature header".to_string()))?;

        let expected = SecurityUtils::compute_hmac_sha256(&state.config.razorpay_webhook_secret, raw_body)
            .map_err(|e| AppError::Internal(format!("HMAC failure: {e}")))?;
        if !constant_time_eq(signature.trim().as_bytes(), expected.as_bytes()) {
            warn!("Rejected Razorpay webhook with invalid signature");
            return Err(AppError::Unauthorized("Invalid Razorpay webhook signature".to_string()));
        }

        let payload: Json = serde_json::from_str(raw_body)
            .map_err(|_| AppError::BadRequest("Webhook body is not valid JSON".to_string()))?;
        let event = payload.get("event").and_then(|v| v.as_str()).unwrap_or("unknown");

        // Entity location differs per event type.
        let entity = match event {
            "payment.captured" | "payment.authorized" | "payment.failed" => {
                payload.pointer("/payload/payment/entity").cloned()
            }
            "order.paid" => payload.pointer("/payload/order/entity").cloned(),
            _ => None,
        };
        let Some(entity) = entity else {
            // Other events (refund, etc.) — acknowledged, nothing to do.
            return Ok(serde_json::json!({ "received": true, "event": event, "processed": false }));
        };

        let order_id = match event {
            "order.paid" => entity.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            _ => entity.get("order_id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        };
        if order_id.is_empty() {
            return Ok(serde_json::json!({ "received": true, "event": event, "processed": false }));
        }

        if event == "payment.failed" {
            exec(
                &state.db,
                "UPDATE coin_orders SET status = 'FAILED', payment_id = $2, updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'",
                vec![
                    Json::String(order_id),
                    Json::String(entity.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string()),
                ],
            )
            .await?;
            return Ok(serde_json::json!({ "received": true, "event": event, "processed": "marked_failed" }));
        }

        let order_row = query_player_json(
            &state.db,
            "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1"
                .to_string(),
            vec![Json::String(order_id.clone())],
        )
        .await?;

        let Some(order_row) = order_row else {
            warn!("Razorpay webhook for unknown coin order {order_id} — acknowledged only");
            return Ok(serde_json::json!({ "received": true, "event": event, "processed": "unknown_order" }));
        };

        let payment_id = entity
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        Self::settle_order(state, &order_row, &payment_id, event).await
    }

    /// POST https://playforfun.in/api/public/coins/grant (server-to-server):
    /// credits the tenant's coin pool on PlayforFun. `userId` must be the exact
    /// identity PFF was given at launch — the launch `user` param, i.e. the
    /// player's games-DB gamer id (`gamer_uid`, e.g. `MPXG1A2B3C4D5E`).
    async fn grant_pff_coins(
        state: &GamesState,
        user_id: &str,
        amount: i64,
        reason: &str,
        idempotency_key: Option<&str>,
    ) -> Result<Json, AppError> {
        if state.config.pff_tenant.is_empty() || state.config.pff_secret.is_empty() {
            return Err(AppError::Internal(
                "PFF coins/grant not configured: set PLAYFORFUN_TENANT_ID / PLAYFORFUN_SECRET on the games service"
                    .to_string(),
            ));
        }
        let body = serde_json::json!({
            "userId": user_id,
            "amount": amount,
            "reason": reason,
        });
        let mut req = state
            .http
            .post(format!("{BASE_URL}{PFF_GRANT_PATH}"))
            .header("Content-Type", "application/json")
            .header("x-pff-tenant", &state.config.pff_tenant)
            .header("x-pff-secret", &state.config.pff_secret)
            .json(&body);
        // Idempotency-Key (PFF contract): prevents duplicate credits on retry.
        if let Some(key) = idempotency_key {
            req = req.header("Idempotency-Key", key);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed reaching PlayforFun coins/grant: {e}")))?;

        let status = resp.status();
        let payload: Json = resp.json().await.unwrap_or(Json::Null);
        if !status.is_success() {
            warn!("PFF coins/grant failed (HTTP {status}) for {user_id} amount {amount}: {payload}");
            return Err(AppError::Internal(format!(
                "PlayforFun coins/grant rejected (HTTP {})",
                status.as_u16()
            )));
        }
        info!("PFF coins/grant OK: user={user_id} credited={amount} reason={reason} resp={payload}");
        Ok(payload)
    }

    /// Best-effort retry of recharges flagged PENDING_PFF_SYNC for one gamer.
    /// Stops at the first failure (PFF is unreachable) so we don't hammer it.
    async fn flush_pending_pff_grants(state: &GamesState, player_id: Uuid, gamer_id: &str) {
        let pending = query_player_json(
            &state.db,
            "SELECT COALESCE(json_agg(r), '[]'::json) AS row FROM recharges r \
             WHERE r.player_id = $1::uuid AND r.status = 'PENDING_PFF_SYNC'"
                .to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await
        .ok()
        .flatten();
        let Some(items) = pending
            .as_ref()
            .and_then(|j| j.get("row"))
            .and_then(|v| v.as_array())
            .cloned()
        else {
            return;
        };
        for r in items {
            let reference = r
                .get("reference")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let coins = r.get("coins").and_then(|v| v.as_i64()).unwrap_or(0);
            if reference.is_empty() || coins <= 0 {
                continue;
            }
            match Self::grant_pff_coins(
                state,
                gamer_id,
                coins,
                &format!("purchase_{reference}"),
                Some(&reference),
            )
            .await
            {
                Ok(pff) => {
                    let _ = exec(
                        &state.db,
                        "UPDATE recharges SET status = 'SYNCED', payload = payload || $2::jsonb WHERE reference = $1",
                        vec![
                            Json::String(reference.clone()),
                            serde_json::json!({ "pffGrant": pff, "pffGrantRetried": true }),
                        ],
                    )
                    .await;
                    info!("PFF pending grant retried OK: ref={reference} coins={coins}");
                }
                Err(e) => {
                    warn!("PFF pending grant retry failed: ref={reference} ({e}) — stays PENDING_PFF_SYNC");
                    break;
                }
            }
        }
    }

    /// Marks a recharge row after the PFF wallet sync attempt (never fails the caller).
    async fn record_pff_grant_outcome(
        state: &GamesState,
        reference: &str,
        outcome: Result<Json, AppError>,
    ) {
        match outcome {
            Ok(pff) => {
                let _ = exec(
                    &state.db,
                    "UPDATE recharges SET status = 'SYNCED', payload = payload || $2::jsonb WHERE reference = $1",
                    vec![
                        Json::String(reference.to_string()),
                        serde_json::json!({ "pffGrant": pff }),
                    ],
                )
                .await;
            }
            Err(e) => {
                warn!(
                    "PFF wallet grant FAILED for recharge {reference} ({e}) — flagged PENDING_PFF_SYNC, retried on next recharge"
                );
                let _ = exec(
                    &state.db,
                    "UPDATE recharges SET status = 'PENDING_PFF_SYNC', payload = payload || $2::jsonb WHERE reference = $1",
                    vec![
                        Json::String(reference.to_string()),
                        serde_json::json!({ "pffGrantError": e.to_string() }),
                    ],
                )
                .await;
            }
        }
    }

    /// Credits coins for a PAID order exactly once (transaction-guarded).
    async fn settle_order(        state: &GamesState,
        order_row: &Json,
        payment_id: &str,
        via: &str,
    ) -> Result<Json, AppError> {
        let order_id = order_row
            .get("razorpay_order_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let player_id = Uuid::parse_str(
            order_row.get("player_id").and_then(|v| v.as_str()).unwrap_or_default(),
        )
        .map_err(|_| AppError::Internal("Coin order has invalid player reference".to_string()))?;
        let coins = order_row.get("coins").and_then(|v| v.as_i64()).unwrap_or(0);
        let amount_paise = order_row.get("amount_paise").and_then(|v| v.as_i64()).unwrap_or(0);

        if coins <= 0 {
            return Err(AppError::Internal("Coin order has no coins attached".to_string()));
        }
        if payment_id.is_empty() {
            return Err(AppError::Internal("Payment id missing for settlement".to_string()));
        }

        let tx = state
            .db
            .begin()
            .await
            .map_err(|e| AppError::Database(format!("Failed opening settlement transaction: {e}")))?;

        // Idempotency gate: only one transition CREATED → PAID wins.
        let applied = exec(
            &tx,
            r#"
            UPDATE coin_orders SET status = 'PAID', payment_id = $2, signature_verified = TRUE,
                                    updated_at = now()
            WHERE razorpay_order_id = $1 AND status <> 'PAID'
            "#,
            vec![Json::String(order_id.clone()), Json::String(payment_id.to_string())],
        )
        .await?;

        let result = if applied > 0 {
            // Credit the coins (ledger reference = payment id → replay-safe).
            let balance = GamesService::adjust_coins(
                &tx,
                player_id,
                "RECHARGE",
                coins,
                None,
                None,
                Some(payment_id),
                order_row,
            )
            .await?;

            // Recharge audit trail (unique reference = payment id).
            exec(
                &tx,
                r#"
                INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
                VALUES ($1::uuid, $2::bigint, $3::double precision, 'RAZORPAY', 'CREDITED', $4, $5::jsonb)
                ON CONFLICT (reference) DO NOTHING
                "#,
                vec![
                    Json::String(player_id.to_string()),
                    Json::from(coins),
                    Json::from(amount_paise as f64 / 100.0),
                    Json::String(payment_id.to_string()),
                    order_row.clone(),
                ],
            )
            .await?;

            info!("Coin recharge settled via {via}: order={order_id} payment={payment_id} coins={coins}");
            serde_json::json!({
                "credited": balance.is_some(),
                "coins": if balance.is_some() { coins } else { 0 },
                "balance": balance,
            })
        } else {
            info!("Coin order {order_id} already settled — webhook/verify replay ignored");
            serde_json::json!({ "credited": false, "alreadyProcessed": true })
        };

        tx.commit()
            .await
            .map_err(|e| AppError::Database(format!("Settlement commit failed: {e}")))?;

        // ---- PlayforFun tenant-wallet sync (server-to-server) ---------------
        // The local ledger is authoritative for MaxxPixels; PFF keeps its own
        // pool per tenant, so every settled recharge must ALSO be granted there
        // or the coins won't be spendable in-game. Payment was already captured
        // by Razorpay, so a PFF failure never fails this response — the recharge
        // is flagged PENDING_PFF_SYNC and retried on the gamer's next recharge.
        if applied > 0 {
            let prow = query_player_json(
                &state.db,
                "SELECT row_to_json(p) AS row FROM players p WHERE p.id = $1::uuid".to_string(),
                vec![Json::String(player_id.to_string())],
            )
            .await
            .ok()
            .flatten();
            let gamer_id = prow
                .as_ref()
                .and_then(|j| j.get("gamer_uid"))
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            if gamer_id.is_empty() {
                warn!(
                    "PFF wallet grant skipped for recharge {payment_id}: player {player_id} has no gamer_uid"
                );
            } else {
                Self::flush_pending_pff_grants(state, player_id, &gamer_id).await;
                let outcome = Self::grant_pff_coins(
                    state,
                    &gamer_id,
                    coins,
                    &format!("purchase_{payment_id}"),
                    Some(&payment_id),
                )
                .await;
                Self::record_pff_grant_outcome(state, &payment_id, outcome).await;
            }
        }

        let mut out = result;
        if let Json::Object(map) = &mut out {
            map.insert("received".into(), serde_json::json!(true));
            map.insert("orderId".into(), serde_json::json!(order_id));
            map.insert("via".into(), serde_json::json!(via));
        }
        Ok(out)
    }

    /// Grants game coins tied to a paid (non-trial) OTT subscription.
    /// Mobile-driven, JWT-authed — the NestJS API is never involved:
    ///
    /// - **Purchase grant** (`paymentId` present): the Razorpay payment is
    ///   verified server-side (status = captured), then SUBSCRIPTION_GRANT_COINS
    ///   (default 1000) are credited with reference `sub_<paymentId>` and the
    ///   plan expiry is recorded.
    /// - **Monthly claim** (`subscriptionId` absent): +SUBSCRIPTION_MONTHLY_COINS
    ///   (default 100) once per calendar month while a recorded plan expiry is
    ///   in the future — reference `subm_<playerId>_<yyyy-mm>`.
    ///
    /// Both mirror to the PlayforFun tenant wallet with reason
    /// `monthly_subscription`. No subscription model lives in this service —
    /// every credit is just a purchase-style ledger entry.
    pub(crate) async fn grant_subscription(
        state: &GamesState,
        bearer: &str,
        req: &SubscriptionGrantRequest,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_key_secret.is_empty() {
            return Err(AppError::BadRequest(
                "Razorpay is not configured on the games service".to_string(),
            ));
        }

        // Auth + player resolution (JWT = the same token the app already sends).
        let player = GamesService::resolve_player(state, bearer).await?;
        let prow = GamesService::find_player_any(&state.db, &player.user_id)
            .await?
            .ok_or_else(|| AppError::Internal("Player row missing after resolution".to_string()))?;
        let player_id = GamesService::player_id_from(&prow)
            .ok_or_else(|| AppError::Internal("Player row has no id".to_string()))?;

        match &req.payment_id {
            // ---- Purchase grant: one-time 1000 coins -------------------------
            Some(payment_id) => {
                let payment_id = payment_id.trim().to_string();
                if payment_id.is_empty() {
                    return Err(AppError::BadRequest("paymentId is required".to_string()));
                }
                let reference = format!("sub_{payment_id}");
                let coins = match req.coins {
                    Some(c) if c > 0 => c,
                    _ => state.config.subscription_grant_coins,
                };

                // Verify with Razorpay: only real captured payments credit coins.
                let pay: Json = state
                    .http
                    .get(format!("{RAZORPAY_API}/payments/{payment_id}"))
                    .basic_auth(
                        &state.config.razorpay_key_id,
                        Some(&state.config.razorpay_key_secret),
                    )
                    .header("Accept", "application/json")
                    .send()
                    .await
                    .map_err(|e| AppError::Internal(format!("Failed reaching Razorpay: {e}")))?
                    .json()
                    .await
                    .map_err(|e| AppError::Internal(format!("Invalid Razorpay response: {e}")))?;
                let status = pay.get("status").and_then(|v| v.as_str()).unwrap_or("");
                if !status.eq_ignore_ascii_case("captured") {
                    warn!(
                        "Subscription grant rejected: payment {payment_id} status={status} is not captured"
                    );
                    return Err(AppError::BadRequest(format!(
                        "Payment {payment_id} is not captured (status: {status})"
                    )));
                }

                let tx = state
                    .db
                    .begin()
                    .await
                    .map_err(|e| AppError::Database(format!("Failed opening grant transaction: {e}")))?;

                let balance = GamesService::adjust_coins(
                    &tx,
                    player_id,
                    "RECHARGE",
                    coins,
                    None,
                    None,
                    Some(reference.as_str()),
                    &serde_json::json!({ "source": "SUBSCRIPTION", "userId": player.user_id }),
                )
                .await?;

                let valid_until = req.valid_until.clone().unwrap_or_default();
                exec(
                    &tx,
                    r#"
                    INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
                    VALUES ($1::uuid, $2::bigint, 0, 'SUBSCRIPTION', 'CREDITED', $3, $4::jsonb)
                    ON CONFLICT (reference) DO NOTHING
                    "#,
                    vec![
                        Json::String(player_id.to_string()),
                        Json::from(coins),
                        Json::String(reference.clone()),
                        serde_json::json!({
                            "userId": player.user_id,
                            "paymentId": payment_id,
                            "subscriptionId": req.subscription_id,
                            "validUntil": valid_until,
                        }),
                    ],
                )
                .await?;

                tx.commit()
                    .await
                    .map_err(|e| AppError::Database(format!("Grant commit failed: {e}")))?;

                let already = balance.is_none();
                info!(
                    "Subscription purchase grant: user={} player={player_id} coins={coins} ref={reference} replay={already}",
                    player.user_id
                );

                Self::mirror_subscription_grant_to_pff(state, player_id, &prow, coins, &reference)
                    .await;

                Ok(serde_json::json!({
                    "credited": balance.is_some(),
                    "alreadyProcessed": already,
                    "coins": if balance.is_some() { coins } else { 0 },
                    "balance": balance,
                    "reference": reference,
                }))
            }

            // ---- Monthly claim: +100 once per calendar month ------------------
            None => {
                // Latest SUBSCRIPTION purchase whose recorded validity is live.
                let rows: Vec<Json> = query_json_rows(
                    &state.db,
                    r#"
                    SELECT row_to_json(q) AS row
                    FROM (
                        SELECT payload->>'validUntil' AS valid_until
                        FROM recharges
                        WHERE player_id = $1::uuid
                          AND source = 'SUBSCRIPTION'
                          AND payload->>'validUntil' IS NOT NULL
                          AND payload->>'validUntil' <> ''
                        ORDER BY created_at DESC
                        LIMIT 1
                    ) q
                    "#
                    .to_string(),
                    vec![Json::String(player_id.to_string())],
                )
                .await?;
                let valid_until = rows
                    .first()
                    .and_then(|r| r.get("valid_until"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();
                if valid_until.is_empty() {
                    return Err(AppError::BadRequest(
                        "No subscription benefit recorded — purchase a paid subscription first"
                            .to_string(),
                    ));
                }
                let expiry = parse_valid_until(&valid_until)
                    .ok_or_else(|| AppError::Internal("Stored plan expiry is invalid".to_string()))?;
                if expiry <= chrono::Utc::now() {
                    return Err(AppError::BadRequest(
                        "Subscription plan has expired — renew to keep receiving monthly coins"
                            .to_string(),
                    ));
                }

                let month_key = chrono::Utc::now().format("%Y-%m").to_string();
                let reference = format!("subm_{}_{month_key}", player_id.simple());
                let coins = state.config.subscription_monthly_coins;

                let tx = state
                    .db
                    .begin()
                    .await
                    .map_err(|e| AppError::Database(format!("Failed opening grant transaction: {e}")))?;

                let balance = GamesService::adjust_coins(
                    &tx,
                    player_id,
                    "RECHARGE",
                    coins,
                    None,
                    None,
                    Some(reference.as_str()),
                    &serde_json::json!({ "source": "SUBSCRIPTION", "userId": player.user_id }),
                )
                .await?;

                exec(
                    &tx,
                    r#"
                    INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
                    VALUES ($1::uuid, $2::bigint, 0, 'SUBSCRIPTION', 'CREDITED', $3, $4::jsonb)
                    ON CONFLICT (reference) DO NOTHING
                    "#,
                    vec![
                        Json::String(player_id.to_string()),
                        Json::from(coins),
                        Json::String(reference.clone()),
                        serde_json::json!({
                            "userId": player.user_id,
                            "monthly": true,
                            "month": month_key,
                        }),
                    ],
                )
                .await?;

                tx.commit()
                    .await
                    .map_err(|e| AppError::Database(format!("Grant commit failed: {e}")))?;

                let already = balance.is_none();
                info!(
                    "Subscription monthly top-up: user={} player={player_id} coins={coins} ref={reference} replay={already}",
                    player.user_id
                );

                Self::mirror_subscription_grant_to_pff(state, player_id, &prow, coins, &reference)
                    .await;

                Ok(serde_json::json!({
                    "credited": balance.is_some(),
                    "alreadyProcessed": already,
                    "coins": if balance.is_some() { coins } else { 0 },
                    "balance": balance,
                    "reference": reference,
                }))
            }
        }
    }

    /// Best-effort PFF mirror for subscription grants (local ledger first,
    /// tenant wallet follows; failure is retried on the next recharge).
    async fn mirror_subscription_grant_to_pff(
        state: &GamesState,
        _player_id: Uuid,
        prow: &Json,
        coins: i64,
        reference: &str,
    ) {
        let gamer_id = prow
            .get("gamer_uid")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if gamer_id.is_empty() {
            warn!("PFF subscription grant skipped for {reference}: player has no gamer_uid");
            return;
        }
        let outcome = Self::grant_pff_coins(
            state,
            &gamer_id,
            coins,
            "monthly_subscription",
            Some(reference),
        )
        .await;
        Self::record_pff_grant_outcome(state, reference, outcome).await;
    }

    // -----------------------------------------------------------------------
    // Service-provider wallet API (PFF contract: /api/v1/games/wallet).
    // SERVER-TO-SERVER: the PlayforFun backend calls these endpoints with the
    // same identity pair we use on our coins/grant calls to them — the
    // `x-pff-tenant` and `x-pff-secret` headers. No UI is served here.
    //
    //   GET  /api/v1/games/wallet?userId=<gamer id>
    //        → identity + balance + Razorpay key + pack catalog + endpoints
    //   POST /api/v1/games/wallet/order  {userId, packId}
    //        → Razorpay order payload (checkout takes it from here)
    //   POST /api/v1/games/wallet/verify {userId, razorpay_order_id,
    //        razorpay_payment_id, razorpay_signature}
    //        → signature-checked settlement: ledger + PFF mirror, exactly once
    // -----------------------------------------------------------------------

    /// Validates the server-to-server identity pair on wallet requests.
    pub fn verify_wallet_s2s(
        state: &GamesState,
        tenant: Option<&str>,
        secret: Option<&str>,
    ) -> Result<(), AppError> {
        if state.config.pff_secret.is_empty() {
            return Err(AppError::BadRequest(
                "Wallet API is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service."
                    .to_string(),
            ));
        }
        let secret = secret.ok_or_else(|| AppError::Unauthorized("Missing x-pff-secret header".to_string()))?;
        if !constant_time_eq(secret.trim().as_bytes(), state.config.pff_secret.as_bytes()) {
            warn!("Rejected wallet request with invalid x-pff-secret");
            return Err(AppError::Unauthorized("Invalid wallet credentials".to_string()));
        }
        // Tenant is checked whenever it is sent.
        if let Some(t) = tenant {
            if !t.trim().is_empty() && !t.trim().eq_ignore_ascii_case(&state.config.pff_tenant) {
                return Err(AppError::Unauthorized("Unknown wallet tenant".to_string()));
            }
        }
        Ok(())
    }

    /// Resolves the gamer behind a wallet request. `identifier` is the launch
    /// `user` identity (games-DB gamer id); userId / username / legacy
    /// display_name / external_id / OTT user id all resolve too.
    async fn wallet_player(state: &GamesState, identifier: &str) -> Result<Json, AppError> {
        let ident = identifier.trim();
        if ident.is_empty() {
            return Err(AppError::BadRequest("userId is required".to_string()));
        }
        GamesService::find_player_any(&state.db, ident)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest(
                    "Unknown gamer — no MAXX GAMES record for that userId".to_string(),
                )
            })
    }

    /// GET /wallet — the provider wallet payload for one gamer.
    pub async fn wallet(state: &GamesState, identifier: &str) -> Result<Json, AppError> {
        let prow = Self::wallet_player(state, identifier).await?;

        let gamer_uid = prow
            .get("gamer_uid")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        let display_name = prow
            .get("name")
            .and_then(|v| v.as_str())
            .filter(|n| !n.trim().is_empty())
            .unwrap_or_else(|| {
                prow.get("display_name").and_then(|v| v.as_str()).unwrap_or("")
            })
            .to_string();
        let coins = prow.get("coins").and_then(|v| v.as_i64()).unwrap_or(0);

        Ok(serde_json::json!({
            "tenant": state.config.pff_tenant,
            "userId": gamer_uid,
            "gamerUid": gamer_uid,
            "externalId": prow.get("external_id").and_then(|v| v.as_str()).unwrap_or(""),
            "displayName": display_name,
            "coins": coins,
            "currency": state.config.razorpay_currency,
            "keyId": state.config.razorpay_key_id,
            "packs": state.config.coin_packs,
            "endpoints": {
                "order": "/api/v1/games/wallet/order",
                "verify": "/api/v1/games/wallet/verify",
            },
        }))
    }

    /// POST /wallet/order — creates a Razorpay order for a pack on behalf of
    /// the identified gamer (server-to-server).
    pub async fn wallet_order(
        state: &GamesState,
        identifier: &str,
        pack_id: &str,
    ) -> Result<Json, AppError> {
        let prow = Self::wallet_player(state, identifier).await?;
        let pack = Self::find_pack(state, pack_id)?;
        Self::create_order_core(state, &prow, &pack).await
    }

    /// POST /wallet/verify — settles a completed checkout (server-to-server):
    /// Razorpay signature check, order ownership vs the identified gamer, then
    /// ledger credit + PFF mirror exactly once.
    pub async fn wallet_verify(
        state: &GamesState,
        identifier: &str,
        razorpay_order_id: &str,
        razorpay_payment_id: &str,
        razorpay_signature: &str,
    ) -> Result<Json, AppError> {
        if state.config.razorpay_key_secret.is_empty() {
            return Err(AppError::BadRequest("Razorpay is not configured".to_string()));
        }

        let prow = Self::wallet_player(state, identifier).await?;
        let player_id = Uuid::parse_str(
            prow.get("id").and_then(|v| v.as_str()).unwrap_or_default(),
        )
        .map_err(|_| AppError::Internal("Gamer record missing id".to_string()))?;

        let order_row = query_player_json(
            &state.db,
            "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1"
                .to_string(),
            vec![Json::String(razorpay_order_id.to_string())],
        )
        .await?
        .ok_or_else(|| AppError::BadRequest("Unknown Razorpay order".to_string()))?;

        // The order must belong to the identified gamer.
        let order_player = order_row
            .get("player_id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string();
        if order_player != player_id.to_string() {
            return Err(AppError::Forbidden("Order does not belong to this gamer".to_string()));
        }

        // Razorpay checkout signature: HMAC_SHA256(KEY_SECRET, "order|payment")
        let payload = format!("{razorpay_order_id}|{razorpay_payment_id}");
        let expected = SecurityUtils::compute_hmac_sha256(&state.config.razorpay_key_secret, &payload)
            .map_err(|e| AppError::Internal(format!("HMAC failure: {e}")))?;
        if !constant_time_eq(razorpay_signature.trim().as_bytes(), expected.as_bytes()) {
            warn!("Rejected wallet payment with invalid signature: order {razorpay_order_id}");
            exec(
                &state.db,
                "UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'",
                vec![Json::String(razorpay_order_id.to_string())],
            )
            .await?;
            return Err(AppError::Unauthorized("Invalid Razorpay payment signature".to_string()));
        }

        Self::settle_order(state, &order_row, razorpay_payment_id, "wallet").await
    }
}
