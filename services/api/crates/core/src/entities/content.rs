use chrono::{DateTime, FixedOffset, NaiveDate};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "contents")]
#[serde(rename_all = "camelCase")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i64,
    pub title: String,
    #[sea_orm(unique)]
    pub slug: String,
    pub description: Option<String>,
    pub short_description: Option<String>,
    pub content_type: Option<String>,
    #[sea_orm(column_name = "type")]
    pub r#type: Option<String>,
    pub status: String,
    pub access_type: Option<String>,
    pub monetization: Option<String>,
    pub rent_price: Option<Decimal>,
    pub validity_hours: Option<i32>,
    pub release_year: Option<i32>,
    pub release_date: Option<NaiveDate>,
    pub age_rating: Option<String>,
    pub poster_url: Option<String>,
    pub poster_2_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub landscape_image_url: Option<String>,
    pub logo_image_url: Option<String>,
    pub banner_image_url: Option<String>,
    pub trailer_url: Option<String>,
    pub subtitles_json: Option<String>,
    pub audio_tracks_json: Option<String>,
    pub cast_json: Option<String>,
    pub content_warnings: Option<String>,
    pub quality_badges: Option<String>,
    pub skip_intro_start: Option<i32>,
    pub skip_intro_end: Option<i32>,
    pub skip_outro_start: Option<i32>,
    pub scheduled_publish_at: Option<DateTime<FixedOffset>>,
    pub expires_at: Option<DateTime<FixedOffset>>,
    pub duration_seconds: Option<i32>,
    pub original_language_code: Option<String>,
    pub is_premium: Option<bool>,
    pub is_featured: Option<bool>,
    pub is_trending: Option<bool>,
    pub is_original: Option<bool>,
    pub view_count: Option<i64>,
    pub producer_id: Option<i64>,
    pub content_type_id: Option<i64>,
    pub production_name: Option<String>,
    pub producer_contact_phone: Option<String>,
    pub producer_email: Option<String>,
    pub google_drive_link: Option<String>,
    pub one_line_brief: Option<String>,
    pub submission_source: Option<String>,
    pub agreement_url: Option<String>,
    pub agreement_status: Option<String>,
    pub drm_rule_id: Option<i64>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
    pub published_at: Option<DateTime<FixedOffset>>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

