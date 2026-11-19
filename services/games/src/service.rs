use chrono::{DateTime, SecondsFormat};
use sea_orm::{
    ConnectionTrait, DatabaseBackend, DatabaseTransaction, Statement, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;
use tracing::{info, warn};
use uuid::Uuid;

use crate::error::AppError;
use crate::security::SecurityUtils;
use crate::state::{GamesState, Player};

const GAMES: [&str; 4] = ["ludo", "carrom", "snooker", "chess"];
pub(crate) const BASE_URL: &str = "https://playforfun.in";

pub struct GamesService;

// ---------------------------------------------------------------------------
// Small JSON helpers (PlayforFun payloads mix camelCase / snake_case)
// ---------------------------------------------------------------------------

fn probe_str(obj: &Json, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|k| {
            obj.get(*k)
                .and_then(|v| v.as_str())
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
        })
}

fn probe_i64(obj: &Json, keys: &[&str]) -> Option<i64> {
    keys.iter().find_map(|k| {
        let v = obj.get(*k)?;
        match v {
            Json::Number(n) => n.as_i64().or_else(|| n.as_f64().map(|f| f as i64)),
            Json::String(s) => s.trim().parse::<i64>().ok(),
            _ => None,
        }
    })
}

fn id_from_value(v: &Json) -> Option<String> {
    match v {
        Json::String(s) => {
            let s = s.trim();
            (!s.is_empty()).then(|| s.to_string())
        }
        Json::Number(n) => Some(n.to_string()),
        Json::Object(_) => probe_str(v, &["external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id", "name", "displayName"]),
        _ => None,
    }
}

/// Normalizes a result string to the session `result` vocabulary.
fn normalize_result(raw: &str) -> String {
    let r = raw.to_ascii_lowercase();
    if r.contains("won") || r.contains("win") || r.contains("1st") || r == "1" {
        "WON".into()
    } else if r.contains("lost") || r.contains("lose") || r.contains("2nd") || r == "2" {
        "LOST".into()
    } else if r.contains("draw") || r.contains("tie") {
        "DRAW".into()
    } else if r.contains("exit") || r.contains("quit") || r.contains("left") {
        "EXITED".into()
    } else {
        "PLAYED".into()
    }
}

/// A match participant extracted from a webhook payload.
#[derive(Debug, Clone)]
struct Participant {
    id: String,
    result: Option<String>,
    coins_won: i64,
    entry_fee: i64,
    score: Option<i64>,
    rank: Option<i64>,
}

impl Participant {
    fn new(id: String) -> Self {
        Self { id, result: None, coins_won: 0, entry_fee: 0, score: None, rank: None }
    }
}

/// Extracts every participant from any docs-compatible shape:
/// `players[]` / `participants[]` / `results[]` (objects or plain id strings),
/// or top-level `winner` (+ optional `loser`).
fn extract_participants(payload: &Json) -> Vec<Participant> {
    let mut out: Vec<Participant> = Vec::new();

    for container in ["players", "participants", "results"] {
        if let Some(Json::Array(items)) = payload.get(container) {
            for item in items {
                match item {
                    Json::String(s) => {
                        if !s.trim().is_empty() {
                            out.push(Participant::new(s.trim().to_string()));
                        }
                    }
                    Json::Object(_) => {
                        if let Some(id) = id_from_value(item) {
                            let mut p = Participant::new(id);
                            p.result = probe_str(item, &["result", "status", "outcome"]).as_deref().map(normalize_result);
                            p.coins_won = probe_i64(item, &["coins_won", "coinsWon", "won", "reward", "prize", "coins"]).unwrap_or(0);
                            p.entry_fee = probe_i64(item, &["entry_fee", "entryFee", "fee"]).unwrap_or(0);
                            p.score = probe_i64(item, &["score", "points"]);
                            p.rank = probe_i64(item, &["rank", "position"]);
                            out.push(p);
                        }
                    }
                    _ => {}
                }
            }
            if !out.is_empty() {
                break;
            }
        }
    }

    // Top-level winner (+ optional loser) — mark/append as needed.
    if let Some(winner_id) = payload.get("winner").and_then(id_from_value) {
        let already = out.iter_mut().find(|p| p.id == winner_id);
        match already {
            Some(p) => {
                if p.result.is_none() {
                    p.result = Some("WON".into());
                }
            }
            None => {
                let mut p = Participant::new(winner_id);
                p.result = Some("WON".into());
                out.push(p);
            }
        }
    }
    if let Some(loser_id) = payload.get("loser").and_then(id_from_value) {
        let already = out.iter_mut().find(|p| p.id == loser_id);
        match already {
            Some(p) => {
                if p.result.is_none() {
                    p.result = Some("LOST".into());
                }
            }
            None => {
                let mut p = Participant::new(loser_id);
                p.result = Some("LOST".into());
                out.push(p);
            }
        }
    }

    // Payload-level prize / entry fee defaults.
    let prize = probe_i64(payload, &["prize", "coins_won", "coinsWon", "reward", "coins"]);
    let fee = probe_i64(payload, &["entry_fee", "entryFee", "fee"]);
    for p in &mut out {
        if p.result.as_deref() == Some("WON") && p.coins_won == 0 {
            p.coins_won = prize.unwrap_or(0);
        }
        if p.entry_fee == 0 {
            p.entry_fee = fee.unwrap_or(0);
        }
    }

    // Without explicit results: winner is WON, everyone else LOST (>=2 players).
    let has_explicit = out.iter().any(|p| p.result.is_some());
    if !has_explicit {
        let n = out.len();
        for (idx, p) in out.iter_mut().enumerate() {
            if idx == 0 && n > 1 {
                p.result = Some("WON".into());
            } else if n > 1 {
                p.result = Some("LOST".into());
            }
        }
    }

    out
}

