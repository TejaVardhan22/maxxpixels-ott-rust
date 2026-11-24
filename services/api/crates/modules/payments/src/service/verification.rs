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
    ActiveModelTrait, ColumnTrait, Condition, ConnectionTrait, DatabaseBackend, EntityTrait,
    PaginatorTrait, QueryFilter, QueryOrder, QuerySelect, Set, Statement, TransactionTrait,
};
use serde_json::{json, Value};
use uuid::Uuid;

impl PaymentService {
    pub async fn verify_payment(
        state: &AppState,
        user_id: Option<i64>,
        body: Value,
    ) -> AppResult<Value> {
        let mut order_identifiers: Vec<String> = Vec::new();
        for key in [
            "razorpay_subscription_id",
            "subscriptionId",
            "subscription_id",
            "razorpay_order_id",
            "razorpayOrderId",
            "providerOrderId",
            "orderId",
            "order_id",
            "gatewayOrderId",
            "gateway_order_id",
            "dbOrderId",
        ] {
            if let Some(s) = json_str(&body, &[key]) {
                if !order_identifiers.contains(&s) {
                    order_identifiers.push(s);
                }
            }
        }

        let provider_order_id = order_identifiers.first().cloned();
        let provider_payment_id = json_str(
            &body,
            &[
                "razorpay_payment_id",
                "razorpayPaymentId",
                "providerPaymentId",
                "paymentId",
                "gateway_payment_id",
                "transaction_id",
            ],
        )
        .unwrap_or_else(|| format!("pay_{}", &Uuid::new_v4().simple().to_string()[..16]));

        let signature = json_str(
            &body,
            &[
                "razorpay_signature",
                "razorpaySignature",
                "signature",
                "gateway_signature",
            ],
        )
        .unwrap_or_default();

        if order_identifiers.is_empty()
            && json_i64(&body, &["planId", "package_id", "contentId", "video_id"]).is_none()
        {
            return Err(AppError::BadRequest(
                "Order ID or planId/contentId is required for payment verification".to_string(),
            ));
        }

        let lock_key = format!(
            "payment:verify:{}",
            provider_order_id
                .clone()
                .unwrap_or_else(|| format!("{:?}-{}", user_id, Utc::now().timestamp_millis()))
        );
        let lock_token = state
            .redis
            .acquire_lock(&lock_key, 15000)
            .await
            .ok_or_else(|| {
                AppError::Conflict("Payment verification is already in progress".to_string())
            })?;

        let res = Self::verify_payment_inner(
            state,
            user_id,
            &body,
            &order_identifiers,
            provider_order_id.as_deref(),
            &provider_payment_id,
            &signature,
        )
        .await;

        let _ = state.redis.release_lock(&lock_key, &lock_token).await;
        res
    }

