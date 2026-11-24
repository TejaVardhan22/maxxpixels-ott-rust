use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use maxx_common::{
    error::{AppError, AppResult},
    response::ApiResponse,
    security::Claims,
};
use maxx_core::AppState;
use maxx_module_catalogue::{dto::CatalogBrowseQuery, CatalogueService};
use serde::Deserialize;
use serde_json::Value;

use crate::service::ContentService;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadQuery {
    pub folder: Option<String>,
    pub title: Option<String>,
}

fn svc(state: &AppState) -> ContentService {
    let base = std::env::var("PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "https://api.maxxpixels.com".to_string());
    ContentService::new(state.db.clone(), base)
}

// ─── MOVIES READ + WRITE HANDLERS ───────────────────────────────────────────

pub async fn admin_list_movies_handler(
    claims: Claims,
    State(state): State<AppState>,
    Query(query): Query<CatalogBrowseQuery>,
) -> AppResult<Response> {
    if !claims.is_admin() && !claims.has_role("CONTENT_MANAGER") && !claims.has_role("PRODUCER") {
        return Err(AppError::Forbidden("Admin or Producer privileges required".into()));
    }
    let base = std::env::var("PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "https://api.maxxpixels.com".to_string());
    let res = CatalogueService::new(state.db.clone(), base)
        .browse_catalog(query, true)
        .await?;
    Ok(ApiResponse::ok_response(res))
}

pub async fn admin_get_movie_handler(
    claims: Claims,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Response> {
    if !claims.is_admin() && !claims.has_role("CONTENT_MANAGER") && !claims.has_role("PRODUCER") {
        return Err(AppError::Forbidden("Admin or Producer privileges required".into()));
    }
    let base = std::env::var("PUBLIC_BASE_URL")
        .unwrap_or_else(|_| "https://api.maxxpixels.com".to_string());
    let res = CatalogueService::new(state.db.clone(), base)
        .get_content_detail(&id, true)
        .await?;
    Ok(ApiResponse::ok_response(res))
}

pub async fn create_movie_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_movie(payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn update_movie_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).update_movie(id, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn update_movie_status_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let status = payload
        .get("status")
        .and_then(|v| v.as_str())
        .unwrap_or("PUBLISHED");
    let data = svc(&state).update_movie_status(id, status).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_movie_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).delete_movie(id).await?;
    Ok(ApiResponse::ok_response(data))
}

// ─── SERIES / SEASONS / EPISODES ────────────────────────────────────────────

pub async fn list_series_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = svc(&state).list_series().await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn get_series_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).get_series(id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_series_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_series(payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn update_series_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).update_series(id, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_series_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).delete_series(id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_seasons_handler(
    State(state): State<AppState>,
    Path(series_id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).list_seasons(series_id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_season_handler(
    State(state): State<AppState>,
    Path(series_id): Path<i64>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_season(series_id, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_season_handler(
    State(state): State<AppState>,
    Path((_series_id, season_id)): Path<(i64, i64)>,
) -> AppResult<Response> {
    let data = svc(&state).delete_season(season_id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_episodes_handler(
    State(state): State<AppState>,
    Path((_series_id, season_id)): Path<(i64, i64)>,
) -> AppResult<Response> {
    let data = svc(&state).list_episodes(season_id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_episode_handler(
    State(state): State<AppState>,
    Path((_series_id, season_id)): Path<(i64, i64)>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_episode(season_id, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_episodes_by_season_handler(
    State(state): State<AppState>,
    Path(season_id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).list_episodes(season_id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_episode_by_season_handler(
    State(state): State<AppState>,
    Path(season_id): Path<i64>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_episode(season_id, payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_episode_handler(
    State(state): State<AppState>,
    Path((_series_id, _season_id, episode_id)): Path<(i64, i64, i64)>,
) -> AppResult<Response> {
    let data = svc(&state).delete_episode(episode_id).await?;
    Ok(ApiResponse::ok_response(data))
}

// ─── LIVE CHANNELS & EVENTS ─────────────────────────────────────────────────

pub async fn list_live_channels_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = svc(&state).list_live_channels().await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_live_channel_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_live_channel(payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_live_channel_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).delete_live_channel(id).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn list_live_events_handler(State(state): State<AppState>) -> AppResult<Response> {
    let data = svc(&state).list_live_events().await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn create_live_event_handler(
    State(state): State<AppState>,
    Json(payload): Json<Value>,
) -> AppResult<Response> {
    let data = svc(&state).create_live_event(payload).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn delete_live_event_handler(
    State(state): State<AppState>,
    Path(id): Path<i64>,
) -> AppResult<Response> {
    let data = svc(&state).delete_live_event(id).await?;
    Ok(ApiResponse::ok_response(data))
}

// ─── STORAGE & VIDEO UPLOADS ────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Deserialize)]
pub struct PresignedUrlQuery {
    pub folder: Option<String>,
    #[serde(alias = "fileName", alias = "file_name")]
    pub filename: Option<String>,
    #[serde(alias = "contentType", alias = "content_type")]
    pub content_type: Option<String>,
}

pub async fn presigned_url_get_handler(
    State(state): State<AppState>,
    Query(q): Query<PresignedUrlQuery>,
) -> AppResult<Response> {
    let folder = q.folder.unwrap_or_else(|| "posters".to_string());
    let filename = q.filename.unwrap_or_else(|| "asset.bin".to_string());
    let content_type = q.content_type.unwrap_or_else(|| "application/octet-stream".to_string());
    let data = svc(&state).get_presigned_url(&folder, &filename, &content_type);
    Ok(ApiResponse::ok_response(data))
}

pub async fn presigned_url_post_handler(
    State(state): State<AppState>,
    Json(body): Json<Value>,
) -> AppResult<Response> {
    let folder = body.get("folder").and_then(|v| v.as_str()).unwrap_or("posters");
    let filename = body.get("fileName").or_else(|| body.get("filename")).or_else(|| body.get("file_name")).and_then(|v| v.as_str()).unwrap_or("asset.bin");
    let content_type = body.get("contentType").or_else(|| body.get("content_type")).and_then(|v| v.as_str()).unwrap_or("application/octet-stream");
    let data = svc(&state).get_presigned_url(folder, filename, content_type);
    Ok(ApiResponse::ok_response(data))
}

pub async fn upload_media_handler(
    State(state): State<AppState>,
    Query(q): Query<UploadQuery>,
    mut multipart: Multipart,
) -> AppResult<Response> {
    let mut folder = q.folder.unwrap_or_else(|| "posters".to_string());
    let mut file_name = "upload.bin".to_string();
    let mut content_type = "application/octet-stream".to_string();
    let mut bytes = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart payload: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "folder" {
            if let Ok(txt) = field.text().await {
                if !txt.trim().is_empty() {
                    folder = txt.trim().to_string();
                }
            }
            continue;
        }
        if name == "file" || bytes.is_empty() {
            if let Some(fname) = field.file_name() {
                file_name = fname.to_string();
            }
            if let Some(ct) = field.content_type() {
                content_type = ct.to_string();
            }
            bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("Failed reading file bytes: {}", e)))?
                .to_vec();
        }
    }

    if bytes.is_empty() {
        return Err(AppError::BadRequest("No file uploaded".into()));
    }

    let data = svc(&state)
        .upload_media(&folder, &file_name, bytes, &content_type)
        .await;
    Ok(ApiResponse::ok_response(data))
}

pub async fn direct_upload_token_handler(
    State(state): State<AppState>,
    _claims: Claims,
    Query(q): Query<std::collections::HashMap<String, String>>,
) -> AppResult<Response> {
    let title = q
        .get("title")
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .unwrap_or("Untitled Video");
    let s = svc(&state);
    if s.bunny_stream.library_id.is_empty() || s.bunny_stream.api_key.is_empty() {
        return Err(AppError::BadRequest(
            "Bunny Stream credentials (BUNNY_STREAM_LIBRARY_ID / BUNNY_STREAM_API_KEY) are not configured".into(),
        ));
    }
    let guid = s
        .bunny_stream
        .create_video(title)
        .await
        .map_err(AppError::Internal)?;
    let expire_unix = chrono::Utc::now().timestamp() + 86400; // 24h TUS resumable window
    let tus_signature = s.bunny_stream.sign_tus_upload(&guid, expire_unix);
    let upload_url = format!(
        "https://video.bunnycdn.com/library/{}/videos/{}",
        s.bunny_stream.library_id, guid
    );
    let hls_url = format!("https://{}/{}/playlist.m3u8", s.bunny_stream.cdn_hostname, guid);
    let thumbnail_url = format!("https://{}/{}/thumbnail.jpg", s.bunny_stream.cdn_hostname, guid);

    Ok(ApiResponse::ok_response(serde_json::json!({
        "videoId": guid,
        "guid": guid,
        "title": title,
        "libraryId": s.bunny_stream.library_id,
        "tusEndpoint": "https://video.bunnycdn.com/tusupload",
        "authorizationSignature": tus_signature,
        "authorizationExpire": expire_unix,
        "uploadUrl": upload_url,
        "accessKey": s.bunny_stream.api_key,
        "hlsUrl": hls_url,
        "thumbnailUrl": thumbnail_url
    })))
}

pub async fn upload_video_handler(
    State(state): State<AppState>,
    Query(q): Query<UploadQuery>,
    mut multipart: Multipart,
) -> AppResult<Response> {
    let mut title = q.title.unwrap_or_else(|| "MaxxPixels Video".to_string());
    let mut bytes = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Invalid multipart payload: {}", e)))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name == "title" {
            if let Ok(txt) = field.text().await {
                if !txt.trim().is_empty() {
                    title = txt.trim().to_string();
                }
            }
            continue;
        }
        if name == "file" || name == "video" || bytes.is_empty() {
            bytes = field
                .bytes()
                .await
                .map_err(|e| AppError::BadRequest(format!("Failed reading video bytes: {}", e)))?
                .to_vec();
        }
    }

    let data = svc(&state).upload_video(&title, bytes).await?;
    Ok(ApiResponse::ok_response(data))
}

pub async fn serve_upload_handler(
    State(state): State<AppState>,
    Path((folder, file_name)): Path<(String, String)>,
) -> Response {
    let s = svc(&state);
    if let Some((bytes, mime)) = s.read_local_upload(&folder, &file_name).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .body(Body::from(bytes))
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
    }
    if let Some((bytes, mime)) = s.bunny_storage.download_file(&folder, &file_name).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, "public, max-age=86400")
            .body(Body::from(bytes))
            .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response());
    }
    StatusCode::NOT_FOUND.into_response()
}

pub async fn serve_flat_upload_handler(
    State(state): State<AppState>,
    Path(file_name): Path<String>,
) -> Response {
    serve_upload_handler(State(state), Path(("".to_string(), file_name))).await
}

pub async fn serve_poster_handler(
    State(state): State<AppState>,
    Path(file_name): Path<String>,
) -> Response {
    serve_upload_handler(State(state), Path(("posters".to_string(), file_name))).await
}

pub async fn serve_banner_handler(
    State(state): State<AppState>,
    Path(file_name): Path<String>,
) -> Response {
    serve_upload_handler(State(state), Path(("banners".to_string(), file_name))).await
}
