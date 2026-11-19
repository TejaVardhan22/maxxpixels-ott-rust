use crate::error::AppError;
use regex::Regex;
use std::sync::OnceLock;

// ── PAN validation (India) : 5 uppercase letters, 4 digits, 1 uppercase letter ──
static PAN_RE: OnceLock<Regex> = OnceLock::new();
fn pan_regex() -> &'static Regex {
    PAN_RE.get_or_init(|| Regex::new(r"^[A-Z]{5}[0-9]{4}[A-Z]$").expect("valid PAN regex"))
}

pub fn validate_pan(pan: &str) -> Result<(), AppError> {
    let trimmed = pan.trim().to_uppercase();
    if !pan_regex().is_match(&trimmed) {
        return Err(AppError::BadRequest(
            "Invalid PAN format. Expected format: ABCDE1234F".to_string(),
        ));
    }
    Ok(())
}

pub fn normalize_pan(pan: &str) -> String {
    pan.trim().to_uppercase()
}

// ── Aadhaar validation (India) : exactly 12 digits ──
static AADHAAR_RE: OnceLock<Regex> = OnceLock::new();
fn aadhaar_regex() -> &'static Regex {
    AADHAAR_RE.get_or_init(|| Regex::new(r"^\d{12}$").expect("valid Aadhaar regex"))
}

pub fn validate_aadhaar(aadhaar: &str) -> Result<(), AppError> {
    let digits: String = aadhaar.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != 12 || !aadhaar_regex().is_match(&digits) {
        return Err(AppError::BadRequest(
            "Invalid Aadhaar number. Must be exactly 12 digits".to_string(),
        ));
    }
    Ok(())
}

pub fn normalize_aadhaar(aadhaar: &str) -> String {
    aadhaar.chars().filter(|c| c.is_ascii_digit()).collect()
}

// ── IFSC validation (India) : 4 chars, 0, 6 alphanumeric ──
static IFSC_RE: OnceLock<Regex> = OnceLock::new();
fn ifsc_regex() -> &'static Regex {
    IFSC_RE.get_or_init(|| Regex::new(r"^[A-Z]{4}0[A-Z0-9]{6}$").expect("valid IFSC regex"))
}

pub fn validate_ifsc(ifsc: &str) -> Result<(), AppError> {
    let trimmed = ifsc.trim().to_uppercase();
    if !ifsc_regex().is_match(&trimmed) {
        return Err(AppError::BadRequest(
            "Invalid IFSC code. Expected format: ABCD0XXXXXX".to_string(),
        ));
    }
    Ok(())
}

pub fn normalize_ifsc(ifsc: &str) -> String {
    ifsc.trim().to_uppercase()
}

// ── File upload validation ──
pub const MAX_FILE_SIZE_BYTES: u64 = 5 * 1024 * 1024; // 5 MB
pub const ALLOWED_DOC_MIME_TYPES: &[&str] = &["application/pdf"];
pub const ALLOWED_DOC_EXTENSIONS: &[&str] = &["pdf"];

pub fn validate_uploaded_file(
    file_name: &str,
    content_type: &str,
    size_bytes: u64,
) -> Result<String, AppError> {
    // Size check
    if size_bytes == 0 {
        return Err(AppError::BadRequest("File is empty".to_string()));
    }
    if size_bytes > MAX_FILE_SIZE_BYTES {
        return Err(AppError::BadRequest(format!(
            "File size exceeds {} MB limit",
            MAX_FILE_SIZE_BYTES / (1024 * 1024)
        )));
    }

    // Extension check
    let ext = file_name
        .rsplit('.')
        .next()
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    if !ALLOWED_DOC_EXTENSIONS.contains(&ext.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Only {} files are allowed",
            ALLOWED_DOC_EXTENSIONS.join(", ")
        )));
    }

    // MIME type check
    if !ALLOWED_DOC_MIME_TYPES.contains(&content_type) && content_type != "application/octet-stream" {
        return Err(AppError::BadRequest(format!(
            "Invalid file type '{}'. Only PDF documents are allowed",
            content_type
        )));
    }

    // Sanitize filename
    let safe_name: String = file_name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();

    if safe_name.is_empty() || safe_name == "." || safe_name == ".." {
        return Err(AppError::BadRequest("Invalid file name".to_string()));
    }

    Ok(safe_name)
}

// ── Email validation helper ──
pub fn validate_email_format(email: &str) -> Result<(), AppError> {
    let re = Regex::new(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
        .expect("valid email regex");
    if !re.is_match(email.trim()) {
        return Err(AppError::BadRequest("Invalid email address format".to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pan_validation() {
        assert!(validate_pan("ABCDE1234F").is_ok());
        assert!(validate_pan("abcde1234f").is_ok());
        assert!(validate_pan("INVALID").is_err());
        assert!(validate_pan("ABCDE1234").is_err());
    }

    #[test]
    fn test_aadhaar_validation() {
        assert!(validate_aadhaar("123456789012").is_ok());
        assert!(validate_aadhaar("1234 5678 9012").is_ok());
        assert!(validate_aadhaar("12345678901").is_err());
        assert!(validate_aadhaar("1234567890123").is_err());
    }

    #[test]
    fn test_ifsc_validation() {
        assert!(validate_ifsc("HDFC0001234").is_ok());
        assert!(validate_ifsc("sbin0001234").is_ok());
        assert!(validate_ifsc("INVALID").is_err());
    }

    #[test]
    fn test_file_validation() {
        assert!(validate_uploaded_file("doc.pdf", "application/pdf", 1024).is_ok());
        assert!(validate_uploaded_file("doc.jpg", "image/jpeg", 1024).is_err());
        assert!(validate_uploaded_file("doc.pdf", "application/pdf", 0).is_err());
        assert!(validate_uploaded_file("../etc/passwd", "application/pdf", 1024).is_ok());
    }
}
