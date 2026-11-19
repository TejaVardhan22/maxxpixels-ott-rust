use maxx_common::error::AppResult;
use maxx_common::validation::{Validatable, ValidationBag};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveProgressRequest {
    pub content_id: i64,
    pub episode_id: Option<i64>,
    pub profile_id: Option<i64>,
    pub position_seconds: Option<i32>,
    pub current_position_seconds: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub total_duration_seconds: Option<i32>,
    pub completed: Option<bool>,
}

impl Validatable for SaveProgressRequest {
    fn validate(&self) -> AppResult<()> {
        let mut v = ValidationBag::new();
        v.positive_id("contentId", self.content_id);
        v.optional_range_i32("positionSeconds", self.position_seconds.or(self.current_position_seconds), 0, 86400);
        v.optional_range_i32("durationSeconds", self.duration_seconds.or(self.total_duration_seconds), 0, 86400);
        v.finish()
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchHistoryItemDto {
    pub id: i64,
    pub content_id: i64,
    pub episode_id: Option<i64>,
    pub profile_id: i64,
    pub title: String,
    pub slug: String,
    pub poster_url: String,
    pub backdrop_url: String,
    pub content_type: String,
    pub position_seconds: i32,
    pub duration_seconds: i32,
    pub percentage: f64,
    pub completed: bool,
    pub last_watched_at: String,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistToggleRequest {
    pub content_id: Option<i64>,
    pub profile_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchlistItemDto {
    pub id: i64,
    pub content_id: i64,
    pub title: String,
    pub slug: String,
    pub poster_url: String,
    pub backdrop_url: String,
    pub content_type: String,
    pub added_at: String,
}

