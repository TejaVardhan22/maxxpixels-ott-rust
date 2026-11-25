use chrono::Utc;
use maxx_common::error::AppError;
use maxx_core::entities::{content, movie};
use maxx_core::AppState;
use maxx_integration_bunny::BunnyStorageClient;
use rand::Rng;
use sea_orm::{ActiveModelTrait, ConnectionTrait, DatabaseBackend, Set, Statement};
use serde_json::{json, Value};
use uuid::Uuid;

use super::AdvertisingService;

type AppResult<T> = Result<T, AppError>;

fn normalize_phone_10(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() >= 10 {
        Some(digits[digits.len() - 10..].to_string())
    } else {
        None
    }
}

fn normalize_content_type(raw: &str) -> String {
    let clean = raw.trim().to_uppercase().replace('-', "_");
    match clean.as_str() {
        "MOVIES" | "FILM" => "MOVIE".to_string(),
        "SHORT_FILMS" | "SHORTS" | "SHORT" => "SHORT_FILM".to_string(),
        "MICRO_DRAMA" | "MICRO_DRAMAS" | "MICRODRAMAS" => "MICRODRAMA".to_string(),
        "WEB_SERIES" | "SHOWS" | "SHOW" => "SERIES".to_string(),
        "ALBUMS" | "SONGS" | "MUSIC" => "ALBUM".to_string(),
        "PODCASTS" => "PODCAST".to_string(),
        "STAGE_DRAMAS" | "STAGEDRAMA" => "STAGE_DRAMA".to_string(),
        "DOCUMENTARIES" => "DOCUMENTARY".to_string(),
        "" => "MOVIE".to_string(),
        other => other.to_string(),
    }
}

fn normalize_lang_code(raw: &str) -> String {
    match raw.trim().to_lowercase().as_str() {
        "kannada" | "kan" => "kn".to_string(),
        "tamil" | "tam" => "ta".to_string(),
        "telugu" | "tel" => "te".to_string(),
        "hindi" | "hin" => "hi".to_string(),
        "malayalam" | "mal" => "ml".to_string(),
        "marathi" | "mar" => "mr".to_string(),
        "bengali" | "ben" => "bn".to_string(),
        "punjabi" | "pan" => "pa".to_string(),
        "gujarati" | "guj" => "gu".to_string(),
        "english" | "eng" => "en".to_string(),
        other => other.to_string(),
    }
}

