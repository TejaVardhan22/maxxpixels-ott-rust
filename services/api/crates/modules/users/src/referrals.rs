use sea_orm::{ConnectionTrait, DatabaseBackend, DatabaseConnection, Statement};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use maxx_common::error::AppError;

pub const DEFAULT_REFERRAL_REWARD_DAYS: i32 = 7;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyReferralCodeRequest {
    #[serde(
        alias = "referral_code",
        alias = "reference_code",
        alias = "referenceCode",
        alias = "agent_code",
        alias = "agentCode",
        alias = "code"
    )]
    pub referral_code: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferralHistoryItem {
    pub id: i64,
    pub referred_user_id: i64,
    pub friend_name: String,
    pub referral_code: String,
    pub status: String,
    pub reward_type: String,
    pub reward_days: i32,
    pub reward_amount: f64,
    pub credited_at: Option<String>,
    pub created_at: String,
}

/// Ensures the user has a unique uppercase `MAXXxxxxxx` referral code persisted in `users.referral_code`,
/// guaranteed not to collide with any `marketing_agents.agent_code`.
pub async fn ensure_user_referral_code(
    db: &DatabaseConnection,
    user_id: i64,
) -> Result<String, AppError> {
    let existing = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT referral_code FROM users WHERE id = $1",
            vec![user_id.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    if let Some(row) = existing {
        if let Ok(Some(code)) = row.try_get::<Option<String>>("", "referral_code") {
            let trimmed = code.trim().to_uppercase();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
        }
    } else {
        return Err(AppError::NotFound("User not found".to_string()));
    }

    for _ in 0..10 {
        let suffix = uuid::Uuid::new_v4().simple().to_string()[..6].to_uppercase();
        let candidate = format!("MAXX{}", suffix);

        // Guard against any collision with marketing_agents.agent_code
        let collides_agent = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT id FROM marketing_agents WHERE UPPER(agent_code) = $1 LIMIT 1",
                vec![candidate.clone().into()],
            ))
            .await
            .ok()
            .flatten()
            .is_some();
        if collides_agent {
            continue;
        }

        let updated = db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE users SET referral_code = $1, updated_at = NOW() \
                 WHERE id = $2 AND (referral_code IS NULL OR TRIM(referral_code) = '')",
                vec![candidate.clone().into(), user_id.into()],
            ))
            .await;

        if let Ok(res) = updated {
            if res.rows_affected() > 0 {
                return Ok(candidate);
            }
            if let Ok(Some(row)) = db
                .query_one(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "SELECT referral_code FROM users WHERE id = $1",
                    vec![user_id.into()],
                ))
                .await
            {
                if let Ok(Some(code)) = row.try_get::<Option<String>>("", "referral_code") {
                    if !code.trim().is_empty() {
                        return Ok(code.trim().to_uppercase());
                    }
                }
            }
        }
    }

    Err(AppError::Internal(
        "Failed to generate a unique referral code".to_string(),
    ))
}