    async fn verify_payment_inner(
        state: &AppState,
        user_id: Option<i64>,
        body: &Value,
        order_identifiers: &[String],
        provider_order_id: Option<&str>,
        provider_payment_id: &str,
        signature: &str,
    ) -> AppResult<Value> {
        let mut order: Option<payment_order::Model> = None;
        for id_str in order_identifiers {
            order = payment_order::Entity::find()
                .filter(
                    Condition::any()
                        .add(payment_order::Column::OrderId.eq(id_str))
                        .add(payment_order::Column::ProviderOrderId.eq(id_str))
                        .add(payment_order::Column::SubscriptionId.eq(id_str)),
                )
                .one(&state.db)
                .await?;
            if order.is_none() {
                if let Ok(num_id) = id_str.parse::<i64>() {
                    order = payment_order::Entity::find_by_id(num_id)
                        .one(&state.db)
                        .await?;
                }
            }
            if order.is_some() {
                break;
            }
        }

        if let Some(ref ord) = order {
            if ord.status == "PAID" {
                let existing_payment = payment::Entity::find()
                    .filter(payment::Column::PaymentOrderId.eq(ord.id))
                    .one(&state.db)
                    .await?;
                let existing_sub = subscription::Entity::find()
                    .filter(subscription::Column::UserId.eq(ord.user_id))
                    .filter(subscription::Column::Status.eq("ACTIVE"))
                    .order_by_desc(subscription::Column::EndDate)
                    .one(&state.db)
                    .await?;

                return Ok(json!({
                    "verified": true,
                    "idempotent": true,
                    "status": "SUCCESS",
                    "success": true,
                    "subscription_active": existing_sub.is_some(),
                    "is_subscribed": existing_sub.is_some(),
                    "isSubscribed": existing_sub.is_some(),
                    "isBuy": if existing_sub.is_some() { 1 } else { 0 },
                    "is_buy": if existing_sub.is_some() { 1 } else { 0 },
                    "orderId": ord.id,
                    "providerOrderId": ord.provider_order_id.as_ref().or(ord.order_id.as_ref()),
                    "paymentId": existing_payment.map(|p| p.id),
                    "subscription": existing_sub
                }));
            }
        }

        if order.is_none() {
            if let Some(uid) = user_id {
                let created = Self::create_order(state, uid, body.clone()).await?;
                if let Some(cid) = created.get("id").and_then(|v| v.as_i64()) {
                    order = payment_order::Entity::find_by_id(cid)
                        .one(&state.db)
                        .await?;
                }
            }
        }

        let ord = order.ok_or_else(|| {
            AppError::NotFound(format!(
                "Payment order not found ({})",
                order_identifiers.join(", ")
            ))
        })?;

        // Ownership check: prevent another user from verifying/claiming someone else's order
        if let Some(uid) = user_id {
            if ord.user_id != uid {
                return Err(AppError::Forbidden(
                    "Order does not belong to the authenticated user".to_string(),
                ));
            }
        }

        // Only trust server-side DB amount/provider for free orders — NEVER client-supplied strings
        let ord_final_amount = ord.final_amount.or(ord.amount).unwrap_or(Decimal::ZERO);
        let is_free_order = ord_final_amount <= Decimal::ZERO
            || ord.provider == "COUPON_100_PERCENT"
            || ord.provider == "FREE";

        if ord.status == "PAID" {
            let existing_payment = payment::Entity::find()
                .filter(payment::Column::PaymentOrderId.eq(ord.id))
                .one(&state.db)
                .await?;
            let existing_sub = subscription::Entity::find()
                .filter(subscription::Column::UserId.eq(ord.user_id))
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .order_by_desc(subscription::Column::EndDate)
                .one(&state.db)
                .await?;

            return Ok(json!({
                "verified": true,
                "idempotent": true,
                "status": "SUCCESS",
                "success": true,
                "subscription_active": existing_sub.is_some(),
                "is_subscribed": existing_sub.is_some(),
                "isSubscribed": existing_sub.is_some(),
                "isBuy": if existing_sub.is_some() { 1 } else { 0 },
                "is_buy": if existing_sub.is_some() { 1 } else { 0 },
                "orderId": ord.id,
                "providerOrderId": ord.provider_order_id.as_ref().or(ord.order_id.as_ref()),
                "paymentId": existing_payment.map(|p| p.id),
                "subscription": existing_sub
            }));
        }

        if !is_free_order && ord.provider == "RAZORPAY" {
            let sub_id = json_str(
                body,
                &["subscription_id", "subscriptionId", "razorpay_subscription_id"],
            )
            .or_else(|| ord.subscription_id.clone());
            let oid = ord
                .provider_order_id
                .as_deref()
                .or(ord.order_id.as_deref())
                .or(provider_order_id);

            let rzp = RazorpayClient::from_env();
            if !rzp.verify_payment_signature(oid, sub_id.as_deref(), provider_payment_id, signature)
            {
                return Err(AppError::BadRequest(
                    "Invalid payment signature".to_string(),
                ));
            }
        }

        let effective_user_id = user_id
            .or(Some(ord.user_id))
            .or_else(|| json_i64(body, &["userId", "user_id"]))
            .unwrap_or(ord.user_id);

        Self::fulfill_order(state, ord, effective_user_id, provider_payment_id, signature, body, provider_order_id).await
    }