fn extract_gdrive_file_id(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if let Some(pos) = trimmed.find("/file/d/") {
        let rest = &trimmed[pos + 8..];
        let id = rest.split(&['/', '?', '#'][..]).next().unwrap_or("").trim();
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    if let Some(pos) = trimmed.find("id=") {
        let rest = &trimmed[pos + 3..];
        let id = rest.split(&['&', '#'][..]).next().unwrap_or("").trim();
        if !id.is_empty() {
            return Some(id.to_string());
        }
    }
    None
}

async fn download_gdrive_image(url: &str) -> Option<(Vec<u8>, String, String)> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let fetch_url = if let Some(fid) = extract_gdrive_file_id(trimmed) {
        format!("https://drive.google.com/uc?export=download&id={}", fid)
    } else if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        return None;
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .ok()?;
    let resp = client.get(&fetch_url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let ct = resp
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_string();
    // Skip HTML confirmation/login pages (means Drive file isn't shared publicly or with service account)
    if ct.contains("text/html") {
        return None;
    }
    let ext = if ct.contains("png") {
        "png"
    } else if ct.contains("webp") {
        "webp"
    } else {
        "jpg"
    };
    let bytes = resp.bytes().await.ok()?.to_vec();
    if bytes.is_empty() {
        return None;
    }
    Some((bytes, ct, format!("asset.{}", ext)))
}

async fn trigger_media_streamer_job(gdrive_url: &str, title: &str) -> Option<String> {
    let trimmed = gdrive_url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let base = std::env::var("MEDIA_STREAMER_URL")
        .ok()
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "http://media-streamer:8085".to_string());

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .ok()?;

    let resp = client
        .post(format!("{}/api/stream-gdrive", base))
        .json(&json!({
            "gdriveUrl": trimmed,
            "title": title
        }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.json::<Value>().await.ok()?;
    body.get("jobId")
        .or_else(|| body.get("job_id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

async fn send_resend_email(to_email: &str, subject: &str, html: &str) {
    let api_key = std::env::var("RESEND_API_KEY").unwrap_or_default();
    let from = std::env::var("EMAIL_FROM")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "MaxxPixels OTT <no-reply@maxxpixels.com>".to_string());
    if api_key.trim().is_empty() || to_email.trim().is_empty() {
        return;
    }
    if let Ok(client) = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
    {
        let recipients: Vec<&str> = to_email
            .split(',')
            .map(str::trim)
            .filter(|s| s.contains('@'))
            .collect();
        if recipients.is_empty() {
            return;
        }
        let _ = client
            .post("https://api.resend.com/emails")
            .bearer_auth(api_key.trim())
            .json(&json!({
                "from": from,
                "to": recipients,
                "subject": subject,
                "html": html
            }))
            .send()
            .await;
    }
}

async fn notify_admins(state: &AppState, title: &str, message: &str) {
    // 1. Post into Admin Dashboard Ops Chat ("producers" room)
    let _ = state
        .db
        .execute_unprepared(
            r#"
            CREATE TABLE IF NOT EXISTS admin_ops_messages (
                id BIGSERIAL PRIMARY KEY,
                room VARCHAR(64) NOT NULL DEFAULT 'general',
                sender_id BIGINT,
                sender_name VARCHAR(150) NOT NULL,
                role VARCHAR(64) NOT NULL DEFAULT 'Admin',
                role_color VARCHAR(32) NOT NULL DEFAULT '#1a4cd8',
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            "#,
        )
        .await;
    let _ = state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "INSERT INTO admin_ops_messages (room, sender_name, role, role_color, message) VALUES ('producers', 'Content Intake Bot', 'System', '#00d2ff', $1)",
            [format!("{} — {}", title, message).into()],
        ))
        .await;

    // 2. Insert in-app notification for every Admin / SuperAdmin user
    let _ = state
        .db
        .execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            r#"
            INSERT INTO user_notifications (user_id, title, body, notification_type, is_read, created_at)
            SELECT DISTINCT u.id, $1, $2, 'PRODUCER_SUBMISSION', FALSE, NOW()
            FROM users u
            JOIN user_roles ur ON ur.user_id = u.id
            JOIN roles r ON r.id = ur.role_id
            WHERE UPPER(r.name) LIKE '%ADMIN%'
            "#,
            [title.into(), message.into()],
        ))
        .await;

    // 3. Optional email alert to ADMIN_ALERT_EMAIL / SUPPORT_EMAIL
    let admin_email = std::env::var("ADMIN_ALERT_EMAIL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "maxxpixelsoffical@gmail.com".to_string());
    let html = format!(
        "<h2>{}</h2><p>{}</p><p><a href=\"https://admin.maxxpixels.com/admin/producer-reviews\">Open Producer Reviews Queue</a></p>",
        title, message
    );
    send_resend_email(&admin_email, title, &html).await;
}

impl AdvertisingService {
    /// Step 1A: Send OTP to producer's phone number before public content submission.
    pub async fn collect_send_otp(state: &AppState, body: Value) -> AppResult<Value> {
        let raw_phone = body
            .get("phone")
            .or_else(|| body.get("contactPhone"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let phone10 = normalize_phone_10(raw_phone)
            .ok_or_else(|| AppError::BadRequest("Please enter a valid 10-digit mobile number".to_string()))?;

        let otp: u32 = rand::thread_rng().gen_range(100000..=999999);
        let otp_str = otp.to_string();
        let cache_key = format!("producer:collect:otp:{}", phone10);
        let _ = state.redis.set(&cache_key, &otp_str, 600).await;

        let auth_key = std::env::var("MSG91_AUTH_KEY").unwrap_or_default();
        let template_id = std::env::var("MSG91_TEMPLATE_ID").unwrap_or_default();
        let mut sms_sent = false;

        if !auth_key.trim().is_empty() && !template_id.trim().is_empty() {
            let full_mobile = format!("91{}", phone10);
            if let Ok(client) = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
            {
                let url = format!(
                    "https://control.msg91.com/api/v5/otp?template_id={}&mobile={}&otp={}",
                    template_id.trim(),
                    full_mobile,
                    otp_str
                );
                if let Ok(resp) = client
                    .post(&url)
                    .header("authkey", auth_key.trim())
                    .header("Content-Type", "application/json")
                    .json(&json!({}))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        sms_sent = true;
                    }
                }
            }
        }

        Ok(json!({
            "sent": true,
            "smsSent": sms_sent,
            "phone": format!("+91{}", phone10),
            "message": if sms_sent { "OTP sent to your mobile number." } else { "OTP generated. Please check your SMS." }
        }))
    }

    /// Step 1B: Verify producer OTP and issue a short-lived verification token for submission.
    pub async fn collect_verify_otp(state: &AppState, body: Value) -> AppResult<Value> {
        let raw_phone = body
            .get("phone")
            .or_else(|| body.get("contactPhone"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let phone10 = normalize_phone_10(raw_phone)
            .ok_or_else(|| AppError::BadRequest("Invalid mobile number".to_string()))?;
        let otp_input = body
            .get("otp")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("");
        if otp_input.len() != 6 {
            return Err(AppError::BadRequest("Please enter the 6-digit OTP".to_string()));
        }

        let cache_key = format!("producer:collect:otp:{}", phone10);
        let expected = state.redis.get::<String>(&cache_key).await;
        match expected {
            Some(code) if code == otp_input => {
                let _ = state.redis.del(&cache_key).await;
                let token = Uuid::new_v4().to_string();
                let ver_key = format!("producer:collect:verified:{}", token);
                let _ = state.redis.set(&ver_key, &phone10, 3600).await;
                Ok(json!({
                    "verified": true,
                    "otpToken": token,
                    "phone": format!("+91{}", phone10)
                }))
            }
            _ => Err(AppError::BadRequest("Invalid or expired OTP. Please try again.".to_string())),
        }
    }

    /// Step 1C: Public producer content submission -> saves ONLY in `producer_submissions` (NOT `contents`) and alerts Admins.
    pub async fn collect_submit_content(state: &AppState, body: Value) -> AppResult<Value> {
        let title = body
            .get("title")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Title is required".to_string()))?
            .to_string();

        let raw_phone = body
            .get("producerContactPhone")
            .or_else(|| body.get("contactPhone"))
            .or_else(|| body.get("phone"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let phone10 = normalize_phone_10(raw_phone)
            .ok_or_else(|| AppError::BadRequest("Valid mobile number is required".to_string()))?;

        // Enforce OTP verification before submission
        let otp_token = body
            .get("otpToken")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Please verify your mobile number with OTP before submitting".to_string()))?;
        let ver_key = format!("producer:collect:verified:{}", otp_token);
        let verified_phone = state.redis.get::<String>(&ver_key).await;
        if verified_phone.as_deref() != Some(phone10.as_str()) {
            return Err(AppError::BadRequest("Phone OTP verification expired or mismatched. Please verify again.".to_string()));
        }
        let _ = state.redis.del(&ver_key).await;

        let content_type = normalize_content_type(
            body.get("contentType")
                .or_else(|| body.get("content_type"))
                .and_then(|v| v.as_str())
                .unwrap_or("MOVIE"),
        );
        let language = body
            .get("language")
            .or_else(|| body.get("originalLanguage"))
            .and_then(|v| v.as_str())
            .map(normalize_lang_code)
            .unwrap_or_else(|| "kn".to_string());

        let poster_1 = body
            .get("poster1Url")
            .or_else(|| body.get("posterUrl"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let poster_2 = body
            .get("poster2Url")
            .or_else(|| body.get("bannerUrl"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let trailer_url = body
            .get("trailerUrl")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let google_drive_link = body
            .get("googleDriveLink")
            .or_else(|| body.get("fullMovieLink"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Google Drive link for the full content is required".to_string()))?
            .to_string();
        let production_name = body
            .get("productionName")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let producer_name = body
            .get("producerName")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let producer_email = body
            .get("producerEmail")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Email address is required".to_string()))?
            .to_string();
        let one_line_brief = body
            .get("oneLineBrief")
            .or_else(|| body.get("description"))
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();

        let kyc_token = Uuid::new_v4().to_string();
        let expires_at = Utc::now().fixed_offset() + chrono::Duration::days(7);
        let formatted_phone = format!("+91{}", phone10);

        let row = state
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                INSERT INTO producer_submissions (
                    content_id, content_type, title, language,
                    poster_1_url, poster_2_url, trailer_url, google_drive_link,
                    production_name, producer_name, producer_contact_phone, producer_email,
                    one_line_brief, phone_verified, kyc_token,
                    status, agreement_status, expires_at, created_at, updated_at
                )
                VALUES (
                    NULL, $1, $2, $3,
                    $4, $5, $6, $7,
                    $8, $9, $10, $11,
                    $12, TRUE, $13,
                    'SUBMITTED', 'PENDING', $14, NOW(), NOW()
                )
                RETURNING id
                "#,
                vec![
                    content_type.clone().into(),
                    title.clone().into(),
                    language.clone().into(),
                    poster_1.into(),
                    poster_2.into(),
                    trailer_url.into(),
                    google_drive_link.into(),
                    production_name.clone().into(),
                    producer_name.clone().into(),
                    formatted_phone.clone().into(),
                    producer_email.clone().into(),
                    one_line_brief.into(),
                    kyc_token.clone().into(),
                    expires_at.into(),
                ],
            ))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let sub_id = row
            .and_then(|r| r.try_get::<i64>("", "id").ok())
            .unwrap_or(0);

        // Notify admins immediately
        let alert_title = format!("New Content Submission: {}", title);
        let alert_msg = format!(
            "{} ({}) submitted by {} ({}, {}). Review in Producer Reviews Queue.",
            title,
            content_type,
            if !production_name.is_empty() { &production_name } else { &producer_name },
            formatted_phone,
            producer_email
        );
        notify_admins(state, &alert_title, &alert_msg).await;

        Ok(json!({
            "id": sub_id,
            "title": title,
            "contentType": content_type,
            "language": language,
            "status": "SUBMITTED",
            "kycToken": kyc_token,
            "trackUrl": format!("https://maxxpixels.com/producer/content/collect?token={}", kyc_token),
            "expiresAt": expires_at.to_rfc3339(),
            "message": "Your submission has been received! Our team will review your details and Google Drive assets, then send you the Agreement & KYC link."
        }))
    }

    /// Step 2A: Public status & Agreement/KYC lookup by secure token.
    pub async fn collect_get_status(state: &AppState, token: &str) -> AppResult<Value> {
        let clean = token.trim();
        if clean.is_empty() {
            return Err(AppError::BadRequest("Submission token is required".to_string()));
        }
        let row = state
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                SELECT json_build_object(
                    'id', id,
                    'title', title,
                    'contentType', content_type,
                    'language', language,
                    'productionName', COALESCE(production_name, ''),
                    'producerName', COALESCE(producer_name, ''),
                    'producerEmail', COALESCE(producer_email, ''),
                    'producerContactPhone', COALESCE(producer_contact_phone, ''),
                    'status', status,
                    'agreementStatus', COALESCE(agreement_status, 'PENDING'),
                    'agreementAccepted', COALESCE(agreement_accepted, FALSE),
                    'agreementSignedName', COALESCE(agreement_signed_name, ''),
                    'adminReviewNotes', COALESCE(admin_review_notes, ''),
                    'bunnyTransferStatus', COALESCE(bunny_transfer_status, ''),
                    'createdAt', created_at
                ) AS value
                FROM producer_submissions
                WHERE kyc_token = $1
                LIMIT 1
                "#,
                [clean.into()],
            ))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let val = row
            .and_then(|r| r.try_get::<Value>("", "value").ok())
            .ok_or_else(|| AppError::NotFound("Submission not found or link expired".to_string()))?;
        Ok(val)
    }

    /// Step 2B: Producer accepts Agreement & submits KYC (Aadhaar, PAN, Bank Details).
    pub async fn collect_submit_kyc(state: &AppState, token: &str, body: Value) -> AppResult<Value> {
        let clean = token.trim();
        let agreement_accepted = body
            .get("agreementAccepted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        if !agreement_accepted {
            return Err(AppError::BadRequest("You must accept the Content Licensing Agreement to continue".to_string()));
        }
        let signed_name = body
            .get("agreementSignedName")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Full legal signature name is required".to_string()))?
            .to_string();
        let aadhaar = body
            .get("aadhaarNumber")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| s.len() >= 12)
            .ok_or_else(|| AppError::BadRequest("Valid 12-digit Aadhaar number is required".to_string()))?
            .to_string();
        let pan = body
            .get("panNumber")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase())
            .filter(|s| s.len() == 10)
            .ok_or_else(|| AppError::BadRequest("Valid 10-character PAN number is required".to_string()))?
            .to_string();
        let bank_holder = body
            .get("bankAccountHolder")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::BadRequest("Bank account holder name is required".to_string()))?
            .to_string();
        let bank_acc = body
            .get("bankAccountNumber")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| s.len() >= 8)
            .ok_or_else(|| AppError::BadRequest("Valid bank account number is required".to_string()))?
            .to_string();
        let bank_ifsc = body
            .get("bankIfscCode")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_uppercase())
            .filter(|s| s.len() == 11)
            .ok_or_else(|| AppError::BadRequest("Valid 11-character IFSC code is required".to_string()))?
            .to_string();
        let bank_name = body
            .get("bankName")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("")
            .to_string();
        let aadhaar_doc = body.get("aadhaarDocLink").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let pan_doc = body.get("panDocLink").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();
        let cheque_doc = body.get("bankChequeLink").and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

        let row = state
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                UPDATE producer_submissions
                SET
                    agreement_accepted = TRUE,
                    agreement_signed_name = $1,
                    agreement_signed_at = NOW(),
                    agreement_status = 'SIGNED',
                    aadhaar_number = $2,
                    aadhaar_doc_link = $3,
                    pan_number = $4,
                    pan_doc_link = $5,
                    bank_account_holder = $6,
                    bank_account_number = $7,
                    bank_ifsc_code = $8,
                    bank_name = $9,
                    bank_cheque_link = $10,
                    status = 'KYC_SUBMITTED',
                    updated_at = NOW()
                WHERE kyc_token = $11
                RETURNING id, title
                "#,
                vec![
                    signed_name.into(),
                    aadhaar.into(),
                    aadhaar_doc.into(),
                    pan.into(),
                    pan_doc.into(),
                    bank_holder.into(),
                    bank_acc.into(),
                    bank_ifsc.into(),
                    bank_name.into(),
                    cheque_doc.into(),
                    clean.into(),
                ],
            ))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let (sub_id, title) = match row {
            Some(r) => (
                r.try_get::<i64>("", "id").unwrap_or(0),
                r.try_get::<String>("", "title").unwrap_or_default(),
            ),
            None => return Err(AppError::NotFound("Invalid or expired submission link".to_string())),
        };

        notify_admins(
            state,
            &format!("Agreement & KYC Submitted: {}", title),
            &format!(
                "Submission #{} ('{}') has signed the agreement and uploaded Aadhaar, PAN & Bank details. Ready to verify and onboard to Draft + Bunny.",
                sub_id, title
            ),
        )
        .await;

        Ok(json!({
            "id": sub_id,
            "title": title,
            "status": "KYC_SUBMITTED",
            "agreementStatus": "SIGNED",
            "message": "Agreement signed and KYC submitted successfully! Our team will verify and onboard your content shortly."
        }))
    }

    /// Admin Queue: List all `producer_submissions` ordered latest on top (`created_at DESC, id DESC`).
    pub async fn admin_list_collect_submissions(
        state: &AppState,
        status_filter: Option<&str>,
    ) -> AppResult<Vec<Value>> {
        let rows = if let Some(s) = status_filter.map(str::trim).filter(|v| !v.is_empty() && *v != "ALL") {
            state
                .db
                .query_all(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    r#"
                    SELECT json_build_object(
                        'id', id,
                        'contentId', content_id,
                        'title', title,
                        'contentType', content_type,
                        'language', COALESCE(language, ''),
                        'oneLineBrief', COALESCE(one_line_brief, ''),
                        'description', COALESCE(one_line_brief, ''),
                        'posterUrl', COALESCE(NULLIF(bunny_poster_url, ''), poster_1_url, ''),
                        'poster1Url', COALESCE(poster_1_url, ''),
                        'poster2Url', COALESCE(poster_2_url, ''),
                        'bannerUrl', COALESCE(NULLIF(bunny_banner_url, ''), poster_2_url, ''),
                        'trailerUrl', COALESCE(trailer_url, ''),
                        'googleDriveLink', COALESCE(google_drive_link, ''),
                        'productionName', COALESCE(production_name, ''),
                        'producerName', COALESCE(NULLIF(producer_name, ''), production_name, ''),
                        'producerContactPhone', COALESCE(producer_contact_phone, ''),
                        'producerEmail', COALESCE(producer_email, ''),
                        'phoneVerified', COALESCE(phone_verified, FALSE),
                        'kycToken', COALESCE(kyc_token, ''),
                        'kycUrl', CASE WHEN kyc_token IS NOT NULL THEN 'https://maxxpixels.com/producer/content/collect?token=' || kyc_token ELSE '' END,
                        'status', status,
                        'agreementStatus', COALESCE(agreement_status, 'PENDING'),
                        'agreementAccepted', COALESCE(agreement_accepted, FALSE),
                        'agreementSignedName', COALESCE(agreement_signed_name, ''),
                        'agreementSignedAt', agreement_signed_at,
                        'aadhaarNumber', COALESCE(aadhaar_number, ''),
                        'aadhaarDocLink', COALESCE(aadhaar_doc_link, ''),
                        'panNumber', COALESCE(pan_number, ''),
                        'panDocLink', COALESCE(pan_doc_link, ''),
                        'bankAccountHolder', COALESCE(bank_account_holder, ''),
                        'bankAccountNumber', COALESCE(bank_account_number, ''),
                        'bankIfscCode', COALESCE(bank_ifsc_code, ''),
                        'bankName', COALESCE(bank_name, ''),
                        'bankChequeLink', COALESCE(bank_cheque_link, ''),
                        'bunnyTransferStatus', COALESCE(bunny_transfer_status, ''),
                        'bunnyVideoJobId', COALESCE(bunny_video_job_id, ''),
                        'bunnyPosterUrl', COALESCE(bunny_poster_url, ''),
                        'bunnyBannerUrl', COALESCE(bunny_banner_url, ''),
                        'reviewNotes', COALESCE(admin_review_notes, ''),
                        'submissionSource', 'public_producer',
                        'expiresAt', expires_at,
                        'createdAt', created_at
                    ) AS value
                    FROM producer_submissions
                    WHERE UPPER(status) = UPPER($1)
                    ORDER BY created_at DESC, id DESC
                    LIMIT 200
                    "#,
                    [s.into()],
                ))
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        } else {
            state
                .db
                .query_all(Statement::from_string(
                    DatabaseBackend::Postgres,
                    r#"
                    SELECT json_build_object(
                        'id', id,
                        'contentId', content_id,
                        'title', title,
                        'contentType', content_type,
                        'language', COALESCE(language, ''),
                        'oneLineBrief', COALESCE(one_line_brief, ''),
                        'description', COALESCE(one_line_brief, ''),
                        'posterUrl', COALESCE(NULLIF(bunny_poster_url, ''), poster_1_url, ''),
                        'poster1Url', COALESCE(poster_1_url, ''),
                        'poster2Url', COALESCE(poster_2_url, ''),
                        'bannerUrl', COALESCE(NULLIF(bunny_banner_url, ''), poster_2_url, ''),
                        'trailerUrl', COALESCE(trailer_url, ''),
                        'googleDriveLink', COALESCE(google_drive_link, ''),
                        'productionName', COALESCE(production_name, ''),
                        'producerName', COALESCE(NULLIF(producer_name, ''), production_name, ''),
                        'producerContactPhone', COALESCE(producer_contact_phone, ''),
                        'producerEmail', COALESCE(producer_email, ''),
                        'phoneVerified', COALESCE(phone_verified, FALSE),
                        'kycToken', COALESCE(kyc_token, ''),
                        'kycUrl', CASE WHEN kyc_token IS NOT NULL THEN 'https://maxxpixels.com/producer/content/collect?token=' || kyc_token ELSE '' END,
                        'status', status,
                        'agreementStatus', COALESCE(agreement_status, 'PENDING'),
                        'agreementAccepted', COALESCE(agreement_accepted, FALSE),
                        'agreementSignedName', COALESCE(agreement_signed_name, ''),
                        'agreementSignedAt', agreement_signed_at,
                        'aadhaarNumber', COALESCE(aadhaar_number, ''),
                        'aadhaarDocLink', COALESCE(aadhaar_doc_link, ''),
                        'panNumber', COALESCE(pan_number, ''),
                        'panDocLink', COALESCE(pan_doc_link, ''),
                        'bankAccountHolder', COALESCE(bank_account_holder, ''),
                        'bankAccountNumber', COALESCE(bank_account_number, ''),
                        'bankIfscCode', COALESCE(bank_ifsc_code, ''),
                        'bankName', COALESCE(bank_name, ''),
                        'bankChequeLink', COALESCE(bank_cheque_link, ''),
                        'bunnyTransferStatus', COALESCE(bunny_transfer_status, ''),
                        'bunnyVideoJobId', COALESCE(bunny_video_job_id, ''),
                        'bunnyPosterUrl', COALESCE(bunny_poster_url, ''),
                        'bunnyBannerUrl', COALESCE(bunny_banner_url, ''),
                        'reviewNotes', COALESCE(admin_review_notes, ''),
                        'submissionSource', 'public_producer',
                        'expiresAt', expires_at,
                        'createdAt', created_at
                    ) AS value
                    FROM producer_submissions
                    ORDER BY created_at DESC, id DESC
                    LIMIT 200
                    "#
                    .to_string(),
                ))
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        };

        Ok(rows
            .into_iter()
            .filter_map(|r| r.try_get::<Value>("", "value").ok())
            .collect())
    }

    /// Admin Action on a `producer_submissions` row:
    /// - `APPROVE_DETAILS` / `REQUEST_KYC`: moves to `KYC_PENDING` and emails/returns Agreement + KYC link
    /// - `ONBOARD_DRAFT` / `APPROVE_KYC`: creates `contents` (`DRAFT`) + `movies`, transfers Drive posters -> Bunny Storage & Drive video -> Bunny Stream
    /// - `REJECT`: marks `REJECTED` with review notes
    pub async fn admin_review_collect_submission(
        state: &AppState,
        id: i64,
        reviewer: &str,
        body: Value,
    ) -> AppResult<Value> {
        let action = body
            .get("action")
            .or_else(|| body.get("status"))
            .and_then(|v| v.as_str())
            .unwrap_or("APPROVE_DETAILS")
            .trim()
            .to_uppercase();
        let notes = body
            .get("notes")
            .or_else(|| body.get("reviewNotes"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim()
            .to_string();

        let sub_row = state
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                r#"
                SELECT json_build_object(
                    'id', id,
                    'contentId', content_id,
                    'title', title,
                    'contentType', content_type,
                    'language', COALESCE(language, 'kn'),
                    'poster1Url', COALESCE(poster_1_url, ''),
                    'poster2Url', COALESCE(poster_2_url, ''),
                    'trailerUrl', COALESCE(trailer_url, ''),
                    'googleDriveLink', COALESCE(google_drive_link, ''),
                    'productionName', COALESCE(production_name, ''),
                    'producerName', COALESCE(producer_name, ''),
                    'producerContactPhone', COALESCE(producer_contact_phone, ''),
                    'producerEmail', COALESCE(producer_email, ''),
                    'oneLineBrief', COALESCE(one_line_brief, ''),
                    'kycToken', COALESCE(kyc_token, '')
                ) AS value
                FROM producer_submissions
                WHERE id = $1
                "#,
                [id.into()],
            ))
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let sub = sub_row
            .and_then(|r| r.try_get::<Value>("", "value").ok())
            .ok_or_else(|| AppError::NotFound(format!("Submission #{} not found", id)))?;

        if action.contains("REJECT") {
            state
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "UPDATE producer_submissions SET status = 'REJECTED', admin_review_notes = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW() WHERE id = $3",
                    [notes.clone().into(), reviewer.into(), id.into()],
                ))
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            return Ok(json!({ "id": id, "status": "REJECTED", "reviewed": true }));
        }

        if action == "APPROVE_DETAILS" || action == "REQUEST_KYC" || action == "SHARE_AGREEMENT" {
            let existing_token = sub.get("kycToken").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let kyc_token = if existing_token.is_empty() {
                Uuid::new_v4().to_string()
            } else {
                existing_token
            };
            state
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "UPDATE producer_submissions SET status = 'KYC_PENDING', agreement_status = 'SENT', kyc_token = $1, admin_review_notes = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW() WHERE id = $4",
                    [kyc_token.clone().into(), notes.into(), reviewer.into(), id.into()],
                ))
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

            let kyc_url = format!("https://maxxpixels.com/producer/content/collect?token={}", kyc_token);
            let email = sub.get("producerEmail").and_then(|v| v.as_str()).unwrap_or("");
            let title = sub.get("title").and_then(|v| v.as_str()).unwrap_or("Your Content");
            let html = format!(
                "<h2>Your submission '{}' has been approved for Agreement &amp; KYC!</h2>\
                 <p>Please complete the Licensing Agreement and submit your KYC &amp; Bank details using the link below:</p>\
                 <p><a href=\"{}\">{}</a></p>",
                title, kyc_url, kyc_url
            );
            send_resend_email(email, &format!("Next Step: Agreement & KYC for {}", title), &html).await;

            return Ok(json!({
                "id": id,
                "status": "KYC_PENDING",
                "kycToken": kyc_token,
                "kycUrl": kyc_url,
                "reviewed": true
            }));
        }

        if action == "ONBOARD_DRAFT" || action == "APPROVE_KYC" || action == "ONBOARD" {
            let title = sub.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
            let content_type = normalize_content_type(sub.get("contentType").and_then(|v| v.as_str()).unwrap_or("MOVIE"));
            let language = normalize_lang_code(sub.get("language").and_then(|v| v.as_str()).unwrap_or("kn"));
            let poster_1 = sub.get("poster1Url").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let poster_2 = sub.get("poster2Url").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let trailer_url = sub.get("trailerUrl").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let drive_link = sub.get("googleDriveLink").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let production_name = sub.get("productionName").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let contact_phone = sub.get("producerContactPhone").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let producer_email = sub.get("producerEmail").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let brief = sub.get("oneLineBrief").and_then(|v| v.as_str()).unwrap_or("").to_string();

            // 1. Transfer Poster & Banner directly from Google Drive -> Bunny Edge Storage
            let bunny_storage = BunnyStorageClient::from_env();
            let mut final_poster_url = poster_1.clone();
            let mut bunny_poster_url = String::new();
            if let Some((bytes, ct, fname)) = download_gdrive_image(&poster_1).await {
                let res = bunny_storage.upload_file("posters", &fname, bytes, &ct).await;
                if let Some(u) = res.get("url").and_then(|v| v.as_str()) {
                    final_poster_url = u.to_string();
                    bunny_poster_url = u.to_string();
                }
            }

            let mut final_banner_url = if !poster_2.is_empty() { poster_2.clone() } else { final_poster_url.clone() };
            let mut bunny_banner_url = String::new();
            if !poster_2.is_empty() {
                if let Some((bytes, ct, fname)) = download_gdrive_image(&poster_2).await {
                    let res = bunny_storage.upload_file("banners", &fname, bytes, &ct).await;
                    if let Some(u) = res.get("url").and_then(|v| v.as_str()) {
                        final_banner_url = u.to_string();
                        bunny_banner_url = u.to_string();
                    }
                }
            }

            // 2. Create DRAFT content in `contents` + linked `movies` row
            let now = Utc::now().fixed_offset();
            let slug = format!(
                "{}-{}",
                title
                    .to_lowercase()
                    .chars()
                    .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
                    .collect::<String>()
                    .trim_matches('-'),
                Utc::now().timestamp() % 100000
            );
            let new_content = content::ActiveModel {
                title: Set(title.clone()),
                slug: Set(slug),
                description: Set(Some(brief.clone())),
                short_description: Set(Some(brief.clone())),
                content_type: Set(Some(content_type.clone())),
                r#type: Set(Some(content_type.clone())),
                status: Set("DRAFT".to_string()),
                access_type: Set(Some("AVOD".to_string())),
                monetization: Set(Some("AVOD".to_string())),
                original_language_code: Set(Some(language.clone())),
                poster_url: Set(if final_poster_url.is_empty() { None } else { Some(final_poster_url.clone()) }),
                poster_2_url: Set(if final_banner_url.is_empty() { None } else { Some(final_banner_url.clone()) }),
                banner_image_url: Set(if final_banner_url.is_empty() { None } else { Some(final_banner_url.clone()) }),
                landscape_image_url: Set(if final_banner_url.is_empty() { None } else { Some(final_banner_url.clone()) }),
                backdrop_url: Set(if final_banner_url.is_empty() { None } else { Some(final_banner_url.clone()) }),
                trailer_url: Set(if trailer_url.is_empty() { None } else { Some(trailer_url.clone()) }),
                production_name: Set(if production_name.is_empty() { None } else { Some(production_name.clone()) }),
                producer_contact_phone: Set(if contact_phone.is_empty() { None } else { Some(contact_phone) }),
                producer_email: Set(if producer_email.is_empty() { None } else { Some(producer_email) }),
                google_drive_link: Set(if drive_link.is_empty() { None } else { Some(drive_link.clone()) }),
                one_line_brief: Set(Some(brief)),
                submission_source: Set(Some("public_producer".to_string())),
                agreement_status: Set(Some("SIGNED".to_string())),
                view_count: Set(Some(0)),
                created_at: Set(now),
                updated_at: Set(now),
                ..Default::default()
            };
            let saved_content = new_content.insert(&state.db).await?;

            // Safe movie row id avoiding collision with legacy movies.id
            let movie_row_id = if let Ok(Some(r)) = state
                .db
                .query_one(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "SELECT CASE WHEN EXISTS (SELECT 1 FROM movies WHERE id = $1) THEN (SELECT COALESCE(MAX(id), 0) + 1 FROM movies) ELSE $1 END AS nid",
                    [saved_content.id.into()],
                ))
                .await
            {
                r.try_get::<i64>("", "nid").unwrap_or(saved_content.id)
            } else {
                saved_content.id
            };

            let new_movie = movie::ActiveModel {
                id: Set(movie_row_id),
                content_id: Set(Some(saved_content.id)),
                production_house: Set(if production_name.is_empty() { None } else { Some(production_name) }),
                is_tvod_available: Set(Some(false)),
                ..Default::default()
            };
            let _ = new_movie.insert(&state.db).await?;

            // 3. Trigger Google Drive -> Bunny Stream direct transfer via media-streamer
            let video_job_id = trigger_media_streamer_job(&drive_link, &title).await;
            let trailer_job_id = if trailer_url.contains("drive.google.com") {
                trigger_media_streamer_job(&trailer_url, &format!("{} (Trailer)", title)).await
            } else {
                None
            };
            let transfer_status = if video_job_id.is_some() {
                "TRANSFERRING"
            } else {
                "DRAFT_READY"
            };

            state
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    r#"
                    UPDATE producer_submissions
                    SET
                        status = 'ONBOARDED',
                        content_id = $1,
                        bunny_transfer_status = $2,
                        bunny_video_job_id = $3,
                        bunny_trailer_job_id = $4,
                        bunny_poster_url = $5,
                        bunny_banner_url = $6,
                        admin_review_notes = $7,
                        reviewed_by = $8,
                        reviewed_at = NOW(),
                        updated_at = NOW()
                    WHERE id = $9
                    "#,
                    vec![
                        saved_content.id.into(),
                        transfer_status.into(),
                        video_job_id.clone().unwrap_or_default().into(),
                        trailer_job_id.clone().unwrap_or_default().into(),
                        bunny_poster_url.clone().into(),
                        bunny_banner_url.clone().into(),
                        notes.into(),
                        reviewer.into(),
                        id.into(),
                    ],
                ))
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;

            // 4. Spawn background poller to attach Bunny Stream HLS URL + GUID onto the draft movie once media-streamer finishes
            if let Some(job_id) = video_job_id.clone() {
                let db_clone = state.db.clone();
                let draft_content_id = saved_content.id;
                let submission_id = id;
                tokio::spawn(async move {
                    let base = std::env::var("MEDIA_STREAMER_URL")
                        .ok()
                        .map(|s| s.trim().trim_end_matches('/').to_string())
                        .filter(|s| !s.is_empty())
                        .unwrap_or_else(|| "http://media-streamer:8085".to_string());
                    let Ok(client) = reqwest::Client::builder()
                        .timeout(std::time::Duration::from_secs(10))
                        .build()
                    else {
                        return;
                    };
                    for _ in 0..180 {
                        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
                        if let Ok(resp) = client.get(format!("{}/api/jobs/{}", base, job_id)).send().await {
                            if let Ok(j) = resp.json::<Value>().await {
                                let st = j.get("status").and_then(|v| v.as_str()).unwrap_or("").to_uppercase();
                                if st == "COMPLETED" || st == "DONE" || st == "SUCCESS" {
                                    let guid = j
                                        .pointer("/metadata/guid")
                                        .or_else(|| j.get("guid"))
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    let hls = j
                                        .pointer("/metadata/hlsUrl")
                                        .or_else(|| j.get("hlsUrl"))
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();
                                    if !hls.is_empty() || !guid.is_empty() {
                                        let _ = db_clone
                                            .execute(Statement::from_sql_and_values(
                                                DatabaseBackend::Postgres,
                                                "UPDATE movies SET hls_url = COALESCE(NULLIF($1, ''), hls_url), stream_url = COALESCE(NULLIF($1, ''), stream_url), video_url = COALESCE(NULLIF($1, ''), video_url), video_asset_id = COALESCE(NULLIF($1, ''), video_asset_id), bunny_video_guid = COALESCE(NULLIF($2, ''), bunny_video_guid) WHERE content_id = $3",
                                                [hls.into(), guid.into(), draft_content_id.into()],
                                            ))
                                            .await;
                                    }
                                    let _ = db_clone
                                        .execute(Statement::from_sql_and_values(
                                            DatabaseBackend::Postgres,
                                            "UPDATE producer_submissions SET bunny_transfer_status = 'COMPLETED', updated_at = NOW() WHERE id = $1",
                                            [submission_id.into()],
                                        ))
                                        .await;
                                    break;
                                } else if st == "FAILED" || st == "ERROR" {
                                    let _ = db_clone
                                        .execute(Statement::from_sql_and_values(
                                            DatabaseBackend::Postgres,
                                            "UPDATE producer_submissions SET bunny_transfer_status = 'FAILED', updated_at = NOW() WHERE id = $1",
                                            [submission_id.into()],
                                        ))
                                        .await;
                                    break;
                                }
                            }
                        }
                    }
                });
            }

            return Ok(json!({
                "id": id,
                "contentId": saved_content.id,
                "status": "ONBOARDED",
                "draftStatus": "DRAFT",
                "bunnyTransferStatus": transfer_status,
                "bunnyVideoJobId": video_job_id,
                "bunnyPosterUrl": bunny_poster_url,
                "bunnyBannerUrl": bunny_banner_url,
                "reviewed": true
            }));
        }

        Err(AppError::BadRequest(format!("Unsupported review action '{}'", action)))
    }
}
