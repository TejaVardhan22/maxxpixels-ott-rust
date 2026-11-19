mod orders;
mod tvod;
mod verification;

use crate::dto::{AdminPaymentListQuery, AdminTvodListQuery};
use chrono::{Duration, Utc};
use maxx_common::error::AppError;
use maxx_common::response::PageResponse;
use maxx_integration_razorpay::RazorpayClient;
type AppResult<T> = Result<T, AppError>;
use maxx_core::entities::{
    content, content_purchase, coupon, payment, payment_order, plan, subscription, tvod_product,
};
use maxx_core::AppState;
use maxx_module_subscriptions::SubscriptionService;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder,
    QuerySelect, Set, TransactionTrait,
};
use serde_json::{json, Value};
use uuid::Uuid;

pub struct PaymentService;

pub(super) fn json_i64(body: &Value, keys: &[&str]) -> Option<i64> {
    for k in keys {
        if let Some(v) = body.get(*k) {
            if let Some(n) = v.as_i64() {
                return Some(n);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.trim().parse::<i64>() {
                    return Some(n);
                }
            }
        }
    }
    None
}

pub(super) fn json_f64(body: &Value, keys: &[&str]) -> Option<f64> {
    for k in keys {
        if let Some(v) = body.get(*k) {
            if let Some(n) = v.as_f64() {
                return Some(n);
            }
            if let Some(s) = v.as_str() {
                if let Ok(n) = s.trim().parse::<f64>() {
                    return Some(n);
                }
            }
        }
    }
    None
}

pub(super) fn json_str(body: &Value, keys: &[&str]) -> Option<String> {
    for k in keys {
        if let Some(v) = body.get(*k) {
            if let Some(s) = v.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            } else if let Some(n) = v.as_i64() {
                return Some(n.to_string());
            }
        }
    }
    None
}

pub(super) fn json_bool(body: &Value, keys: &[&str]) -> bool {
    for k in keys {
        if let Some(v) = body.get(*k) {
            if let Some(b) = v.as_bool() {
                return b;
            }
            if let Some(s) = v.as_str() {
                if s.eq_ignore_ascii_case("true") || s == "1" {
                    return true;
                }
            }
            if let Some(n) = v.as_i64() {
                return n != 0;
            }
        }
    }
    false
}

