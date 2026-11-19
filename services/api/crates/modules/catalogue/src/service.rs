use chrono::Datelike;
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
};
use std::collections::HashMap;

use maxx_common::{error::AppError, response::PageResponse};
use maxx_core::entities::{
    category, content, content_category, content_genre, content_type, genre, language, movie,
};

use crate::dto::{
    CatalogBrowseQuery, CategoryDto, ContentDto, ContentTypeDto, GenreDto, LanguageDto,
    PublicMetadataDto,
};

pub struct CatalogueService {
    db: DatabaseConnection,
    public_base_url: String,
}

impl CatalogueService {
    pub fn new(db: DatabaseConnection, public_base_url: String) -> Self {
        Self {
            db,
            public_base_url: public_base_url.trim_end_matches('/').to_string(),
        }
    }

    pub async fn browse_catalog(
        &self,
        query: CatalogBrowseQuery,
        include_drafts: bool,
    ) -> Result<PageResponse<ContentDto>, AppError> {
        let page = query.page.unwrap_or(0);
        let size = query.size.unwrap_or(20).min(100);

        let mut select = content::Entity::find().order_by_desc(content::Column::Id);

        if !include_drafts {
            select = select.filter(content::Column::Status.eq("PUBLISHED"));
        } else if let Some(status) = query.status.as_deref() {
            let s = status.trim().to_uppercase();
            if !s.is_empty() && s != "ALL" {
                select = select.filter(content::Column::Status.eq(s));
            }
        }

        if let Some(ctype) = query.content_type.as_deref() {
            let ct = ctype.trim().to_uppercase();
            if !ct.is_empty() && ct != "ALL" {
                select = select.filter(
                    content::Column::ContentType
                        .eq(&ct)
                        .or(content::Column::Type.eq(&ct)),
                );
            }
        }

        if let Some(lang) = query.language.as_deref() {
            let l = lang.trim().to_lowercase();
            if l == "non-kannada" || l == "except-kannada" {
                select = select.filter(
                    content::Column::OriginalLanguageCode
                        .ne("kn")
                        .and(content::Column::OriginalLanguageCode.ne("kannada")),
                );
            } else if !l.is_empty() && l != "all" {
                let code_alias = match l.as_str() {
                    "kannada" => "kn",
                    "hindi" => "hi",
                    "telugu" => "te",
                    "tamil" => "ta",
                    "malayalam" => "ml",
                    "marathi" => "mr",
                    "bengali" => "bn",
                    "punjabi" => "pa",
                    "gujarati" => "gu",
                    "english" => "en",
                    _ => "",
                };
                if !code_alias.is_empty() {
                    select = select.filter(
                        content::Column::OriginalLanguageCode
                            .eq(&l)
                            .or(content::Column::OriginalLanguageCode.eq(code_alias)),
                    );
                } else {
                    select = select.filter(content::Column::OriginalLanguageCode.eq(l));
                }
            }
        }

        if query.featured.as_deref() == Some("true") {
            select = select.filter(content::Column::IsFeatured.eq(true));
        }

        if query.trending.as_deref() == Some("true") {
            select = select.filter(content::Column::IsTrending.eq(true));
        }

        let search_term = query
            .search
            .or(query.q)
            .or(query.query)
            .or(query.name);

        if let Some(s) = search_term.as_deref() {
            let clean = s.trim();
            if !clean.is_empty() {
                select = select.filter(
                    content::Column::Title
                        .contains(clean)
                        .or(content::Column::Description.contains(clean)),
                );
            }
        }

        if let Some(cat_id) = query.category_id {
            let cc_rows = content_category::Entity::find()
                .filter(content_category::Column::CategoryId.eq(cat_id))
                .all(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            let ids: Vec<i64> = cc_rows.into_iter().map(|r| r.content_id).collect();
            if ids.is_empty() {
                return Ok(PageResponse::of(vec![], 0, page, size));
            }
            select = select.filter(content::Column::Id.is_in(ids));
        }

        if let Some(genre_id) = query.genre_id {
            let cg_rows = content_genre::Entity::find()
                .filter(content_genre::Column::GenreId.eq(genre_id))
                .all(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            let ids: Vec<i64> = cg_rows.into_iter().map(|r| r.content_id).collect();
            if ids.is_empty() {
                return Ok(PageResponse::of(vec![], 0, page, size));
            }
            select = select.filter(content::Column::Id.is_in(ids));
        }

        let paginator = select.paginate(&self.db, size);
        let total = paginator
            .num_items()
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let contents = paginator
            .fetch_page(page)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let dtos = self.hydrate_content_list(contents).await?;
        Ok(PageResponse::of(dtos, total, page, size))
    }

    pub async fn get_content_detail(
        &self,
        id_or_slug: &str,
        include_drafts: bool,
    ) -> Result<ContentDto, AppError> {
        let mut select = content::Entity::find();
        if !include_drafts {
            select = select.filter(content::Column::Status.eq("PUBLISHED"));
        }

        let content_model = if let Ok(num_id) = id_or_slug.trim().parse::<i64>() {
            select
                .filter(content::Column::Id.eq(num_id))
                .one(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        } else {
            select
                .filter(content::Column::Slug.eq(id_or_slug.trim()))
                .one(&self.db)
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
        }
        .ok_or_else(|| AppError::NotFound(format!("Content '{}' not found", id_or_slug)))?;

        let content_id = content_model.id;
        let ctype = content_model
            .content_type
            .clone()
            .or_else(|| content_model.r#type.clone())
            .unwrap_or_else(|| "MOVIE".to_string());

        let mut dtos = self.hydrate_content_list(vec![content_model]).await?;
        let mut dto = dtos
            .pop()
            .ok_or_else(|| AppError::NotFound("Content not found".to_string()))?;

        let related_contents = content::Entity::find()
            .filter(content::Column::Id.ne(content_id))
            .filter(content::Column::Status.eq("PUBLISHED"))
            .filter(content::Column::ContentType.eq(ctype))
            .order_by_desc(content::Column::ViewCount)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .into_iter()
            .take(10)
            .collect();

        let related_dtos = self.hydrate_content_list(related_contents).await?;
        dto.related_content = Some(related_dtos);

        Ok(dto)
    }

    pub async fn get_public_metadata(&self) -> Result<PublicMetadataDto, AppError> {
        let langs = language::Entity::find()
            .filter(language::Column::IsActive.eq(true))
            .order_by_asc(language::Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let cats = category::Entity::find()
            .filter(category::Column::IsActive.eq(true))
            .order_by_asc(category::Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let genres_list = genre::Entity::find()
            .filter(genre::Column::IsActive.eq(true))
            .order_by_asc(genre::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        let ctypes = content_type::Entity::find()
            .filter(content_type::Column::IsActive.eq(true))
            .order_by_asc(content_type::Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(PublicMetadataDto {
            languages: langs
                .into_iter()
                .map(|l| LanguageDto {
                    id: l.id,
                    code: l.code,
                    name: l.name,
                    native_name: l.native_name,
                })
                .collect(),
            categories: cats
                .into_iter()
                .map(|c| CategoryDto {
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                })
                .collect(),
            genres: genres_list
                .into_iter()
                .map(|g| GenreDto {
                    id: g.id,
                    name: g.name,
                    slug: g.slug,
                })
                .collect(),
            content_types: ctypes
                .into_iter()
                .map(|ct| ContentTypeDto {
                    id: ct.id,
                    slug: ct.slug,
                    title: ct.title,
                    name: ct.name,
                })
                .collect(),
        })
    }

    async fn hydrate_content_list(
        &self,
        contents: Vec<content::Model>,
    ) -> Result<Vec<ContentDto>, AppError> {
        if contents.is_empty() {
            return Ok(vec![]);
        }

        let ids: Vec<i64> = contents.iter().map(|c| c.id).collect();

        // Batch load movies
        let movie_rows = movie::Entity::find()
            .filter(movie::Column::Id.is_in(ids.clone()))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let movie_map: HashMap<i64, movie::Model> =
            movie_rows.into_iter().map(|m| (m.id, m)).collect();

        // Batch load categories
        let cc_rows = content_category::Entity::find()
            .filter(content_category::Column::ContentId.is_in(ids.clone()))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let all_cats = category::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let cat_lookup: HashMap<i64, category::Model> =
            all_cats.into_iter().map(|c| (c.id, c)).collect();

        let mut content_cats: HashMap<i64, Vec<CategoryDto>> = HashMap::new();
        for cc in cc_rows {
            if let Some(c) = cat_lookup.get(&cc.category_id) {
                content_cats.entry(cc.content_id).or_default().push(CategoryDto {
                    id: c.id,
                    name: c.name.clone(),
                    slug: c.slug.clone(),
                });
            }
        }

        // Batch load genres
        let cg_rows = content_genre::Entity::find()
            .filter(content_genre::Column::ContentId.is_in(ids))
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let all_genres = genre::Entity::find()
            .all(&self.db)
            .await
            .map_err(|e| AppError::Database(e.to_string()))?;
        let genre_lookup: HashMap<i64, genre::Model> =
            all_genres.into_iter().map(|g| (g.id, g)).collect();

        let mut content_genres: HashMap<i64, Vec<GenreDto>> = HashMap::new();
        for cg in cg_rows {
            if let Some(g) = genre_lookup.get(&cg.genre_id) {
                content_genres.entry(cg.content_id).or_default().push(GenreDto {
                    id: g.id,
                    name: g.name.clone(),
                    slug: g.slug.clone(),
                });
            }
        }

        let mut result = Vec::with_capacity(contents.len());
        for c in contents {
            let mv = movie_map.get(&c.id);
            let cats = content_cats.remove(&c.id).unwrap_or_default();
            let gns = content_genres.remove(&c.id).unwrap_or_default();
            result.push(self.to_content_dto(c, mv, cats, gns));
        }

        Ok(result)
    }

    fn ensure_absolute_url(&self, url: Option<&str>) -> String {
        let raw = match url {
            Some(u) if !u.trim().is_empty() => u.trim(),
            _ => return String::new(),
        };
        if raw.starts_with("data:") || raw.starts_with("blob:") {
            return raw.to_string();
        }
        if raw.starts_with("http://") || raw.starts_with("https://") {
            return raw.to_string();
        }
        let clean = raw.trim_start_matches('/');
        if !clean.starts_with("uploads/") {
            format!("{}/uploads/{}", self.public_base_url, clean)
        } else {
            format!("{}/{}", self.public_base_url, clean)
        }
    }

    fn to_content_dto(
        &self,
        c: content::Model,
        mv: Option<&movie::Model>,
        categories: Vec<CategoryDto>,
        genres: Vec<GenreDto>,
    ) -> ContentDto {
        let ctype = c
            .r#type
            .clone()
            .or_else(|| c.content_type.clone())
            .unwrap_or_else(|| "MOVIE".to_string())
            .to_uppercase();

        let type_id = match ctype.as_str() {
            "MOVIE" | "FILM" => 1,
            "ALBUM" | "SONG" | "MUSIC" | "SONGS" => 2,
            "SHORT_FILM" | "SHORTS" | "SHORT" => 3,
            "MICRODRAMA" | "MICRO-DRAMA" | "MICRODRAMAS" => 4,
            "PODCAST" | "PODCASTS" => 5,
            "SERIES" | "SHOWS" | "WEB-SERIES" => 6,
            _ if ctype.starts_with("AI_") => 7,
            _ => 1,
        };

        let access_type = c
            .access_type
            .clone()
            .or_else(|| c.monetization.clone())
            .unwrap_or_else(|| "AVOD".to_string());
        let is_premium = c
            .is_premium
            .unwrap_or_else(|| access_type == "PREMIUM" || access_type == "SVOD");

        let video_url = mv
            .and_then(|m| {
                m.video_url
                    .clone()
                    .or_else(|| m.stream_url.clone())
                    .or_else(|| m.video_asset_id.clone())
            })
            .or_else(|| c.trailer_url.clone())
            .unwrap_or_default();

        let duration_seconds = c
            .duration_seconds
            .or_else(|| mv.and_then(|m| m.duration_seconds))
            .unwrap_or_else(|| mv.and_then(|m| m.duration_minutes).unwrap_or(0) * 60);
        let duration_minutes = mv
            .and_then(|m| m.duration_minutes)
            .unwrap_or_else(|| (duration_seconds as f64 / 60.0).round() as i32);

        let raw_lang = c
            .original_language_code
            .clone()
            .unwrap_or_else(|| "kn".to_string())
            .to_lowercase();
        let (lang_id, lang_code, lang_name) = match raw_lang.as_str() {
            "kn" | "kannada" | "kan" => (1, "kn".to_string(), "Kannada".to_string()),
            "ta" | "tamil" | "tam" => (2, "ta".to_string(), "Tamil".to_string()),
            "hi" | "hindi" | "hin" => (3, "hi".to_string(), "Hindi".to_string()),
            "en" | "english" | "eng" => (10, "en".to_string(), "English".to_string()),
            "te" | "telugu" | "tel" => (11, "te".to_string(), "Telugu".to_string()),
            "ml" | "malayalam" | "mal" => (12, "ml".to_string(), "Malayalam".to_string()),
            _ => (1, raw_lang.clone(), raw_lang),
        };

        let poster_url = self.ensure_absolute_url(c.poster_url.as_deref());
        let raw_backdrop = c
            .backdrop_url
            .as_deref()
            .or(c.landscape_image_url.as_deref())
            .or(c.poster_url.as_deref());
        let backdrop_url = self.ensure_absolute_url(raw_backdrop);
        let raw_banner = c
            .banner_image_url
            .as_deref()
            .or(c.landscape_image_url.as_deref())
            .or(raw_backdrop);
        let banner_url = self.ensure_absolute_url(raw_banner);

        let release_year = c.release_year.unwrap_or_else(|| {
            c.release_date
                .map(|d| d.year())
                .unwrap_or_else(|| c.created_at.year())
        });
        let release_date = c
            .release_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_else(|| c.created_at.format("%Y-%m-%d").to_string());

        let producer = mv
            .and_then(|m| m.production_house.clone())
            .unwrap_or_default();
        let director = mv.and_then(|m| m.director.clone()).unwrap_or_default();
        let bunny_video_id = mv
            .and_then(|m| m.bunny_video_guid.clone())
            .unwrap_or_default();

        let category_names: Vec<String> = categories.iter().map(|cat| cat.name.clone()).collect();

        ContentDto {
            id: c.id,
            video_id: c.id,
            title: c.title.clone(),
            name: c.title,
            slug: c.slug,
            description: c.description.unwrap_or_default(),
            short_description: c.short_description.unwrap_or_default(),
            r#type: ctype.clone(),
            content_type: ctype,
            status: c.status,
            access_type: access_type.clone(),
            monetization: c.monetization.unwrap_or(access_type),
            rent_price: c.rent_price.and_then(|d| d.to_string().parse::<f64>().ok()),
            validity_hours: c.validity_hours,
            release_year,
            release_date,
            age_rating: c.age_rating.clone().unwrap_or_else(|| "U/A 13+".to_string()),
            maturity_rating: c.age_rating.unwrap_or_else(|| "U/A 13+".to_string()),
            poster_url,
            backdrop_url: backdrop_url.clone(),
            landscape_image_url: backdrop_url,
            banner_url,
            logo_image_url: c.logo_image_url.unwrap_or_default(),
            trailer_url: c.trailer_url.unwrap_or_default(),
            video_url: video_url.clone(),
            master_playlist_url: video_url,
            bunny_video_id,
            producer: producer.clone(),
            production_house: producer,
            duration_seconds,
            duration_minutes,
            director,
            original_language_code: lang_code,
            original_language: lang_name.clone(),
            language_id: lang_id,
            language_name: lang_name,
            is_premium,
            is_featured: c.is_featured.unwrap_or(false),
            is_trending: c.is_trending.unwrap_or(false),
            is_original: c.is_original.unwrap_or(false),
            view_count: c.view_count.unwrap_or(0),
            content_type_id: type_id,
            producer_id: c.producer_id,
            genres,
            categories,
            category: category_names,
            subtitles: c
                .subtitles_json
                .as_deref()
                .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
                .unwrap_or_default(),
            audio_tracks: c
                .audio_tracks_json
                .as_deref()
                .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
                .unwrap_or_default(),
            cast: c
                .cast_json
                .as_deref()
                .and_then(|s| serde_json::from_str::<Vec<serde_json::Value>>(s).ok())
                .unwrap_or_default(),
            content_warnings: c
                .content_warnings
                .as_deref()
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            quality_badges: c
                .quality_badges
                .as_deref()
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            skip_intro_start: c.skip_intro_start,
            skip_intro_end: c.skip_intro_end,
            skip_outro_start: c.skip_outro_start,
            scheduled_publish_at: c.scheduled_publish_at.map(|dt| dt.to_rfc3339()),
            expires_at: c.expires_at.map(|dt| dt.to_rfc3339()),
            related_content: None,
        }
    }
}

