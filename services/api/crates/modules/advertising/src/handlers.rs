use crate::service::AdvertisingService;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use maxx_common::error::AppError;
use maxx_common::response::ApiResponse;
use maxx_common::security::{Claims, SecurityUtils};
use maxx_core::AppState;
use serde::Deserialize;
use serde_json::{json, Value};

type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Deserialize)]
pub struct ProducerPasswordResetQuery {
    #[serde(rename = "newPassword")]
    pub new_password: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AdQuery {
    pub device: Option<String>,
    pub period: Option<String>,
    #[serde(rename = "producerId")]
    pub producer_id: Option<String>,
    #[serde(rename = "contentId")]
    pub content_id: Option<i64>,
    pub video_id: Option<i64>,
    pub status: Option<String>,
    #[serde(rename = "kycStatus")]
    pub kyc_status: Option<String>,
}

fn extract_optional_user_id(headers: &HeaderMap, state: &AppState) -> Option<i64> {
    let auth_header = headers.get("authorization").and_then(|v| v.to_str().ok())?;
    let token = auth_header.strip_prefix("Bearer ").unwrap_or(auth_header).trim();
    if token.is_empty() {
        return None;
    }
    let claims = SecurityUtils::validate_jwt(token, &state.config.jwt_secret).ok()?;
    claims.sub.parse::<i64>().ok()
}

pub async fn get_ad_config_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(content_id): Path<i64>,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let uid = extract_optional_user_id(&headers, &state);
    let data = AdvertisingService::get_ad_config_for_content(
        &state,
        content_id,
        uid,
        q.device.as_deref().unwrap_or("WEB"),
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_ad_session_handler(Json(body): Json<Value>) -> AppResult<Response> {
    let session_id = body
        .get("sessionId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("ad-session-{}", chrono::Utc::now().timestamp_millis()));
    Ok(ApiResponse::ok_response(json!({ "sessionId": session_id, "active": true })))
}

pub async fn record_ad_event_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::record_ad_event(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_public_campaigns_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = AdvertisingService::list_campaigns(&state).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_ad_revenue_handler(
    State(state): State<AppState>,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let data = AdvertisingService::get_ad_revenue_summary(&state, q.period.as_deref()).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_producer_revenue_handler(
    State(state): State<AppState>,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let pid = q.producer_id.as_deref().and_then(|s| s.parse::<i64>().ok());
    let data =
        AdvertisingService::get_producer_revenue_report(&state, pid, q.period.as_deref())
            .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_vast_xml_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let campaigns = AdvertisingService::list_campaigns(&state).await.unwrap_or_default();
    let media_url = campaigns
        .iter()
        .find(|c| c.is_active.unwrap_or(false))
        .and_then(|c| c.video_url.clone())
        .unwrap_or_else(|| std::env::var("DEFAULT_PREROLL_URL").unwrap_or_default());

    let xml = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<VAST version="4.2">
  <Ad id="maxxpixels-ad-1">
    <InLine>
      <AdSystem>MaxxPixels Ad Server</AdSystem>
      <AdTitle>MaxxPixels Pre-Roll</AdTitle>
      <Creatives>
        <Creative>
          <Linear skipoffset="00:00:05">
            <Duration>00:00:15</Duration>
            <MediaFiles>
              <MediaFile delivery="progressive" type="video/mp4" width="1280" height="720">{}</MediaFile>
            </MediaFiles>
          </Linear>
        </Creative>
      </Creatives>
    </InLine>
  </Ad>
</VAST>"#,
        media_url
    );

    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/xml; charset=utf-8")],
        xml,
    )
}

pub async fn get_ad_queue_handler(
    State(state): State<AppState>,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let cid = q.video_id.or(q.content_id).unwrap_or(0);
    if cid > 0 {
        let cfg = AdvertisingService::get_ad_config_for_content(
            &state,
            cid,
            None,
            q.device.as_deref().unwrap_or("MOBILE"),
        )
        .await?;
        if cfg.get("eligible").and_then(|v| v.as_bool()).unwrap_or(false) {
            let gam_url = cfg.get("gamTagUrl").cloned().unwrap_or(Value::Null);
            return Ok(ApiResponse::ok_response(json!({
                "enabled": true,
                "session_id": cfg.get("sessionId"),
                "gam_tag_url": gam_url,
                "fallback_vast_url": cfg.get("fallbackVastUrl"),
                "pre_roll": [{ "id": "preroll-gam", "tag_url": gam_url }],
                "mid_roll": [],
                "post_roll": []
            })));
        }
    }
    Ok(ApiResponse::ok_response(json!({
        "enabled": false,
        "session_id": format!("ad-session-{}", chrono::Utc::now().timestamp_millis()),
        "pre_roll": [],
        "mid_roll": [],
        "post_roll": []
    })))
}

pub async fn track_ad_post_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    if let Some(ad_id) = body.get("ad_id").or_else(|| body.get("adId")).and_then(|v| v.as_i64()) {
        let _ = AdvertisingService::record_impression(&state, ad_id).await;
    }
    if body.get("eventType").is_some() {
        let _ = AdvertisingService::record_ad_event(&state, body).await;
    }
    Ok(ApiResponse::ok_response(json!({ "success": true, "tracked": true })))
}

pub async fn track_impression_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    AdvertisingService::record_impression(&state, id).await?;
    Ok(ApiResponse::ok_response(
        json!({ "tracked": true, "type": "IMPRESSION", "campaignId": id }),
    ))
}

pub async fn track_click_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    AdvertisingService::record_click(&state, id).await?;
    Ok(ApiResponse::ok_response(
        json!({ "tracked": true, "type": "CLICK", "campaignId": id }),
    ))
}

