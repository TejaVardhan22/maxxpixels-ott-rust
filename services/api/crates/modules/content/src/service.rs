use chrono::Utc;
use maxx_common::error::{AppError, AppResult};
use maxx_common::validation::{
    ValidationBag, ALLOWED_CONTENT_STATUS, ALLOWED_MONETIZATION,
};
use maxx_core::entities::{content, episode, live_channel, live_event, movie, season, series};
use maxx_integration_bunny::{BunnyStorageClient, BunnyStreamClient};
use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, DatabaseConnection,
    EntityTrait, QueryFilter, QueryOrder, Set, Statement,
};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::str::FromStr;

pub struct ContentService {
    pub db: DatabaseConnection,
    pub bunny_stream: BunnyStreamClient,
    pub bunny_storage: BunnyStorageClient,
    pub public_base_url: String,
}

impl ContentService {
    pub fn new(db: DatabaseConnection, public_base_url: String) -> Self {
        Self {
            db,
            bunny_stream: BunnyStreamClient::from_env(),
            bunny_storage: BunnyStorageClient::from_env(),
            public_base_url,
        }
    }

    fn slugify(input: &str) -> String {
        let mut s: String = input
            .to_lowercase()
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
            .collect();
        while s.contains("--") {
            s = s.replace("--", "-");
        }
        let trimmed = s.trim_matches('-').to_string();
        if trimmed.is_empty() {
            format!("item-{}", Utc::now().timestamp_millis())
        } else {
            format!("{}-{}", trimmed, Utc::now().timestamp() % 100000)
        }
    }

    fn opt_str(v: &Value, keys: &[&str]) -> Option<String> {
        for k in keys {
            if let Some(s) = v.get(*k).and_then(|x| x.as_str()) {
                let t = s.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }
        None
    }

    fn opt_i32(v: &Value, keys: &[&str]) -> Option<i32> {
        for k in keys {
            if let Some(n) = v.get(*k).and_then(|x| x.as_i64()) {
                return Some(n as i32);
            }
        }
        None
    }

    fn opt_bool(v: &Value, keys: &[&str]) -> Option<bool> {
        for k in keys {
            if let Some(b) = v.get(*k).and_then(|x| x.as_bool()) {
                return Some(b);
            }
        }
        None
    }

    fn opt_decimal(v: &Value, keys: &[&str]) -> Option<Decimal> {
        for k in keys {
            if let Some(val) = v.get(*k) {
                if let Some(f) = val.as_f64() {
                    if let Some(d) = Decimal::from_f64_retain(f) {
                        return Some(d);
                    }
                } else if let Some(s) = val.as_str() {
                    if let Ok(d) = Decimal::from_str(s.trim()) {
                        return Some(d);
                    }
                }
            }
        }
        None
    }

    fn opt_json_array_str(v: &Value, keys: &[&str]) -> Option<String> {
        for k in keys {
            if let Some(val) = v.get(*k) {
                if val.is_array() {
                    return Some(val.to_string());
                }
                if let Some(s) = val.as_str() {
                    let t = s.trim();
                    if !t.is_empty() {
                        return Some(t.to_string());
                    }
                }
            }
        }
        None
    }

    fn normalize_language_code(raw: &str) -> String {
        let lower = raw.trim().to_lowercase();
        match lower.as_str() {
            "kannada" | "kan" => "kn".to_string(),
            "hindi" | "hin" => "hi".to_string(),
            "telugu" | "tel" => "te".to_string(),
            "tamil" | "tam" => "ta".to_string(),
            "malayalam" | "mal" => "ml".to_string(),
            "marathi" | "mar" => "mr".to_string(),
            "bengali" | "ben" => "bn".to_string(),
            "punjabi" | "pan" => "pa".to_string(),
            "gujarati" | "guj" => "gu".to_string(),
            "english" | "eng" => "en".to_string(),
            _ => lower,
        }
    }

    fn parse_release_date(v: &Value) -> Option<chrono::NaiveDate> {
        if let Some(rd) = Self::opt_str(v, &["releaseDate", "release_date"]) {
            let date_part = rd.split('T').next().unwrap_or(&rd).trim();
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                return Some(d);
            }
        }
        None
    }

