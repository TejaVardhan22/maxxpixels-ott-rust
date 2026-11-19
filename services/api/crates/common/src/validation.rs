use std::collections::HashMap;
use serde_json::json;

use crate::error::{AppError, AppResult};

/// SOLID (Interface Segregation & Open/Closed):
/// Every inbound request DTO implements `Validatable` so handlers enforce
/// uniform, structured field-level validation before invoking services.
pub trait Validatable {
    fn validate(&self) -> AppResult<()>;
}

/// Collects multiple field-level validation failures and converts them into
/// a single structured `AppError::Validation` response.
#[derive(Debug, Default)]
pub struct ValidationBag {
    errors: HashMap<String, String>,
}

impl ValidationBag {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, field: impl Into<String>, message: impl Into<String>) {
        self.errors.entry(field.into()).or_insert_with(|| message.into());
    }

    pub fn is_empty(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn require_text(
        &mut self,
        field: &str,
        value: Option<&str>,
        min_len: usize,
        max_len: usize,
    ) {
        match value.map(str::trim) {
            Some(v) if !v.is_empty() => {
                let len = v.chars().count();
                if len < min_len {
                    self.add(field, format!("must be at least {} character(s)", min_len));
                } else if len > max_len {
                    self.add(field, format!("must be at most {} character(s)", max_len));
                }
            }
            _ => self.add(field, "is required"),
        }
    }

    pub fn optional_text(&mut self, field: &str, value: Option<&str>, max_len: usize) {
        if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
            if v.chars().count() > max_len {
                self.add(field, format!("must be at most {} character(s)", max_len));
            }
        }
    }

    pub fn optional_email(&mut self, field: &str, value: Option<&str>) {
        if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
            let parts: Vec<&str> = v.split('@').collect();
            let valid = parts.len() == 2
                && !parts[0].is_empty()
                && parts[1].contains('.')
                && !parts[1].starts_with('.')
                && !parts[1].ends_with('.')
                && !v.contains(' ');
            if !valid {
                self.add(field, "must be a valid email address");
            }
        }
    }

    pub fn require_phone(&mut self, field: &str, value: Option<&str>) {
        match value.map(str::trim).filter(|s| !s.is_empty()) {
            Some(v) => self.check_phone(field, v),
            None => self.add(field, "mobile number is required"),
        }
    }

    pub fn optional_phone(&mut self, field: &str, value: Option<&str>) {
        if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
            self.check_phone(field, v);
        }
    }

    fn check_phone(&mut self, field: &str, raw: &str) {
        let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
        if digits.len() < 10 || digits.len() > 15 {
            self.add(field, "must be a valid mobile number (10-15 digits)");
        }
    }

    pub fn optional_url(&mut self, field: &str, value: Option<&str>) {
        if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
            let ok = v.starts_with("https://")
                || v.starts_with("http://")
                || v.starts_with('/');
            if !ok {
                self.add(field, "must be a valid http(s) URL or relative path");
            }
        }
    }

    pub fn optional_enum(&mut self, field: &str, value: Option<&str>, allowed: &[&str]) {
        if let Some(v) = value.map(str::trim).filter(|s| !s.is_empty()) {
            let upper = v.to_uppercase();
            if !allowed.iter().any(|a| a.eq_ignore_ascii_case(&upper)) {
                self.add(field, format!("must be one of: {}", allowed.join(", ")));
            }
        }
    }

    pub fn optional_range_i32(&mut self, field: &str, value: Option<i32>, min: i32, max: i32) {
        if let Some(v) = value {
            if v < min || v > max {
                self.add(field, format!("must be between {} and {}", min, max));
            }
        }
    }

    pub fn optional_non_negative_f64(&mut self, field: &str, value: Option<f64>) {
        if let Some(v) = value {
            if !v.is_finite() || v < 0.0 {
                self.add(field, "must be a non-negative number");
            }
        }
    }

    pub fn positive_id(&mut self, field: &str, id: i64) {
        if id <= 0 {
            self.add(field, "must be a positive ID");
        }
    }

    pub fn finish(self) -> AppResult<()> {
        if self.errors.is_empty() {
            Ok(())
        } else {
            let summary = self
                .errors
                .iter()
                .map(|(k, v)| format!("{}: {}", k, v))
                .collect::<Vec<_>>()
                .join("; ");
            Err(AppError::Validation(summary, Some(json!(self.errors))))
        }
    }
}

/// Reusable pagination clamping (prevents unbounded queries / DoS).
pub fn clamp_pagination(page: Option<u64>, size: Option<u64>, default_size: u64, max_size: u64) -> (u64, u64) {
    let p = page.unwrap_or(0);
    let s = size.unwrap_or(default_size).clamp(1, max_size);
    (p, s)
}

/// Reusable full-name builder from optional first/last/full name fields.
pub fn combine_full_name(
    first: Option<&str>,
    last: Option<&str>,
    full: Option<&str>,
) -> Option<String> {
    match (
        first.map(str::trim).filter(|s| !s.is_empty()),
        last.map(str::trim).filter(|s| !s.is_empty()),
    ) {
        (Some(f), Some(l)) => Some(format!("{} {}", f, l)),
        (Some(f), None) => Some(f.to_string()),
        (None, Some(l)) => Some(l.to_string()),
        (None, None) => full.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string),
    }
}

/// Reusable URL-safe slug generator (single source of truth across all modules).
pub fn slugify(input: &str) -> String {
    let mut s: String = input
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while s.contains("--") {
        s = s.replace("--", "-");
    }
    s.trim_matches('-').to_string()
}

/// Standard domain enum constants (single source of truth).
pub const ALLOWED_MONETIZATION: &[&str] = &["AVOD", "TVOD", "SVOD", "FREE", "PREMIUM"];
pub const ALLOWED_CONTENT_STATUS: &[&str] = &["DRAFT", "SCHEDULED", "PUBLISHED", "SUBMITTED", "ARCHIVED"];
pub const ALLOWED_USER_STATUS: &[&str] = &["ACTIVE", "SUSPENDED", "BLOCKED", "INACTIVE", "DELETED"];
