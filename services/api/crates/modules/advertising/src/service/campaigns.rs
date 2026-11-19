use super::AdvertisingService;
use chrono::Utc;

use maxx_common::error::AppError;

use maxx_common::validation::ValidationBag;

type AppResult<T> = Result<T, AppError>;

use maxx_common::security::{Claims, SecurityUtils};

use maxx_core::entities::{

    ad_campaign, ad_event, ad_placement, ad_provider, content, producer_ad_revenue,

    producer_profile, role, subscription, user, user_role,
    plan,
};

use maxx_core::AppState;

use rust_decimal::prelude::ToPrimitive;

use rust_decimal::Decimal;

use sea_orm::{

    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,

};

use serde_json::{json, Value};

use uuid::Uuid;





impl AdvertisingService {
    pub async fn get_ad_config_for_content(
        state: &AppState,
        content_id: i64,
        user_id: Option<i64>,
        device: &str,
    ) -> AppResult<Value> {
        let mut is_ad_free = false;
        if let Some(uid) = user_id {
            if let Some(sub) = subscription::Entity::find()
                .filter(subscription::Column::UserId.eq(uid))
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .order_by_desc(subscription::Column::EndDate)
                .one(&state.db)
                .await?
            {
                if sub.end_date > Utc::now() {
                    // Enforce plan.ads_enabled flag: ad-free only if plan does NOT have ads enabled
                    let plan_has_ads = plan::Entity::find_by_id(sub.plan_id)
                        .one(&state.db)
                        .await?
                        .and_then(|p| p.ads_enabled)
                        .unwrap_or(false);
                    is_ad_free = !plan_has_ads;
                }
            }
        }

        let placements = ad_placement::Entity::find()
            .filter(ad_placement::Column::IsActive.eq(true))
            .order_by_asc(ad_placement::Column::CuePointSeconds)
            .all(&state.db)
            .await?;

        let cue_points: Vec<i32> = placements
            .iter()
            .filter_map(|p| p.cue_point_seconds)
            .filter(|&s| s > 0)
            .collect();

        let gam_network_code = std::env::var("GAM_NETWORK_CODE").unwrap_or_default();
        let gam_tag_url = std::env::var("GAM_CUSTOM_VIDEO_AD_TAG")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                format!(
                    "https://pubads.g.doubleclick.net/gampad/ads?iu=/{}/maxxpixels_video&sz=640x480&gdfp_req=1&output=vast&unviewed_position_start=1",
                    gam_network_code
                )
            });

        let session_id = format!("ad_sess_{}", &Uuid::new_v4().simple().to_string()[..12]);

        Ok(json!({
            "eligible": !is_ad_free,
            "adFree": is_ad_free,
            "contentId": content_id,
            "device": device,
            "sessionId": session_id,
            "gamTagUrl": gam_tag_url,
            "fallbackVastUrl": format!("/api/v1/ads/vast.xml?contentId={}", content_id),
            "cuePoints": cue_points,
            "placements": placements
        }))
    }

    pub async fn record_ad_event(state: &AppState, body: Value) -> AppResult<Value> {
        let session_token = body
            .get("sessionToken")
            .or_else(|| body.get("sessionId"))
            .or_else(|| body.get("session_token"))
            .and_then(|v| v.as_str())
            .unwrap_or("anon-session")
            .to_string();
        let event_type = body
            .get("eventType")
            .or_else(|| body.get("event"))
            .and_then(|v| v.as_str())
            .unwrap_or("IMPRESSION")
            .to_uppercase();
        let campaign_id = body
            .get("campaignId")
            .or_else(|| body.get("adId"))
            .and_then(|v| v.as_i64());
        let content_id = body.get("contentId").and_then(|v| v.as_i64());
        let producer_id = body.get("producerId").and_then(|v| v.as_i64());
        let dedup_key = body
            .get("dedupKey")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("{}:{}:{}", session_token, event_type, Uuid::new_v4().simple()));

        if let Some(existing) = ad_event::Entity::find()
            .filter(ad_event::Column::DedupKey.eq(&dedup_key))
            .one(&state.db)
            .await?
        {
            return Ok(json!({ "recorded": true, "deduplicated": true, "id": existing.id }));
        }

        let am = ad_event::ActiveModel {
            session_token: Set(session_token),
            campaign_id: Set(campaign_id),
            provider_code: Set(Some(
                body.get("providerCode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("GAM")
                    .to_string(),
            )),
            event_type: Set(event_type),
            content_id: Set(content_id),
            producer_id: Set(producer_id),
            dedup_key: Set(dedup_key),
            revenue_paise: Set(body
                .get("revenuePaise")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .or(Some(0))),
            metadata: Set(body.get("metadata").map(|v| v.to_string())),
            created_at: Set(Some(Utc::now().into())),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;
        Ok(json!({ "recorded": true, "id": saved.id }))
    }

    pub async fn list_campaigns(state: &AppState) -> AppResult<Vec<ad_campaign::Model>> {
        Ok(ad_campaign::Entity::find()
            .order_by_desc(ad_campaign::Column::CreatedAt)
            .all(&state.db)
            .await?)
    }

    pub async fn get_campaign_by_id(state: &AppState, id: i64) -> AppResult<ad_campaign::Model> {
        ad_campaign::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Ad campaign {} not found", id)))
    }

    pub async fn upsert_campaign(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<ad_campaign::Model> {
        let existing = if let Some(cid) = id {
            ad_campaign::Entity::find_by_id(cid).one(&state.db).await?
        } else {
            None
        };

        let mut v = ValidationBag::new();
        let cname = body.get("campaignName").or_else(|| body.get("name")).and_then(|x| x.as_str());
        if existing.is_none() {
            v.require_text("campaignName", cname, 2, 160);
        } else {
            v.optional_text("campaignName", cname, 160);
        }
        v.optional_non_negative_f64("cpmRate", body.get("cpmRate").and_then(|x| x.as_f64()));
        v.optional_non_negative_f64("totalBudget", body.get("totalBudget").and_then(|x| x.as_f64()));
        v.optional_url("videoUrl", body.get("videoUrl").and_then(|x| x.as_str()));
        v.optional_url("clickUrl", body.get("clickUrl").and_then(|x| x.as_str()));
        v.finish()?;

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        if let Some(c) = existing {
            let mut am: ad_campaign::ActiveModel = c.into();
            if let Some(name) = body
                .get("campaignName")
                .or_else(|| body.get("name"))
                .and_then(|v| v.as_str())
            {
                am.campaign_name = Set(name.to_string());
                am.name = Set(Some(name.to_string()));
            }
            if let Some(status) = body.get("status").and_then(|v| v.as_str()) {
                am.status = Set(Some(status.to_uppercase()));
            }
            if let Some(active) = body.get("isActive").and_then(|v| v.as_bool()) {
                am.is_active = Set(Some(active));
            }
            if let Some(url) = body.get("vastTagUrl").and_then(|v| v.as_str()) {
                am.vast_tag_url = Set(Some(url.to_string()));
            }
            am.updated_at = Set(Some(now));
            Ok(am.update(&state.db).await?)
        } else {
            let name = body
                .get("campaignName")
                .or_else(|| body.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("New Ad Campaign")
                .to_string();
            let am = ad_campaign::ActiveModel {
                campaign_name: Set(name.clone()),
                name: Set(Some(name)),
                advertiser_name: Set(body
                    .get("advertiserName")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                ad_break_type: Set(body
                    .get("adBreakType")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| Some("PRE_ROLL".to_string()))),
                provider: Set(body
                    .get("provider")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .or_else(|| Some("DIRECT".to_string()))),
                status: Set(Some(
                    body.get("status")
                        .and_then(|v| v.as_str())
                        .unwrap_or("ACTIVE")
                        .to_uppercase(),
                )),
                is_active: Set(Some(
                    body.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true),
                )),
                vast_tag_url: Set(body
                    .get("vastTagUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                video_url: Set(body
                    .get("videoUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                click_url: Set(body
                    .get("clickUrl")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())),
                cpm_rate: Set(body.get("cpmRate").and_then(|v| v.as_f64())),
                duration_seconds: Set(body
                    .get("durationSeconds")
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32)),
                created_at: Set(now),
                updated_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn delete_campaign(state: &AppState, id: i64) -> AppResult<Value> {
        let existing = ad_campaign::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Campaign {} not found", id)))?;
        let mut am: ad_campaign::ActiveModel = existing.into();
        am.is_active = Set(Some(false));
        am.status = Set(Some("ARCHIVED".into()));
        am.updated_at = Set(Some(Utc::now().into()));
        am.update(&state.db).await?;
        Ok(json!({
            "id": id,
            "deleted": true,
            "softDeleted": true,
            "deactivated": true
        }))
    }

    pub async fn record_impression(state: &AppState, id: i64) -> AppResult<()> {
        if let Some(c) = ad_campaign::Entity::find_by_id(id).one(&state.db).await? {
            let next_imp = c.impressions_count.unwrap_or(0) + 1;
            let next_del = c.impressions_delivered.unwrap_or(0) + 1;
            let mut am: ad_campaign::ActiveModel = c.into();
            am.impressions_count = Set(Some(next_imp));
            am.impressions_delivered = Set(Some(next_del));
            am.update(&state.db).await?;
        }
        Ok(())
    }

    pub async fn record_click(state: &AppState, id: i64) -> AppResult<()> {
        if let Some(c) = ad_campaign::Entity::find_by_id(id).one(&state.db).await? {
            let next_clicks = c.clicks_count.unwrap_or(0) + 1;
            let mut am: ad_campaign::ActiveModel = c.into();
            am.clicks_count = Set(Some(next_clicks));
            am.update(&state.db).await?;
        }
        Ok(())
    }

    pub async fn list_providers(state: &AppState) -> AppResult<Vec<ad_provider::Model>> {
        Ok(ad_provider::Entity::find()
            .order_by_asc(ad_provider::Column::Id)
            .all(&state.db)
            .await?)
    }

    pub async fn upsert_provider(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<ad_provider::Model> {
        let existing = if let Some(pid) = id {
            ad_provider::Entity::find_by_id(pid).one(&state.db).await?
        } else {
            None
        };
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(p) = existing {
            let mut am: ad_provider::ActiveModel = p.into();
            if let Some(name) = body.get("name").and_then(|v| v.as_str()) {
                am.name = Set(name.to_string());
            }
            if let Some(active) = body.get("isActive").and_then(|v| v.as_bool()) {
                am.is_active = Set(Some(active));
            }
            if let Some(bidding) = body.get("isBiddingEnabled").and_then(|v| v.as_bool()) {
                am.is_bidding_enabled = Set(Some(bidding));
            }
            am.updated_at = Set(Some(now));
            Ok(am.update(&state.db).await?)
        } else {
            let code = body
                .get("code")
                .and_then(|v| v.as_str())
                .unwrap_or("CUSTOM")
                .to_uppercase();
            let name = body
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&code)
                .to_string();
            let am = ad_provider::ActiveModel {
                code: Set(code),
                name: Set(name),
                r#type: Set(Some(
                    body.get("type")
                        .and_then(|v| v.as_str())
                        .unwrap_or("VIDEO_VAST")
                        .to_string(),
                )),
                is_active: Set(Some(
                    body.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true),
                )),
                is_bidding_enabled: Set(Some(
                    body.get("isBiddingEnabled")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false),
                )),
                created_at: Set(Some(now)),
                updated_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn list_placements(state: &AppState) -> AppResult<Vec<ad_placement::Model>> {
        Ok(ad_placement::Entity::find()
            .order_by_asc(ad_placement::Column::Id)
            .all(&state.db)
            .await?)
    }

    pub async fn upsert_placement(
        state: &AppState,
        body: Value,
        id: Option<i64>,
    ) -> AppResult<ad_placement::Model> {
        let existing = if let Some(pid) = id {
            ad_placement::Entity::find_by_id(pid).one(&state.db).await?
        } else {
            None
        };
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        if let Some(p) = existing {
            let mut am: ad_placement::ActiveModel = p.into();
            if let Some(name) = body.get("name").and_then(|v| v.as_str()) {
                am.name = Set(name.to_string());
            }
            if let Some(active) = body.get("isActive").and_then(|v| v.as_bool()) {
                am.is_active = Set(Some(active));
            }
            if let Some(cue) = body.get("cuePointSeconds").and_then(|v| v.as_i64()) {
                am.cue_point_seconds = Set(Some(cue as i32));
            }
            am.updated_at = Set(Some(now));
            Ok(am.update(&state.db).await?)
        } else {
            let code = body
                .get("code")
                .and_then(|v| v.as_str())
                .unwrap_or("PRE_ROLL")
                .to_uppercase();
            let name = body
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or(&code)
                .to_string();
            let am = ad_placement::ActiveModel {
                code: Set(code),
                name: Set(name),
                format: Set(Some(
                    body.get("format")
                        .and_then(|v| v.as_str())
                        .unwrap_or("PRE_ROLL")
                        .to_string(),
                )),
                platform: Set(Some(
                    body.get("platform")
                        .and_then(|v| v.as_str())
                        .unwrap_or("ALL")
                        .to_string(),
                )),
                cue_point_seconds: Set(Some(
                    body.get("cuePointSeconds")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0) as i32,
                )),
                is_active: Set(Some(
                    body.get("isActive").and_then(|v| v.as_bool()).unwrap_or(true),
                )),
                created_at: Set(Some(now)),
                updated_at: Set(Some(now)),
                ..Default::default()
            };
            Ok(am.insert(&state.db).await?)
        }
    }

    pub async fn get_ad_revenue_summary(state: &AppState, period: Option<&str>) -> AppResult<Value> {
        let mut q = producer_ad_revenue::Entity::find();
        if let Some(p) = period.filter(|s| !s.is_empty()) {
            q = q.filter(producer_ad_revenue::Column::BillingPeriod.eq(p));
        }
        let rows = q.all(&state.db).await?;
        let total_impressions: i64 = rows.iter().filter_map(|r| r.total_impressions).sum();
        let gross: f64 = rows
            .iter()
            .filter_map(|r| r.gross_revenue.and_then(|d| d.to_f64()))
            .sum();
        let producer_share: f64 = rows
            .iter()
            .filter_map(|r| r.producer_amount.and_then(|d| d.to_f64()))
            .sum();
        let platform_share: f64 = rows
            .iter()
            .filter_map(|r| r.platform_amount.and_then(|d| d.to_f64()))
            .sum();

        Ok(json!({
            "period": period.unwrap_or("ALL"),
            "totalImpressions": total_impressions,
            "grossRevenue": gross,
            "producerShare": producer_share,
            "platformShare": platform_share,
            "records": rows.len()
        }))
    }

    pub async fn get_producer_revenue_report(
        state: &AppState,
        producer_id: Option<i64>,
        period: Option<&str>,
    ) -> AppResult<Vec<producer_ad_revenue::Model>> {
        let mut q = producer_ad_revenue::Entity::find()
            .order_by_desc(producer_ad_revenue::Column::CreatedAt);
        if let Some(pid) = producer_id {
            q = q.filter(producer_ad_revenue::Column::ProducerId.eq(pid));
        }
        if let Some(p) = period.filter(|s| !s.is_empty()) {
            q = q.filter(producer_ad_revenue::Column::BillingPeriod.eq(p));
        }
        Ok(q.all(&state.db).await?)
    }

}