/// Returns the user's referral code, stats, applied referrer/agent (if any), and referral history.
pub async fn get_my_referrals(db: &DatabaseConnection, user_id: i64) -> Result<Value, AppError> {
    let my_code = ensure_user_referral_code(db, user_id).await?;

    // Check if this user was referred by a friend (user_referrals) OR a marketing agent (marketing_agent_members)
    let user_ref_row = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT ur.referral_code, ur.status, ur.reward_days, \
                    COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''), 'A Friend') AS referrer_name \
             FROM user_referrals ur \
             JOIN users u ON u.id = ur.referrer_user_id \
             WHERE ur.referred_user_id = $1 \
             LIMIT 1",
            vec![user_id.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let applied_referral = if let Some(r) = user_ref_row {
        Some(json!({
            "codeType": "USER_REFERRAL",
            "referralCode": r.try_get::<String>("", "referral_code").unwrap_or_default(),
            "status": r.try_get::<String>("", "status").unwrap_or_else(|_| "SIGNED_UP".to_string()),
            "rewardDays": r.try_get::<i32>("", "reward_days").unwrap_or(DEFAULT_REFERRAL_REWARD_DAYS),
            "referrerName": r.try_get::<String>("", "referrer_name").unwrap_or_else(|_| "A Friend".to_string()),
        }))
    } else {
        let agent_row = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT ma.agent_code, ma.full_name \
                 FROM marketing_agent_members mam \
                 JOIN marketing_agents ma ON ma.id = mam.agent_id \
                 WHERE mam.user_id = $1 \
                 LIMIT 1",
                vec![user_id.into()],
            ))
            .await
            .ok()
            .flatten();

        agent_row.map(|r| {
            json!({
                "codeType": "MARKETING_AGENT",
                "referralCode": r.try_get::<String>("", "agent_code").unwrap_or_default(),
                "status": "LINKED",
                "rewardDays": 0,
                "referrerName": r.try_get::<String>("", "full_name").unwrap_or_else(|_| "Partner Agent".to_string()),
            })
        })
    };

    // Fetch referrals sent by this user
    let rows = db
        .query_all(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT ur.id, ur.referred_user_id, ur.referral_code, ur.status, ur.reward_type, \
                    ur.reward_days, COALESCE(ur.reward_amount, 0)::float8 AS reward_amount, \
                    ur.credited_at, ur.created_at, \
                    COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(SPLIT_PART(COALESCE(u.email, ''), '@', 1), ''), 'MaxxPixels Member') AS friend_name \
             FROM user_referrals ur \
             JOIN users u ON u.id = ur.referred_user_id \
             WHERE ur.referrer_user_id = $1 \
             ORDER BY ur.created_at DESC \
             LIMIT 100",
            vec![user_id.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut history: Vec<ReferralHistoryItem> = Vec::with_capacity(rows.len());
    let mut pending_count: i64 = 0;
    let mut rewarded_count: i64 = 0;
    let mut total_reward_days: i64 = 0;
    let mut total_reward_amount: f64 = 0.0;

    for row in rows {
        let status = row
            .try_get::<String>("", "status")
            .unwrap_or_else(|_| "SIGNED_UP".to_string());
        let reward_days = row
            .try_get::<i32>("", "reward_days")
            .unwrap_or(DEFAULT_REFERRAL_REWARD_DAYS);
        let reward_amount = row.try_get::<f64>("", "reward_amount").unwrap_or(0.0);

        if status == "REWARDED" {
            rewarded_count += 1;
            total_reward_days += reward_days as i64;
            total_reward_amount += reward_amount;
        } else if status == "SIGNED_UP" {
            pending_count += 1;
        }

        let created_at = row
            .try_get::<chrono::DateTime<chrono::Utc>>("", "created_at")
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default();
        let credited_at = row
            .try_get::<Option<chrono::DateTime<chrono::Utc>>>("", "credited_at")
            .ok()
            .flatten()
            .map(|dt| dt.to_rfc3339());

        history.push(ReferralHistoryItem {
            id: row.try_get::<i64>("", "id").unwrap_or(0),
            referred_user_id: row.try_get::<i64>("", "referred_user_id").unwrap_or(0),
            friend_name: row
                .try_get::<String>("", "friend_name")
                .unwrap_or_else(|_| "MaxxPixels Member".to_string()),
            referral_code: row.try_get::<String>("", "referral_code").unwrap_or_default(),
            status,
            reward_type: row
                .try_get::<String>("", "reward_type")
                .unwrap_or_else(|_| "VIP_DAYS".to_string()),
            reward_days,
            reward_amount,
            credited_at,
            created_at,
        });
    }

    Ok(json!({
        "referralCode": my_code,
        "reference_code": my_code,
        "rewardConfig": {
            "rewardType": "VIP_DAYS",
            "rewardDays": DEFAULT_REFERRAL_REWARD_DAYS,
        },
        "stats": {
            "totalInvited": history.len(),
            "pendingCount": pending_count,
            "rewardedCount": rewarded_count,
            "totalRewardDays": total_reward_days,
            "totalRewardAmount": total_reward_amount,
        },
        "appliedReferral": applied_referral,
        "history": history,
    }))
}

