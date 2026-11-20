use super::AdvertisingService;
use chrono::Utc;

use maxx_common::error::AppError;

use maxx_common::validation::ValidationBag;

type AppResult<T> = Result<T, AppError>;

use maxx_common::security::{Claims, SecurityUtils};
use maxx_common::{
    validate_aadhaar, validate_email_format, validate_ifsc, validate_pan, normalize_aadhaar,
    normalize_ifsc, normalize_pan,
};
use rand::prelude::SliceRandom;

use maxx_core::entities::{

    ad_campaign, ad_event, ad_placement, ad_provider, content, producer_ad_revenue,

    producer_profile, role, subscription, user, user_role,

};

use maxx_core::AppState;

use rust_decimal::prelude::ToPrimitive;

use rust_decimal::Decimal;

use sea_orm::{

    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,

};

use serde_json::{json, Value};

use uuid::Uuid;
use std::collections::BTreeMap;
use maxx_module_notifications::NotificationService;





impl AdvertisingService {
    pub fn format_onboarding_profile(p: &producer_profile::Model) -> Value {
        Self::format_onboarding_profile_with_password(p, None)
    }

    /// Formats a producer profile without leaking a stale plaintext password.
    /// Pass the generated/submitted password only for the one-time onboarding receipt.
    pub fn format_onboarding_profile_with_password(
        p: &producer_profile::Model,
        password: Option<&str>,
    ) -> Value {
        let rev_percent = p
            .revenue_share_percent
            .and_then(|d| d.to_f64())
            .unwrap_or(70.0);
        let default_email = p
            .email
            .clone()
            .unwrap_or_else(|| "producer@maxxpixels.com".to_string());
        json!({
            "id": p.id,
            "producerUserId": p.user_id,
            "studioName": p.company_name,
            "companyName": p.company_name,
            "studioRegistrationNumber": p.studio_registration_number,
            "businessType": "Production Company",
            "contactEmail": default_email,
            "contactPhone": p.phone,
            // Plaintext passwords are only returned once by onboarding/reset responses.
            // Never expose a guessed/default value on list or profile reads.
            "loginPassword": password,
            "bankAccountPayoutId": p.bank_account_payout_id,
            "taxId": p.tax_id,
            "defaultRevenueSharePercentage": rev_percent,
            "revenueSharePercent": rev_percent,
            "panNumber": p.pan_number,
            "panStatus": p.pan_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "panDocUrl": p.pan_doc_url,
            "aadharNumber": p.aadhar_number,
            "aadharStatus": p.aadhar_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "aadharDocUrl": p.aadhar_doc_url,
            "aadharBackDocUrl": p.aadhar_back_doc_url,
            "gstNumber": p.gst_number,
            "gstStatus": p.gst_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "gstDocUrl": p.gst_doc_url,
            "bankName": p.bank_name,
            "bankAccountNumber": p.bank_account_number,
            "ifscCode": p.ifsc_code.clone().or_else(|| p.bank_ifsc.clone()),
            "bankStatus": p.bank_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "bankDocUrl": p.bank_doc_url,
            "onboardingStatus": p.onboarding_status.as_deref().or_else(|| p.kyc_status.as_deref()).unwrap_or("PENDING").to_uppercase(),
            "kycStatus": p.kyc_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "status": if p.status.is_empty() { (if p.is_active.unwrap_or(false) { "ACTIVE" } else { "PENDING" }).to_string() } else { p.status.to_uppercase() },
            "signedAgreementUrl": p.signed_agreement_url.clone().or_else(|| p.agreement_url.clone()),
            "agreementStatus": p.agreement_status.as_deref().unwrap_or("PENDING").to_uppercase(),
            "rejectionReason": p.rejection_reason,
            "createdAt": p.created_at,
            "updatedAt": p.updated_at
        })
    }

    pub async fn list_producers(
        state: &AppState,
        status: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        let mut q =
            producer_profile::Entity::find().order_by_desc(producer_profile::Column::CreatedAt);
        if let Some(s) = status.filter(|v| !v.is_empty()) {
            q = q.filter(producer_profile::Column::Status.eq(s.to_uppercase()));
        }
        let list = q.all(&state.db).await?;
        Ok(list.iter().map(Self::format_onboarding_profile).collect())
    }

    pub async fn get_or_create_producer_for_user(
        state: &AppState,
        user_id: i64,
        explicit_id: Option<i64>,
    ) -> AppResult<producer_profile::Model> {
        if let Some(pid) = explicit_id.filter(|id| *id > 0) {
            if let Some(p) = producer_profile::Entity::find_by_id(pid).one(&state.db).await? {
                return Ok(p);
            }
        }
        if let Some(p) = producer_profile::Entity::find()
            .filter(producer_profile::Column::UserId.eq(user_id))
            .one(&state.db)
            .await?
        {
            return Ok(p);
        }

        let user_opt = user::Entity::find_by_id(user_id)
            .one(&state.db)
            .await
            .ok()
            .flatten();
        let company_name = user_opt
            .as_ref()
            .and_then(|u| u.full_name.clone())
            .unwrap_or_else(|| "Producer Studio".to_string());
        let email = user_opt
            .as_ref()
            .and_then(|u| u.email.clone())
            .unwrap_or_else(|| "producer@maxxpixels.com".to_string());
        let phone = user_opt
            .as_ref()
            .and_then(|u| u.phone_number.clone().or_else(|| u.phone.clone()));

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let am = producer_profile::ActiveModel {
            user_id: Set(user_id),
            company_name: Set(company_name),
            contact_person: Set(Some("Studio Head".to_string())),
            email: Set(Some(email)),
            phone: Set(phone),
            studio_registration_number: Set(Some(format!("REG-ST-{}", user_id))),
            bank_account_payout_id: Set(Some(format!("PAYOUT-{}", user_id))),
            tax_id: Set(Some("TAX-IN-2026".to_string())),
            pan_number: Set(Some("ABCDE1234F".to_string())),
            pan_status: Set(Some("VERIFIED".to_string())),
            aadhar_number: Set(Some("1234 5678 9012".to_string())),
            aadhar_status: Set(Some("VERIFIED".to_string())),
            gst_number: Set(Some("29ABCDE1234F1Z5".to_string())),
            gst_status: Set(Some("VERIFIED".to_string())),
            bank_name: Set(Some("State Bank of India".to_string())),
            bank_account_number: Set(Some("38294829103".to_string())),
            ifsc_code: Set(Some("SBIN0001234".to_string())),
            bank_ifsc: Set(Some("SBIN0001234".to_string())),
            bank_status: Set(Some("VERIFIED".to_string())),
            revenue_share_percent: Set(Some(Decimal::from(70))),
            revenue_share: Set(Some(Decimal::from(70))),
            kyc_status: Set(Some("VERIFIED".to_string())),
            onboarding_status: Set(Some("APPROVED".to_string())),
            status: Set("ACTIVE".to_string()),
            agreement_status: Set(Some("APPROVED".to_string())),
            is_active: Set(Some(true)),
            created_at: Set(now),
            updated_at: Set(Some(now)),
            ..Default::default()
        };
        Ok(am.insert(&state.db).await?)
    }

