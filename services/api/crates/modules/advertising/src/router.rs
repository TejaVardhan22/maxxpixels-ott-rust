use crate::handlers::*;
use axum::routing::{get, post, put};
use axum::Router;
use maxx_core::AppState;

pub fn advertising_routes() -> Router<AppState> {
    let public_ads = Router::new()
        .route("/config/:contentId", get(get_ad_config_handler))
        .route("/session", post(create_ad_session_handler))
        .route("/sessions", post(create_ad_session_handler))
        .route("/events", post(record_ad_event_handler))
        .route("/event", post(record_ad_event_handler))
        .route("/campaigns", get(list_public_campaigns_handler))
        .route("/revenue", get(get_ad_revenue_handler))
        .route("/producer-revenue", get(get_producer_revenue_handler))
        .route("/content-analytics", get(get_producer_revenue_handler))
        .route("/vast", get(get_vast_xml_handler))
        .route("/vast.xml", get(get_vast_xml_handler))
        .route("/queue", get(get_ad_queue_handler))
        .route("/ad-queue", get(get_ad_queue_handler))
        .route("/track", post(track_ad_post_handler))
        .route("/ad-track", post(track_ad_post_handler))
        .route("/track/impression/:id", get(track_impression_handler))
        .route("/track/click/:id", get(track_click_handler));

    let admin_ads = Router::new()
        .route(
            "/providers",
            get(admin_list_providers_handler).post(admin_create_provider_handler),
        )
        .route("/providers/:id", put(admin_update_provider_handler))
        .route(
            "/placements",
            get(admin_list_placements_handler).post(admin_create_placement_handler),
        )
        .route("/placements/:id", put(admin_update_placement_handler))
        .route(
            "/",
            get(list_public_campaigns_handler).post(admin_create_campaign_handler),
        )
        .route(
            "/campaigns",
            get(list_public_campaigns_handler).post(admin_create_campaign_handler),
        )
        .route("/campaigns/:id/toggle", post(admin_toggle_campaign_handler))
        .route("/:id/toggle", post(admin_toggle_campaign_handler))
        .route(
            "/campaigns/:id",
            get(admin_get_campaign_handler)
                .put(admin_update_campaign_handler)
                .delete(admin_delete_campaign_handler),
        )
        .route(
            "/:id",
            get(admin_get_campaign_handler)
                .put(admin_update_campaign_handler)
                .delete(admin_delete_campaign_handler),
        )
        .route("/revenue", get(get_ad_revenue_handler))
        .route("/producer-revenue", get(get_producer_revenue_handler))
        .route("/content-analytics", get(get_producer_revenue_handler));

    let admin_producers = Router::new()
        .route(
            "/",
            get(admin_list_producers_handler).post(admin_onboard_producer_handler),
        )
        .route("/list", get(admin_list_producers_handler))
        .route("/onboard", post(admin_onboard_producer_handler))
        .route("/onboarding", post(admin_onboard_producer_handler))
        .route("/onboardings", get(admin_list_producers_handler))
        .route("/submissions", get(admin_list_submissions_handler))
        .route("/onboardings/:id/review", post(admin_review_producer_handler))
        .route("/onboardings/:id", post(admin_review_producer_handler))
        .route("/:id/kyc/review", post(admin_review_producer_handler))
        .route("/:id/review", post(admin_review_producer_handler))
        .route("/:id/toggle-status", post(admin_toggle_producer_handler))
        .route(
            "/:id/reset-password",
            post(admin_reset_producer_password_handler),
        )
        .route(
            "/:id/credentials",
            post(admin_generate_producer_credentials_handler),
        )
        .route(
            "/:id",
            get(admin_get_producer_handler)
                .put(admin_update_producer_handler)
                .delete(admin_delete_producer_handler),
        );

    let producer_portal = Router::new()
        .route("/register", post(producer_register_handler))
        .route("/signup", post(producer_register_handler))
        .route("/submit-content", post(public_producer_submit_handler))
        .route("/profile", get(producer_profile_handler))
        .route("/kyc/documents", post(producer_update_kyc_handler))
        .route("/kyc", post(producer_update_kyc_handler))
        .route(
            "/agreement",
            get(producer_agreement_handler).post(producer_upload_agreement_handler),
        )
        .route("/agreement/upload", post(producer_upload_agreement_handler))
        .route("/analytics/movies", get(producer_movie_analytics_handler))
        .route(
            "/analytics/dashboard",
            get(producer_dashboard_analytics_handler),
        )
        .route(
            "/analytics/content-overview",
            get(producer_content_overview_handler),
        )
        .route("/analytics/ad-breakdown", get(producer_ad_breakdown_handler))
        .route(
            "/submissions",
            get(producer_my_submissions_handler).post(producer_submit_content_handler),
        );

    Router::new()
        .route("/ads.txt", get(ads_txt_handler))
        .route("/api/ads.txt", get(ads_txt_handler))
        .route("/api/v1/ads.txt", get(ads_txt_handler))
        .route("/app-ads.txt", get(ads_txt_handler))
        .route("/api/app-ads.txt", get(ads_txt_handler))
        .route("/api/v1/app-ads.txt", get(ads_txt_handler))
        .route("/api/v1/admin/content/submissions", get(admin_list_submissions_handler))
        .route("/api/admin/content/submissions", get(admin_list_submissions_handler))
        .route("/api/v1/admin/content/submissions/:id/review", post(admin_review_submission_handler))
        .route("/api/admin/content/submissions/:id/review", post(admin_review_submission_handler))
        .nest("/api/v1/ads", public_ads.clone())
        .nest("/api/ads", public_ads.clone())
        .nest("/ads", public_ads)
        .nest("/api/v1/admin/ads", admin_ads.clone())
        .nest("/api/admin/ads", admin_ads.clone())
        .nest("/admin/ads", admin_ads.clone())
        .nest("/api/v1/admin/advertisements", admin_ads)
        .nest("/api/v1/admin/producers", admin_producers.clone())
        .nest("/api/admin/producers", admin_producers.clone())
        .nest("/admin/producers", admin_producers.clone())
        .nest("/api/v1/producers", admin_producers)
        .nest("/api/v1/producer", producer_portal.clone())
        .nest("/api/producer", producer_portal.clone())
        .nest("/producer", producer_portal)
        .route("/api/v1/producer/submit", post(public_producer_submit_handler))
        .route("/api/producer/submit", post(public_producer_submit_handler))
        .route("/producer/submit", post(public_producer_submit_handler))
}

