use axum::http::{HeaderName, HeaderValue, Request};
use tower_http::request_id::{MakeRequestId, RequestId, SetRequestIdLayer};
use uuid::Uuid;

#[derive(Clone, Copy)]
pub struct MakeRequestUuid;

impl MakeRequestId for MakeRequestUuid {
    fn make_request_id<B>(&mut self, _request: &Request<B>) -> Option<RequestId> {
        let id = Uuid::new_v4().to_string();
        HeaderValue::from_str(&id).ok().map(RequestId::new)
    }
}

pub fn make_request_id_layer() -> SetRequestIdLayer<MakeRequestUuid> {
    let header_name = HeaderName::from_static("x-request-id");
    SetRequestIdLayer::new(header_name, MakeRequestUuid)
}

