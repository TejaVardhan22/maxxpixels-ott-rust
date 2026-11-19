use super::*;
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

impl PaymentService {
    pub async fn list_admin_tvod_purchases(
        state: &AppState,
        q: &AdminTvodListQuery,
    ) -> AppResult<PageResponse<content_purchase::Model>> {
        let page = q.page.unwrap_or(0);
        let size = q.size.unwrap_or(20).clamp(1, 100);
        let query =
            content_purchase::Entity::find().order_by_desc(content_purchase::Column::PurchasedAt);
        let paginator = query.paginate(&state.db, size);
        let total = paginator.num_items().await?;
        let items = paginator.fetch_page(page).await?;
        Ok(PageResponse::of(items, total, page, size))
    }

    pub async fn refund_payment(
        state: &AppState,
        id: i64,
        reason: Option<String>,
    ) -> AppResult<payment::Model> {
        let p = payment::Entity::find_by_id(id)
            .one(&state.db)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Payment {} not found", id)))?;

        if p.status.eq_ignore_ascii_case("REFUNDED") {
            return Err(AppError::BadRequest(
                "Payment has already been refunded.".to_string(),
            ));
        }

        let amt = p.amount;
        let amt_paise = (amt.to_f64().unwrap_or(0.0) * 100.0).round() as i64;
        let is_razorpay_live_pay = p
            .provider
            .as_deref()
            .map(|pr| pr.eq_ignore_ascii_case("RAZORPAY"))
            .unwrap_or(false)
            && p.provider_payment_id
                .as_deref()
                .map(|pid| pid.starts_with("pay_"))
                .unwrap_or(false)
            && amt_paise >= 100;

        if is_razorpay_live_pay {
            let rzp = RazorpayClient::from_env();
            if rzp.is_configured() {
                if let Some(ref ppid) = p.provider_payment_id {
                    rzp.refund_payment(ppid, amt_paise, reason.as_deref())
                        .await
                        .map_err(AppError::BadRequest)?;
                }
            }
        }

        let payment_id_str = p.id.to_string();
        let linked_order_id = p.payment_order_id;
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        let txn = state.db.begin().await?;

        let mut am: payment::ActiveModel = p.into();
        am.status = Set("REFUNDED".to_string());
        am.refunded_amount = Set(Some(amt));
        am.failure_reason = Set(reason);
        let updated_payment = am.update(&txn).await?;

        // Mark linked payment_order as REFUNDED
        if let Some(ord) = payment_order::Entity::find_by_id(linked_order_id).one(&txn).await? {
            let mut oam: payment_order::ActiveModel = ord.into();
            oam.status = Set("REFUNDED".to_string());
            oam.updated_at = Set(Some(now));
            let _ = oam.update(&txn).await;
        }

        // Revoke linked active subscription(s)
        let linked_subs = subscription::Entity::find()
            .filter(subscription::Column::PaymentId.eq(&payment_id_str))
            .all(&txn)
            .await?;
        for s in linked_subs {
            let mut sam: subscription::ActiveModel = s.into();
            sam.status = Set("CANCELLED".to_string());
            sam.cancelled_at = Set(Some(now));
            sam.auto_renew = Set(Some(false));
            sam.updated_at = Set(now);
            let _ = sam.update(&txn).await;
        }

        // Revoke linked TVOD rental purchase(s)
        let linked_purchases = content_purchase::Entity::find()
            .filter(content_purchase::Column::PaymentId.eq(&payment_id_str))
            .all(&txn)
            .await?;
        for purch in linked_purchases {
            let mut pam: content_purchase::ActiveModel = purch.into();
            pam.status = Set(Some("REFUNDED".to_string()));
            let _ = pam.update(&txn).await;
        }

        txn.commit().await?;
        Ok(updated_payment)
    }

