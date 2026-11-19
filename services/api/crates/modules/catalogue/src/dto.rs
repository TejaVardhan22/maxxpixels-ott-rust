use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CatalogBrowseQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    #[serde(rename = "type")]
    pub content_type: Option<String>,
    pub category_id: Option<i64>,
    pub genre_id: Option<i64>,
    pub language: Option<String>,
    pub access_type: Option<String>,
    pub featured: Option<String>,
    pub trending: Option<String>,
    pub search: Option<String>,
    pub q: Option<String>,
    pub query: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenreDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDto {
    pub id: i64,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageDto {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub native_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentTypeDto {
    pub id: i64,
    pub slug: String,
    pub title: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicMetadataDto {
    pub languages: Vec<LanguageDto>,
    pub categories: Vec<CategoryDto>,
    pub genres: Vec<GenreDto>,
    pub content_types: Vec<ContentTypeDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentDto {
    pub id: i64,
    pub video_id: i64,
    pub title: String,
    pub name: String,
    pub slug: String,
    pub description: String,
    pub short_description: String,
    #[serde(rename = "type")]
    pub r#type: String,
    pub content_type: String,
    pub status: String,
    pub access_type: String,
    pub monetization: String,
    pub rent_price: Option<f64>,
    pub validity_hours: Option<i32>,
    pub release_year: i32,
    pub release_date: String,
    pub age_rating: String,
    pub maturity_rating: String,
    pub poster_url: String,
    pub backdrop_url: String,
    pub landscape_image_url: String,
    pub banner_url: String,
    pub logo_image_url: String,
    pub trailer_url: String,
    pub video_url: String,
    pub master_playlist_url: String,
    pub bunny_video_id: String,
    pub producer: String,
    pub production_house: String,
    pub duration_seconds: i32,
    pub duration_minutes: i32,
    pub director: String,
    pub original_language_code: String,
    pub original_language: String,
    pub language_id: i64,
    pub language_name: String,
    pub is_premium: bool,
    pub is_featured: bool,
    pub is_trending: bool,
    pub is_original: bool,
    pub view_count: i64,
    pub content_type_id: i64,
    pub producer_id: Option<i64>,
    pub genres: Vec<GenreDto>,
    pub categories: Vec<CategoryDto>,
    pub category: Vec<String>,
    pub subtitles: Vec<serde_json::Value>,
    pub audio_tracks: Vec<serde_json::Value>,
    pub cast: Vec<serde_json::Value>,
    pub content_warnings: Vec<String>,
    pub quality_badges: Vec<String>,
    pub skip_intro_start: Option<i32>,
    pub skip_intro_end: Option<i32>,
    pub skip_outro_start: Option<i32>,
    pub scheduled_publish_at: Option<String>,
    pub expires_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub related_content: Option<Vec<ContentDto>>,
}

