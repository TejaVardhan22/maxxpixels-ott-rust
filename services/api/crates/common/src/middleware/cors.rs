use axum::http::{header, Method};
use tower_http::cors::{AllowOrigin, CorsLayer};

pub fn build_cors_layer(allowed_origins_str: &str) -> CorsLayer {
    let origins: Vec<String> = allowed_origins_str
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();

    let is_wildcard = origins.iter().any(|o| o == "*");

    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::ORIGIN,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::AUTHORIZATION,
            header::ACCEPT_LANGUAGE,
            header::HeaderName::from_static("x-requested-with"),
            header::HeaderName::from_static("x-razorpay-signature"),
            header::HeaderName::from_static("stripe-signature"),
            header::HeaderName::from_static("x-device-id"),
            header::HeaderName::from_static("x-client-platform"),
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600));

    if is_wildcard || origins.is_empty() {
        // When allow_credentials(true) is used, CORS spec forbids wildcard '*'
        // mirror_request dynamically echoes the Origin header of the request for browsers
        cors.allow_origin(AllowOrigin::mirror_request())
    } else {
        cors.allow_origin(AllowOrigin::predicate(move |_, _| true))
    }
}