    async fn next_movie_row_id(&self, preferred_id: i64) -> i64 {
        if let Ok(Some(row)) = self
            .db
            .query_one(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT CASE WHEN EXISTS (SELECT 1 FROM movies WHERE id = $1) THEN (SELECT COALESCE(MAX(id), 0) + 1 FROM movies) ELSE $1 END AS next_id",
                [preferred_id.into()],
            ))
            .await
        {
            if let Ok(nid) = row.try_get::<i64>("", "next_id") {
                return nid;
            }
        }
        preferred_id
    }

    fn parse_release_year(v: &Value) -> Option<i32> {
        if let Some(y) = Self::opt_i32(v, &["releaseYear", "release_year"]) {
            if (1900..=2100).contains(&y) {
                return Some(y);
            }
        }
        if let Some(rd) = Self::opt_str(v, &["releaseDate", "release_date"]) {
            if rd.len() >= 4 {
                if let Ok(y) = rd[..4].parse::<i32>() {
                    if (1900..=2100).contains(&y) {
                        return Some(y);
                    }
                }
            }
        }
        None
    }

    fn extract_str_list(v: &Value, keys: &[&str]) -> Option<Vec<String>> {
        for k in keys {
            if let Some(val) = v.get(*k) {
                if let Some(arr) = val.as_array() {
                    let out: Vec<String> = arr
                        .iter()
                        .filter_map(|item| {
                            if let Some(s) = item.as_str() {
                                let t = s.trim();
                                if !t.is_empty() {
                                    return Some(t.to_string());
                                }
                            } else if let Some(n) = item.as_i64() {
                                return Some(n.to_string());
                            } else if let Some(obj) = item.as_object() {
                                if let Some(s) = obj
                                    .get("name")
                                    .or_else(|| obj.get("slug"))
                                    .and_then(|x| x.as_str())
                                {
                                    let t = s.trim();
                                    if !t.is_empty() {
                                        return Some(t.to_string());
                                    }
                                }
                            }
                            None
                        })
                        .collect();
                    return Some(out);
                }
            }
        }
        None
    }

    fn resolve_primary_stream_url(&self, payload: &Value, bunny_guid: Option<&str>) -> Option<String> {
        if let Some(url) = Self::opt_str(
            payload,
            &[
                "masterPlaylistUrl",
                "master_playlist_url",
                "hlsUrl",
                "hls_url",
                "streamUrl",
                "stream_url",
                "videoUrl",
                "video_url",
                "video4kUrl",
                "video2kUrl",
                "video1080Url",
                "video720Url",
                "video480Url",
                "video320Url",
                "videoAssetId",
                "video_asset_id",
            ],
        ) {
            return Some(url);
        }
        if let Some(guid) = bunny_guid {
            let g = guid.trim();
            if !g.is_empty() && !self.bunny_stream.cdn_hostname.is_empty() {
                return Some(format!(
                    "https://{}/{}/playlist.m3u8",
                    self.bunny_stream.cdn_hostname.trim_end_matches('/'),
                    g
                ));
            }
        }
        None
    }

    async fn sync_categories_and_genres(&self, content_id: i64, payload: &Value) {
        if let Some(cat_names) = Self::extract_str_list(payload, &["categories", "category"]) {
            let _ = self
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "DELETE FROM content_categories WHERE content_id = $1",
                    [content_id.into()],
                ))
                .await;

            for raw in cat_names {
                if let Ok(cat_id) = raw.parse::<i64>() {
                    let _ = self
                        .db
                        .execute(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            "INSERT INTO content_categories (content_id, category_id) SELECT $1, id FROM categories WHERE id = $2 ON CONFLICT DO NOTHING",
                            [content_id.into(), cat_id.into()],
                        ))
                        .await;
                } else {
                    let _ = self
                        .db
                        .execute(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            "INSERT INTO content_categories (content_id, category_id) SELECT $1, id FROM categories WHERE LOWER(name) = LOWER($2) OR LOWER(COALESCE(slug, '')) = LOWER($2) LIMIT 1 ON CONFLICT DO NOTHING",
                            [content_id.into(), raw.into()],
                        ))
                        .await;
                }
            }
        }

        if let Some(genre_names) = Self::extract_str_list(payload, &["genres"]) {
            let _ = self
                .db
                .execute(Statement::from_sql_and_values(
                    DatabaseBackend::Postgres,
                    "DELETE FROM content_genres WHERE content_id = $1",
                    [content_id.into()],
                ))
                .await;

            for raw in genre_names {
                if let Ok(gid) = raw.parse::<i64>() {
                    let _ = self
                        .db
                        .execute(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            "INSERT INTO content_genres (content_id, genre_id) SELECT $1, id FROM genres WHERE id = $2 ON CONFLICT DO NOTHING",
                            [content_id.into(), gid.into()],
                        ))
                        .await;
                } else {
                    let _ = self
                        .db
                        .execute(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            "INSERT INTO content_genres (content_id, genre_id) SELECT $1, id FROM genres WHERE LOWER(name) = LOWER($2) OR LOWER(COALESCE(slug, '')) = LOWER($2) LIMIT 1 ON CONFLICT DO NOTHING",
                            [content_id.into(), raw.into()],
                        ))
                        .await;
                }
            }
        }
    }

    fn validate_content_payload(payload: &Value, is_create: bool) -> AppResult<()> {
        let mut v = ValidationBag::new();
        let title = Self::opt_str(payload, &["title"]);
        if is_create {
            v.require_text("title", title.as_deref(), 1, 250);
        } else {
            v.optional_text("title", title.as_deref(), 250);
        }
        let status = Self::opt_str(payload, &["status"]);
        v.optional_enum("status", status.as_deref(), ALLOWED_CONTENT_STATUS);
        let mon = Self::opt_str(payload, &["monetization"]);
        v.optional_enum("monetization", mon.as_deref(), ALLOWED_MONETIZATION);
        v.optional_range_i32(
            "validityHours",
            Self::opt_i32(payload, &["validityHours", "validity_hours"]),
            1,
            8760,
        );
        if let Some(rp) = Self::opt_decimal(payload, &["rentPrice", "rent_price"]) {
            if rp.is_sign_negative() {
                v.add("rentPrice", "must be a non-negative amount");
            }
        }
        v.optional_url("posterUrl", Self::opt_str(payload, &["posterUrl", "poster_url"]).as_deref());
        v.optional_url("bannerUrl", Self::opt_str(payload, &["bannerUrl", "bannerImageUrl", "banner_image_url"]).as_deref());
        v.optional_url("trailerUrl", Self::opt_str(payload, &["trailerUrl", "trailer_url"]).as_deref());
        v.optional_url("logoImageUrl", Self::opt_str(payload, &["logoImageUrl", "logo_image_url"]).as_deref());
        if status.as_deref().map(|s| s.eq_ignore_ascii_case("SCHEDULED")).unwrap_or(false) {
            match Self::opt_str(payload, &["scheduledPublishAt", "scheduled_publish_at"]) {
                Some(ts) if chrono::DateTime::parse_from_rfc3339(&ts).is_ok() => {}
                _ => v.add("scheduledPublishAt", "must be a valid ISO-8601 timestamp when status is SCHEDULED"),
            }
        }
        v.finish()
    }

    // ─── MOVIES ─────────────────────────────────────────────────────────────────

    pub async fn create_movie(&self, payload: Value) -> AppResult<Value> {
        Self::validate_content_payload(&payload, true)?;
        let title = Self::opt_str(&payload, &["title"])
            .ok_or_else(|| AppError::BadRequest("title is required".into()))?;
        let slug = Self::opt_str(&payload, &["slug"]).unwrap_or_else(|| Self::slugify(&title));
        let now = Utc::now().fixed_offset();
        let status = Self::opt_str(&payload, &["status"]).unwrap_or_else(|| "DRAFT".into());

        let content_type_norm = Self::opt_str(&payload, &["contentType", "content_type", "type"])
            .map(|t| t.to_uppercase())
            .unwrap_or_else(|| "MOVIE".into());
        let monetization_norm = Self::opt_str(&payload, &["monetization"])
            .or_else(|| Self::opt_str(&payload, &["accessType", "access_type"]))
            .map(|m| m.to_uppercase())
            .unwrap_or_else(|| "AVOD".into());
        let derived_is_premium = Self::opt_bool(&payload, &["isPremium", "is_premium"])
            .unwrap_or(monetization_norm != "AVOD" && monetization_norm != "FREE");

        let new_content = content::ActiveModel {
            title: Set(title),
            slug: Set(slug),
            description: Set(Self::opt_str(&payload, &["description", "synopsis"])),
            short_description: Set(Self::opt_str(&payload, &["shortDescription", "short_description"])),
            content_type: Set(Some(content_type_norm.clone())),
            r#type: Set(Some(content_type_norm)),
            status: Set(status.clone()),
            access_type: Set(Some(monetization_norm.clone())),
            monetization: Set(Some(monetization_norm.clone())),
            rent_price: Set(Self::opt_decimal(&payload, &["rentPrice", "rent_price"])),
            validity_hours: Set(Self::opt_i32(&payload, &["validityHours", "validity_hours"])),
            release_year: Set(Self::parse_release_year(&payload)),
            release_date: Set(Self::parse_release_date(&payload)),
            age_rating: Set(Self::opt_str(&payload, &["ageRating", "age_rating", "maturityRating", "maturity_rating"])),
            production_name: Set(Self::opt_str(&payload, &["productionHouse", "production_house", "producer"])),
            poster_url: Set(Self::opt_str(&payload, &["posterUrl", "poster_url"])),
            backdrop_url: Set(Self::opt_str(&payload, &["backdropUrl", "backdrop_url", "bannerUrl", "bannerImageUrl", "banner_image_url"])),
            landscape_image_url: Set(Self::opt_str(&payload, &["landscapeImageUrl", "landscape_image_url", "bannerUrl", "bannerImageUrl"])),
            logo_image_url: Set(Self::opt_str(&payload, &["logoImageUrl", "logo_image_url"])),
            banner_image_url: Set(Self::opt_str(&payload, &["bannerImageUrl", "banner_image_url", "bannerUrl"])),
            trailer_url: Set(Self::opt_str(&payload, &["trailerUrl", "trailer_url"])),
            subtitles_json: Set(Self::opt_json_array_str(&payload, &["subtitles", "subtitleTracks", "subtitlesJson"])),
            audio_tracks_json: Set(Self::opt_json_array_str(&payload, &["audioTracks", "audio_tracks", "audioTracksJson"])),
            cast_json: Set(Self::opt_json_array_str(&payload, &["cast", "castMembers", "castJson"])),
            content_warnings: Set(Self::opt_json_array_str(&payload, &["contentWarnings", "content_warnings"])),
            quality_badges: Set(Self::opt_json_array_str(&payload, &["qualityBadges", "quality_badges"])),
            skip_intro_start: Set(Self::opt_i32(&payload, &["skipIntroStart", "skip_intro_start"])),
            skip_intro_end: Set(Self::opt_i32(&payload, &["skipIntroEnd", "skip_intro_end"])),
            skip_outro_start: Set(Self::opt_i32(&payload, &["skipOutroStart", "skip_outro_start"])),
            scheduled_publish_at: Set(Self::opt_str(&payload, &["scheduledPublishAt", "scheduled_publish_at"])
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())),
            expires_at: Set(Self::opt_str(&payload, &["expiresAt", "expires_at"])
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())),
            duration_seconds: Set(Self::opt_i32(&payload, &["durationSeconds", "duration_seconds"])
                .or_else(|| Self::opt_i32(&payload, &["durationMinutes", "duration_minutes"]).map(|m| m * 60))),
            original_language_code: Set(
                Self::opt_str(
                    &payload,
                    &[
                        "originalLanguageCode",
                        "original_language_code",
                        "originalLanguage",
                        "original_language",
                        "language",
                        "languageCode",
                    ],
                )
                .map(|l| Self::normalize_language_code(&l)),
            ),
            is_premium: Set(Some(derived_is_premium)),
            is_featured: Set(Self::opt_bool(&payload, &["isFeatured", "is_featured"])),
            is_trending: Set(Self::opt_bool(&payload, &["isTrending", "is_trending"])),
            is_original: Set(Self::opt_bool(&payload, &["isOriginal", "is_original"])),
            view_count: Set(Some(0)),
            created_at: Set(now),
            updated_at: Set(now),
            published_at: Set(if status.eq_ignore_ascii_case("PUBLISHED") { Some(now) } else { None }),
            ..Default::default()
        };

        let saved_content = new_content.insert(&self.db).await?;
        let bunny_guid = Self::opt_str(
            &payload,
            &["bunnyVideoGuid", "bunny_video_guid", "bunnyVideoId", "bunny_video_id"],
        );
        let resolved_stream = self.resolve_primary_stream_url(&payload, bunny_guid.as_deref());
        let dur_mins = Self::opt_i32(&payload, &["durationMinutes", "duration_minutes"]);
        let dur_secs = Self::opt_i32(&payload, &["durationSeconds", "duration_seconds"])
            .or_else(|| dur_mins.map(|m| m * 60));

        let movie_row_id = self.next_movie_row_id(saved_content.id).await;
        let new_movie = movie::ActiveModel {
            id: Set(movie_row_id),
            content_id: Set(Some(saved_content.id)),
            video_asset_id: Set(
                Self::opt_str(&payload, &["videoAssetId", "video_asset_id"])
                    .or_else(|| resolved_stream.clone()),
            ),
            video_url: Set(
                Self::opt_str(&payload, &["videoUrl", "video_url"])
                    .or_else(|| resolved_stream.clone()),
            ),
            bunny_video_guid: Set(bunny_guid),
            duration_minutes: Set(dur_mins),
            duration_seconds: Set(dur_secs),
            director: Set(Self::opt_str(&payload, &["director"])),
            writers: Set(Self::opt_str(&payload, &["writers"])),
            production_house: Set(Self::opt_str(&payload, &["productionHouse", "production_house", "producer"])),
            country_of_origin: Set(Self::opt_str(&payload, &["countryOfOrigin", "country_of_origin"])),
            is_tvod_available: Set(Some(
                Self::opt_bool(&payload, &["isTvodAvailable", "is_tvod_available"])
                    .unwrap_or(monetization_norm == "TVOD"),
            )),
            drm_enabled: Set(Self::opt_bool(&payload, &["drmEnabled", "drm_enabled"])),
            stream_url: Set(
                Self::opt_str(&payload, &["streamUrl", "stream_url"])
                    .or_else(|| resolved_stream.clone()),
            ),
            hls_url: Set(
                Self::opt_str(&payload, &["hlsUrl", "hls_url", "masterPlaylistUrl", "master_playlist_url"])
                    .or(resolved_stream),
            ),
            dash_url: Set(Self::opt_str(&payload, &["dashUrl", "dash_url"])),
        };
        let saved_movie = new_movie.insert(&self.db).await?;
        self.sync_categories_and_genres(saved_content.id, &payload).await;
        Ok(json!({ "content": saved_content, "movie": saved_movie, "id": saved_content.id }))
    }

    pub async fn update_movie(&self, id: i64, payload: Value) -> AppResult<Value> {
        Self::validate_content_payload(&payload, false)?;
        let existing_content = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Movie not found".into()))?;
        let existing_published_at = existing_content.published_at;
        let mut active_c: content::ActiveModel = existing_content.into();

        if let Some(v) = Self::opt_str(&payload, &["title"]) {
            active_c.title = Set(v);
        }
        if let Some(ct) = Self::opt_str(&payload, &["contentType", "content_type", "type"]) {
            let norm = ct.to_uppercase();
            active_c.content_type = Set(Some(norm.clone()));
            active_c.r#type = Set(Some(norm));
        }
        if let Some(v) = Self::opt_str(&payload, &["description", "synopsis"]) {
            active_c.description = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["status"]) {
            let norm = v.to_uppercase();
            if norm == "PUBLISHED" && existing_published_at.is_none() {
                active_c.published_at = Set(Some(Utc::now().fixed_offset()));
            }
            active_c.status = Set(norm);
        }
        if let Some(m) = Self::opt_str(&payload, &["monetization", "accessType", "access_type"]) {
            let norm = m.to_uppercase();
            active_c.monetization = Set(Some(norm.clone()));
            active_c.access_type = Set(Some(norm.clone()));
            active_c.is_premium = Set(Some(norm != "AVOD" && norm != "FREE"));
        } else if let Some(p) = Self::opt_bool(&payload, &["isPremium", "is_premium"]) {
            active_c.is_premium = Set(Some(p));
        }
        if let Some(rp) = Self::opt_decimal(&payload, &["rentPrice", "rent_price"]) {
            active_c.rent_price = Set(Some(rp));
        }
        if let Some(vh) = Self::opt_i32(&payload, &["validityHours", "validity_hours"]) {
            active_c.validity_hours = Set(Some(vh));
        }
        if let Some(v) = Self::opt_str(&payload, &["posterUrl", "poster_url"]) {
            active_c.poster_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["backdropUrl", "backdrop_url"]) {
            active_c.backdrop_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["bannerImageUrl", "banner_image_url", "bannerUrl"]) {
            active_c.banner_image_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["logoImageUrl", "logo_image_url"]) {
            active_c.logo_image_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["contentWarnings", "content_warnings"]) {
            active_c.content_warnings = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["qualityBadges", "quality_badges"]) {
            active_c.quality_badges = Set(Some(v));
        }
        if let Some(v) = Self::opt_i32(&payload, &["skipIntroStart", "skip_intro_start"]) {
            active_c.skip_intro_start = Set(Some(v));
        }
        if let Some(v) = Self::opt_i32(&payload, &["skipIntroEnd", "skip_intro_end"]) {
            active_c.skip_intro_end = Set(Some(v));
        }
        if let Some(v) = Self::opt_i32(&payload, &["skipOutroStart", "skip_outro_start"]) {
            active_c.skip_outro_start = Set(Some(v));
        }
        if let Some(s) = Self::opt_str(&payload, &["scheduledPublishAt", "scheduled_publish_at"]) {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&s) {
                active_c.scheduled_publish_at = Set(Some(dt));
            }
        } else if payload.get("scheduledPublishAt").is_some() || payload.get("scheduled_publish_at").is_some() {
            active_c.scheduled_publish_at = Set(None);
        }
        if let Some(s) = Self::opt_str(&payload, &["expiresAt", "expires_at"]) {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&s) {
                active_c.expires_at = Set(Some(dt));
            }
        } else if payload.get("expiresAt").is_some() || payload.get("expires_at").is_some() {
            active_c.expires_at = Set(None);
        }
        if let Some(v) = Self::opt_str(&payload, &["trailerUrl", "trailer_url"]) {
            active_c.trailer_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["subtitles", "subtitleTracks", "subtitlesJson"]) {
            active_c.subtitles_json = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["audioTracks", "audio_tracks", "audioTracksJson"]) {
            active_c.audio_tracks_json = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["cast", "castMembers", "castJson"]) {
            active_c.cast_json = Set(Some(v));
        }
        if let Some(v) = Self::parse_release_year(&payload) {
            active_c.release_year = Set(Some(v));
        }
        if let Some(d) = Self::parse_release_date(&payload) {
            active_c.release_date = Set(Some(d));
        }
        if let Some(v) = Self::opt_str(&payload, &["productionHouse", "production_house", "producer"]) {
            active_c.production_name = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["ageRating", "age_rating", "maturityRating", "maturity_rating"]) {
            active_c.age_rating = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(
            &payload,
            &[
                "originalLanguageCode",
                "original_language_code",
                "originalLanguage",
                "original_language",
                "language",
                "languageCode",
            ],
        ) {
            active_c.original_language_code = Set(Some(Self::normalize_language_code(&v)));
        }
        if let Some(secs) = Self::opt_i32(&payload, &["durationSeconds", "duration_seconds"])
            .or_else(|| Self::opt_i32(&payload, &["durationMinutes", "duration_minutes"]).map(|m| m * 60))
        {
            active_c.duration_seconds = Set(Some(secs));
        }
        if let Some(v) = Self::opt_bool(&payload, &["isPremium", "is_premium"]) {
            active_c.is_premium = Set(Some(v));
        }
        if let Some(v) = Self::opt_bool(&payload, &["isFeatured", "is_featured"]) {
            active_c.is_featured = Set(Some(v));
        }
        if let Some(v) = Self::opt_bool(&payload, &["isTrending", "is_trending"]) {
            active_c.is_trending = Set(Some(v));
        }
        if let Some(v) = Self::opt_bool(&payload, &["isOriginal", "is_original"]) {
            active_c.is_original = Set(Some(v));
        }
        active_c.updated_at = Set(Utc::now().fixed_offset());
        let saved_c = active_c.update(&self.db).await?;

        let bunny_guid = Self::opt_str(
            &payload,
            &["bunnyVideoGuid", "bunny_video_guid", "bunnyVideoId", "bunny_video_id"],
        );
        let resolved_stream = self.resolve_primary_stream_url(&payload, bunny_guid.as_deref());
        let dur_mins = Self::opt_i32(&payload, &["durationMinutes", "duration_minutes"]);
        let dur_secs = Self::opt_i32(&payload, &["durationSeconds", "duration_seconds"])
            .or_else(|| dur_mins.map(|m| m * 60));

        let candidates = movie::Entity::find()
            .filter(movie::Column::ContentId.eq(id).or(movie::Column::Id.eq(id)))
            .all(&self.db)
            .await?;
        let target_movie = candidates
            .iter()
            .find(|m| m.content_id == Some(id))
            .cloned()
            .or_else(|| candidates.into_iter().find(|m| m.content_id.is_none() && m.id == id));

        if let Some(existing_m) = target_movie {
            let mut active_m: movie::ActiveModel = existing_m.into();
            active_m.content_id = Set(Some(id));
            if let Some(ref v) = resolved_stream {
                active_m.hls_url = Set(Some(v.clone()));
                active_m.stream_url = Set(Some(v.clone()));
                active_m.video_url = Set(Some(v.clone()));
                active_m.video_asset_id = Set(Some(v.clone()));
            }
            if let Some(v) = Self::opt_str(&payload, &["videoUrl", "video_url"]) {
                active_m.video_url = Set(Some(v));
            }
            if let Some(v) = bunny_guid {
                active_m.bunny_video_guid = Set(Some(v));
            }
            if let Some(v) = Self::opt_str(&payload, &["streamUrl", "stream_url"]) {
                active_m.stream_url = Set(Some(v));
            }
            if let Some(v) = Self::opt_str(&payload, &["hlsUrl", "hls_url", "masterPlaylistUrl", "master_playlist_url"]) {
                active_m.hls_url = Set(Some(v));
            }
            if let Some(v) = Self::opt_str(&payload, &["director"]) {
                active_m.director = Set(Some(v));
            }
            if let Some(v) = Self::opt_str(&payload, &["productionHouse", "production_house", "producer"]) {
                active_m.production_house = Set(Some(v));
            }
            if let Some(v) = dur_mins {
                active_m.duration_minutes = Set(Some(v));
            }
            if let Some(v) = dur_secs {
                active_m.duration_seconds = Set(Some(v));
            }
            let _ = active_m.update(&self.db).await?;
        } else {
            let movie_row_id = self.next_movie_row_id(id).await;
            let new_movie = movie::ActiveModel {
                id: Set(movie_row_id),
                content_id: Set(Some(id)),
                video_asset_id: Set(resolved_stream.clone()),
                video_url: Set(resolved_stream.clone()),
                bunny_video_guid: Set(bunny_guid),
                duration_minutes: Set(dur_mins),
                duration_seconds: Set(dur_secs),
                director: Set(Self::opt_str(&payload, &["director"])),
                writers: Set(Self::opt_str(&payload, &["writers"])),
                production_house: Set(Self::opt_str(&payload, &["productionHouse", "production_house", "producer"])),
                country_of_origin: Set(Self::opt_str(&payload, &["countryOfOrigin", "country_of_origin"])),
                is_tvod_available: Set(Some(false)),
                drm_enabled: Set(Self::opt_bool(&payload, &["drmEnabled", "drm_enabled"])),
                stream_url: Set(resolved_stream.clone()),
                hls_url: Set(resolved_stream),
                dash_url: Set(Self::opt_str(&payload, &["dashUrl", "dash_url"])),
            };
            let _ = new_movie.insert(&self.db).await?;
        }

        self.sync_categories_and_genres(saved_c.id, &payload).await;
        Ok(json!({ "id": saved_c.id, "content": saved_c }))
    }

    pub async fn update_movie_status(&self, id: i64, status: &str) -> AppResult<Value> {
        let existing = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Movie not found".into()))?;
        let mut active: content::ActiveModel = existing.into();
        active.status = Set(status.to_uppercase());
        if status.eq_ignore_ascii_case("PUBLISHED") {
            active.published_at = Set(Some(Utc::now().fixed_offset()));
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        let saved = active.update(&self.db).await?;
        Ok(json!(saved))
    }

    pub async fn delete_movie(&self, id: i64) -> AppResult<Value> {
        let existing = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Movie not found".into()))?;
        let mut active: content::ActiveModel = existing.into();
        active.status = Set("ARCHIVED".into());
        active.updated_at = Set(Utc::now().fixed_offset());
        active.update(&self.db).await?;

        // Deactivate any homepage banners pointing to this archived movie
        let _ = self
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE banners SET is_active = false WHERE content_id = $1",
                [id.into()],
            ))
            .await;

        Ok(json!({ "deleted": true, "softDeleted": true, "id": id }))
    }

    // ─── SERIES / SEASONS / EPISODES ────────────────────────────────────────────

    pub async fn list_series(&self) -> AppResult<Vec<Value>> {
        let contents = content::Entity::find()
            .filter(content::Column::ContentType.eq("SERIES"))
            .order_by_desc(content::Column::Id)
            .all(&self.db)
            .await?;
        Ok(contents.into_iter().map(|c| json!(c)).collect())
    }

    pub async fn get_series(&self, id: i64) -> AppResult<Value> {
        let c = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Series not found".into()))?;
        let s = series::Entity::find_by_id(id).one(&self.db).await?;
        let seasons = season::Entity::find()
            .filter(season::Column::SeriesId.eq(id))
            .order_by_asc(season::Column::SeasonNumber)
            .all(&self.db)
            .await?;
        Ok(json!({ "content": c, "series": s, "seasons": seasons }))
    }

    pub async fn create_series(&self, payload: Value) -> AppResult<Value> {
        Self::validate_content_payload(&payload, true)?;
        let title = Self::opt_str(&payload, &["title"])
            .ok_or_else(|| AppError::BadRequest("title is required".into()))?;
        let slug = Self::opt_str(&payload, &["slug"]).unwrap_or_else(|| Self::slugify(&title));
        let now = Utc::now().fixed_offset();
        let status = Self::opt_str(&payload, &["status"]).unwrap_or_else(|| "DRAFT".into());

        let series_type_norm = Self::opt_str(&payload, &["contentType", "content_type", "type"])
            .map(|t| t.to_uppercase())
            .unwrap_or_else(|| "SERIES".into());

        let new_content = content::ActiveModel {
            title: Set(title),
            slug: Set(slug),
            description: Set(Self::opt_str(&payload, &["description", "synopsis"])),
            content_type: Set(Some(series_type_norm.clone())),
            r#type: Set(Some(series_type_norm)),
            status: Set(status.clone()),
            poster_url: Set(Self::opt_str(&payload, &["posterUrl", "poster_url"])),
            backdrop_url: Set(Self::opt_str(&payload, &["backdropUrl", "backdrop_url"])),
            trailer_url: Set(Self::opt_str(&payload, &["trailerUrl", "trailer_url"])),
            subtitles_json: Set(Self::opt_json_array_str(&payload, &["subtitles", "subtitleTracks", "subtitlesJson"])),
            audio_tracks_json: Set(Self::opt_json_array_str(&payload, &["audioTracks", "audio_tracks", "audioTracksJson"])),
            cast_json: Set(Self::opt_json_array_str(&payload, &["cast", "castMembers", "castJson"])),
            content_warnings: Set(Self::opt_json_array_str(&payload, &["contentWarnings", "content_warnings"])),
            quality_badges: Set(Self::opt_json_array_str(&payload, &["qualityBadges", "quality_badges"])),
            skip_intro_start: Set(Self::opt_i32(&payload, &["skipIntroStart", "skip_intro_start"])),
            skip_intro_end: Set(Self::opt_i32(&payload, &["skipIntroEnd", "skip_intro_end"])),
            skip_outro_start: Set(Self::opt_i32(&payload, &["skipOutroStart", "skip_outro_start"])),
            scheduled_publish_at: Set(Self::opt_str(&payload, &["scheduledPublishAt", "scheduled_publish_at"])
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())),
            expires_at: Set(Self::opt_str(&payload, &["expiresAt", "expires_at"])
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s).ok())),
            release_year: Set(Self::opt_i32(&payload, &["releaseYear", "release_year"])),
            is_premium: Set(Self::opt_bool(&payload, &["isPremium", "is_premium"])),
            is_featured: Set(Self::opt_bool(&payload, &["isFeatured", "is_featured"])),
            created_at: Set(now),
            updated_at: Set(now),
            published_at: Set(if status == "PUBLISHED" { Some(now) } else { None }),
            ..Default::default()
        };
        let saved_c = new_content.insert(&self.db).await?;
        let new_s = series::ActiveModel {
            id: Set(saved_c.id),
            content_id: Set(Some(saved_c.id)),
            total_seasons: Set(Self::opt_i32(&payload, &["totalSeasons"]).or(Some(0))),
            total_episodes: Set(Self::opt_i32(&payload, &["totalEpisodes"]).or(Some(0))),
            is_ongoing: Set(Self::opt_bool(&payload, &["isOngoing"]).or(Some(true))),
        };
        let saved_s = new_s.insert(&self.db).await?;
        Ok(json!({ "id": saved_c.id, "content": saved_c, "series": saved_s }))
    }

    pub async fn update_series(&self, id: i64, payload: Value) -> AppResult<Value> {
        let existing = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Series not found".into()))?;
        let mut active: content::ActiveModel = existing.into();
        if let Some(v) = Self::opt_str(&payload, &["title"]) {
            active.title = Set(v);
        }
        if let Some(v) = Self::opt_str(&payload, &["description", "synopsis"]) {
            active.description = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["status"]) {
            active.status = Set(v);
        }
        if let Some(v) = Self::opt_str(&payload, &["posterUrl", "poster_url"]) {
            active.poster_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_str(&payload, &["trailerUrl", "trailer_url"]) {
            active.trailer_url = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["subtitles", "subtitleTracks", "subtitlesJson"]) {
            active.subtitles_json = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["audioTracks", "audio_tracks", "audioTracksJson"]) {
            active.audio_tracks_json = Set(Some(v));
        }
        if let Some(v) = Self::opt_json_array_str(&payload, &["cast", "castMembers", "castJson"]) {
            active.cast_json = Set(Some(v));
        }
        active.updated_at = Set(Utc::now().fixed_offset());
        let saved = active.update(&self.db).await?;
        Ok(json!(saved))
    }

    pub async fn delete_series(&self, id: i64) -> AppResult<Value> {
        let existing = content::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Series not found".into()))?;
        let now = Utc::now().fixed_offset();
        let mut active: content::ActiveModel = existing.into();
        active.status = Set("ARCHIVED".into());
        active.updated_at = Set(now);
        active.update(&self.db).await?;

        let _ = season::Entity::update_many()
            .col_expr(season::Column::IsActive, sea_orm::sea_query::Expr::value(false))
            .filter(season::Column::SeriesId.eq(id))
            .exec(&self.db)
            .await;

        // Archive all child episodes belonging to this series' seasons
        let _ = self
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE episodes SET status = 'ARCHIVED', updated_at = NOW() WHERE season_id IN (SELECT id FROM seasons WHERE series_id = $1)",
                [id.into()],
            ))
            .await;

        // Deactivate any homepage banners pointing to this archived series
        let _ = self
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE banners SET is_active = false WHERE content_id = $1",
                [id.into()],
            ))
            .await;

        Ok(json!({ "deleted": true, "softDeleted": true, "id": id }))
    }

    pub async fn list_seasons(&self, series_id: i64) -> AppResult<Vec<season::Model>> {
        season::Entity::find()
            .filter(season::Column::SeriesId.eq(series_id))
            .order_by_asc(season::Column::SeasonNumber)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create_season(&self, series_id: i64, payload: Value) -> AppResult<season::Model> {
        let now = Utc::now().fixed_offset();
        let season_number = Self::opt_i32(&payload, &["seasonNumber", "season_number"]).unwrap_or(1);
        let title = Self::opt_str(&payload, &["title"])
            .unwrap_or_else(|| format!("Season {}", season_number));
        let model = season::ActiveModel {
            series_id: Set(series_id),
            season_number: Set(season_number),
            title: Set(title),
            description: Set(Self::opt_str(&payload, &["description"])),
            synopsis: Set(Self::opt_str(&payload, &["synopsis"])),
            poster_url: Set(Self::opt_str(&payload, &["posterUrl", "poster_url"])),
            release_year: Set(Self::opt_i32(&payload, &["releaseYear", "release_year"])),
            is_active: Set(Self::opt_bool(&payload, &["isActive", "is_active"]).or(Some(true))),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
            ..Default::default()
        };
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete_season(&self, season_id: i64) -> AppResult<Value> {
        let existing = season::Entity::find_by_id(season_id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Season not found".into()))?;
        let mut active: season::ActiveModel = existing.into();
        active.is_active = Set(Some(false));
        active.updated_at = Set(Some(Utc::now().fixed_offset()));
        active.update(&self.db).await?;

        // Archive all child episodes belonging to this season
        let _ = self
            .db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE episodes SET status = 'ARCHIVED', updated_at = NOW() WHERE season_id = $1",
                [season_id.into()],
            ))
            .await;

        Ok(json!({ "deleted": true, "softDeleted": true, "id": season_id }))
    }

    pub async fn list_episodes(&self, season_id: i64) -> AppResult<Vec<episode::Model>> {
        episode::Entity::find()
            .filter(episode::Column::SeasonId.eq(season_id))
            .order_by_asc(episode::Column::EpisodeNumber)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create_episode(&self, season_id: i64, payload: Value) -> AppResult<episode::Model> {
        let now = Utc::now().fixed_offset();
        let ep_num = Self::opt_i32(&payload, &["episodeNumber", "episode_number"]).unwrap_or(1);
        let title = Self::opt_str(&payload, &["title"])
            .unwrap_or_else(|| format!("Episode {}", ep_num));
        let model = episode::ActiveModel {
            season_id: Set(season_id),
            episode_number: Set(ep_num),
            title: Set(title),
            description: Set(Self::opt_str(&payload, &["description"])),
            synopsis: Set(Self::opt_str(&payload, &["synopsis"])),
            thumbnail_url: Set(Self::opt_str(&payload, &["thumbnailUrl", "thumbnail_url", "stillImageUrl"])),
            still_image_url: Set(Self::opt_str(&payload, &["stillImageUrl", "thumbnailUrl"])),
            video_url: Set(Self::opt_str(&payload, &["videoUrl", "video_url"])),
            bunny_video_guid: Set(Self::opt_str(&payload, &["bunnyVideoGuid", "bunny_video_guid"])),
            duration_minutes: Set(Self::opt_i32(&payload, &["durationMinutes", "duration_minutes"])),
            duration_seconds: Set(Self::opt_i32(&payload, &["durationSeconds", "duration_seconds"])),
            is_premium: Set(Self::opt_bool(&payload, &["isPremium", "is_premium"])),
            is_free_preview: Set(Self::opt_bool(&payload, &["isFreePreview", "is_free_preview"])),
            status: Set(Self::opt_str(&payload, &["status"]).or_else(|| Some("PUBLISHED".into()))),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
            ..Default::default()
        };
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete_episode(&self, episode_id: i64) -> AppResult<Value> {
        let existing = episode::Entity::find_by_id(episode_id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Episode not found".into()))?;
        let mut active: episode::ActiveModel = existing.into();
        active.status = Set(Some("ARCHIVED".into()));
        active.updated_at = Set(Some(Utc::now().fixed_offset()));
        active.update(&self.db).await?;
        Ok(json!({ "deleted": true, "softDeleted": true, "id": episode_id }))
    }

    // ─── LIVE CHANNELS & EVENTS ─────────────────────────────────────────────────

    pub async fn list_live_channels(&self) -> AppResult<Vec<live_channel::Model>> {
        live_channel::Entity::find()
            .order_by_asc(live_channel::Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create_live_channel(&self, payload: Value) -> AppResult<live_channel::Model> {
        let name = Self::opt_str(&payload, &["name", "title"])
            .ok_or_else(|| AppError::BadRequest("name is required".into()))?;
        let slug = Self::opt_str(&payload, &["slug"]).unwrap_or_else(|| Self::slugify(&name));
        let stream_url = Self::opt_str(&payload, &["streamUrl", "stream_url", "hlsStreamUrl"])
            .ok_or_else(|| AppError::BadRequest("streamUrl is required".into()))?;
        let model = live_channel::ActiveModel {
            name: Set(name),
            slug: Set(slug),
            stream_url: Set(stream_url),
            hls_stream_url: Set(Self::opt_str(&payload, &["hlsStreamUrl", "hls_stream_url"])),
            description: Set(Self::opt_str(&payload, &["description"])),
            logo_url: Set(Self::opt_str(&payload, &["logoUrl", "logo_url"])),
            poster_url: Set(Self::opt_str(&payload, &["posterUrl", "poster_url"])),
            category: Set(Self::opt_str(&payload, &["category"])),
            language_code: Set(Self::opt_str(&payload, &["languageCode", "language_code"])),
            is_active: Set(Self::opt_bool(&payload, &["isActive", "is_active"]).or(Some(true))),
            is_live: Set(Self::opt_bool(&payload, &["isLive", "is_live"]).or(Some(true))),
            is_premium: Set(Self::opt_bool(&payload, &["isPremium", "is_premium"])),
            is_drm_protected: Set(Self::opt_bool(&payload, &["isDrmProtected", "is_drm_protected"])),
            display_order: Set(Self::opt_i32(&payload, &["displayOrder", "display_order"]).or(Some(0))),
            created_at: Set(Some(Utc::now().fixed_offset())),
            ..Default::default()
        };
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete_live_channel(&self, id: i64) -> AppResult<Value> {
        let existing = live_channel::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Live channel not found".into()))?;
        let mut active: live_channel::ActiveModel = existing.into();
        active.is_active = Set(Some(false));
        active.is_live = Set(Some(false));
        active.update(&self.db).await?;
        Ok(json!({ "deleted": true, "softDeleted": true, "id": id }))
    }

    pub async fn list_live_events(&self) -> AppResult<Vec<live_event::Model>> {
        live_event::Entity::find()
            .order_by_desc(live_event::Column::StartTime)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create_live_event(&self, payload: Value) -> AppResult<live_event::Model> {
        let title = Self::opt_str(&payload, &["title", "name"])
            .ok_or_else(|| AppError::BadRequest("title is required".into()))?;
        let slug = Self::opt_str(&payload, &["slug"]).unwrap_or_else(|| Self::slugify(&title));
        let stream_url = Self::opt_str(&payload, &["streamUrl", "stream_url", "hlsStreamUrl"])
            .unwrap_or_default();
        let now = Utc::now().fixed_offset();
        let ppv_price = payload
            .get("ppvPrice")
            .and_then(|v| v.as_f64())
            .and_then(|n| Decimal::from_str(&format!("{:.2}", n)).ok());

        let model = live_event::ActiveModel {
            title: Set(title),
            slug: Set(slug),
            stream_url: Set(stream_url),
            hls_stream_url: Set(Self::opt_str(&payload, &["hlsStreamUrl", "hls_stream_url"])),
            description: Set(Self::opt_str(&payload, &["description"])),
            poster_url: Set(Self::opt_str(&payload, &["posterUrl", "poster_url"])),
            status: Set(Self::opt_str(&payload, &["status"]).unwrap_or_else(|| "SCHEDULED".into())),
            start_time: Set(now),
            end_time: Set(now + chrono::Duration::hours(2)),
            is_premium: Set(Self::opt_bool(&payload, &["isPremium", "is_premium"])),
            is_drm_protected: Set(Self::opt_bool(&payload, &["isDrmProtected", "is_drm_protected"])),
            is_ppv: Set(Self::opt_bool(&payload, &["isPpv", "is_ppv"])),
            ppv_price: Set(ppv_price),
            created_at: Set(Some(now)),
            ..Default::default()
        };
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete_live_event(&self, id: i64) -> AppResult<Value> {
        let existing = live_event::Entity::find_by_id(id)
            .one(&self.db)
            .await?
            .ok_or_else(|| AppError::NotFound("Live event not found".into()))?;
        let mut active: live_event::ActiveModel = existing.into();
        active.status = Set("ARCHIVED".into());
        active.update(&self.db).await?;
        Ok(json!({ "deleted": true, "softDeleted": true, "id": id }))
    }

    // ─── STORAGE & VIDEO UPLOADS (BUNNY) ────────────────────────────────────────

    pub fn get_presigned_url(&self, folder: &str, file_name: &str, content_type: &str) -> Value {
        let sanitized_folder = folder.trim_matches('/');
        let safe_name: String = file_name.chars().map(|c| if c.is_alphanumeric() || c == '.' || c == '-' || c == '_' { c } else { '_' }).collect();
        let key = format!("{}/{}-{}", sanitized_folder, chrono::Utc::now().timestamp_millis(), safe_name);
        let base_url = std::env::var("PUBLIC_BASE_URL").unwrap_or_default();
        let upload_url = format!("{}/api/v1/storage/upload?folder={}", base_url.trim_end_matches('/'), sanitized_folder);
        let public_url = format!("{}/{}/{}", self.bunny_storage.cdn_url.trim_end_matches('/'), sanitized_folder, safe_name);

        json!({
            "uploadUrl": upload_url,
            "publicUrl": public_url,
            "fileUrl": public_url,
            "key": key,
            "objectKey": key,
            "expiresInSeconds": "3600",
            "provider": "DIRECT",
            "contentType": content_type
        })
    }

    pub async fn upload_media(
        &self,
        folder: &str,
        file_name: &str,
        bytes: Vec<u8>,
        content_type: &str,
    ) -> Value {
        self.bunny_storage
            .upload_file(folder, file_name, bytes, content_type)
            .await
    }

    pub async fn upload_video(&self, title: &str, bytes: Vec<u8>) -> AppResult<Value> {
        let guid = self
            .bunny_stream
            .create_video(title)
            .await
            .map_err(AppError::Internal)?;
        if !bytes.is_empty() {
            self.bunny_stream
                .upload_video_bytes(&guid, bytes)
                .await
                .map_err(AppError::Internal)?;
        }
        let hls_url = self.bunny_stream.sign_hls_url(&guid, 14400);
        Ok(json!({
            "guid": guid,
            "bunnyVideoGuid": guid,
            "videoId": guid,
            "hlsUrl": hls_url,
            "libraryId": self.bunny_stream.library_id,
            "status": "UPLOADED"
        }))
    }

    pub async fn read_local_upload(&self, folder: &str, file_name: &str) -> Option<(Vec<u8>, &'static str)> {
        if folder.contains("..") || file_name.contains("..") || folder.contains('/') || file_name.contains('/') {
            return None;
        }
        let path: PathBuf = self.bunny_storage.uploads_root.join(folder).join(file_name);
        let bytes = tokio::fs::read(&path).await.ok()?;
        let mime = match file_name.rsplit('.').next().map(|s| s.to_ascii_lowercase()).as_deref() {
            Some("png") => "image/png",
            Some("jpg") | Some("jpeg") => "image/jpeg",
            Some("webp") => "image/webp",
            Some("gif") => "image/gif",
            Some("svg") => "image/svg+xml",
            Some("mp4") => "video/mp4",
            Some("m3u8") => "application/vnd.apple.mpegurl",
            _ => "application/octet-stream",
        };
        Some((bytes, mime))
    }
}
