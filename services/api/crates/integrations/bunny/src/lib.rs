use chrono::Utc;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Duration;
use tracing::warn;
use uuid::Uuid;

fn shared_bunny_http() -> reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .pool_max_idle_per_host(16)
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap_or_else(|_| reqwest::Client::new())
        })
        .clone()
}

pub struct BunnyStreamClient {
    pub cdn_hostname: String,
    pub token_key: String,
    pub library_id: String,
    pub api_key: String,
    http: reqwest::Client,
}

impl BunnyStreamClient {
    pub fn from_env() -> Self {
        Self {
            cdn_hostname: std::env::var("BUNNY_STREAM_CDN_HOSTNAME").unwrap_or_default(),
            token_key: std::env::var("BUNNY_STREAM_TOKEN_KEY")
                .or_else(|_| std::env::var("BUNNY_STREAM_TOKEN_AUTH_KEY"))
                .unwrap_or_default(),
            library_id: std::env::var("BUNNY_STREAM_LIBRARY_ID").unwrap_or_default(),
            api_key: std::env::var("BUNNY_STREAM_API_KEY").unwrap_or_default(),
            http: shared_bunny_http(),
        }
    }

    pub fn sign_hls_url(&self, video_guid: &str, ttl_seconds: i64) -> String {
        let clean_guid = video_guid.trim();
        let path = format!("/{}/playlist.m3u8", clean_guid);
        if self.token_key.is_empty() {
            return format!("https://{}{}", self.cdn_hostname, path);
        }
        let expires = Utc::now().timestamp() + ttl_seconds;
        let hashable = format!("{}{}{}", self.token_key, path, expires);
        let mut hasher = Sha256::new();
        hasher.update(hashable.as_bytes());
        let token = hex::encode(hasher.finalize());
        format!(
            "https://{}{}?token={}&expires={}",
            self.cdn_hostname, path, token, expires
        )
    }

    pub fn sign_tus_upload(&self, video_guid: &str, expire_unix: i64) -> String {
        let raw = format!(
            "{}{}{}{}",
            self.library_id,
            self.api_key,
            expire_unix,
            video_guid.trim()
        );
        let mut hasher = Sha256::new();
        hasher.update(raw.as_bytes());
        hex::encode(hasher.finalize())
    }

    pub async fn create_video(&self, title: &str) -> Result<String, String> {
        if self.library_id.is_empty() || self.api_key.is_empty() {
            return Ok(Uuid::new_v4().to_string());
        }

        let url = format!(
            "https://video.bunnycdn.com/library/{}/videos",
            self.library_id
        );
        let resp = self
            .http
            .post(&url)
            .header("AccessKey", &self.api_key)
            .json(&json!({ "title": title }))
            .send()
            .await
            .map_err(|e| format!("Bunny Stream create video error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Bunny Stream returned status {}", resp.status()));
        }

        let body = resp
            .json::<Value>()
            .await
            .map_err(|e| format!("Bunny Stream parse error: {}", e))?;

        body.get("guid")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| "Missing video guid in Bunny Stream response".to_string())
    }

    pub async fn upload_video_bytes(&self, guid: &str, bytes: Vec<u8>) -> Result<(), String> {
        if self.library_id.is_empty() || self.api_key.is_empty() {
            return Ok(());
        }
        let url = format!(
            "https://video.bunnycdn.com/library/{}/videos/{}",
            self.library_id, guid
        );
        let resp = self
            .http
            .put(&url)
            .header("AccessKey", &self.api_key)
            .header("Content-Type", "application/octet-stream")
            .body(bytes)
            .send()
            .await
            .map_err(|e| format!("Bunny Stream upload error: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Bunny Stream upload status {}", resp.status()));
        }
        Ok(())
    }
}

pub struct BunnyStorageClient {
    pub storage_zone: String,
    pub api_key: String,
    pub cdn_url: String,
    pub uploads_root: PathBuf,
    http: reqwest::Client,
}

impl BunnyStorageClient {
    pub fn from_env() -> Self {
        Self {
            storage_zone: std::env::var("BUNNY_STORAGE_ZONE")
                .or_else(|_| std::env::var("BUNNY_STORAGE_ZONE_NAME"))
                .unwrap_or_default(),
            api_key: std::env::var("BUNNY_STORAGE_API_KEY")
                .or_else(|_| std::env::var("BUNNY_STORAGE_ZONE_PASSWORD"))
                .unwrap_or_default(),
            cdn_url: std::env::var("BUNNY_STORAGE_CDN_URL")
                .or_else(|_| std::env::var("BUNNY_PULL_ZONE_DOMAIN"))
                .unwrap_or_default()
                .trim_end_matches('/')
                .to_string(),
            uploads_root: PathBuf::from("./uploads"),
            http: shared_bunny_http(),
        }
    }