    pub(super) async fn fulfill_order(
        state: &AppState,
        ord: payment_order::Model,
        effective_user_id: i64,
        provider_payment_id: &str,
        signature: &str,
        body: &Value,
        provider_order_id: Option<&str>,
    ) -> AppResult<Value> {
        let txn = state.db.begin().await?;
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();

        let ord_id = ord.id;
        let ord_provider = ord.provider.clone();
        let ord_provider_order_id = ord
            .provider_order_id
            .clone()
            .or_else(|| ord.order_id.clone())
            .or_else(|| provider_order_id.map(|s| s.to_string()));
        let ord_final_amount = ord.final_amount.or(ord.amount).unwrap_or(Decimal::ZERO);
        let ord_currency = ord.currency.clone().unwrap_or_else(|| "INR".to_string());
        let ord_type = ord
            .order_type
            .clone()
            .unwrap_or_else(|| "SUBSCRIPTION".to_string());
        let ord_plan_id = ord.plan_id;
        let ord_content_id = ord.content_id;
        let ord_coupon_code = ord.coupon_code.clone();
        let ord_sub_id = ord.subscription_id.clone();

        let mut ord_am: payment_order::ActiveModel = ord.into();
        ord_am.status = Set("PAID".to_string());
        if ord_provider_order_id.is_some() {
            ord_am.provider_order_id = Set(ord_provider_order_id.clone());
        }
        ord_am.updated_at = Set(Some(now));
        ord_am.update(&txn).await?;

        let tax_val = (ord_final_amount.to_f64().unwrap_or(0.0) * 18.0 / 118.0 * 100.0).round()
            / 100.0;
        let effective_pay_id = if provider_payment_id.trim().is_empty() {
            format!(
                "free_pay_{}_{}",
                Utc::now().timestamp_millis(),
                &Uuid::new_v4().simple().to_string()[..6]
            )
        } else {
            provider_payment_id.to_string()
        };
        let pay_am = payment::ActiveModel {
            user_id: Set(Some(effective_user_id)),
            payment_id: Set(Some(effective_pay_id.clone())),
            order_id: Set(ord_provider_order_id.clone()),
            payment_order_id: Set(ord_id),
            provider: Set(Some(ord_provider)),
            provider_order_id: Set(ord_provider_order_id.clone()),
            transaction_id: Set(effective_pay_id.clone()),
            provider_payment_id: Set(Some(effective_pay_id)),
            provider_signature: Set(if signature.is_empty() {
                None
            } else {
                Some(signature.to_string())
            }),
            payment_method: Set(Some(
                json_str(body, &["paymentMethod", "payment_method"])
                    .unwrap_or_else(|| "ONLINE".to_string()),
            )),
            amount: Set(ord_final_amount),
            tax_amount: Set(Decimal::from_f64_retain(tax_val)),
            currency: Set(Some(ord_currency.clone())),
            status: Set("SUCCESS".to_string()),
            created_at: Set(now),
            paid_at: Set(Some(now)),
            ..Default::default()
        };
        let saved_payment = pay_am.insert(&txn).await?;

        let mut subscription_result: Option<subscription::Model> = None;
        let mut purchase_result: Option<content_purchase::Model> = None;

        let mut target_plan_id =
            ord_plan_id.or_else(|| json_i64(body, &["planId", "plan_id", "package_id", "packageId"]));
        let is_subscription = ord_type == "SUBSCRIPTION" || ord_content_id.is_none();

        if target_plan_id.is_none() && is_subscription {
            if let Some(fallback) = plan::Entity::find()
                .filter(plan::Column::IsActive.eq(true))
                .order_by_asc(plan::Column::Price)
                .one(&txn)
                .await?
            {
                target_plan_id = Some(fallback.id);
            }
        }

        if is_subscription {
            if let Some(pid) = target_plan_id {
                let p = plan::Entity::find_by_id(pid).one(&txn).await?;
                let duration_days = p.as_ref().and_then(|m| m.duration_days).unwrap_or(30) as i64;
                let end_date = Utc::now() + Duration::days(duration_days);

                // Supersede existing active subscriptions
                let active_subs = subscription::Entity::find()
                    .filter(subscription::Column::UserId.eq(effective_user_id))
                    .filter(subscription::Column::Status.eq("ACTIVE"))
                    .all(&txn)
                    .await?;
                for s in active_subs {
                    let mut sam: subscription::ActiveModel = s.into();
                    sam.status = Set("SUPERSEDED".to_string());
                    sam.updated_at = Set(now);
                    sam.update(&txn).await?;
                }

                let active_sub_id = json_str(
                    body,
                    &["subscription_id", "subscriptionId", "razorpay_subscription_id"],
                )
                .or(ord_sub_id);
                let is_autopay = active_sub_id.is_some()
                    || p.as_ref().and_then(|m| m.is_autopay_eligible).unwrap_or(false);

                let sub_am = subscription::ActiveModel {
                    user_id: Set(effective_user_id),
                    plan_id: Set(pid),
                    status: Set("ACTIVE".to_string()),
                    start_date: Set(now),
                    end_date: Set(end_date.into()),
                    auto_renew: Set(Some(is_autopay)),
                    autopay_enabled: Set(Some(is_autopay)),
                    payment_id: Set(Some(saved_payment.id.to_string())),
                    payment_gateway_sub_id: Set(active_sub_id.clone()),
                    razorpay_subscription_id: Set(active_sub_id),
                    amount: Set(Some(ord_final_amount)),
                    created_at: Set(now),
                    updated_at: Set(now),
                    ..Default::default()
                };
                subscription_result = Some(sub_am.insert(&txn).await?);
            }
        } else if ord_type == "TVOD" {
            if let Some(cid) = ord_content_id {
                let content_row = content::Entity::find_by_id(cid).one(&txn).await?;
                let tvod = tvod_product::Entity::find()
                    .filter(tvod_product::Column::ContentId.eq(cid))
                    .one(&txn)
                    .await?;
                let rental_hours = content_row
                    .as_ref()
                    .and_then(|c| c.validity_hours)
                    .or_else(|| tvod.as_ref().and_then(|t| t.rental_duration_hours))
                    .unwrap_or(48) as i64;
                let expires_at = Utc::now() + Duration::hours(rental_hours);

                let purch_am = content_purchase::ActiveModel {
                    user_id: Set(effective_user_id),
                    content_id: Set(cid),
                    tvod_product_id: Set(tvod.map(|t| t.id)),
                    price: Set(ord_final_amount),
                    purchase_type: Set("RENT".to_string()),
                    amount_paid: Set(Some(ord_final_amount)),
                    currency: Set(Some(ord_currency.clone())),
                    payment_id: Set(Some(saved_payment.id.to_string())),
                    status: Set(Some("ACTIVE".to_string())),
                    purchased_at: Set(now),
                    expires_at: Set(Some(expires_at.into())),
                    valid_until: Set(Some(expires_at.into())),
                    ..Default::default()
                };
                purchase_result = Some(purch_am.insert(&txn).await?);
            }
        }

        if let Some(code) = ord_coupon_code {
            let clean_code = code.trim().to_uppercase();
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE coupons \
                 SET used_count = COALESCE(used_count, 0) + 1 \
                 WHERE UPPER(code) = $1 \
                   AND is_active = TRUE \
                   AND (usage_limit IS NULL OR COALESCE(used_count, 0) < usage_limit)",
                vec![clean_code.into()],
            );
            let exec_res = txn.execute(stmt).await?;
            if exec_res.rows_affected() == 0 {
                return Err(AppError::Conflict(
                    "Coupon is inactive or its redemption limit has been reached.".to_string(),
                ));
            }
        }