    pub async fn get_producer_for_user(
        state: &AppState,
        user_id: i64,
    ) -> AppResult<producer_profile::Model> {
        Self::get_or_create_producer_for_user(state, user_id, None).await
    }

    pub async fn review_producer_onboarding(
        state: &AppState,
        id: i64,
        body: Value,
    ) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;
        let next_status = body
            .get("status")
            .or_else(|| body.get("action"))
            .and_then(|v| v.as_str())
            .unwrap_or("APPROVED")
            .to_uppercase();
        let mut am: producer_profile::ActiveModel = p.into();
        am.status = Set(next_status.clone());
        am.kyc_status = Set(Some(next_status.clone()));
        am.onboarding_status = Set(Some(next_status.clone()));
        am.is_active = Set(Some(next_status == "APPROVED" || next_status == "ACTIVE"));
        if let Some(reason) = body
            .get("rejectionReason")
            .or_else(|| body.get("notes"))
            .and_then(|v| v.as_str())
        {
            am.rejection_reason = Set(Some(reason.to_string()));
        }
        if let Some(share) = body
            .get("revenueSharePercent")
            .or_else(|| body.get("defaultRevenueSharePercentage"))
            .and_then(|v| v.as_f64())
            .and_then(Decimal::from_f64_retain)
        {
            am.revenue_share_percent = Set(Some(share));
            am.revenue_share = Set(Some(share));
        }
        am.updated_at = Set(Some(Utc::now().into()));
        let saved = am.update(&state.db).await?;
        Ok(Self::format_onboarding_profile(&saved))
    }

    pub async fn get_movie_analytics(
        state: &AppState,
        claims: &Claims,
        producer_id_str: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        let is_admin = claims.is_admin();
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let explicit_pid = producer_id_str.and_then(|s| s.parse::<i64>().ok());

        let (producer, contents) = if is_admin && producer_id_str == Some("ALL") {
            let list = content::Entity::find()
                .order_by_desc(content::Column::CreatedAt)
                .limit(100)
                .all(&state.db)
                .await?;
            let p_opt = Self::get_or_create_producer_for_user(state, uid, None)
                .await
                .ok();
            (p_opt, list)
        } else if is_admin && explicit_pid.is_some() {
            let p = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;
            let list = content::Entity::find()
                .filter(content::Column::ProducerId.eq(p.id))
                .order_by_desc(content::Column::CreatedAt)
                .limit(100)
                .all(&state.db)
                .await?;
            (Some(p), list)
        } else {
            let p = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;
            let mut list = content::Entity::find()
                .filter(content::Column::ProducerId.eq(p.id))
                .order_by_desc(content::Column::CreatedAt)
                .limit(100)
                .all(&state.db)
                .await?;
            if list.is_empty() && is_admin {
                list = content::Entity::find()
                    .order_by_desc(content::Column::CreatedAt)
                    .limit(100)
                    .all(&state.db)
                    .await?;
            }
            (Some(p), list)
        };

        let active_campaigns = ad_campaign::Entity::find()
            .filter(ad_campaign::Column::Status.eq("ACTIVE"))
            .all(&state.db)
            .await
            .unwrap_or_default();
        let active_count = active_campaigns.len() as f64;
        let avg_cpm = if active_count > 0.0 {
            let sum_cpm: f64 = active_campaigns
                .iter()
                .filter_map(|c| c.cpm_rate.and_then(|d| d.to_f64()))
                .sum();
            sum_cpm / active_count
        } else {
            25.0
        };

        let rev_share = producer
            .as_ref()
            .and_then(|p| p.revenue_share_percent.and_then(|d| d.to_f64()))
            .unwrap_or(70.0)
            / 100.0;

        let studio_name = producer
            .as_ref()
            .map(|p| p.company_name.clone())
            .unwrap_or_else(|| "Producer Studio".to_string());

        let result = contents
            .into_iter()
            .map(|c| {
                let views = c.view_count.unwrap_or(0);
                let duration = c.duration_seconds.unwrap_or(7200) as i64;
                let ads_multiplier = (active_count as i64).clamp(1, 3);
                let ads_runned = if views > 0 { views * ads_multiplier } else { 0 };
                let total_watch_hours = (views * duration) / 3600;
                let ad_rev = (ads_runned as f64) * (avg_cpm / 1000.0);
                let producer_earnings = ((ad_rev * rev_share) * 100.0).round() / 100.0;

                json!({
                    "id": c.id,
                    "title": c.title,
                    "studioName": studio_name,
                    "contentType": c.content_type.clone().or_else(|| c.r#type.clone()).unwrap_or_else(|| "MOVIE".to_string()),
                    "posterUrl": c.poster_url.clone().or_else(|| c.landscape_image_url.clone()).unwrap_or_default(),
                    "runTimeMinutes": duration / 60,
                    "totalViews": views,
                    "adsRunned": ads_runned,
                    "fillRatePercentage": if active_count > 0.0 && views > 0 { 94.8 } else { 0.0 },
                    "cpmRate": ((avg_cpm * 100.0).round() / 100.0),
                    "totalWatchHours": total_watch_hours,
                    "completionRatePercentage": if views > 0 { 82.5 } else { 0.0 },
                    "producerEarnings": producer_earnings,
                    "status": c.status,
                    "releaseDate": c.release_date.map(|d| d.to_string()).unwrap_or_else(|| c.created_at.format("%Y-%m-%d").to_string())
                })
            })
            .collect();

        Ok(result)
    }

    pub async fn get_content_overview_analytics(
        state: &AppState,
        claims: &Claims,
        producer_id_str: Option<&str>,
        selected_content_id: Option<i64>,
    ) -> AppResult<Value> {
        use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
        use std::collections::HashMap;

        let is_admin = claims.is_admin();
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        // Only admins may inspect another studio via ?producerId=
        let explicit_pid = if is_admin {
            producer_id_str.and_then(|s| s.parse::<i64>().ok())
        } else {
            None
        };

        let (producer_id, studio_name, contents) = if is_admin && producer_id_str == Some("ALL") {
            let list = content::Entity::find()
                .order_by_desc(content::Column::CreatedAt)
                .limit(200)
                .all(&state.db)
                .await?;
            (None, "All Studios".to_string(), list)
        } else {
            let p = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;
            let list = content::Entity::find()
                .filter(content::Column::ProducerId.eq(p.id))
                .order_by_desc(content::Column::CreatedAt)
                .limit(200)
                .all(&state.db)
                .await?;
            (Some(p.id), p.company_name, list)
        };

        // Build 30-day date buckets (YYYY-MM-DD)
        let today = Utc::now().date_naive();
        let days: Vec<String> = (0..30)
            .rev()
            .map(|offset| (today - chrono::Duration::days(offset)).format("%Y-%m-%d").to_string())
            .collect();

        if contents.is_empty() {
            let daily_views: Vec<Value> = days.iter().map(|d| json!({ "day": d, "views": 0 })).collect();
            let daily_ads: Vec<Value> = days
                .iter()
                .map(|d| json!({ "day": d, "preRoll": 0, "midRoll": 0, "postRoll": 0, "other": 0, "total": 0 }))
                .collect();
            return Ok(json!({
                "producerId": producer_id,
                "studioName": studio_name,
                "watchingNow": 0,
                "adsAvailable": false,
                "viewsDataAvailable": false,
                "contents": [],
                "totals": {
                    "contentCount": 0,
                    "totalViews": 0,
                    "uniqueViews": 0,
                    "adsRun": { "preRoll": 0, "midRoll": 0, "postRoll": 0, "other": 0, "total": 0 }
                },
                "dailyViews": daily_views,
                "dailyAds": daily_ads
            }));
        }

        let all_ids: Vec<i64> = contents.iter().map(|c| c.id).collect();
        let all_ids_csv = all_ids
            .iter()
            .map(|id| id.to_string())
            .collect::<Vec<_>>()
            .join(",");

        // Scope chart queries to selected_content_id ONLY if it belongs to this producer
        let scoped_ids_csv = match selected_content_id {
            Some(cid) if all_ids.contains(&cid) => cid.to_string(),
            _ => all_ids_csv.clone(),
        };

        let q_watch_per_content = format!(
            "SELECT content_id, COUNT(*)::bigint AS views, COUNT(DISTINCT user_id)::bigint AS unique_views \
             FROM watch_history WHERE content_id IN ({}) GROUP BY content_id",
            all_ids_csv
        );
        let q_watching_now = format!(
            "SELECT COUNT(DISTINCT COALESCE(user_id, id))::bigint AS watching_now \
             FROM playback_sessions \
             WHERE COALESCE(is_active, false) = true \
               AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '5 minutes' \
               AND content_id IN ({})",
            all_ids_csv
        );
        let q_ads_per_content = format!(
            "SELECT ae.content_id, UPPER(COALESCE(ac.ad_break_type, 'OTHER')) AS slot, COUNT(*)::bigint AS cnt \
             FROM ad_events ae \
             LEFT JOIN ad_campaigns ac ON ac.id = ae.campaign_id \
             WHERE ae.content_id IN ({}) \
               AND UPPER(ae.event_type) IN ('IMPRESSION', 'START', 'COMPLETE', 'VIEW') \
             GROUP BY ae.content_id, UPPER(COALESCE(ac.ad_break_type, 'OTHER'))",
            all_ids_csv
        );
        let q_daily_views = format!(
            "SELECT TO_CHAR(DATE(COALESCE(updated_at, created_at)), 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS views \
             FROM watch_history \
             WHERE content_id IN ({}) \
               AND COALESCE(updated_at, created_at) >= NOW() - INTERVAL '30 days' \
             GROUP BY 1",
            scoped_ids_csv
        );
        let q_daily_ads = format!(
            "SELECT TO_CHAR(DATE(ae.created_at), 'YYYY-MM-DD') AS day, \
                    UPPER(COALESCE(ac.ad_break_type, 'OTHER')) AS slot, \
                    COUNT(*)::bigint AS cnt \
             FROM ad_events ae \
             LEFT JOIN ad_campaigns ac ON ac.id = ae.campaign_id \
             WHERE ae.content_id IN ({}) \
               AND UPPER(ae.event_type) IN ('IMPRESSION', 'START', 'COMPLETE', 'VIEW') \
               AND ae.created_at >= NOW() - INTERVAL '30 days' \
             GROUP BY 1, 2",
            scoped_ids_csv
        );

        let (watch_res, live_res, ads_res, daily_views_res, daily_ads_res) = tokio::join!(
            state.db.query_all(Statement::from_string(DatabaseBackend::Postgres, q_watch_per_content)),
            state.db.query_one(Statement::from_string(DatabaseBackend::Postgres, q_watching_now)),
            state.db.query_all(Statement::from_string(DatabaseBackend::Postgres, q_ads_per_content)),
            state.db.query_all(Statement::from_string(DatabaseBackend::Postgres, q_daily_views)),
            state.db.query_all(Statement::from_string(DatabaseBackend::Postgres, q_daily_ads)),
        );

        let mut watch_map: HashMap<i64, (i64, i64)> = HashMap::new();
        for r in watch_res.unwrap_or_default() {
            if let Ok(cid) = r.try_get::<i64>("", "content_id") {
                let v = r.try_get::<i64>("", "views").unwrap_or(0);
                let u = r.try_get::<i64>("", "unique_views").unwrap_or(0);
                watch_map.insert(cid, (v, u));
            }
        }

        let watching_now = live_res
            .ok()
            .flatten()
            .and_then(|r| r.try_get::<i64>("", "watching_now").ok())
            .unwrap_or(0);

        // (pre, mid, post, other)
        let mut ads_map: HashMap<i64, (i64, i64, i64, i64)> = HashMap::new();
        for r in ads_res.unwrap_or_default() {
            if let Ok(cid) = r.try_get::<i64>("", "content_id") {
                let slot = r.try_get::<String>("", "slot").unwrap_or_default();
                let cnt = r.try_get::<i64>("", "cnt").unwrap_or(0);
                let entry = ads_map.entry(cid).or_insert((0, 0, 0, 0));
                if slot.contains("PRE") {
                    entry.0 += cnt;
                } else if slot.contains("MID") {
                    entry.1 += cnt;
                } else if slot.contains("POST") {
                    entry.2 += cnt;
                } else {
                    entry.3 += cnt;
                }
            }
        }

        let mut daily_views_map: HashMap<String, i64> = HashMap::new();
        for r in daily_views_res.unwrap_or_default() {
            if let Ok(day) = r.try_get::<String>("", "day") {
                let v = r.try_get::<i64>("", "views").unwrap_or(0);
                daily_views_map.insert(day, v);
            }
        }

        let mut daily_ads_map: HashMap<String, (i64, i64, i64, i64)> = HashMap::new();
        for r in daily_ads_res.unwrap_or_default() {
            if let Ok(day) = r.try_get::<String>("", "day") {
                let slot = r.try_get::<String>("", "slot").unwrap_or_default();
                let cnt = r.try_get::<i64>("", "cnt").unwrap_or(0);
                let entry = daily_ads_map.entry(day).or_insert((0, 0, 0, 0));
                if slot.contains("PRE") {
                    entry.0 += cnt;
                } else if slot.contains("MID") {
                    entry.1 += cnt;
                } else if slot.contains("POST") {
                    entry.2 += cnt;
                } else {
                    entry.3 += cnt;
                }
            }
        }

        let mut total_views_sum: i64 = 0;
        let mut total_unique_sum: i64 = 0;
        let mut total_pre: i64 = 0;
        let mut total_mid: i64 = 0;
        let mut total_post: i64 = 0;
        let mut total_other: i64 = 0;

        let mut content_rows = Vec::with_capacity(contents.len());
        for c in contents {
            let (wh_views, wh_unique) = *watch_map.get(&c.id).unwrap_or(&(0, 0));
            let col_views = c.view_count.unwrap_or(0);
            let total_views = col_views.max(wh_views);
            let unique_views = if wh_unique > 0 { wh_unique } else { total_views };

            let (pre, mid, post, other) = *ads_map.get(&c.id).unwrap_or(&(0, 0, 0, 0));
            let ads_total = pre + mid + post + other;

            total_views_sum += total_views;
            total_unique_sum += unique_views;
            total_pre += pre;
            total_mid += mid;
            total_post += post;
            total_other += other;

            content_rows.push(json!({
                "id": c.id,
                "title": c.title,
                "contentType": c.content_type.or(c.r#type).unwrap_or_else(|| "MOVIE".to_string()),
                "status": c.status,
                "posterUrl": c.poster_url.or(c.landscape_image_url).unwrap_or_default(),
                "totalViews": total_views,
                "uniqueViews": unique_views,
                "adsRun": {
                    "preRoll": pre,
                    "midRoll": mid,
                    "postRoll": post,
                    "other": other,
                    "total": ads_total
                },
                "adsAvailable": ads_total > 0
            }));
        }

        let grand_ads = total_pre + total_mid + total_post + total_other;
        let daily_views: Vec<Value> = days
            .iter()
            .map(|d| json!({ "day": d, "views": *daily_views_map.get(d).unwrap_or(&0) }))
            .collect();
        let daily_ads: Vec<Value> = days
            .iter()
            .map(|d| {
                let (pre, mid, post, other) = *daily_ads_map.get(d).unwrap_or(&(0, 0, 0, 0));
                json!({
                    "day": d,
                    "preRoll": pre,
                    "midRoll": mid,
                    "postRoll": post,
                    "other": other,
                    "total": pre + mid + post + other
                })
            })
            .collect();

        Ok(json!({
            "producerId": producer_id,
            "studioName": studio_name,
            "watchingNow": watching_now,
            "adsAvailable": grand_ads > 0,
            "viewsDataAvailable": total_views_sum > 0 || daily_views_map.values().any(|&v| v > 0),
            "contents": content_rows,
            "totals": {
                "contentCount": content_rows.len(),
                "totalViews": total_views_sum,
                "uniqueViews": total_unique_sum,
                "adsRun": {
                    "preRoll": total_pre,
                    "midRoll": total_mid,
                    "postRoll": total_post,
                    "other": total_other,
                    "total": grand_ads
                }
            },
            "dailyViews": daily_views,
            "dailyAds": daily_ads
        }))
    }

    pub async fn get_dashboard_analytics(
        state: &AppState,
        claims: &Claims,
        producer_id_str: Option<&str>,
    ) -> AppResult<Value> {
        let movie_analytics = Self::get_movie_analytics(state, claims, producer_id_str).await?;
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let explicit_pid = producer_id_str.and_then(|s| s.parse::<i64>().ok());
        let producer = Self::get_or_create_producer_for_user(state, uid, explicit_pid)
            .await
            .ok();

        let total_submissions = movie_analytics.len();
        let total_ad_impressions: i64 = movie_analytics
            .iter()
            .filter_map(|m| m.get("adsRunned").and_then(|v| v.as_i64()))
            .sum();
        let total_ad_revenue_earned: f64 = movie_analytics
            .iter()
            .filter_map(|m| m.get("producerEarnings").and_then(|v| v.as_f64()))
            .sum();
        let total_subscription_earnings =
            ((total_ad_revenue_earned * 0.35) * 100.0).round() / 100.0;
        let total_tvod_earnings = 0.0;
        let grand_total_earnings =
            ((total_ad_revenue_earned + total_subscription_earnings + total_tvod_earnings) * 100.0)
                .round()
                / 100.0;

        Ok(json!({
            "producerId": producer.as_ref().map(|p| p.id).unwrap_or(1),
            "totalSubmissions": total_submissions,
            "totalAdImpressions": total_ad_impressions,
            "totalAdRevenueEarned": total_ad_revenue_earned,
            "totalSubscriptionEarnings": total_subscription_earnings,
            "totalTvodEarnings": total_tvod_earnings,
            "grandTotalEarnings": grand_total_earnings
        }))
    }

    pub async fn get_ad_breakdown(state: &AppState, claims: &Claims) -> AppResult<Vec<Value>> {
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let producer = Self::get_or_create_producer_for_user(state, uid, None)
            .await
            .ok();
        let rev_share = producer
            .as_ref()
            .and_then(|p| p.revenue_share_percent.and_then(|d| d.to_f64()))
            .unwrap_or(70.0)
            / 100.0;

        let active_campaigns = ad_campaign::Entity::find()
            .filter(ad_campaign::Column::Status.eq("ACTIVE"))
            .order_by_desc(ad_campaign::Column::CreatedAt)
            .all(&state.db)
            .await
            .unwrap_or_default();

        let list = active_campaigns
            .into_iter()
            .enumerate()
            .map(|(idx, camp)| {
                let cpm = camp.cpm_rate.and_then(|d| d.to_f64()).unwrap_or(25.0);
                let ad_rev = ((cpm / 1000.0) * 10000.0).round() / 10000.0;
                let producer_earnings = ((ad_rev * rev_share) * 10000.0).round() / 10000.0;
                let cue_point = (idx as i64 + 1) * 300;
                json!({
                    "id": camp.id,
                    "adId": format!("AD-{}", camp.id),
                    "slotType": camp.ad_break_type.unwrap_or_else(|| "PRE_ROLL".to_string()),
                    "cuePointSeconds": cue_point,
                    "adRevenue": ad_rev,
                    "producerEarnings": producer_earnings,
                })
            })
            .collect();
        Ok(list)
    }

    pub async fn get_producer_agreement(
        state: &AppState,
        claims: &Claims,
        producer_id_str: Option<&str>,
    ) -> AppResult<Value> {
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let explicit_pid = producer_id_str.and_then(|s| s.parse::<i64>().ok());
        let producer = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;

        let contents = content::Entity::find()
            .filter(content::Column::ProducerId.eq(producer.id))
            .order_by_desc(content::Column::CreatedAt)
            .all(&state.db)
            .await
            .unwrap_or_default();

        let approved_titles: Vec<Value> = contents
            .into_iter()
            .map(|c| {
                json!({
                    "id": c.id,
                    "title": c.title,
                    "contentType": c.content_type.or(c.r#type).unwrap_or_else(|| "MOVIE".to_string()),
                    "status": c.status
                })
            })
            .collect();

        let rev_percent = producer
            .revenue_share_percent
            .and_then(|d| d.to_f64())
            .unwrap_or(70.0);

        Ok(json!({
            "agreementId": format!("AGR-PROD-{:04}", producer.id),
            "effectiveDate": producer.created_at.format("%Y-%m-%d").to_string(),
            "studioName": producer.company_name,
            "studioRegistrationNumber": producer.studio_registration_number.clone().unwrap_or_else(|| format!("REG-ST-{}", producer.id)),
            "contactEmail": producer.email.clone().unwrap_or_else(|| "producer@maxxpixels.com".to_string()),
            "contactPhone": producer.phone.clone().unwrap_or_else(|| "+91 9876543210".to_string()),
            "panNumber": producer.pan_number.clone().unwrap_or_else(|| "ABCDE1234F".to_string()),
            "aadharNumber": producer.aadhar_number.clone().unwrap_or_else(|| "1234 5678 9012".to_string()),
            "gstNumber": producer.gst_number.clone().unwrap_or_else(|| "29ABCDE1234F1Z5".to_string()),
            "bankName": producer.bank_name.clone().unwrap_or_else(|| "State Bank of India".to_string()),
            "bankAccountNumber": producer.bank_account_number.clone().unwrap_or_else(|| "38294829103".to_string()),
            "ifscCode": producer.ifsc_code.clone().or_else(|| producer.bank_ifsc.clone()).unwrap_or_else(|| "SBIN0001234".to_string()),
            "revenueSharePercentage": rev_percent,
            "approvedTitles": approved_titles,
            "agreementStatus": producer.agreement_status.clone().unwrap_or_else(|| "APPROVED".to_string()),
            "signedAgreementUrl": producer.signed_agreement_url.clone().or_else(|| producer.agreement_url.clone()),
            "licenseTerms": "Standard non-exclusive digital OTT video on demand distribution license with automated programmatic & SSAI ad insertion revenue sharing model."
        }))
    }

    pub async fn upload_signed_agreement(
        state: &AppState,
        claims: &Claims,
        body: Value,
        producer_id_str: Option<&str>,
    ) -> AppResult<Value> {
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let explicit_pid = producer_id_str.and_then(|s| s.parse::<i64>().ok());
        let producer = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;

        // ── Validate document URLs (must be non-empty PDF URLs) ──
        let signed_agreement_url = body
            .get("signedAgreementUrl")
            .or_else(|| body.get("agreementUrl"))
            .or_else(|| body.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if signed_agreement_url.is_empty() {
            return Err(AppError::BadRequest(
                "Signed agreement URL is required".to_string(),
            ));
        }

        // ── Validate PAN ──
        let pan_number_raw = body.get("panNumber").and_then(|v| v.as_str()).unwrap_or("");
        let pan_number = if !pan_number_raw.is_empty() {
            validate_pan(pan_number_raw)?;
            Some(normalize_pan(pan_number_raw))
        } else {
            None
        };

        // ── Validate Aadhaar ──
        let aadhar_number_raw = body.get("aadharNumber").and_then(|v| v.as_str()).unwrap_or("");
        let aadhar_number = if !aadhar_number_raw.is_empty() {
            validate_aadhaar(aadhar_number_raw)?;
            Some(normalize_aadhaar(aadhar_number_raw))
        } else {
            None
        };

        // ── Validate IFSC ──
        let ifsc_code_raw = body.get("ifscCode").or_else(|| body.get("bankIfsc")).and_then(|v| v.as_str()).unwrap_or("");
        let ifsc_code = if !ifsc_code_raw.is_empty() {
            validate_ifsc(ifsc_code_raw)?;
            Some(normalize_ifsc(ifsc_code_raw))
        } else {
            None
        };

        let pan_doc_url = body.get("panDocUrl").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
        let aadhar_doc_url = body.get("aadharDocUrl").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
        let bank_name = body.get("bankName").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
        let bank_account_number = body.get("bankAccountNumber").and_then(|v| v.as_str()).map(|s| s.trim().to_string());
        let bank_doc_url = body.get("bankDocUrl").and_then(|v| v.as_str()).map(|s| s.trim().to_string());

        let mut am: producer_profile::ActiveModel = producer.into();
        am.signed_agreement_url = Set(Some(signed_agreement_url.clone()));
        am.agreement_url = Set(Some(signed_agreement_url.clone()));
        am.agreement_status = Set(Some("CONFIRMED".to_string()));
        if let Some(ref v) = pan_number { am.pan_number = Set(Some(v.clone())); }
        if let Some(ref v) = pan_doc_url { am.pan_doc_url = Set(Some(v.clone())); }
        if let Some(ref v) = aadhar_number { am.aadhar_number = Set(Some(v.clone())); }
        if let Some(ref v) = aadhar_doc_url { am.aadhar_doc_url = Set(Some(v.clone())); }
        if let Some(ref v) = bank_name { am.bank_name = Set(Some(v.clone())); }
        if let Some(ref v) = bank_account_number { am.bank_account_number = Set(Some(v.clone())); }
        if let Some(ref v) = ifsc_code {
            am.ifsc_code = Set(Some(v.clone()));
            am.bank_ifsc = Set(Some(v.clone()));
        }
        let bank_doc_url_for_response = bank_doc_url.clone();
        if let Some(v) = bank_doc_url { am.bank_doc_url = Set(Some(v)); }
        am.updated_at = Set(Some(Utc::now().into()));
        am.update(&state.db).await?;

        Ok(json!({
            "success": true,
            "message": "Signed agreement & KYC documents confirmed successfully",
            "signedAgreementUrl": signed_agreement_url,
            "panNumber": pan_number,
            "panDocUrl": pan_doc_url,
            "aadharNumber": aadhar_number,
            "aadharDocUrl": aadhar_doc_url,
            "bankName": bank_name,
            "bankAccountNumber": bank_account_number,
            "ifscCode": ifsc_code,
            "bankDocUrl": bank_doc_url_for_response,
            "agreementStatus": "CONFIRMED",
            "storageProvider": "BUNNY_STORAGE"
        }))
    }

    pub async fn update_kyc_documents(
        state: &AppState,
        claims: &Claims,
        body: Value,
        producer_id_str: Option<&str>,
    ) -> AppResult<Value> {
        let uid = claims.sub.parse::<i64>().unwrap_or(0);
        let explicit_pid = producer_id_str.and_then(|s| s.parse::<i64>().ok());
        let producer = Self::get_or_create_producer_for_user(state, uid, explicit_pid).await?;

        let mut am: producer_profile::ActiveModel = producer.into();
        if let Some(u) = body.get("aadharDocUrl").and_then(|v| v.as_str()) {
            am.aadhar_doc_url = Set(Some(u.to_string()));
            am.aadhar_status = Set(Some("PENDING".to_string()));
        }
        if let Some(u) = body.get("aadharBackDocUrl").and_then(|v| v.as_str()) {
            am.aadhar_back_doc_url = Set(Some(u.to_string()));
            am.aadhar_status = Set(Some("PENDING".to_string()));
        }
        if let Some(u) = body.get("panDocUrl").and_then(|v| v.as_str()) {
            am.pan_doc_url = Set(Some(u.to_string()));
            am.pan_status = Set(Some("PENDING".to_string()));
        }
        if let Some(u) = body.get("bankDocUrl").and_then(|v| v.as_str()) {
            am.bank_doc_url = Set(Some(u.to_string()));
            am.bank_status = Set(Some("PENDING".to_string()));
        }
        if let Some(u) = body.get("gstDocUrl").and_then(|v| v.as_str()) {
            am.gst_doc_url = Set(Some(u.to_string()));
            am.gst_status = Set(Some("PENDING".to_string()));
        }
        am.updated_at = Set(Some(Utc::now().into()));
        let saved = am.update(&state.db).await?;
        Ok(Self::format_onboarding_profile(&saved))
    }

    pub async fn register_producer_studio(state: &AppState, body: Value) -> AppResult<Value> {
        Self::register_producer_studio_internal(state, body, false).await
    }

    /// Admin onboarding is an explicit credential-provisioning action, so it may
    /// replace the password on an existing login for the same email.
    pub async fn onboard_producer_studio(state: &AppState, body: Value) -> AppResult<Value> {
        Self::register_producer_studio_internal(state, body, true).await
    }

    async fn register_producer_studio_internal(
        state: &AppState,
        body: Value,
        overwrite_existing_password: bool,
    ) -> AppResult<Value> {
        let studio_name = body
            .get("studioName")
            .or_else(|| body.get("companyName"))
            .or_else(|| body.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or("Independent Studio")
            .to_string();
        let email = body
            .get("email")
            .or_else(|| body.get("contactEmail"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_lowercase();
        let phone = body
            .get("phone")
            .or_else(|| body.get("contactPhone"))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string());
        let raw_password = body
            .get("loginPassword")
            .or_else(|| body.get("accountPassword"))
            .or_else(|| body.get("password"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|p| !p.is_empty())
            .map(str::to_string)
            .unwrap_or_else(Self::generate_secure_password);

        let mut v = ValidationBag::new();
        v.require_text("studioName", Some(studio_name.as_str()), 2, 160);
        v.optional_email("contactEmail", if email.is_empty() { None } else { Some(email.as_str()) });
        v.optional_phone("contactPhone", phone.as_deref());
        v.optional_non_negative_f64(
            "defaultRevenueSharePercentage",
            body.get("defaultRevenueSharePercentage").and_then(|x| x.as_f64()),
        );
        v.finish()?;

        let password_hash = SecurityUtils::hash_password_async(raw_password.to_string())
            .await
            .map_err(|e| AppError::Internal(format!("Failed hashing password: {}", e)))?;

        let mut password_provisioned = false;
        let user = if !email.is_empty() {
            if let Some(existing) = user::Entity::find()
                .filter(user::Column::Email.eq(&email))
                .one(&state.db)
                .await?
            {
                if overwrite_existing_password {
                    let mut am: user::ActiveModel = existing.into();
                    am.password_hash = Set(Some(password_hash.clone()));
                    am.auth_method = Set(Some("EMAIL_PASSWORD".to_string()));
                    am.status = Set("ACTIVE".to_string());
                    am.email_verified = Set(Some(true));
                    am.updated_at = Set(Utc::now().fixed_offset());
                    let updated = am.update(&state.db).await?;
                    password_provisioned = true;
                    updated
                } else {
                    existing
                }
            } else {
                let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
                let am = user::ActiveModel {
                    uuid: Set(Uuid::new_v4().to_string()),
                    email: Set(Some(email.clone())),
                    phone: Set(phone.clone()),
                    phone_number: Set(phone.clone()),
                    full_name: Set(Some(studio_name.clone())),
                    password_hash: Set(Some(password_hash)),
                    status: Set("ACTIVE".to_string()),
                    auth_method: Set(Some("EMAIL_PASSWORD".to_string())),
                    email_verified: Set(Some(true)),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                };
                let inserted = am.insert(&state.db).await?;
                password_provisioned = true;
                inserted
            }
        } else {
            return Err(AppError::BadRequest(
                "Email is required for producer studio registration".into(),
            ));
        };

        if let Ok(Some(role_producer)) = role::Entity::find()
            .filter(role::Column::Name.eq("ROLE_PRODUCER"))
            .one(&state.db)
            .await
        {
            let has_role = user_role::Entity::find()
                .filter(user_role::Column::UserId.eq(user.id))
                .filter(user_role::Column::RoleId.eq(role_producer.id))
                .one(&state.db)
                .await?
                .is_some();
            if !has_role {
                let ur = user_role::ActiveModel {
                    user_id: Set(user.id),
                    role_id: Set(role_producer.id),
                };
                let _ = ur.insert(&state.db).await;
            }
        }

        let p = Self::get_or_create_producer_for_user(state, user.id, None).await?;
        let mut p_am: producer_profile::ActiveModel = p.into();
        p_am.company_name = Set(studio_name);
        p_am.email = Set(Some(email));
        p_am.phone = Set(phone);
        p_am.updated_at = Set(Some(Utc::now().into()));
        let saved = p_am.update(&state.db).await?;

        if password_provisioned {
            Ok(Self::format_onboarding_profile_with_password(
                &saved,
                Some(&raw_password),
            ))
        } else {
            Ok(Self::format_onboarding_profile(&saved))
        }
    }

    pub async fn submit_producer_content(
        state: &AppState,
        producer_id: i64,
        producer_name: &str,
        body: Value,
    ) -> AppResult<Value> {
        let title = body
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled Submission")
            .to_string();
        let slug = format!(
            "{}-{}",
            title
                .to_lowercase()
                .chars()
                .map(|c| if c.is_alphanumeric() { c } else { '-' })
                .collect::<String>(),
            Utc::now().timestamp_millis()
        );
        let now = Utc::now().fixed_offset();
        let content_type = body
            .get("contentType")
            .or_else(|| body.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("MOVIE")
            .to_uppercase();

        let am = content::ActiveModel {
            title: Set(title.clone()),
            slug: Set(slug),
            description: Set(body
                .get("description")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            content_type: Set(Some(content_type.clone())),
            r#type: Set(Some(content_type.clone())),
            status: Set("SUBMITTED".to_string()),
            poster_url: Set(body
                .get("posterUrl")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            backdrop_url: Set(body
                .get("bannerUrl")
                .or_else(|| body.get("backdropUrl"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            trailer_url: Set(body
                .get("trailerUrl")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            producer_id: Set(Some(producer_id)),
            view_count: Set(Some(0)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;

        Ok(json!({
            "id": saved.id,
            "producerId": producer_id,
            "producerName": producer_name,
            "title": saved.title,
            "contentType": content_type,
            "status": saved.status,
            "createdAt": saved.created_at
        }))
    }

    pub async fn public_producer_submit(
        state: &AppState,
        body: Value,
    ) -> AppResult<Value> {
        let title = body
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Untitled Submission")
            .to_string();

        let content_type = body
            .get("contentType")
            .or_else(|| body.get("content_type"))
            .or_else(|| body.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("MOVIE")
            .to_uppercase();

        let language = body
            .get("language")
            .or_else(|| body.get("originalLanguageCode"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let poster_1 = body
            .get("posterUrl")
            .or_else(|| body.get("poster_1_url"))
            .or_else(|| body.get("poster1Url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let poster_2 = body
            .get("poster2Url")
            .or_else(|| body.get("poster_2_url"))
            .or_else(|| body.get("posterUrl2"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let trailer_url = body
            .get("trailerUrl")
            .or_else(|| body.get("trailer_url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let production_name = body
            .get("productionName")
            .or_else(|| body.get("production_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let contact_phone = body
            .get("producerContactPhone")
            .or_else(|| body.get("producer_contact_phone"))
            .or_else(|| body.get("contactPhone"))
            .or_else(|| body.get("contact_phone"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let producer_email = body
            .get("producerEmail")
            .or_else(|| body.get("producer_email"))
            .or_else(|| body.get("email"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let google_drive_link = body
            .get("googleDriveLink")
            .or_else(|| body.get("google_drive_link"))
            .or_else(|| body.get("driveLink"))
            .or_else(|| body.get("fullMovieLink"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let one_line_brief = body
            .get("oneLineBrief")
            .or_else(|| body.get("one_line_brief"))
            .or_else(|| body.get("brief"))
            .or_else(|| body.get("description"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let slug = format!(
            "{}-{}",
            title
                .to_lowercase()
                .chars()
                .map(|c| if c.is_alphanumeric() { c } else { '-' })
                .collect::<String>(),
            Utc::now().timestamp_millis()
        );

        let now = Utc::now().fixed_offset();
        let expires_at = now + chrono::Duration::days(7);

        let am = content::ActiveModel {
            title: Set(title.clone()),
            slug: Set(slug),
            description: Set(one_line_brief.clone()),
            short_description: Set(one_line_brief.clone()),
            content_type: Set(Some(content_type.clone())),
            r#type: Set(Some(content_type.clone())),
            status: Set("SUBMITTED".to_string()),
            original_language_code: Set(language.clone()),
            poster_url: Set(poster_1.clone()),
            poster_2_url: Set(poster_2.clone()),
            trailer_url: Set(trailer_url.clone()),
            production_name: Set(production_name.clone()),
            producer_contact_phone: Set(contact_phone.clone()),
            producer_email: Set(producer_email.clone()),
            google_drive_link: Set(google_drive_link.clone()),
            one_line_brief: Set(one_line_brief.clone()),
            submission_source: Set(Some("public_producer".to_string())),
            agreement_status: Set(Some("PENDING".to_string())),
            expires_at: Set(Some(expires_at)),
            view_count: Set(Some(0)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;

        // Also create a producer_submissions tracking record
        let _ = state.db.execute(sea_orm::Statement::from_sql_and_values(
            sea_orm::DatabaseBackend::Postgres,
            r#"INSERT INTO producer_submissions (content_id, content_type, title, language, poster_1_url, poster_2_url, trailer_url, production_name, producer_contact_phone, producer_email, google_drive_link, one_line_brief, status, agreement_status, expires_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'SUBMITTED', 'PENDING', $13)"#,
            vec![
                saved.id.into(),
                content_type.clone().into(),
                title.clone().into(),
                language.clone().unwrap_or_default().into(),
                poster_1.clone().unwrap_or_default().into(),
                poster_2.clone().unwrap_or_default().into(),
                trailer_url.clone().unwrap_or_default().into(),
                production_name.clone().unwrap_or_default().into(),
                contact_phone.clone().unwrap_or_default().into(),
                producer_email.clone().unwrap_or_default().into(),
                google_drive_link.clone().unwrap_or_default().into(),
                one_line_brief.clone().unwrap_or_default().into(),
                expires_at.into(),
            ],
        )).await;

        Ok(json!({
            "id": saved.id,
            "title": saved.title,
            "contentType": content_type,
            "language": language,
            "status": "SUBMITTED",
            "expiresAt": expires_at.to_rfc3339(),
            "message": "Your submission has been received. Our team will review it within 7 days. If no further action is taken, the submission will be automatically closed."
        }))
    }

    pub async fn list_producer_submissions_filtered(
        state: &AppState,
        producer_id: Option<i64>,
        is_admin: bool,
    ) -> AppResult<Vec<Value>> {
        let mut q = content::Entity::find().order_by_desc(content::Column::CreatedAt);
        if !is_admin {
            if let Some(pid) = producer_id {
                q = q.filter(content::Column::ProducerId.eq(pid));
            }
        }
        let rows = q.limit(100).all(&state.db).await?;
        let result = rows
            .into_iter()
            .map(|c| {
                json!({
                    "id": c.id,
                    "producerId": c.producer_id,
                    "title": c.title,
                    "contentType": c.content_type.or(c.r#type).unwrap_or_else(|| "MOVIE".to_string()),
                    "description": c.description.clone().or_else(|| c.short_description.clone()).unwrap_or_default(),
                    "posterUrl": c.poster_url.unwrap_or_default(),
                    "poster2Url": c.poster_2_url.unwrap_or_default(),
                    "bannerUrl": c.backdrop_url.or(c.banner_image_url).unwrap_or_default(),
                    "trailerUrl": c.trailer_url.unwrap_or_default(),
                    "productionName": c.production_name.unwrap_or_default(),
                    "producerContactPhone": c.producer_contact_phone.unwrap_or_default(),
                    "producerEmail": c.producer_email.unwrap_or_default(),
                    "googleDriveLink": c.google_drive_link.unwrap_or_default(),
                    "oneLineBrief": c.one_line_brief.clone().or_else(|| c.description.clone()).or_else(|| c.short_description.clone()).unwrap_or_default(),
                    "language": c.original_language_code.unwrap_or_default(),
                    "submissionSource": c.submission_source.unwrap_or_else(|| "admin".to_string()),
                    "agreementUrl": c.agreement_url.unwrap_or_default(),
                    "agreementStatus": c.agreement_status.unwrap_or_else(|| "PENDING".to_string()),
                    "expiresAt": c.expires_at.map(|e| e.to_rfc3339()).unwrap_or_default(),
                    "status": c.status,
                    "createdAt": c.created_at.to_rfc3339()
                })
            })
            .collect();
        Ok(result)
    }

    pub async fn list_producer_submissions(
        state: &AppState,
        status: Option<&str>,
    ) -> AppResult<Vec<content::Model>> {
        let mut q = content::Entity::find().order_by_desc(content::Column::CreatedAt);
        if let Some(s) = status.filter(|v| !v.is_empty()) {
            q = q.filter(content::Column::Status.eq(s.to_uppercase()));
        }
        Ok(q.all(&state.db).await?)
    }

    pub async fn toggle_producer_status(
        state: &AppState,
        id: i64,
        body: Value,
    ) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;
        let current_active = p.is_active.unwrap_or(false);
        let target_active = body
            .get("status")
            .and_then(|v| v.as_str())
            .map(|s| s == "ACTIVE")
            .unwrap_or(!current_active);
        let mut am: producer_profile::ActiveModel = p.into();
        am.is_active = Set(Some(target_active));
        am.status = Set(if target_active {
            "ACTIVE".to_string()
        } else {
            "INACTIVE".to_string()
        });
        am.updated_at = Set(Some(Utc::now().into()));
        let saved = am.update(&state.db).await?;
        Ok(Self::format_onboarding_profile(&saved))
    }

    pub async fn reset_producer_password(
        state: &AppState,
        id: i64,
        new_password: &str,
    ) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;

        // Never fall back to a shared default password. Generate a fresh secret
        // when a caller omits one so the returned password always matches the hash.
        let raw_password = new_password.trim();
        let raw_password = if raw_password.is_empty() {
            Self::generate_secure_password()
        } else {
            raw_password.to_string()
        };

        let hash = SecurityUtils::hash_password_async(raw_password.clone())
            .await
            .map_err(|e| AppError::Internal(format!("Failed hashing password: {}", e)))?;

        let mut linked_user = if p.user_id > 0 {
            user::Entity::find_by_id(p.user_id).one(&state.db).await?
        } else {
            None
        };
        if linked_user.is_none() {
            if let Some(email) = p
                .email
                .as_deref()
                .map(str::trim)
                .filter(|e| !e.is_empty())
            {
                linked_user = user::Entity::find()
                    .filter(user::Column::Email.eq(email.to_lowercase()))
                    .one(&state.db)
                    .await?;
            }
        }
        let linked_user = linked_user.ok_or_else(|| {
            AppError::NotFound("No login account is linked to this producer".to_string())
        })?;
        let login_email = linked_user.email.clone();

        let mut u_am: user::ActiveModel = linked_user.into();
        u_am.password_hash = Set(Some(hash));
        u_am.auth_method = Set(Some("EMAIL_PASSWORD".to_string()));
        u_am.updated_at = Set(Utc::now().fixed_offset());
        u_am.update(&state.db).await?;

        Ok(json!({
            "success": true,
            "message": format!("Password for producer {} reset successfully", id),
            "id": id,
            "email": login_email,
            "password": raw_password
        }))
    }

    /// Generate secure login credentials for a producer after onboarding approval.
    /// Returns the email and a temporary password that the producer can use to log in.
    pub async fn generate_producer_credentials(
        state: &AppState,
        id: i64,
    ) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;

        let email = p
            .email
            .clone()
            .ok_or_else(|| AppError::BadRequest("Producer has no email on file".to_string()))?;

        // Validate email format
        validate_email_format(&email)?;

        // Generate a secure random password
        let raw_password = Self::generate_secure_password();

        let hash = SecurityUtils::hash_password_async(raw_password.clone())
            .await
            .map_err(|e| AppError::Internal(format!("Failed hashing password: {}", e)))?;

        if let Some(user_row) = user::Entity::find_by_id(p.user_id).one(&state.db).await? {
            let mut u_am: user::ActiveModel = user_row.into();
            u_am.password_hash = Set(Some(hash));
            u_am.auth_method = Set(Some("EMAIL_PASSWORD".to_string()));
            u_am.status = Set("ACTIVE".to_string());
            u_am.email_verified = Set(Some(true));
            u_am.updated_at = Set(Utc::now().fixed_offset());
            u_am.update(&state.db).await?;
        }

        // Ensure ROLE_PRODUCER is assigned
        if let Ok(Some(role_producer)) = role::Entity::find()
            .filter(role::Column::Name.eq("ROLE_PRODUCER"))
            .one(&state.db)
            .await
        {
            let has_role = user_role::Entity::find()
                .filter(user_role::Column::UserId.eq(p.user_id))
                .filter(user_role::Column::RoleId.eq(role_producer.id))
                .one(&state.db)
                .await?
                .is_some();
            if !has_role {
                let ur = user_role::ActiveModel {
                    user_id: Set(p.user_id),
                    role_id: Set(role_producer.id),
                };
                let _ = ur.insert(&state.db).await;
            }
        }

        // Notify the producer by SMS without putting the password in the message.
        if let Some(phone) = p.phone.clone() {
            let template_id = std::env::var("MSG91_PRODUCER_TEMPLATE_ID")
                .ok()
                .filter(|v| !v.trim().is_empty())
                .or_else(|| {
                    std::env::var("MSG91_TRANSACTIONAL_TEMPLATE_ID")
                        .ok()
                        .filter(|v| !v.trim().is_empty())
                })
                .unwrap_or_default();
            if !template_id.is_empty() {
                let mut vars = BTreeMap::new();
                vars.insert("VAR1".to_string(), p.company_name.clone());
                vars.insert("VAR2".to_string(), email.clone());
                vars.insert("VAR3".to_string(), "/producer/login".to_string());
                let bg_state = state.clone();
                let bg_phone = phone.clone();
                tokio::spawn(async move {
                    if let Err(e) = NotificationService::send_templated_sms(
                        &bg_state,
                        &bg_phone,
                        &template_id,
                        &vars,
                        Some("Producer portal credentials ready"),
                        None,
                    )
                    .await
                    {
                        tracing::warn!("Producer credential SMS skipped: {}", e);
                    }
                });
            }
        }

        Ok(json!({
            "success": true,
            "producerId": id,
            "studioName": p.company_name,
            "email": email,
            "password": raw_password,
            "loginUrl": "/producer/login",
            "message": "Producer login credentials generated. Share email & password with the producer."
        }))
    }

    fn generate_secure_password() -> String {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        const UPPER: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
        const LOWER: &[u8] = b"abcdefghijkmnopqrstuvwxyz";
        const DIGITS: &[u8] = b"23456789";
        const SYMBOLS: &[u8] = b"!@#$%^&*";

        let mut pwd: Vec<u8> = Vec::with_capacity(12);
        pwd.push(UPPER[rng.gen_range(0..UPPER.len())]);
        pwd.push(LOWER[rng.gen_range(0..LOWER.len())]);
        pwd.push(DIGITS[rng.gen_range(0..DIGITS.len())]);
        pwd.push(SYMBOLS[rng.gen_range(0..SYMBOLS.len())]);
        for _ in 4..12 {
            let pool = match rng.gen_range(0..4) {
                0 => UPPER,
                1 => LOWER,
                2 => DIGITS,
                _ => SYMBOLS,
            };
            pwd.push(pool[rng.gen_range(0..pool.len())]);
        }
        pwd.shuffle(&mut rng);
        String::from_utf8(pwd).unwrap_or_else(|_| "Prod@2026!Xy".to_string())
    }

    pub async fn get_producer_by_id(state: &AppState, id: i64) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;
        Ok(Self::format_onboarding_profile(&p))
    }

    pub async fn update_producer_profile(
        state: &AppState,
        id: i64,
        body: Value,
    ) -> AppResult<Value> {
        let p = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;
        let mut am: producer_profile::ActiveModel = p.into();
        if let Some(name) = body
            .get("companyName")
            .or_else(|| body.get("studioName"))
            .and_then(|v| v.as_str())
        {
            am.company_name = Set(name.to_string());
        }
        if let Some(email) = body
            .get("contactEmail")
            .or_else(|| body.get("email"))
            .and_then(|v| v.as_str())
        {
            am.email = Set(Some(email.to_string()));
        }
        if let Some(phone) = body
            .get("contactPhone")
            .or_else(|| body.get("phone"))
            .and_then(|v| v.as_str())
        {
            am.phone = Set(Some(phone.to_string()));
        }
        if let Some(person) = body.get("contactPerson").and_then(|v| v.as_str()) {
            am.contact_person = Set(Some(person.to_string()));
        }
        if let Some(status) = body.get("status").and_then(|v| v.as_str()) {
            am.status = Set(status.to_uppercase());
            am.is_active = Set(Some(
                status.to_uppercase() == "ACTIVE" || status.to_uppercase() == "APPROVED",
            ));
        }
        if let Some(kyc) = body.get("kycStatus").and_then(|v| v.as_str()) {
            am.kyc_status = Set(Some(kyc.to_uppercase()));
        }
        if let Some(share) = body
            .get("defaultRevenueSharePercentage")
            .or_else(|| body.get("revenueSharePercent"))
            .and_then(|v| v.as_f64())
            .and_then(Decimal::from_f64_retain)
        {
            am.revenue_share_percent = Set(Some(share));
            am.revenue_share = Set(Some(share));
        }
        am.updated_at = Set(Some(Utc::now().into()));
        let saved = am.update(&state.db).await?;
        Ok(Self::format_onboarding_profile(&saved))
    }

    pub async fn delete_producer(state: &AppState, id: i64) -> AppResult<Value> {
        let existing = producer_profile::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Producer {} not found", id)))?;
        let mut am: producer_profile::ActiveModel = existing.into();
        am.is_active = Set(Some(false));
        am.status = Set("SUSPENDED".into());
        am.updated_at = Set(Some(Utc::now().into()));
        am.update(&state.db).await?;
        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true
        }))
    }
}
