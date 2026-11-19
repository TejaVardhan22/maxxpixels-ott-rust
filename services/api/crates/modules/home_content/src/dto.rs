use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IntroVideoRequest {
    #[serde(alias = "name", alias = "title")]
    pub title: Option<String>,
    #[serde(alias = "description", alias = "shortDescription")]
    pub description: Option<String>,
    #[serde(alias = "video", alias = "video_url", alias = "videoLink", alias = "url")]
    pub video_url: Option<String>,
    #[serde(alias = "poster", alias = "poster_url", alias = "thumbnailUrl")]
    pub poster_url: Option<String>,
    #[serde(alias = "cta", alias = "ctaText", alias = "buttonLabel", alias = "button_label")]
    pub cta_label: Option<String>,
    #[serde(alias = "active", alias = "enabled")]
    pub is_active: Option<bool>,
    #[serde(alias = "sortOrder", alias = "order", alias = "display_order")]
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalBannerRequest {
    #[serde(alias = "name", alias = "title")]
    pub title: Option<String>,
    #[serde(alias = "description", alias = "shortDescription")]
    pub subtitle: Option<String>,
    #[serde(alias = "image", alias = "image_url", alias = "landscape", alias = "landscapeImageUrl")]
    pub image_url: Option<String>,
    #[serde(alias = "mobile_image", alias = "mobile_image_url", alias = "mobileImage")]
    pub mobile_image_url: Option<String>,
    #[serde(alias = "actionUrl", alias = "action_url", alias = "link", alias = "url")]
    pub target_url: Option<String>,
    #[serde(alias = "portal", alias = "portal_key")]
    pub portal_key: Option<String>,
    #[serde(alias = "cta", alias = "ctaText", alias = "buttonText", alias = "button_label")]
    pub button_label: Option<String>,
    #[serde(alias = "active", alias = "enabled")]
    pub is_active: Option<bool>,
    #[serde(alias = "sortOrder", alias = "order", alias = "display_order")]
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortalBannerQuery {
    #[serde(alias = "portal", alias = "portal_key")]
    pub portal_key: Option<String>,
}