// ---------------------------------------------------------------------------
// DB helpers (work on both the pool and a transaction)
// ---------------------------------------------------------------------------

/// Converts a serde_json value into a SeaORM bind value. Everything binds as
/// TEXT (NULL binds as an untyped NULL); the SQL statements cast params
/// explicitly (`$1::uuid`, `$2::bigint`, `$3::double precision`, `$x::jsonb`).
pub(crate) fn sea_value(j: Json) -> sea_orm::Value {
    match j {
        Json::Null => sea_orm::Value::String(None),
        Json::Bool(b) => sea_orm::Value::String(Some(Box::new(if b { "true".into() } else { "false".into() }))),
        Json::Number(n) => sea_orm::Value::String(Some(Box::new(n.to_string()))),
        Json::String(s) => sea_orm::Value::String(Some(Box::new(s))),
        Json::Array(_) | Json::Object(_) => sea_orm::Value::String(Some(Box::new(j.to_string()))),
    }
}

pub(crate) async fn query_player_json(
    db: &impl ConnectionTrait,
    sql: String,
    values: Vec<Json>,
) -> Result<Option<Json>, AppError> {
    let stmt = Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values.into_iter().map(sea_value),
    );
    let row = db
        .query_one(stmt)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(row.and_then(|r| r.try_get::<Json>("", "row").ok()))
}

/// Multi-row variant — every row must be `row_to_json(...) AS row`.
pub(crate) async fn query_json_rows(
    db: &impl ConnectionTrait,
    sql: String,
    values: Vec<Json>,
) -> Result<Vec<Json>, AppError> {
    let stmt = Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values.into_iter().map(sea_value),
    );
    let rows = db
        .query_all(stmt)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(rows
        .iter()
        .filter_map(|r| r.try_get::<Json>("", "row").ok())
        .collect())
}

pub(crate) async fn exec(
    db: &impl ConnectionTrait,
    sql: &str,
    values: Vec<Json>,
) -> Result<u64, AppError> {
    let stmt = Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        sql,
        values.into_iter().map(sea_value),
    );
    let res = db
        .execute(stmt)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(res.rows_affected())
}

// ---------------------------------------------------------------------------
// User details pulled from the NestJS main API (`GET /api/v1/auth/me`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserDetails {
    pub user_id: String,
    pub email: Option<String>,
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
}

