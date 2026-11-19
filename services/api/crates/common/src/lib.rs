pub mod error;
pub mod middleware;
pub mod response;
pub mod security;
pub mod security_validation;
pub mod validation;

pub use error::AppError;
pub use response::{ApiResponse, PageResponse};
pub use security::{Claims, SecurityUtils};
pub use security_validation::{
    validate_aadhaar, validate_email_format, validate_ifsc, validate_pan, validate_uploaded_file,
    normalize_aadhaar, normalize_ifsc, normalize_pan, MAX_FILE_SIZE_BYTES,
};
pub use validation::{Validatable, ValidationBag};