    pub async fn list_tvod_products(state: &AppState) -> AppResult<Vec<Value>> {
        let products = tvod_product::Entity::find()
            .filter(tvod_product::Column::IsActive.ne(Some(false)))
            .all(&state.db)
            .await?;

        let mut result = Vec::new();
        for p in products {
            let price_f64 = p.price.to_f64().unwrap_or(0.0);
            let hours = p.validity_hours.or(p.rental_duration_hours).unwrap_or(48);
            result.push(json!({
                "id": p.id,
                "contentId": p.content_id,
                "content_id": p.content_id,
                "price": price_f64,
                "rentPrice": price_f64,
                "rent_price": price_f64,
                "purchaseType": p.purchase_type,
                "purchase_type": p.purchase_type,
                "validityHours": hours,
                "validity_hours": hours,
                "rentalDurationHours": hours,
                "currency": p.currency.unwrap_or_else(|| "INR".to_string()),
                "isActive": p.is_active.unwrap_or(true),
            }));
        }
        Ok(result)
    }

    pub async fn list_user_tvod_purchases(
        state: &AppState,
        user_id: i64,
    ) -> AppResult<Vec<Value>> {
        let now = Utc::now();
        let purchases = content_purchase::Entity::find()
            .filter(content_purchase::Column::UserId.eq(user_id))
            .filter(content_purchase::Column::Status.eq("ACTIVE"))
            .order_by_desc(content_purchase::Column::PurchasedAt)
            .all(&state.db)
            .await?;

        let mut result = Vec::new();
        for p in purchases {
            if let Some(exp) = p.expires_at.or(p.valid_until) {
                if exp < now {
                    continue;
                }
            }
            result.push(json!({
                "id": p.id,
                "contentId": p.content_id,
                "content_id": p.content_id,
                "userId": p.user_id,
                "user_id": p.user_id,
                "price": p.price.to_f64().unwrap_or(0.0),
                "purchaseType": p.purchase_type,
                "status": p.status.unwrap_or_else(|| "ACTIVE".to_string()),
                "purchasedAt": p.purchased_at,
                "expiresAt": p.expires_at.or(p.valid_until),
                "validUntil": p.valid_until.or(p.expires_at),
                "isRented": true,
            }));
        }
        Ok(result)
    }

    pub async fn purchase_tvod_direct(
        state: &AppState,
        user_id: i64,
        body: &Value,
    ) -> AppResult<Value> {
        let content_id = json_i64(body, &["contentId", "content_id", "id"]).unwrap_or(0);
        let content_row = content::Entity::find_by_id(content_id)
            .one(&state.db)
            .await?;
        let price = content_row
            .as_ref()
            .and_then(|c| c.rent_price.and_then(|d| d.to_f64()))
            .or_else(|| json_f64(body, &["price", "rentPrice", "rent_price", "amount"]))
            .unwrap_or(99.0);
        let hours = content_row
            .as_ref()
            .and_then(|c| c.validity_hours.map(|h| h as i64))
            .or_else(|| json_i64(body, &["validityHours", "validity_hours", "rentalDurationHours"]))
            .unwrap_or(48);
        let tx_id = json_str(body, &["transactionId", "transaction_id", "paymentId", "payment_id"])
            .unwrap_or_else(|| format!("TVOD-{}", Utc::now().timestamp_millis()));

        let now = Utc::now();
        let expires_at = now + Duration::hours(hours);
        let price_dec = Decimal::from_f64_retain(price).unwrap_or_default();

        let purchase = content_purchase::ActiveModel {
            user_id: Set(user_id),
            content_id: Set(content_id),
            price: Set(price_dec),
            amount_paid: Set(Some(price_dec)),
            currency: Set(Some("INR".to_string())),
            purchase_type: Set("RENT".to_string()),
            payment_id: Set(Some(tx_id)),
            status: Set(Some("ACTIVE".to_string())),
            purchased_at: Set(now.into()),
            expires_at: Set(Some(expires_at.into())),
            valid_until: Set(Some(expires_at.into())),
            ..Default::default()
        };
        let saved = purchase.insert(&state.db).await?;

        Ok(json!({
            "id": saved.id,
            "contentId": saved.content_id,
            "content_id": saved.content_id,
            "status": "ACTIVE",
            "expiresAt": saved.expires_at,
            "isRented": true,
        }))
    }
}
