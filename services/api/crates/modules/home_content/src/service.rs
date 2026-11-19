use maxx_common::error::AppError;
use maxx_core::entities::{intro_video, portal_banner};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder, Set, TransactionTrait,
};
use serde_json::json;

use crate::dto::{IntroVideoRequest, PortalBannerRequest};

fn clean_optional(value: Option<String>) -> Option<String> {
    value
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn normalize_portal_key(value: Option<String>) -> String {
    clean_optional(value)
        .map(|v| v.to_lowercase().replace(' ', "-"))
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| "all".to_string())
}

#[derive(Clone)]
pub struct HomeContentService {
    db: DatabaseConnection,
}

impl HomeContentService {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // ------------------------------ Intro video ------------------------------

    pub async fn list_intro_videos(&self) -> Result<Vec<intro_video::Model>, AppError> {
        intro_video::Entity::find()
            .order_by_asc(intro_video::Column::DisplayOrder)
            .order_by_desc(intro_video::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub async fn list_active_intro_videos(&self) -> Result<Vec<intro_video::Model>, AppError> {
        intro_video::Entity::find()
            .filter(intro_video::Column::IsActive.eq(true))
            .order_by_asc(intro_video::Column::DisplayOrder)
            .order_by_desc(intro_video::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub async fn get_active_intro_video(&self) -> Result<Option<intro_video::Model>, AppError> {
        self.list_active_intro_videos()
            .await
            .map(|mut rows| if rows.is_empty() { None } else { Some(rows.remove(0)) })
    }

    pub async fn get_intro_video(&self, id: i64) -> Result<intro_video::Model, AppError> {
        intro_video::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("Intro video {} not found", id)))
    }

    pub async fn create_intro_video(
        &self,
        req: IntroVideoRequest,
    ) -> Result<intro_video::Model, AppError> {
        let IntroVideoRequest {
            title,
            description,
            video_url,
            poster_url,
            cta_label,
            is_active,
            display_order,
        } = req;

        let title = clean_optional(title)
            .ok_or_else(|| AppError::BadRequest("Intro video title is required".to_string()))?;
        let video_url = clean_optional(video_url)
            .ok_or_else(|| AppError::BadRequest("Intro video URL is required".to_string()))?;
        let is_active = is_active.unwrap_or(false);
        let now: chrono::DateTime<chrono::FixedOffset> = chrono::Utc::now().into();

        let txn = self
            .db
            .begin()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if is_active {
            Self::deactivate_intro_videos(&txn, None, now).await?;
        }

        let model = intro_video::ActiveModel {
            title: Set(title),
            description: Set(clean_optional(description)),
            video_url: Set(video_url),
            poster_url: Set(clean_optional(poster_url)),
            cta_label: Set(clean_optional(cta_label).or_else(|| Some("Watch Intro".to_string()))),
            is_active: Set(is_active),
            display_order: Set(display_order.unwrap_or(0)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&txn)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

        txn.commit()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(model)
    }

    pub async fn update_intro_video(
        &self,
        id: i64,
        req: IntroVideoRequest,
    ) -> Result<intro_video::Model, AppError> {
        let existing = self.get_intro_video(id).await?;
        let IntroVideoRequest {
            title,
            description,
            video_url,
            poster_url,
            cta_label,
            is_active,
            display_order,
        } = req;

        let now: chrono::DateTime<chrono::FixedOffset> = chrono::Utc::now().into();
        let txn = self
            .db
            .begin()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        if is_active == Some(true) {
            Self::deactivate_intro_videos(&txn, Some(id), now).await?;
        }

        let mut active: intro_video::ActiveModel = existing.into();
        if title.is_some() {
            let title = clean_optional(title)
                .ok_or_else(|| AppError::BadRequest("Intro video title is required".to_string()))?;
            active.title = Set(title);
        }
        if description.is_some() {
            active.description = Set(clean_optional(description));
        }
        if video_url.is_some() {
            let video_url = clean_optional(video_url)
                .ok_or_else(|| AppError::BadRequest("Intro video URL is required".to_string()))?;
            active.video_url = Set(video_url);
        }
        if poster_url.is_some() {
            active.poster_url = Set(clean_optional(poster_url));
        }
        if cta_label.is_some() {
            active.cta_label = Set(clean_optional(cta_label));
        }
        if let Some(value) = is_active {
            active.is_active = Set(value);
        }
        if let Some(value) = display_order {
            active.display_order = Set(value);
        }
        active.updated_at = Set(now);

        let model = active
            .update(&txn)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        txn.commit()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(model)
    }

    pub async fn activate_intro_video(&self, id: i64) -> Result<intro_video::Model, AppError> {
        self.update_intro_video(
            id,
            IntroVideoRequest {
                is_active: Some(true),
                ..Default::default()
            },
        )
        .await
    }

    pub async fn delete_intro_video(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let result = intro_video::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if result.rows_affected == 0 {
            return Err(AppError::NotFound(format!("Intro video {} not found", id)));
        }
        Ok(json!({ "id": id, "deleted": true }))
    }

    async fn deactivate_intro_videos<C>(
        executor: &C,
        except_id: Option<i64>,
        now: chrono::DateTime<chrono::FixedOffset>,
    ) -> Result<(), AppError>
    where
        C: ConnectionTrait,
    {
        let mut query = intro_video::Entity::find().filter(intro_video::Column::IsActive.eq(true));
        if let Some(id) = except_id {
            query = query.filter(intro_video::Column::Id.ne(id));
        }
        let rows = query
            .all(executor)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        for row in rows {
            let mut active: intro_video::ActiveModel = row.into();
            active.is_active = Set(false);
            active.updated_at = Set(now);
            active
                .update(executor)
                .await
                .map_err(|e| AppError::Internal(e.to_string()))?;
        }
        Ok(())
    }

    // ---------------------------- Portal banners -----------------------------

    pub async fn list_portal_banners(&self) -> Result<Vec<portal_banner::Model>, AppError> {
        portal_banner::Entity::find()
            .order_by_asc(portal_banner::Column::DisplayOrder)
            .order_by_desc(portal_banner::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub async fn list_public_portal_banners(
        &self,
        portal_key: Option<String>,
    ) -> Result<Vec<portal_banner::Model>, AppError> {
        let mut query = portal_banner::Entity::find().filter(portal_banner::Column::IsActive.eq(true));
        let key = clean_optional(portal_key).map(|v| v.to_lowercase().replace(' ', "-"));
        if let Some(key) = key {
            if key != "all" {
                query = query.filter(portal_banner::Column::PortalKey.eq(key));
            }
        }
        query
            .order_by_asc(portal_banner::Column::DisplayOrder)
            .order_by_desc(portal_banner::Column::Id)
            .all(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub async fn get_portal_banner(&self, id: i64) -> Result<portal_banner::Model, AppError> {
        portal_banner::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?
            .ok_or_else(|| AppError::NotFound(format!("Portal banner {} not found", id)))
    }

    pub async fn create_portal_banner(
        &self,
        req: PortalBannerRequest,
    ) -> Result<portal_banner::Model, AppError> {
        let PortalBannerRequest {
            title,
            subtitle,
            image_url,
            mobile_image_url,
            target_url,
            portal_key,
            button_label,
            is_active,
            display_order,
        } = req;

        let title = clean_optional(title)
            .ok_or_else(|| AppError::BadRequest("Portal banner title is required".to_string()))?;
        let image_url = clean_optional(image_url).ok_or_else(|| {
            AppError::BadRequest("Portal banner image URL is required".to_string())
        })?;
        let now: chrono::DateTime<chrono::FixedOffset> = chrono::Utc::now().into();

        let model = portal_banner::ActiveModel {
            title: Set(title),
            subtitle: Set(clean_optional(subtitle)),
            image_url: Set(image_url),
            mobile_image_url: Set(clean_optional(mobile_image_url)),
            target_url: Set(clean_optional(target_url).unwrap_or_else(|| "/".to_string())),
            portal_key: Set(normalize_portal_key(portal_key)),
            button_label: Set(
                clean_optional(button_label).or_else(|| Some("Explore Portal".to_string())),
            ),
            is_active: Set(is_active.unwrap_or(true)),
            display_order: Set(display_order.unwrap_or(0)),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        }
        .insert(&self.db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(model)
    }

    pub async fn update_portal_banner(
        &self,
        id: i64,
        req: PortalBannerRequest,
    ) -> Result<portal_banner::Model, AppError> {
        let existing = self.get_portal_banner(id).await?;
        let PortalBannerRequest {
            title,
            subtitle,
            image_url,
            mobile_image_url,
            target_url,
            portal_key,
            button_label,
            is_active,
            display_order,
        } = req;

        let mut active: portal_banner::ActiveModel = existing.into();
        if title.is_some() {
            let title = clean_optional(title)
                .ok_or_else(|| AppError::BadRequest("Portal banner title is required".to_string()))?;
            active.title = Set(title);
        }
        if subtitle.is_some() {
            active.subtitle = Set(clean_optional(subtitle));
        }
        if image_url.is_some() {
            let image_url = clean_optional(image_url).ok_or_else(|| {
                AppError::BadRequest("Portal banner image URL is required".to_string())
            })?;
            active.image_url = Set(image_url);
        }
        if mobile_image_url.is_some() {
            active.mobile_image_url = Set(clean_optional(mobile_image_url));
        }
        if target_url.is_some() {
            active.target_url = Set(clean_optional(target_url).unwrap_or_else(|| "/".to_string()));
        }
        if portal_key.is_some() {
            active.portal_key = Set(normalize_portal_key(portal_key));
        }
        if button_label.is_some() {
            active.button_label = Set(clean_optional(button_label));
        }
        if let Some(value) = is_active {
            active.is_active = Set(value);
        }
        if let Some(value) = display_order {
            active.display_order = Set(value);
        }
        active.updated_at = Set(chrono::Utc::now().into());

        active
            .update(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))
    }

    pub async fn toggle_portal_banner(&self, id: i64) -> Result<portal_banner::Model, AppError> {
        let existing = self.get_portal_banner(id).await?;
        self.update_portal_banner(
            id,
            PortalBannerRequest {
                is_active: Some(!existing.is_active),
                ..Default::default()
            },
        )
        .await
    }

    pub async fn delete_portal_banner(&self, id: i64) -> Result<serde_json::Value, AppError> {
        let result = portal_banner::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;
        if result.rows_affected == 0 {
            return Err(AppError::NotFound(format!("Portal banner {} not found", id)));
        }
        Ok(json!({ "id": id, "deleted": true }))
    }
}