pub async fn ads_txt_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/plain; charset=utf-8")],
        "# Google AdSense / Ad Manager & InMobi Ads.txt Verification File\ngoogle.com, pub-2191993313473081, DIRECT, f08c47fec0942fa0\ninmobi.com, b0e3f3a3b99e4ed7b9a82cd25cc59481, DIRECT, 83e75a7ae333ca9d\ninmobi.com, 8839a620596f46169ed937f1568740db, DIRECT, 83e75a7ae333ca9d\n",
    )
}

pub async fn admin_list_providers_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::list_providers(&state).await?))
}

pub async fn admin_create_provider_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_provider(&state, body, None).await?))
}

pub async fn admin_update_provider_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_provider(&state, body, Some(id)).await?))
}

pub async fn admin_list_placements_handler(
    State(state): State<AppState>,
    _claims: Claims,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::list_placements(&state).await?))
}

pub async fn admin_create_placement_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_placement(&state, body, None).await?))
}

pub async fn admin_update_placement_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_placement(&state, body, Some(id)).await?))
}

pub async fn admin_create_campaign_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_campaign(&state, body, None).await?))
}

pub async fn admin_get_campaign_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::get_campaign_by_id(&state, id).await?))
}

pub async fn admin_update_campaign_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::upsert_campaign(&state, body, Some(id)).await?))
}

pub async fn admin_toggle_campaign_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let status = body.get("status").and_then(|v| v.as_str()).unwrap_or("ACTIVE");
    Ok(ApiResponse::ok_response(
        AdvertisingService::upsert_campaign(
            &state,
            json!({ "status": status, "isActive": status == "ACTIVE" }),
            Some(id),
        )
        .await?,
    ))
}

pub async fn admin_delete_campaign_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(AdvertisingService::delete_campaign(&state, id).await?))
}

pub async fn admin_list_producers_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let st = q.kyc_status.as_deref().or(q.status.as_deref());
    Ok(ApiResponse::ok_response(
        AdvertisingService::list_producers(&state, st).await?,
    ))
}

pub async fn admin_review_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(
        AdvertisingService::review_producer_onboarding(&state, id, body).await?,
    ))
}

