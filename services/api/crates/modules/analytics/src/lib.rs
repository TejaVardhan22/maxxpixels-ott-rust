#![recursion_limit = "256"]

pub mod handlers;
pub mod router;
pub mod service;

pub use router::analytics_routes;
pub use service::AnalyticsService;
