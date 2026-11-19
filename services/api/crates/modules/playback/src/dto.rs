use maxx_common::error::AppResult;
use maxx_common::validation::{Validatable, ValidationBag};
use serde::{Deserialize, Serialize};

/// Playback authorization accepts both camelCase and snake_case keys. Several
/// web clients send both spellings in the same payload, so each alias gets its
/// own field instead of a serde alias (which would reject the duplicate).
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizePlaybackRequest {
    pub content_id: Option<i64>,
    #[serde(rename = "content_id")]
    pub content_id_snake: Option<i64>,
    pub video_id: Option<i64>,
    #[serde(rename = "video_id")]
    pub video_id_snake: Option<i64>,
    pub episode_id: Option<i64>,
    #[serde(rename = "episode_id")]
    pub episode_id_snake: Option<i64>,
    pub is_trailer: Option<bool>,
    #[serde(rename = "is_trailer")]
    pub is_trailer_snake: Option<bool>,
    pub device_id: Option<String>,
    #[serde(rename = "device_id")]
    pub device_id_snake: Option<String>,
    pub device_type: Option<String>,
    #[serde(rename = "device_type")]
    pub device_type_snake: Option<String>,
    pub profile_id: Option<i64>,
    #[serde(rename = "profile_id")]
    pub profile_id_snake: Option<i64>,
}

impl AuthorizePlaybackRequest {
    pub fn resolved_content_id(&self) -> i64 {
        self.content_id
            .or(self.content_id_snake)
            .or(self.video_id)
            .or(self.video_id_snake)
            .unwrap_or(0)
    }

    pub fn resolved_episode_id(&self) -> Option<i64> {
        self.episode_id.or(self.episode_id_snake)
    }

    pub fn resolved_is_trailer(&self) -> bool {
        self.is_trailer.or(self.is_trailer_snake).unwrap_or(false)
    }

    pub fn resolved_device_id(&self) -> Option<String> {
        self.device_id.clone().or_else(|| self.device_id_snake.clone())
    }

    pub fn resolved_device_type(&self) -> Option<String> {
        self.device_type
            .clone()
            .or_else(|| self.device_type_snake.clone())
    }

    pub fn resolved_profile_id(&self) -> Option<i64> {
        self.profile_id.or(self.profile_id_snake)
    }
}

impl Validatable for AuthorizePlaybackRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.positive_id("contentId", self.resolved_content_id());
        v.finish()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizePlaybackResponse {
    pub authorized: bool,
    pub content_id: i64,
    pub session_id: String,
    pub session_token: String,
    pub stream_url: String,
    pub hls_url: String,
    pub master_playlist_url: String,
    pub bunny_video_id: String,
    pub resume_position_seconds: i32,
    pub duration_seconds: i32,
    pub is_trailer: bool,
    pub subtitles: Vec<serde_json::Value>,
    pub audio_tracks: Vec<serde_json::Value>,
    pub content_warnings: Vec<String>,
    pub skip_intro_start: Option<i32>,
    pub skip_intro_end: Option<i32>,
    pub skip_outro_start: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HeartbeatRequest {
    pub session_id: Option<String>,
    pub session_token: Option<String>,
    pub content_id: Option<i64>,
    pub episode_id: Option<i64>,
    pub position_seconds: Option<i32>,
    pub current_position_seconds: Option<i32>,
    pub total_duration_seconds: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StopPlaybackRequest {
    pub session_id: Option<String>,
    pub session_token: Option<String>,
}

