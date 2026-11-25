use axum::{
    middleware::{from_fn, from_fn_with_state},
    routing::get,
    Router,
};
use std::sync::Arc;
use tower_http::trace::TraceLayer;

use maxx_common::middleware::{
    build_cors_layer, envelope::response_envelope_middleware, make_request_id_layer,
};
use maxx_core::AppState;
use maxx_module_auth::{auth_routes, AuthService};
use maxx_module_catalogue::{catalog_routes, taxonomy_routes, CatalogueService};
use maxx_module_content::content_routes;
use maxx_module_admin::admin_routes;
use maxx_module_advertising::advertising_routes;
use maxx_module_analytics::analytics_routes;
use maxx_module_marketing::marketing_routes;
use maxx_module_home_content::home_content_routes;
use maxx_module_graphql::graphql_routes;
use maxx_module_notifications::notification_routes;
use maxx_module_playback::{playback_routes, PlaybackService};
use maxx_module_payments::payment_routes;
use maxx_module_subscriptions::subscription_routes;
use maxx_module_users::{admin_users_routes, user_profile_routes, UsersService};
use maxx_module_watch_history::{watch_routes, watchlist_routes, WatchHistoryService};

use crate::health::{health_handler, metrics_handler, ping_handler};
use crate::maintenance::maintenance_mode_middleware;

pub fn build_app_router(state: AppState) -> Router {
    let cors = build_cors_layer(&state.config.cors_allowed_origins);
    let request_id = make_request_id_layer();

    let public_base_url = std::env::var("PUBLIC_BASE_URL").unwrap_or_default();

    // Module 1: Auth service & router
    let auth_service = Arc::new(AuthService::new(
        state.db.clone(),
        Arc::new(state.redis.clone()),
        (*state.config).clone(),
    ));
    let auth_router = auth_routes(auth_service);

    // Module 2: Users & Profiles service & routers
    let users_service = Arc::new(UsersService::new(state.db.clone()));
    let user_profile_router = user_profile_routes(users_service.clone());
    let admin_users_router = admin_users_routes(users_service);
    let auth_with_profiles = auth_router.merge(user_profile_router.clone());

    // Module 3: Content & Catalogue service & routers
    let catalogue_service = Arc::new(CatalogueService::new(
        state.db.clone(),
        public_base_url.clone(),
    ));
    let catalog_router = catalog_routes(catalogue_service.clone());
    let taxonomy_router = taxonomy_routes(catalogue_service);

    // Module 4: Playback service & router
    let playback_service = Arc::new(PlaybackService::with_kafka(state.db.clone(), Some(state.kafka.clone())));
    let playback_router = playback_routes(playback_service);

    // Module 5: Watch History & Watchlist service & routers
    let watch_service = Arc::new(WatchHistoryService::with_kafka(
        state.db.clone(),
        public_base_url,
        Some(state.kafka.clone()),
    ));
    let watch_router = watch_routes(watch_service.clone());
    let watchlist_router = watchlist_routes(watch_service);

    Router::new()
        // Observability & Health endpoints (aliased to match NestJS & Spring Actuator contracts)
        .route("/ping", get(ping_handler))
        .route("/api/ping", get(ping_handler))
        .route("/api/v1/ping", get(ping_handler))
        .route("/health", get(health_handler))
        .route("/api/health", get(health_handler))
        .route("/api/v1/health", get(health_handler))
        .route("/actuator/health", get(health_handler))
        .route("/api/actuator/health", get(health_handler))
        .route("/api/v1/actuator/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .route("/prometheus", get(metrics_handler))
        .with_state(state.clone())
        // Module 1 & 2: Authentication + User Profile routes
        .nest("/api/v1/auth", auth_with_profiles.clone())
        .nest("/api/auth", auth_with_profiles.clone())
        .nest("/auth", auth_with_profiles)
        // Module 2: Sub-profiles & Devices under /api/v1 and /api
        .nest("/api/v1", user_profile_router.clone())
        .nest("/api", user_profile_router)
        // Module 2: Admin Users Management
        .nest("/api/v1/admin/users", admin_users_router.clone())
        .nest("/api/admin/users", admin_users_router.clone())
        .nest("/admin/users", admin_users_router)
        // Module 3: Public Content & Catalogue
        .nest("/api/v1/catalog", catalog_router.clone())
        .nest("/api/catalog", catalog_router.clone())
        .nest("/catalog", catalog_router.clone())
        .nest("/api/v1/content", catalog_router.clone())
        .nest("/api/content", catalog_router.clone())
        .nest("/api/v1/contents", catalog_router.clone())
        .nest("/api/contents", catalog_router)
        .merge(taxonomy_router)
        // Module 4: Playback Authorization & Heartbeats
        .nest("/api/v1/playback", playback_router.clone())
        .nest("/api/playback", playback_router.clone())
        .nest("/playback", playback_router.clone())
        .nest("/api/v1/video", playback_router.clone())
        .nest("/api/video", playback_router.clone())
        .nest("/video", playback_router)
        // Module 5: Watch History & Watchlist
        .nest("/api/v1/watch", watch_router.clone())
        .nest("/api/watch", watch_router.clone())
        .nest("/watch", watch_router.clone())
        .nest("/api/v1/watch-history", watch_router.clone())
        .nest("/api/watch-history", watch_router)
        .nest("/api/v1/watchlist", watchlist_router.clone())
        .nest("/api/watchlist", watchlist_router.clone())
        .nest("/watchlist", watchlist_router)
        // Module 6: Subscriptions, Coupons & Payments
        .merge(subscription_routes().with_state(state.clone()))
        .merge(payment_routes().with_state(state.clone()))
        // Module 7: Advertising, VAST & Producers
        .merge(advertising_routes().with_state(state.clone()))
        // Module 7b: Marketing Agents & Member Attribution
        .merge(marketing_routes().with_state(state.clone()))
        // Module 7c: Intro Video & Portal Banner Management
        .merge(home_content_routes().with_state(state.clone()))
        // Module 8: Notifications & Analytics
        .merge(notification_routes().with_state(state.clone()))
        .merge(analytics_routes().with_state(state.clone()))
        // Module 9: Admin Settings, Banners, Pages & Legal
        .merge(admin_routes().with_state(state.clone()))
        // Module 10: Content (Movies Write, Series, Seasons, Episodes, Live, Storage/Bunny)
        .merge(content_routes().with_state(state.clone()))
        // Module 11: GraphQL (NestJS parity endpoint)
        .merge(graphql_routes())
        // Apply global middlewares
        .layer(from_fn_with_state(state.clone(), maintenance_mode_middleware))
        .layer(from_fn(response_envelope_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(request_id)
        .layer(cors)
}
