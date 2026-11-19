pub mod dto;
pub mod handlers;
pub mod router;
pub mod service;

pub use router::marketing_routes;
pub use service::{
    link_registration_agent, validate_agent_code, MarketingService,
};