fn first_id(json: &Json) -> String {
    match json
        .get("id")
        .or_else(|| json.get("userId"))
        .or_else(|| json.get("user_id"))
    {
        Some(Json::String(s)) => s.trim().trim_matches('"').to_string(),
        Some(Json::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

impl GamesService {
    /// Fetch authoritative user details from the NestJS main API using the
    /// caller's own Bearer token. Nest stays the single source of truth for
    /// users; the games service only mirrors into its own DB.
    async fn fetch_user_from_nest(state: &GamesState, bearer: &str) -> Result<UserDetails, AppError> {
        let url = format!(
            "{}/api/v1/auth/me",
            state.config.main_api_url.trim_end_matches('/')
        );
        let resp = state
            .http
            .get(&url)
            .bearer_auth(bearer)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed reaching main API for user details: {e}")))?;

        if !resp.status().is_success() {
            return Err(AppError::Unauthorized(format!(
                "Main API rejected the session for user details (HTTP {})",
                resp.status().as_u16()
            )));
        }

        let body: Json = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Invalid user details payload: {e}")))?;

        // Envelope shapes: {success,data:{...}} | {result:{...}} | raw profile
        let profile = body
            .get("data")
            .or_else(|| body.get("result"))
            .cloned()
            .unwrap_or(body);

        let user_id = first_id(&profile);
        if user_id.is_empty() {
            return Err(AppError::Internal(
                "User details from main API did not include an id".to_string(),
            ));
        }

        Ok(UserDetails {
            user_id,
            email: probe_str(&profile, &["email"]),
            full_name: probe_str(&profile, &["fullName", "full_name", "name", "userName"]),
            phone_number: probe_str(
                &profile,
                &[
                    "phoneNumber",
                    "phone_number",
                    "mobileNumber",
                    "mobile_number",
                    "phone",
                    "mobile",
                ],
            ),
        })
    }

    /// name sent to PlayforFun: `maxpx_<gamer_uid>` (e.g. `maxpx_MPXGE6C6FFF83C`).
    fn normalize_display_name(gamer_uid: &str) -> String {
        format!("maxpx_{gamer_uid}")
            .replace(':', " ")
            .trim()
            .chars()
            .take(30)
            .collect()
    }

    /// Unique gamer id for EVERY gamer: `MPXG` + 10 uppercase hex chars.
    fn new_gamer_uid() -> String {
        format!("MPXG{}", &Uuid::new_v4().simple().to_string()[..10].to_uppercase())
    }

    /// Mirror the user into the SEPARATE games DB and return the stored player.
    async fn upsert_player(state: &GamesState, details: &UserDetails) -> Result<Player, AppError> {
        let external_id = format!("mpx_{}", details.user_id);
        let gamer_uid = Self::new_gamer_uid();
        let display_name = Self::normalize_display_name(&gamer_uid);
        let player_uuid = Uuid::new_v4();

        let sql = r#"
            INSERT INTO players (id, gamer_uid, user_id, external_id, name, email,
                                 mobile_number, display_name, last_synced_at, created_at, updated_at)
            VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, now(), now(), now())
            ON CONFLICT (user_id) DO UPDATE
               SET name           = COALESCE(EXCLUDED.name, players.name),
                   email          = COALESCE(EXCLUDED.email, players.email),
                   mobile_number  = COALESCE(EXCLUDED.mobile_number, players.mobile_number),
                   -- display_name tracks the STORED gamer_uid (not the fresh one from this insert)
                   display_name   = 'maxpx_' || players.gamer_uid,
                   last_synced_at = now(),
                   updated_at     = now()
            RETURNING row_to_json(players) AS row
        "#;

        let row = query_player_json(
            &state.db,
            sql.to_string(),
            vec![
                Json::String(player_uuid.to_string()),
                Json::String(gamer_uid),
                Json::String(details.user_id.clone()),
                Json::String(external_id.clone()),
                details.full_name.clone().map(Json::String).unwrap_or(Json::Null),
                details.email.clone().map(Json::String).unwrap_or(Json::Null),
                details
                    .phone_number
                    .clone()
                    .map(Json::String)
                    .unwrap_or(Json::Null),
                Json::String(display_name.clone()),
            ],
        )
        .await?
        .ok_or_else(|| AppError::Internal("Player upsert returned no row".to_string()))?;

        serde_json::from_value::<Player>(row)
            .map_err(|e| AppError::Internal(format!("Stored player row invalid: {e}")))
    }

    /// Player resolution: games DB cache first, refresh from NestJS when stale/missing.
    pub async fn resolve_player(state: &GamesState, bearer: &str) -> Result<Player, AppError> {
        let claims = SecurityUtils::validate_jwt(bearer, &state.config.jwt_secret)
            .map_err(|e| AppError::Unauthorized(format!("Invalid or expired token: {e}")))?;

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            SELECT row_to_json(p) AS row FROM players p
            WHERE p.user_id = $1
              AND p.last_synced_at > now() - make_interval(secs => $2::double precision)
            "#,
            vec![
                Json::String(claims.sub.clone()),
                Json::from(state.config.player_ttl_seconds as f64),
            ]
            .into_iter()
            .map(sea_value),
        );
        let row = state
            .db
            .query_one(stmt)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        if let Some(json) = row.and_then(|r| r.try_get::<Json>("", "row").ok()) {
            if let Ok(player) = serde_json::from_value::<Player>(json) {
                return Ok(player);
            }
        }

        // Stale or missing → pull authoritative details from NestJS, dump to games DB.
        let details = Self::fetch_user_from_nest(state, bearer).await?;
        let mut player = Self::upsert_player(state, &details).await?;

        // Always honor the token identity even if the profile sync lags.
        player.user_id = claims.sub;
        Ok(player)
    }

    // -----------------------------------------------------------------------
    // Signed PlayforFun launch URL (docs contract; secret stays in this service)
    // -----------------------------------------------------------------------
    pub fn build_launch_url(
        &self,
        state: &GamesState,
        player: &Player,
        game: Option<&str>,
    ) -> Result<Json, AppError> {
        if state.config.pff_secret.is_empty() {
            return Err(AppError::BadRequest(
                "PlayforFun gaming is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service."
                    .to_string(),
            ));
        }

        let exp = chrono::Utc::now().timestamp() + 600;
        let nonce = Uuid::new_v4().simple().to_string()[..16].to_string();

        // Signed identity: userId = the games-DB gamer id (gamer_uid), displayName
        // = the user's username. `:` would break the `tenant:user:name:exp:nonce`
        // message, so it is stripped from the display name.
        let gamer_id = player
            .gamer_uid
            .clone()
            .filter(|g| !g.trim().is_empty())
            .unwrap_or_else(|| player.user_id.clone());
        let display_name = player
            .name
            .clone()
            .map(|n| n.replace(':', " ").trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| player.display_name.clone());

        let payload = format!(
            "{}:{}:{}:{}:{}",
            state.config.pff_tenant, gamer_id, display_name, exp, nonce
        );
        let sig = SecurityUtils::compute_hmac_sha256(&state.config.pff_secret, &payload)
            .map_err(|e| AppError::Internal(format!("Failed signing launch URL: {e}")))?;

        let selected_game = game
            .map(str::trim)
            .map(str::to_lowercase)
            .filter(|g| GAMES.contains(&g.as_str()));
        let path = match &selected_game {
            Some(g) => format!("/play/{g}"),
            None => "/arena".to_string(),
        };

        let query = form_urlencoded(&[
            ("tenant", state.config.pff_tenant.as_str()),
            ("user", gamer_id.as_str()),
            ("name", display_name.as_str()),
            ("exp", exp.to_string().as_str()),
            ("nonce", nonce.as_str()),
            ("sig", sig.as_str()),
        ]);

        let launch_url = format!("{BASE_URL}{path}?{query}");
        let expires_at = DateTime::from_timestamp(exp, 0)
            .map(|d| d.to_rfc3339_opts(SecondsFormat::Secs, true))
            .unwrap_or_default();

        let mut result = serde_json::json!({
            "launchUrl": launch_url,
            "expiresAt": expires_at,
            "tenant": state.config.pff_tenant,
            "userId": gamer_id,
            "externalId": player.external_id,
            "gamerUid": player.gamer_uid,
            "displayName": display_name,
        });
        if let Some(g) = &selected_game {
            result["game"] = Json::String(g.clone());
        }
        Ok(result)
    }

    // -----------------------------------------------------------------------
    // Player lookup by any identifier (external_id | user_id | gamer_uid
    // | display_name — PFF echoes the launch `name` back in webhooks)
    // -----------------------------------------------------------------------
    pub(crate) async fn find_player_any(
        db: &impl ConnectionTrait,
        identifier: &str,
    ) -> Result<Option<Json>, AppError> {
        if identifier.is_empty() {
            return Ok(None);
        }
        // PlayforFun identifies gamers by the launch `user` param (the games-DB
        // gamer id). Webhook participant ids can arrive as the gamer id, the
        // username echoed from the launch `name` param, the legacy
        // `maxpx_<gamer_uid>` display_name, or a bare gamer_uid with the prefix
        // stripped. Match all of them.
        let uid_candidate = identifier.strip_prefix("maxpx_").unwrap_or(identifier).to_string();
        let uid_extra = if uid_candidate == identifier { String::new() } else { uid_candidate };
        query_player_json(
            db,
            r#"
            SELECT row_to_json(p) AS row FROM players p
            WHERE p.external_id = $1 OR p.user_id = $1 OR p.gamer_uid = $1
               OR p.display_name = $1
               OR ($3 <> '' AND p.name = $3)
               OR ($2 <> '' AND p.gamer_uid = $2)
            LIMIT 1
            "#
            .to_string(),
            vec![
                Json::String(identifier.to_string()),
                Json::String(uid_extra),
                Json::String(identifier.trim().to_string()),
            ],
        )
        .await
    }

    pub(crate) fn player_id_from(row: &Json) -> Option<Uuid> {
        row.get("id")
            .and_then(|v| v.as_str())
            .and_then(|s| Uuid::parse_str(s).ok())
    }

    fn player_id_from_opt(row: &Option<Json>) -> Option<Uuid> {
        row.as_ref().and_then(Self::player_id_from)
    }

    // -----------------------------------------------------------------------
    // Coin ledger — every movement goes through adjust_coins
    // -----------------------------------------------------------------------

    /// Applies a signed coin movement to a player inside `tx`, writes the
    /// ledger row, and maintains lifetime aggregates. Returns the new balance,
    /// or `None` when the movement was skipped:
    ///  - idempotent replay (reference already in the ledger), or
    ///  - insufficient balance for a debit (entry fee) — never goes negative.
    #[allow(clippy::too_many_arguments)]
    pub(crate) async fn adjust_coins(
        tx: &impl ConnectionTrait,
        player_id: Uuid,
        txn_type: &str,
        amount: i64,
        game: Option<&str>,
        match_id: Option<&str>,
        reference: Option<&str>,
        payload: &Json,
    ) -> Result<Option<i64>, AppError> {
        if amount == 0 {
            return Ok(None);
        }

        // Idempotency: a ledger row with the same reference already exists?
        if let Some(r) = reference {
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT id FROM coin_transactions WHERE reference = $1 LIMIT 1",
                vec![Json::String(r.to_string())]
                    .into_iter()
                    .map(sea_value),
            );
            let existing = tx
                .query_one(stmt)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            if existing.is_some() {
                info!("Skipped {txn_type}: reference {r} already in the ledger");
                return Ok(None);
            }
        }

        // Lock the player row and read the balance.
        let row = query_player_json(
            tx,
            "SELECT row_to_json(p) AS row FROM players p WHERE p.id = $1::uuid FOR UPDATE".to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await?;
        let current = row
            .as_ref()
            .and_then(|j| j.get("coins"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        if amount < 0 && current < -amount {
            // Insufficient coins — never drive a gamer negative.
            warn!(
                "Skipped {txn_type} of {amount} coins: player {player_id} has only {current}"
            );
            return Ok(None);
        }

        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            UPDATE players SET
                coins                 = coins + $2::bigint,
                total_coins_won       = total_coins_won       + CASE WHEN $3 = 'WIN'       THEN $2::bigint ELSE 0 END,
                total_coins_recharged = total_coins_recharged + CASE WHEN $3 = 'RECHARGE'  THEN $2::bigint ELSE 0 END,
                total_coins_spent     = total_coins_spent     + CASE WHEN $3 = 'ENTRY_FEE' THEN -($2::bigint) ELSE 0 END,
                updated_at            = now()
            WHERE id = $1::uuid
            RETURNING coins AS balance
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::from(amount),
                Json::String(txn_type.to_string()),
            ]
            .into_iter()
            .map(sea_value),
        );
        let updated = tx
            .query_one(stmt)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let balance_after = updated
            .and_then(|r| r.try_get::<i64>("", "balance").ok())
            .ok_or_else(|| AppError::Internal("Coin update returned no row".to_string()))?;

        exec(
            tx,
            r#"
            INSERT INTO coin_transactions (player_id, txn_type, amount, balance_after,
                                           game, match_id, reference, payload)
            VALUES ($1::uuid, $2, $3::bigint, $4::bigint, $5, $6, $7, $8::jsonb)
            ON CONFLICT (reference) DO NOTHING
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::String(txn_type.to_string()),
                Json::from(amount),
                Json::from(balance_after),
                game.map(|g| Json::String(g.to_string())).unwrap_or(Json::Null),
                match_id.map(|m| Json::String(m.to_string())).unwrap_or(Json::Null),
                reference.map(|r| Json::String(r.to_string())).unwrap_or(Json::Null),
                payload.clone(),
            ],
        )
        .await?;

        info!("Coins {txn_type} {amount} for player {player_id} → balance {balance_after}");
        Ok(Some(balance_after))
    }

    // -----------------------------------------------------------------------
    // Match sessions + per-game stats
    // -----------------------------------------------------------------------

    #[allow(clippy::too_many_arguments)]
    async fn record_session(
        tx: &DatabaseTransaction,
        player_id: Uuid,
        match_id: &str,
        game: &str,
        result: &str,
        coins_won: i64,
        entry_fee: i64,
        score: Option<i64>,
        rank: Option<i64>,
        balance_after: Option<i64>,
        played_at: &str,
        payload: &Json,
    ) -> Result<(), AppError> {
        exec(
            tx,
            r#"
            INSERT INTO game_sessions (player_id, match_id, game, result, coins_won, entry_fee,
                                       score, rank, coins_balance_after, played_at, payload)
            VALUES ($1::uuid, $2, $3, $4, $5::bigint, $6::bigint, $7::bigint, $8::bigint, $9::bigint,
                    COALESCE(NULLIF($10, '')::timestamptz, now()), $11::jsonb)
            ON CONFLICT (match_id, player_id) DO UPDATE
               SET result              = EXCLUDED.result,
                   coins_won           = EXCLUDED.coins_won,
                   entry_fee           = EXCLUDED.entry_fee,
                   score               = EXCLUDED.score,
                   rank                = EXCLUDED.rank,
                   coins_balance_after = EXCLUDED.coins_balance_after,
                   payload             = EXCLUDED.payload,
                   played_at           = EXCLUDED.played_at
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::String(match_id.to_string()),
                Json::String(game.to_string()),
                Json::String(result.to_string()),
                Json::from(coins_won),
                Json::from(entry_fee),
                score.map(Json::from).unwrap_or(Json::Null),
                rank.map(Json::from).unwrap_or(Json::Null),
                balance_after.map(Json::from).unwrap_or(Json::Null),
                Json::String(played_at.to_string()),
                payload.clone(),
            ],
        )
        .await?;

        // Activity + per-game stats deltas.
        let d_won = i64::from(result == "WON");
        let d_lost = i64::from(result == "LOST");
        let d_draw = i64::from(result == "DRAW");
        let d_coins_spent = if entry_fee > 0 { entry_fee } else { 0 };

        exec(
            tx,
            r#"
            INSERT INTO game_stats (player_id, game, matches_played, wins, losses, draws,
                                    coins_won, coins_spent, best_coins_won, last_played_at)
            VALUES ($1::uuid, $2, 1, $3::bigint, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $6::bigint,
                    COALESCE(NULLIF($8, '')::timestamptz, now()))
            ON CONFLICT (player_id, game) DO UPDATE
               SET matches_played = game_stats.matches_played + 1,
                   wins           = game_stats.wins   + $3,
                   losses         = game_stats.losses + $4,
                   draws          = game_stats.draws  + $5,
                   coins_won      = game_stats.coins_won  + $6,
                   coins_spent    = game_stats.coins_spent + $7,
                   best_coins_won = GREATEST(game_stats.best_coins_won, $6),
                   last_played_at = COALESCE(NULLIF($8, '')::timestamptz, now()),
                   updated_at     = now()
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::String(game.to_string()),
                Json::from(d_won),
                Json::from(d_lost),
                Json::from(d_draw),
                Json::from(coins_won),
                Json::from(d_coins_spent),
                Json::String(played_at.to_string()),
            ],
        )
        .await?;

        exec(
            tx,
            r#"
            UPDATE players SET
                matches_played = matches_played + 1,
                matches_won    = matches_won    + $2::bigint,
                matches_lost   = matches_lost   + $3::bigint,
                last_game      = $4,
                last_played_at = COALESCE(NULLIF($5, '')::timestamptz, now()),
                updated_at     = now()
            WHERE id = $1::uuid
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::from(d_won),
                Json::from(d_lost),
                Json::String(game.to_string()),
                Json::String(played_at.to_string()),
            ],
        )
        .await?;

        Ok(())
    }

    // -----------------------------------------------------------------------
    // WEBHOOK — full PlayforFun lifecycle processing
    // -----------------------------------------------------------------------

    /// PlayforFun webhook: timing-safe HMAC over the raw body, then full
    /// lifecycle processing (match start/result, coin events, recharges).
    pub async fn handle_webhook(
        &self,
        state: &GamesState,
        raw_body: &str,
        signature: Option<&str>,
    ) -> Result<Json, AppError> {
        if state.config.pff_secret.is_empty() {
            return Err(AppError::BadRequest(
                "PlayforFun webhook secret is not configured".to_string(),
            ));
        }
        let signature = signature
            .ok_or_else(|| AppError::Unauthorized("Missing x-playforfun-signature header".to_string()))?;

        let expected = SecurityUtils::compute_hmac_sha256(&state.config.pff_secret, raw_body)
            .map_err(|e| AppError::Internal(format!("HMAC failure: {e}")))?;
        if !constant_time_eq(signature.trim().as_bytes(), expected.as_bytes()) {
            warn!("Rejected PlayforFun webhook with invalid signature");
            return Err(AppError::Unauthorized(
                "Invalid PlayforFun webhook signature".to_string(),
            ));
        }

        let payload: Json = serde_json::from_str(raw_body)
            .map_err(|_| AppError::BadRequest("Webhook body is not valid JSON".to_string()))?;

        let event = probe_str(&payload, &["event", "type", "action"])
            .unwrap_or_else(|| "unknown".to_string());
        let event_lc = event.to_ascii_lowercase();

        let outcome = if event_lc.contains("recharge") || event_lc.contains("deposit") || event_lc.contains("topup") {
            self.process_recharge(state, &event, &payload).await?
        } else if event_lc.contains("coin") || event_lc.contains("wallet") || event_lc.contains("transaction") {
            self.process_coin_event(state, &event, &payload).await?
        } else if event_lc.contains("register") && event_lc.contains("player") {
            self.process_player_registered(state, &event, &payload).await?
        } else if event_lc.contains("match") || event_lc.contains("game") || event_lc.contains("result")
            || event_lc.contains("round") || payload.get("match_id").is_some()
            || payload.get("matchId").is_some()
        {
            self.process_match_event(state, &event, &payload).await?
        } else {
            // Unknown event: archive only, so nothing is ever lost.
            self.archive_match(state, &event, &payload, None, None).await?;
            serde_json::json!({ "received": true, "event": event, "processed": "archived" })
        };

        info!("PlayforFun webhook accepted: event={event}");
        Ok(outcome)
    }

    /// match_started / match_completed / match_result — the core game webhook.
    async fn process_match_event(
        &self,
        state: &GamesState,
        event: &str,
        payload: &Json,
    ) -> Result<Json, AppError> {
        let match_id = probe_str(payload, &["match_id", "matchId", "game_id", "gameId", "round_id", "roundId"])
            .unwrap_or_else(|| format!("pff_{}", Uuid::new_v4().simple()));
        let game = probe_str(payload, &["game", "game_name", "gameName", "game_type", "gameType"])
            .map(|g| g.to_ascii_lowercase())
            .unwrap_or_default();
        let phase_started = event.to_ascii_lowercase().contains("start");
        let played_at = probe_str(payload, &["at", "played_at", "playedAt", "timestamp", "time", "ended_at"]).unwrap_or_default();

        let participants = extract_participants(payload);
        let winner_ref = payload
            .get("winner")
            .and_then(id_from_value)
            .or_else(|| {
                participants
                    .iter()
                    .find(|p| p.result.as_deref() == Some("WON"))
                    .map(|p| p.id.clone())
            });

        // Winner resolution for the archive table.
        let mut winner_external: Option<String> = winner_ref.clone();
        let mut winner_user: Option<String> = None;
        if let Some(w) = &winner_ref {
            if let Some(prow) = Self::find_player_any(&state.db, w).await? {
                winner_user = probe_str(&prow, &["user_id"]);
                winner_external = probe_str(&prow, &["external_id"]).or(Some(w.clone()));
            }
        }

        let prize = probe_i64(payload, &["prize", "coins_won", "coinsWon", "reward"]).unwrap_or(0);

        // One transaction: archive + ledger + sessions + stats.
        let tx = state
            .db
            .begin()
            .await
            .map_err(|e| AppError::Database(format!("Failed opening webhook transaction: {e}")))?;

        let archive_sql = r#"
            INSERT INTO match_results (match_id, event, game, winner_external_id, winner_user_id,
                                       prize, entry_fee, played_at, payload, signature_verified, received_at)
            VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, COALESCE(NULLIF($8, '')::timestamptz, now()), $9::jsonb, TRUE, now())
            ON CONFLICT (match_id) DO UPDATE
               SET event              = EXCLUDED.event,
                   winner_external_id = EXCLUDED.winner_external_id,
                   winner_user_id     = EXCLUDED.winner_user_id,
                   prize              = EXCLUDED.prize,
                   entry_fee          = EXCLUDED.entry_fee,
                   payload            = EXCLUDED.payload,
                   received_at        = now()
        "#;
        let entry_fee_total = participants.iter().map(|p| p.entry_fee).sum::<i64>();
        exec(
            &tx,
            archive_sql,
            vec![
                Json::String(match_id.clone()),
                Json::String(event.to_string()),
                Json::String(game.clone()),
                winner_external.clone().map(Json::String).unwrap_or(Json::Null),
                winner_user.clone().map(Json::String).unwrap_or(Json::Null),
                Json::from(prize),
                Json::from(entry_fee_total),
                Json::String(played_at.clone()),
                payload.clone(),
            ],
        )
        .await?;

        let mut credited_wins = 0i64;
        let mut processed = 0usize;

        for p in &participants {
            let prow = Self::find_player_any(&tx, &p.id).await?;
            let Some(player_id) = Self::player_id_from_opt(&prow) else {
                warn!("Webhook {match_id}: unknown participant id {} — skipped", p.id);
                continue;
            };
            let external_id = prow
                .as_ref()
                .and_then(|j| j.get("external_id"))
                .and_then(|v| v.as_str())
                .unwrap_or(p.id.as_str())
                .to_string();

            // Default results for completed matches.
            let result = if phase_started {
                p.result.clone().unwrap_or_else(|| "PLAYED".to_string())
            } else if let Some(r) = &p.result {
                r.clone()
            } else if participants.len() > 1 {
                if Some(p.id.as_str()) == winner_ref.as_deref() {
                    "WON".to_string()
                } else {
                    "LOST".to_string()
                }
            } else {
                "PLAYED".to_string()
            };

            // Entry fee debit at match start (or completion if fee arrives then).
            let mut balance: Option<i64> = None;
            if p.entry_fee > 0 {
                balance = Self::adjust_coins(
                    &tx,
                    player_id,
                    "ENTRY_FEE",
                    -p.entry_fee,
                    Some(game.as_str()),
                    Some(match_id.as_str()),
                    Some(format!("{match_id}:{external_id}:FEE").as_str()),
                    payload,
                )
                .await?;
            }

            // Winner coin credit on completion.
            if !phase_started && result == "WON" && p.coins_won > 0 {
                balance = Self::adjust_coins(
                    &tx,
                    player_id,
                    "WIN",
                    p.coins_won,
                    Some(game.as_str()),
                    Some(match_id.as_str()),
                    Some(format!("{match_id}:{external_id}:WIN").as_str()),
                    payload,
                )
                .await?;
                if balance.is_some() {
                    credited_wins += p.coins_won;
                }
            }

            let game_name = if game.is_empty() { "unknown" } else { game.as_str() };
            Self::record_session(
                &tx,
                player_id,
                &match_id,
                game_name,
                &result,
                if result == "WON" { p.coins_won } else { 0 },
                p.entry_fee,
                p.score,
                p.rank,
                balance,
                &played_at,
                payload,
            )
            .await?;

            processed += 1;
        }

        tx.commit()
            .await
            .map_err(|e| AppError::Database(format!("Webhook transaction commit failed: {e}")))?;

        Ok(serde_json::json!({
            "received": true,
            "event": event,
            "matchId": match_id,
            "participantsProcessed": processed,
            "coinsCredited": credited_wins,
        }))
    }

    /// Recharge events — credit coins + audit trail.
    async fn process_recharge(
        &self,
        state: &GamesState,
        event: &str,
        payload: &Json,
    ) -> Result<Json, AppError> {
        // Allow a nested recharge object.
        let source = payload.get("recharge").filter(|v| v.is_object()).unwrap_or(payload);

        let who = id_from_value(source)
            .or_else(|| probe_str(source, &["external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user"]))
            .ok_or_else(|| AppError::BadRequest("Recharge event missing player identifier".to_string()))?;

        let coins = probe_i64(source, &["coins", "amount", "coins_amount", "coinsAmount", "value", "credits"])
            .ok_or_else(|| AppError::BadRequest("Recharge event missing coin amount".to_string()))?;
        if coins <= 0 {
            return Err(AppError::BadRequest("Recharge coin amount must be positive".to_string()));
        }

        let reference = probe_str(source, &["reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "order_id", "orderId", "id"]);
        let money_inr = probe_i64(source, &["money", "amount_inr", "amountInr", "inr"]).map(|v| v as f64 / 100.0);
        let recharge_source = probe_str(source, &["source", "channel"]).unwrap_or_else(|| "PLAYFORFUN".to_string());

        let prow = Self::find_player_any(&state.db, &who)
            .await?
            .ok_or_else(|| AppError::BadRequest(format!("Unknown player for recharge: {who}")))?;
        let player_id = Self::player_id_from(&prow)
            .ok_or_else(|| AppError::Internal("Player row missing id".to_string()))?;

        // Recharge audit row is the idempotency gate (reference UNIQUE).
        let inserted = exec(
            &state.db,
            r#"
            INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
            VALUES ($1::uuid, $2::bigint, $3::double precision, $4, 'CREDITED', $5, $6::jsonb)
            ON CONFLICT (reference) DO NOTHING
            "#,
            vec![
                Json::String(player_id.to_string()),
                Json::from(coins),
                money_inr.map(Json::from).unwrap_or(Json::Null),
                Json::String(recharge_source),
                reference.clone().map(Json::String).unwrap_or(Json::Null),
                payload.clone(),
            ],
        )
        .await?;

        let credited = if inserted > 0 {
            Self::adjust_coins(
                &state.db,
                player_id,
                "RECHARGE",
                coins,
                None,
                None,
                reference.as_deref(),
                payload,
            )
            .await?
            .is_some()
        } else {
            false // replay
        };

        Ok(serde_json::json!({ "received": true, "event": event, "credited": credited, "coins": if credited { coins } else { 0 } }))
    }

    /// Generic coin events (win/bonus/refund/adjustment credits & debits).
    async fn process_coin_event(
        &self,
        state: &GamesState,
        event: &str,
        payload: &Json,
    ) -> Result<Json, AppError> {
        let who = id_from_value(payload)
            .or_else(|| probe_str(payload, &["external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user"]))
            .ok_or_else(|| AppError::BadRequest("Coin event missing player identifier".to_string()))?;

        let raw_type = probe_str(payload, &["txn_type", "txnType", "transaction_type", "transactionType", "coin_type", "coinType", "movement"])
            .unwrap_or_else(|| "ADJUSTMENT".to_string());
        let txn_type = match raw_type.to_ascii_uppercase().as_str() {
            "WIN" | "WINNING" | "WINNINGS" => "WIN",
            "RECHARGE" | "DEPOSIT" | "TOPUP" | "TOP_UP" => "RECHARGE",
            "ENTRY_FEE" | "FEE" | "DEBIT" => "ENTRY_FEE",
            "REFUND" => "REFUND",
            "BONUS" | "REWARD" => "BONUS",
            _ => "ADJUSTMENT",
        };

        let amount = probe_i64(payload, &["amount", "coins", "delta", "value"])
            .ok_or_else(|| AppError::BadRequest("Coin event missing amount".to_string()))?;
        let amount = if txn_type == "ENTRY_FEE" { -amount.abs() } else { amount };

        let reference = probe_str(payload, &["reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "id"]);
        let game = probe_str(payload, &["game"]).map(|g| g.to_ascii_lowercase());
        let match_id = probe_str(payload, &["match_id", "matchId"]);

        let prow = Self::find_player_any(&state.db, &who)
            .await?
            .ok_or_else(|| AppError::BadRequest(format!("Unknown player for coin event: {who}")))?;
        let player_id = Self::player_id_from(&prow)
            .ok_or_else(|| AppError::Internal("Player row missing id".to_string()))?;

        let balance = Self::adjust_coins(
            &state.db,
            player_id,
            txn_type,
            amount,
            game.as_deref(),
            match_id.as_deref(),
            reference.as_deref(),
            payload,
        )
        .await?;

        Ok(serde_json::json!({
            "received": true,
            "event": event,
            "applied": balance.is_some(),
            "balance": balance,
        }))
    }

    /// player_registered events — enrich or create the mirrored gamer record.
    async fn process_player_registered(
        &self,
        state: &GamesState,
        event: &str,
        payload: &Json,
    ) -> Result<Json, AppError> {
        let who = probe_str(payload, &["external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id"]);
        let name = probe_str(payload, &["name", "full_name", "fullName", "display_name", "displayName"]);
        let email = probe_str(payload, &["email"]);
        let mobile = probe_str(payload, &["mobile", "mobile_number", "mobileNumber", "phone", "phone_number", "phoneNumber"]);
        let age = probe_i64(payload, &["age"]).map(|v| v as i16);

        let Some(who) = who else {
            return Err(AppError::BadRequest("player_registered event missing identifier".to_string()));
        };

        if let Some(prow) = Self::find_player_any(&state.db, &who).await? {
            let player_id = Self::player_id_from(&prow)
                .ok_or_else(|| AppError::Internal("Player row missing id".to_string()))?;
            exec(
                &state.db,
                r#"
                UPDATE players SET
                    name          = COALESCE($2, name),
                    email         = COALESCE($3, email),
                    mobile_number = COALESCE($4, mobile_number),
                    age           = COALESCE($5::smallint, age),
                    updated_at    = now()
                WHERE id = $1::uuid
                "#,
                vec![
                    Json::String(player_id.to_string()),
                    name.clone().map(Json::String).unwrap_or(Json::Null),
                    email.clone().map(Json::String).unwrap_or(Json::Null),
                    mobile.clone().map(Json::String).unwrap_or(Json::Null),
                    age.map(Json::from).unwrap_or(Json::Null),
                ],
            )
            .await?;
            Ok(serde_json::json!({ "received": true, "event": event, "updated": true }))
        } else if let Some(uid) = probe_str(payload, &["user_id", "userId"]) {
            // New gamer — create the mirror record directly from webhook data.
            let details = UserDetails {
                user_id: uid,
                email,
                full_name: name,
                phone_number: mobile,
            };
            let player = Self::upsert_player(state, &details).await?;
            if let Some(a) = age {
                let _ = exec(
                    &state.db,
                    "UPDATE players SET age = $2::smallint, updated_at = now() WHERE user_id = $1",
                    vec![Json::String(player.user_id.clone()), Json::from(a)],
                )
                .await;
            }
            Ok(serde_json::json!({ "received": true, "event": event, "created": true, "gamerUid": player.gamer_uid }))
        } else {
            Err(AppError::BadRequest("player_registered event references an unknown gamer".to_string()))
        }
    }

    /// Archive-only insert used for unknown/unmatched events.
    async fn archive_match(
        &self,
        state: &GamesState,
        event: &str,
        payload: &Json,
        winner: Option<String>,
        game: Option<String>,
    ) -> Result<(), AppError> {
        let match_id = probe_str(payload, &["match_id", "matchId", "id"])
            .unwrap_or_else(|| format!("evt_{}", Uuid::new_v4().simple()));
        exec(
            &state.db,
            r#"
            INSERT INTO match_results (match_id, event, game, winner_external_id, prize, payload, signature_verified)
            VALUES ($1, $2, $3, $4, 0, $5::jsonb, TRUE)
            ON CONFLICT (match_id) DO UPDATE
               SET payload = EXCLUDED.payload, received_at = now()
            "#,
            vec![
                Json::String(match_id),
                Json::String(event.to_string()),
                game.map(Json::String).unwrap_or(Json::Null),
                winner.map(Json::String).unwrap_or(Json::Null),
                payload.clone(),
            ],
        )
        .await?;
        Ok(())
    }

    // -----------------------------------------------------------------------
    // Snapshot — full gamer record: profile + coins + stats + sessions
    // -----------------------------------------------------------------------
    pub async fn player_snapshot(state: &GamesState, player: &Player) -> Result<Json, AppError> {
        let row = query_player_json(
            &state.db,
            "SELECT row_to_json(p) AS row FROM players p WHERE p.user_id = $1".to_string(),
            vec![Json::String(player.user_id.clone())],
        )
        .await?
        .ok_or_else(|| AppError::NotFound("Gamer record not found".to_string()))?;

        let player_id = match row.get("id").and_then(|v| v.as_str()).and_then(|s| Uuid::parse_str(s).ok()) {
            Some(id) => id,
            None => return Err(AppError::Internal("Gamer record missing id".to_string())),
        };

        let stats = query_player_json(
            &state.db,
            r#"
            SELECT COALESCE(json_agg(row_to_json(gs)), '[]'::json) AS row
            FROM game_stats gs WHERE gs.player_id = $1::uuid
            "#
            .to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await?
        .and_then(|j| j.get("row").cloned())
        .unwrap_or_else(|| serde_json::json!([]));

        let sessions = query_player_json(
            &state.db,
            r#"
            SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) AS row
            FROM (
                SELECT * FROM game_sessions
                WHERE player_id = $1::uuid
                ORDER BY played_at DESC
                LIMIT 20
            ) s
            "#
            .to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await?
        .and_then(|j| j.get("row").cloned())
        .unwrap_or_else(|| serde_json::json!([]));

        let txns = query_player_json(
            &state.db,
            r#"
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS row
            FROM (
                SELECT * FROM coin_transactions
                WHERE player_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT 15
            ) t
            "#
            .to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await?
        .and_then(|j| j.get("row").cloned())
        .unwrap_or_else(|| serde_json::json!([]));

        let recharges = query_player_json(
            &state.db,
            r#"
            SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) AS row
            FROM (
                SELECT * FROM recharges
                WHERE player_id = $1::uuid
                ORDER BY created_at DESC
                LIMIT 15
            ) r
            "#
            .to_string(),
            vec![Json::String(player_id.to_string())],
        )
        .await?
        .and_then(|j| j.get("row").cloned())
        .unwrap_or_else(|| serde_json::json!([]));

        Ok(serde_json::json!({
            "player": {
                "gamerUid": row.get("gamer_uid"),
                "userId": row.get("user_id"),
                "externalId": row.get("external_id"),
                "name": row.get("name"),
                "email": row.get("email"),
                "age": row.get("age"),
                "mobileNumber": row.get("mobile_number"),
                "displayName": row.get("display_name"),
                "coins": row.get("coins"),
                "totalCoinsWon": row.get("total_coins_won"),
                "totalCoinsRecharged": row.get("total_coins_recharged"),
                "totalCoinsSpent": row.get("total_coins_spent"),
                "matchesPlayed": row.get("matches_played"),
                "matchesWon": row.get("matches_won"),
                "matchesLost": row.get("matches_lost"),
                "lastGame": row.get("last_game"),
                "lastPlayedAt": row.get("last_played_at"),
            },
            "gameStats": stats,
            "recentSessions": sessions,
            "recentTransactions": txns,
            "recentRecharges": recharges,
        }))
    }
}

fn form_urlencoded(pairs: &[(&str, &str)]) -> String {
    pairs
        .iter()
        .map(|(k, v)| format!("{}={}", encode_component(k), encode_component(v)))
        .collect::<Vec<_>>()
        .join("&")
}

fn encode_component(input: &str) -> String {
    let mut out = String::new();
    for byte in input.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(*byte as char)
            }
            other => out.push_str(&format!("%{other:02X}")),
        }
    }
    out
}

pub(crate) fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