/// Unified code resolver: accepts EITHER a Marketing Agent code OR a User Referral code.
/// Enforces strict mutual exclusion (one attribution per user across both tables).
pub async fn apply_referral_code(
    db: &DatabaseConnection,
    user_id: i64,
    raw_code: &str,
) -> Result<Value, AppError> {
    let clean_code = raw_code.trim().to_uppercase();
    if clean_code.len() < 3 || clean_code.len() > 32 {
        return Err(AppError::BadRequest(
            "Please enter a valid referral or partner code.".to_string(),
        ));
    }

    // 1. Strict mutual exclusion: check BOTH user_referrals and marketing_agent_members
    let has_user_ref = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id FROM user_referrals WHERE referred_user_id = $1 LIMIT 1",
            vec![user_id.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .is_some();

    let has_agent_ref = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id FROM marketing_agent_members WHERE user_id = $1 LIMIT 1",
            vec![user_id.into()],
        ))
        .await
        .ok()
        .flatten()
        .is_some();

    if has_user_ref || has_agent_ref {
        return Err(AppError::Conflict(
            "A referral or partner code has already been applied to your account.".to_string(),
        ));
    }

    // 2. Priority 1: Check active Marketing Agent code
    let agent = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id, agent_code, full_name FROM marketing_agents \
             WHERE UPPER(agent_code) = $1 AND status = 'ACTIVE' \
             LIMIT 1",
            vec![clean_code.clone().into()],
        ))
        .await
        .ok()
        .flatten();

    if let Some(agent_row) = agent {
        let agent_id: i64 = agent_row.try_get("", "id").unwrap_or(0);
        let agent_code: String = agent_row
            .try_get("", "agent_code")
            .unwrap_or_else(|_| clean_code.clone());
        let agent_name: String = agent_row
            .try_get("", "full_name")
            .unwrap_or_else(|_| "Partner Agent".to_string());

        let user_phone: Option<String> = db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT phone FROM users WHERE id = $1 LIMIT 1",
                vec![user_id.into()],
            ))
            .await
            .ok()
            .flatten()
            .and_then(|r| r.try_get::<Option<String>>("", "phone").ok().flatten());

        db.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO marketing_agent_members (agent_id, user_id, phone_number, created_at) \
             VALUES ($1, $2, $3, NOW()) \
             ON CONFLICT (user_id) DO NOTHING",
            vec![agent_id.into(), user_id.into(), user_phone.into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

        return Ok(json!({
            "applied": true,
            "codeType": "MARKETING_AGENT",
            "referralCode": agent_code,
            "referrerName": agent_name,
            "rewardDays": 0,
        }));
    }

    // 3. Priority 2: Check User Referral code
    let referrer = db
        .query_one(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "SELECT id, COALESCE(NULLIF(TRIM(full_name), ''), NULLIF(SPLIT_PART(COALESCE(email, ''), '@', 1), ''), 'A Friend') AS referrer_name \
             FROM users \
             WHERE UPPER(referral_code) = $1 \
             LIMIT 1",
            vec![clean_code.clone().into()],
        ))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| {
            AppError::NotFound(
                "Code not found. Please check the referral or partner code and try again."
                    .to_string(),
            )
        })?;

    let referrer_id: i64 = referrer.try_get("", "id").unwrap_or(0);
    let referrer_name: String = referrer
        .try_get("", "referrer_name")
        .unwrap_or_else(|_| "A Friend".to_string());

    if referrer_id == user_id {
        return Err(AppError::BadRequest(
            "You cannot apply your own referral code.".to_string(),
        ));
    }

    db.execute(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        "UPDATE users SET referred_by_user_id = $1, updated_at = NOW() WHERE id = $2",
        vec![referrer_id.into(), user_id.into()],
    ))
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    db.execute(Statement::from_sql_and_values(
        DatabaseBackend::Postgres,
        "INSERT INTO user_referrals (referrer_user_id, referred_user_id, referral_code, status, reward_type, reward_days, reward_amount) \
         VALUES ($1, $2, $3, 'SIGNED_UP', 'VIP_DAYS', $4, 0) \
         ON CONFLICT (referred_user_id) DO NOTHING",
        vec![
            referrer_id.into(),
            user_id.into(),
            clean_code.clone().into(),
            DEFAULT_REFERRAL_REWARD_DAYS.into(),
        ],
    ))
    .await
    .map_err(|e| AppError::Database(e.to_string()))?;

    Ok(json!({
        "applied": true,
        "codeType": "USER_REFERRAL",
        "referralCode": clean_code,
        "referrerName": referrer_name,
        "rewardDays": DEFAULT_REFERRAL_REWARD_DAYS,
    }))
}