        txn.commit().await?;

        // Best-effort: if this subscriber was referred by another user, credit the referrer's VIP days.
        if subscription_result.is_some() {
            let db_clone = state.db.clone();
            tokio::spawn(async move {
                let rewarded = db_clone
                    .query_one(Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        "UPDATE user_referrals \
                         SET status = 'REWARDED', credited_at = NOW(), updated_at = NOW() \
                         WHERE referred_user_id = $1 AND status = 'SIGNED_UP' \
                         RETURNING referrer_user_id, reward_days",
                        vec![effective_user_id.into()],
                    ))
                    .await
                    .ok()
                    .flatten();

                if let Some(row) = rewarded {
                    let referrer_id: i64 = row.try_get("", "referrer_user_id").unwrap_or(0);
                    let reward_days: i32 = row.try_get("", "reward_days").unwrap_or(7).max(1);
                    if referrer_id > 0 {
                        // Extend existing active subscription if present
                        let extended = db_clone
                            .execute(Statement::from_sql_and_values(
                                DatabaseBackend::Postgres,
                                "UPDATE subscriptions \
                                 SET end_date = COALESCE(end_date, NOW()) + ($1 || ' days')::interval, \
                                     expires_at = COALESCE(expires_at, NOW()) + ($1 || ' days')::interval, \
                                     updated_at = NOW() \
                                 WHERE id = ( \
                                     SELECT id FROM subscriptions \
                                     WHERE user_id = $2 AND status = 'ACTIVE' \
                                     ORDER BY COALESCE(end_date, expires_at) DESC NULLS LAST \
                                     LIMIT 1 \
                                 )",
                                vec![reward_days.to_string().into(), referrer_id.into()],
                            ))
                            .await
                            .map(|r| r.rows_affected())
                            .unwrap_or(0);

                        if extended == 0 {
                            let _ = db_clone
                                .execute(Statement::from_sql_and_values(
                                    DatabaseBackend::Postgres,
                                    "INSERT INTO subscriptions (user_id, plan_id, status, start_date, end_date, expires_at, created_at, updated_at) \
                                     SELECT $1, id, 'ACTIVE', NOW(), NOW() + ($2 || ' days')::interval, NOW() + ($2 || ' days')::interval, NOW(), NOW() \
                                     FROM plans WHERE is_active = TRUE ORDER BY price ASC LIMIT 1",
                                    vec![referrer_id.into(), reward_days.to_string().into()],
                                ))
                                .await;
                        }

                        // Send in-app notification to referrer
                        let _ = db_clone
                            .execute(Statement::from_sql_and_values(
                                DatabaseBackend::Postgres,
                                "INSERT INTO notifications (user_id, title, message, type, is_read, created_at) \
                                 VALUES ($1, 'Referral Reward Unlocked!', $2, 'REWARD', FALSE, NOW())",
                                vec![
                                    referrer_id.into(),
                                    format!(
                                        "Your friend just subscribed! {} free VIP days have been added to your account.",
                                        reward_days
                                    )
                                    .into(),
                                ],
                            ))
                            .await;
                    }
                }
            });
        }

        Ok(json!({
            "verified": true,
            "status": "SUCCESS",
            "success": true,
            "subscription_active": subscription_result.is_some(),
            "is_subscribed": subscription_result.is_some(),
            "isSubscribed": subscription_result.is_some(),
            "isBuy": if subscription_result.is_some() { 1 } else { 0 },
            "is_buy": if subscription_result.is_some() { 1 } else { 0 },
            "rent_active": purchase_result.is_some(),
            "is_rented": if purchase_result.is_some() { 1 } else { 0 },
            "orderId": ord_id,
            "providerOrderId": ord_provider_order_id,
            "paymentId": saved_payment.id,
            "providerPaymentId": saved_payment.provider_payment_id,
            "amount": saved_payment.amount,
            "currency": saved_payment.currency,
            "subscription": subscription_result,
            "rentalPurchase": purchase_result
        }))
    }

    pub async fn handle_webhook(
        state: &AppState,
        provider: &str,
        raw_body: &str,
        signature: Option<&str>,
        payload: Value,
    ) -> AppResult<Value> {
        let normalized = provider.to_uppercase();
        if normalized == "RAZORPAY" {
            let rzp = RazorpayClient::from_env();
            if !rzp.verify_webhook_signature(raw_body, signature) {
                return Err(AppError::BadRequest(
                    "Invalid Razorpay webhook signature".to_string(),
                ));
            }

            let event = payload.get("event").and_then(|v| v.as_str()).unwrap_or("");
            let entity = payload
                .pointer("/payload/payment/entity")
                .or_else(|| payload.pointer("/payload/order/entity"));
            let sub_entity = payload.pointer("/payload/subscription/entity");

            if (event == "payment.captured"
                || event == "order.paid"
                || event.starts_with("subscription."))
                && (entity.is_some() || sub_entity.is_some())
            {
                let sub_id = sub_entity
                    .and_then(|s| s.get("id").and_then(|v| v.as_str()))
                    .or_else(|| entity.and_then(|e| e.get("subscription_id").and_then(|v| v.as_str())));
                let order_id = entity
                    .and_then(|e| {
                        e.get("order_id")
                            .or_else(|| e.get("id"))
                            .and_then(|v| v.as_str())
                    })
                    .or(sub_id);
                let payment_id = payload
                    .pointer("/payload/payment/entity/id")
                    .and_then(|v| v.as_str())
                    .or_else(|| entity.and_then(|e| e.get("id").and_then(|v| v.as_str())));

                if let Some(lookup_id) = order_id.or(sub_id) {
                    let lock_key = format!("payment:webhook:{}", lookup_id);
                    if let Some(lock_token) = state.redis.acquire_lock(&lock_key, 15000).await {
                        if let Ok(Some(ord)) = payment_order::Entity::find()
                            .filter(
                                Condition::any()
                                    .add(payment_order::Column::OrderId.eq(lookup_id))
                                    .add(payment_order::Column::ProviderOrderId.eq(lookup_id))
                                    .add(payment_order::Column::SubscriptionId.eq(lookup_id)),
                            )
                            .one(&state.db)
                            .await
                        {
                            if ord.status != "PAID" {
                                let eff_uid = ord.user_id;
                                let pay_id = payment_id.unwrap_or("webhook_captured");
                                let sig = signature.unwrap_or("");
                                let _ = Self::fulfill_order(
                                    state,
                                    ord,
                                    eff_uid,
                                    pay_id,
                                    sig,
                                    &payload,
                                    Some(lookup_id),
                                )
                                .await;
                            }
                        }
                        let _ = state.redis.release_lock(&lock_key, &lock_token).await;
                    }
                }
            }
        }

        Ok(json!({ "received": true, "provider": normalized }))
    }

}