pub async fn admin_onboard_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::onboard_producer_studio(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_toggle_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::toggle_producer_status(&state, id, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_reset_producer_password_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Query(query): Query<ProducerPasswordResetQuery>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let new_pass = body
        .get("newPassword")
        .or_else(|| body.get("password"))
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or(query.new_password)
        .or(query.password)
        .unwrap_or_default();
    let data = AdvertisingService::reset_producer_password(&state, id, &new_pass).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_get_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = AdvertisingService::get_producer_by_id(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_update_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::update_producer_profile(&state, id, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_delete_producer_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = AdvertisingService::delete_producer(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_generate_producer_credentials_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = AdvertisingService::generate_producer_credentials(&state, id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_list_submissions_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    Ok(ApiResponse::ok_response(
        AdvertisingService::admin_list_collect_submissions(&state, q.status.as_deref()).await?,
    ))
}

pub async fn producer_profile_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let explicit_pid = q.producer_id.as_deref().and_then(|s| s.parse::<i64>().ok());
    let p = AdvertisingService::get_or_create_producer_for_user(&state, uid, explicit_pid).await?;
    Ok(ApiResponse::ok_response(
        AdvertisingService::format_onboarding_profile(&p),
    ))
}

pub async fn producer_movie_analytics_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let data =
        AdvertisingService::get_movie_analytics(&state, &claims, q.producer_id.as_deref()).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_dashboard_analytics_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let data = AdvertisingService::get_dashboard_analytics(
        &state,
        &claims,
        q.producer_id.as_deref(),
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_ad_breakdown_handler(
    State(state): State<AppState>,
    claims: Claims,
) -> AppResult<Response> {
    let data = AdvertisingService::get_ad_breakdown(&state, &claims).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_agreement_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let data = AdvertisingService::get_producer_agreement(
        &state,
        &claims,
        q.producer_id.as_deref(),
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_upload_agreement_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::upload_signed_agreement(
        &state,
        &claims,
        body,
        q.producer_id.as_deref(),
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_update_kyc_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::update_kyc_documents(
        &state,
        &claims,
        body,
        q.producer_id.as_deref(),
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_content_overview_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let data = AdvertisingService::get_content_overview_analytics(
        &state,
        &claims,
        q.producer_id.as_deref(),
        q.content_id,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_register_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::register_producer_studio(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn producer_my_submissions_handler(
    State(state): State<AppState>,
    claims: Claims,
    Query(q): Query<AdQuery>,
) -> AppResult<Response> {
    let is_admin = claims.is_admin();
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let explicit_pid = q.producer_id.as_deref().and_then(|s| s.parse::<i64>().ok());
    let producer =
        AdvertisingService::get_or_create_producer_for_user(&state, uid, explicit_pid)
            .await
            .ok();
    let pid = producer.map(|p| p.id);

    let list =
        AdvertisingService::list_producer_submissions_filtered(&state, pid, is_admin).await?;
    Ok(ApiResponse::ok_response(list))
}

pub async fn producer_submit_content_handler(
    State(state): State<AppState>,
    claims: Claims,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let uid = claims.sub.parse::<i64>().unwrap_or(0);
    let producer = AdvertisingService::get_or_create_producer_for_user(&state, uid, None).await?;
    let data = AdvertisingService::submit_producer_content(
        &state,
        producer.id,
        &producer.company_name,
        body,
    )
    .await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn admin_review_submission_handler(
    State(state): State<AppState>,
    claims: Claims,
    Path(id): Path<i64>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let reviewer = claims
        .email
        .as_deref()
        .unwrap_or("admin@maxxpixels.com");
    let data = AdvertisingService::admin_review_collect_submission(&state, id, reviewer, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn public_producer_submit_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::collect_submit_content(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn collect_send_otp_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::collect_send_otp(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn collect_verify_otp_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::collect_verify_otp(&state, body).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn collect_get_status_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> AppResult<Response> {
    let data = AdvertisingService::collect_get_status(&state, &token).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn collect_submit_kyc_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let data = AdvertisingService::collect_submit_kyc(&state, &token, body).await?;
    Ok(ApiResponse::ok_response(data))
}
