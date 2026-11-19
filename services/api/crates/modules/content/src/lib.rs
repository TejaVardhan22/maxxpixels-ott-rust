pub mod handlers;
pub mod router;
pub mod service;

pub use router::{admin_movies_write_routes, content_routes};
pub use service::ContentService;