    pub async fn upload_file(
        &self,
        folder: &str,
        file_name: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Value {
        let safe_folder: String = folder
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .collect();
        let safe_folder = if safe_folder.is_empty() {
            "media".to_string()
        } else {
            safe_folder
        };

        let safe_name: String = file_name
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        let unique_name = format!("{}-{}", Utc::now().timestamp_millis(), safe_name);

        // Direct Bunny Edge Storage upload only (no local disk writes)
        if self.api_key.is_empty() || self.storage_zone.is_empty() {
            warn!("Bunny Storage credentials missing; cannot upload {}", unique_name);
            return json!({
                "error": "Bunny Storage is not configured (BUNNY_STORAGE_ZONE_NAME / BUNNY_STORAGE_ZONE_PASSWORD)",
                "provider": "BUNNY_STORAGE"
            });
        }

        let remote_url = format!(
            "https://storage.bunnycdn.com/{}/{}/{}",
            self.storage_zone, safe_folder, unique_name
        );
        let resp = self
            .http
            .put(&remote_url)
            .header("AccessKey", &self.api_key)
            .header("Content-Type", content_type)
            .body(bytes)
            .send()
            .await;

        let direct_cdn = std::env::var("MEDIA_DIRECT_CDN")
            .map(|v| v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
        let public_base = std::env::var("PUBLIC_BASE_URL")
            .unwrap_or_default()
            .trim_end_matches('/')
            .to_string();

        match resp {
            Ok(r) if r.status().is_success() => {
                let full_url = if direct_cdn && !self.cdn_url.is_empty() {
                    format!("{}/{}/{}", self.cdn_url, safe_folder, unique_name)
                } else {
                    format!("{}/api/v1/uploads/{}/{}", public_base, safe_folder, unique_name)
                };
                json!({
                    "provider": "BUNNY_STORAGE",
                    "folder": safe_folder,
                    "fileName": unique_name,
                    "url": full_url,
                    "fileUrl": full_url
                })
            }
            Ok(r) => {
                let status = r.status();
                warn!("Bunny Storage upload failed with status {}", status);
                json!({
                    "error": format!("Bunny Storage upload failed with HTTP {}", status),
                    "provider": "BUNNY_STORAGE"
                })
            }
            Err(e) => {
                warn!("Bunny Storage upload error: {}", e);
                json!({
                    "error": format!("Bunny Storage upload error: {}", e),
                    "provider": "BUNNY_STORAGE"
                })
            }
        }
    }

    /// Streams an object directly from Bunny Edge Storage API (bypasses suspended Pull Zones).
    pub async fn download_file(&self, folder: &str, file_name: &str) -> Option<(Vec<u8>, String)> {
        if self.api_key.is_empty() || self.storage_zone.is_empty() {
            return None;
        }
        let clean_folder = folder.trim_matches('/');
        let clean_name = file_name.trim_matches('/');
        if clean_name.is_empty() || clean_name.contains("..") {
            return None;
        }

        let mut candidates = Vec::new();
        if !clean_folder.is_empty() {
            candidates.push(format!("{}/{}", clean_folder, clean_name));
        }
        candidates.push(clean_name.to_string());
        if clean_folder != "posters" {
            candidates.push(format!("posters/{}", clean_name));
        }
        if clean_folder != "banners" {
            candidates.push(format!("banners/{}", clean_name));
        }

        let lower = clean_name.to_lowercase();
        let guessed_mime = if lower.ends_with(".png") {
            "image/png"
        } else if lower.ends_with(".webp") {
            "image/webp"
        } else if lower.ends_with(".gif") {
            "image/gif"
        } else if lower.ends_with(".svg") {
            "image/svg+xml"
        } else if lower.ends_with(".pdf") {
            "application/pdf"
        } else if lower.ends_with(".mp4") {
            "video/mp4"
        } else {
            "image/jpeg"
        };

        for rel in candidates {
            let url = format!("https://storage.bunnycdn.com/{}/{}", self.storage_zone, rel);
            if let Ok(resp) = self
                .http
                .get(&url)
                .header("AccessKey", &self.api_key)
                .send()
                .await
            {
                if resp.status().is_success() {
                    let mime = resp
                        .headers()
                        .get(reqwest::header::CONTENT_TYPE)
                        .and_then(|v| v.to_str().ok())
                        .filter(|ct| !ct.starts_with("application/octet-stream"))
                        .unwrap_or(guessed_mime)
                        .to_string();
                    if let Ok(bytes) = resp.bytes().await {
                        if !bytes.is_empty() {
                            return Some((bytes.to_vec(), mime));
                        }
                    }
                }
            }
        }
        None
    }
}
