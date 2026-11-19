use axum::{
    body::Body,
    http::{header, HeaderName, HeaderValue, Request, StatusCode},
    middleware::Next,
    response::Response,
};

/// Middleware ensuring uniform envelope and baseline security headers across endpoints.
pub async fn response_envelope_middleware(req: Request<Body>, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;

    // Baseline security/governance headers (additive hardening)
    {
        let headers = response.headers_mut();
        if !headers.contains_key(header::X_CONTENT_TYPE_OPTIONS) {
            headers.insert(header::X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
        }
        if !headers.contains_key(header::X_FRAME_OPTIONS) {
            headers.insert(header::X_FRAME_OPTIONS, HeaderValue::from_static("SAMEORIGIN"));
        }
        if !headers.contains_key(header::REFERRER_POLICY) {
            headers.insert(
                header::REFERRER_POLICY,
                HeaderValue::from_static("strict-origin-when-cross-origin"),
            );
        }
        let permissions_policy = HeaderName::from_static("permissions-policy");
        if !headers.contains_key(&permissions_policy) {
            headers.insert(
                permissions_policy,
                HeaderValue::from_static("camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
            );
        }
    }

    // Do not wrap raw responses for Prometheus metrics, VAST XML, or static media
    if path == "/metrics" || path == "/prometheus" || path.contains("/ads/vast") || path.contains("/uploads/") {
        return response;
    }

    // Ensure content-type header for successful API responses where missing
    let is_ok = response.status() == StatusCode::OK;
    let headers = response.headers_mut();
    if !headers.contains_key(header::CONTENT_TYPE) && is_ok {
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
    }

    response
}

