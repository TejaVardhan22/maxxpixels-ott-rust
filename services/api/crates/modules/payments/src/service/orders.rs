use super::*;
use crate::dto::{AdminPaymentListQuery, AdminTvodListQuery};
use chrono::{Duration, Utc};
use maxx_common::error::AppError;
use maxx_common::response::PageResponse;
use maxx_integration_razorpay::RazorpayClient;
type AppResult<T> = Result<T, AppError>;
use maxx_core::entities::{
    content, content_purchase, coupon, payment, payment_order, plan, subscription, tvod_product,
    user,
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
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

impl PaymentService {
    pub async fn create_order(state: &AppState, user_id: i64, body: Value) -> AppResult<Value> {
        let mut plan_id = json_i64(&body, &["planId", "plan_id", "package_id", "packageId"]);
        let content_id = json_i64(&body, &["contentId", "video_id", "content_id"]);
        let coupon_code = json_str(&body, &["couponCode", "coupon_code"])
            .map(|c| c.trim().to_uppercase())
            .filter(|c| !c.is_empty());
        let provider = json_str(&body, &["provider", "gateway"])
            .unwrap_or_else(|| "RAZORPAY".to_string())
            .to_uppercase();

        let mut order_type = "SUBSCRIPTION".to_string();
        let base_amount: f64;
        let mut currency = "INR".to_string();
        let mut item_title = "MaxxPixels Subscription".to_string();

        if plan_id.is_none() && content_id.is_none() {
            if let Some(amt) = json_f64(&body, &["amount", "price"]) {
                let amt_dec = Decimal::from_f64_retain(amt).unwrap_or_default();
                if let Some(matched) = plan::Entity::find()
                    .filter(plan::Column::IsActive.eq(true))
                    .filter(
                        Condition::any()
                            .add(plan::Column::DiscountPrice.eq(amt_dec))
                            .add(plan::Column::Price.eq(amt_dec)),
                    )
                    .one(&state.db)
                    .await?
                {
                    plan_id = Some(matched.id);
                }
            }
        }

        let mut plan_opt: Option<plan::Model> = None;
        if let Some(pid) = plan_id {
            let p = plan::Entity::find_by_id(pid)
                .one(&state.db)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Subscription plan {} not found", pid)))?;

            if p.single_use_only.unwrap_or(false) {
                let prior_sub = subscription::Entity::find()
                    .filter(subscription::Column::UserId.eq(user_id))
                    .filter(subscription::Column::PlanId.eq(p.id))
                    .one(&state.db)
                    .await?;
                if prior_sub.is_some() {
                    return Err(AppError::BadRequest(format!(
                        "The \"{}\" plan is for single-time use only and has already been used on your account.",
                        p.name
                    )));
                }
                let prior_order = payment_order::Entity::find()
                    .filter(payment_order::Column::UserId.eq(user_id))
                    .filter(payment_order::Column::PlanId.eq(p.id))
                    .filter(payment_order::Column::Status.eq("PAID"))
                    .one(&state.db)
                    .await?;
                if prior_order.is_some() {
                    return Err(AppError::BadRequest(format!(
                        "The \"{}\" plan is for single-time use only and has already been used on your account.",
                        p.name
                    )));
                }
            }

            base_amount = p
                .discount_price
                .unwrap_or(p.price)
                .to_f64()
                .unwrap_or(0.0);
            currency = p.currency.clone().unwrap_or_else(|| "INR".to_string());
            item_title = p.name.clone();
            plan_opt = Some(p);
        } else if let Some(cid) = content_id {
            order_type = "TVOD".to_string();
            let c = content::Entity::find_by_id(cid)
                .one(&state.db)
                .await?
                .ok_or_else(|| AppError::NotFound(format!("Content {} not found", cid)))?;
            let tvod = tvod_product::Entity::find()
                .filter(tvod_product::Column::ContentId.eq(cid))
                .one(&state.db)
                .await?;
            base_amount = c
                .rent_price
                .and_then(|d| d.to_f64())
                .or_else(|| tvod.as_ref().and_then(|t| t.price.to_f64()))
                .or_else(|| json_f64(&body, &["amount", "price"]))
                .unwrap_or(99.0);
            currency = tvod
                .and_then(|t| t.currency)
                .unwrap_or_else(|| "INR".to_string());
            item_title = format!("Rent: {}", c.title);
        } else if let Some(amt) = json_f64(&body, &["amount", "price"]) {
            base_amount = amt;
        } else {
            return Err(AppError::BadRequest(
                "Either planId or contentId is required to create a payment order".to_string(),
            ));
        }

        let mut discount_amount = 0.0;
        let mut final_amount = base_amount;
        if let Some(ref code) = coupon_code {
            let res = SubscriptionService::validate_and_calculate_coupon(
                state,
                code,
                base_amount,
                plan_id,
            )
            .await?;
            // Production-grade per-user redemption limit enforcement (Netflix/Hotstar/Aha)
            let per_user_limit = res.coupon.usage_per_user.unwrap_or(1);
            if per_user_limit > 0 {
                let clean_code = code.trim().to_uppercase();
                let user_redemptions = payment_order::Entity::find()
                    .filter(payment_order::Column::UserId.eq(user_id))
                    .filter(payment_order::Column::CouponCode.eq(&clean_code))
                    .filter(payment_order::Column::Status.eq("PAID"))
                    .count(&state.db)
                    .await
                    .unwrap_or(0) as i32;
                if user_redemptions >= per_user_limit {
                    return Err(AppError::BadRequest(
                        "You have already redeemed this coupon the maximum number of times."
                            .to_string(),
                    ));
                }
            }
            discount_amount = res.discount_amount;
            final_amount = res.final_amount;
        }

        let is_autopay = plan_opt
            .as_ref()
            .and_then(|p| p.is_autopay_eligible)
            .unwrap_or(false)
            || json_bool(
                &body,
                &["enableAutopay", "enable_autopay", "autopay", "isAutopay"],
            );

        let receipt_number = format!(
            "rcpt_{}_{}",
            Utc::now().timestamp_millis(),
            &Uuid::new_v4().simple().to_string()[..6]
        );

        let rzp = RazorpayClient::from_env();
        let razorpay_key_id = rzp.key_id().to_string();

        let is_free_order = final_amount <= 0.0;
        let (final_order_id, is_live_order) = if is_free_order {
            (
                format!("free_{}_{}", Utc::now().timestamp_millis(), &Uuid::new_v4().simple().to_string()[..8]),
                false,
            )
        } else if provider == "RAZORPAY" {
            let amount_paise = (final_amount * 100.0).round() as i64;
            let res = rzp
                .create_order(
                    amount_paise,
                    &currency,
                    &receipt_number,
                    json!({
                        "userId": user_id,
                        "orderType": order_type,
                        "planId": plan_id.map(|v| v.to_string()).unwrap_or_default(),
                        "contentId": content_id.map(|v| v.to_string()).unwrap_or_default(),
                    }),
                )
                .await;
            (res.order_id, res.is_live)
        } else {
            (
                format!("order_{}", &Uuid::new_v4().simple().to_string()[..14]),
                false,
            )
        };

        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let am = payment_order::ActiveModel {
            order_id: Set(Some(final_order_id.clone())),
            user_id: Set(user_id),
            order_type: Set(Some(order_type.clone())),
            plan_id: Set(plan_id),
            content_id: Set(content_id),
            coupon_code: Set(coupon_code.clone()),
            amount: Set(Decimal::from_f64_retain(final_amount)),
            original_amount: Set(Decimal::from_f64_retain(base_amount)),
            discount_amount: Set(Decimal::from_f64_retain(discount_amount)),
            final_amount: Set(Decimal::from_f64_retain(final_amount)),
            currency: Set(Some(currency.clone())),
            provider: Set(if is_free_order { "COUPON_100_PERCENT".to_string() } else { provider.clone() }),
            provider_order_id: Set(Some(final_order_id.clone())),
            receipt_number: Set(Some(receipt_number.clone())),
            status: Set("CREATED".to_string()),
            created_at: Set(now),
            updated_at: Set(Some(now)),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;

        let mut auto_verify_result: Option<Value> = None;
        if is_free_order {
            let free_pay_id = format!("free_pay_{}_{}", Utc::now().timestamp_millis(), &Uuid::new_v4().simple().to_string()[..6]);
            let val = Self::fulfill_order(
                state,
                saved.clone(),
                user_id,
                &free_pay_id,
                "free_signature",
                &body,
                Some(&final_order_id),
            )
            .await?;
            auto_verify_result = Some(val);
        }

        let billing_period = plan_opt
            .as_ref()
            .and_then(|p| {
                if !p.billing_period.is_empty() {
                    Some(p.billing_period.clone())
                } else {
                    p.billing_cycle.clone()
                }
            })
            .unwrap_or_else(|| "MONTHLY".to_string());

        let amount_paise = (final_amount * 100.0).round() as i64;

        let mut res_json = json!({
            "id": saved.id,
            "dbOrderId": saved.id,
            "orderId": final_order_id,
            "order_id": final_order_id,
            "gatewayOrderId": final_order_id,
            "gateway_order_id": final_order_id,
            "providerOrderId": final_order_id,
            "razorpayOrderId": final_order_id,
            "razorpay_order_id": final_order_id,
            "subscriptionId": Value::Null,
            "subscription_id": Value::Null,
            "isAutopay": is_autopay,
            "autopayEnabled": is_autopay,
            "autopay_enabled": is_autopay,
            "billingPeriod": billing_period,
            "billing_period": billing_period,
            "receiptNumber": receipt_number,
            "receipt": receipt_number,
            "orderType": order_type,
            "itemTitle": item_title,
            "originalAmount": base_amount,
            "discountAmount": discount_amount,
            "finalAmount": final_amount,
            "amount": amount_paise,
            "amountInRupees": final_amount,
            "currency": currency,
            "provider": provider,
            "gateway": provider,
            "keyId": razorpay_key_id,
            "key_id": razorpay_key_id,
            "key": razorpay_key_id,
            "razorpay_key": razorpay_key_id,
            "status": if is_free_order { "SUCCESS" } else { "CREATED" },
            "isFree": is_free_order,
            "isLiveOrder": is_live_order
        });

        if let Some(v) = auto_verify_result {
            if let Some(obj) = res_json.as_object_mut() {
                obj.insert("verified".to_string(), json!(true));
                obj.insert("success".to_string(), json!(true));
                obj.insert("subscription_active".to_string(), json!(true));
                obj.insert("is_subscribed".to_string(), json!(true));
                obj.insert("isSubscribed".to_string(), json!(true));
                obj.insert("isBuy".to_string(), json!(1));
                obj.insert("is_buy".to_string(), json!(1));
                if let Some(sub) = v.get("subscription") {
                    obj.insert("subscription".to_string(), sub.clone());
                }
            }
        }

        Ok(res_json)
    }

    pub async fn get_user_transactions(
        state: &AppState,
        user_id: i64,
    ) -> AppResult<Vec<payment::Model>> {
        let list = payment::Entity::find()
            .filter(payment::Column::UserId.eq(user_id))
            .order_by_desc(payment::Column::CreatedAt)
            .limit(50)
            .all(&state.db)
            .await?;
        Ok(list)
    }

    pub async fn get_user_active_subscription(state: &AppState, user_id: i64) -> AppResult<Value> {
        let active = subscription::Entity::find()
            .filter(subscription::Column::UserId.eq(user_id))
            .filter(subscription::Column::Status.eq("ACTIVE"))
            .order_by_desc(subscription::Column::EndDate)
            .one(&state.db)
            .await?;

        let now = Utc::now();
        let is_active = active
            .as_ref()
            .map(|s| s.end_date > now)
            .unwrap_or(false);

        let plan_model = if let Some(ref s) = active {
            plan::Entity::find_by_id(s.plan_id).one(&state.db).await?
        } else {
            None
        };

        let pkg_name = plan_model
            .as_ref()
            .map(|p| p.name.clone())
            .unwrap_or_else(|| {
                if is_active {
                    "VIP Membership".to_string()
                } else {
                    "Free".to_string()
                }
            });
        let expiry = active.as_ref().map(|s| s.end_date.to_rfc3339());
        let plan_id = active.as_ref().map(|s| s.plan_id).unwrap_or(0);
        let autopay = active
            .as_ref()
            .map(|s| s.autopay_enabled.unwrap_or(false) || s.auto_renew.unwrap_or(false))
            .unwrap_or(false);
        let auto_renew = active
            .as_ref()
            .and_then(|s| s.auto_renew)
            .unwrap_or(false);
        let sub_id = active.as_ref().and_then(|s| {
            s.razorpay_subscription_id
                .clone()
                .or_else(|| s.payment_gateway_sub_id.clone())
        });

        Ok(json!({
            "isSubscribed": is_active,
            "is_subscribed": is_active,
            "isBuy": if is_active { 1 } else { 0 },
            "is_buy": if is_active { 1 } else { 0 },
            "is_buy_package": if is_active { 1 } else { 0 },
            "subscribed": is_active,
            "planId": plan_id,
            "plan_id": plan_id,
            "package_id": plan_id,
            "packageName": pkg_name,
            "package_name": pkg_name,
            "planName": pkg_name,
            "expiryDate": expiry,
            "expire_date": expiry,
            "end_date": expiry,
            "status": if is_active { "ACTIVE" } else { "INACTIVE" },
            "autopayEnabled": autopay,
            "autopay_enabled": autopay,
            "autoRenew": auto_renew,
            "auto_renew": auto_renew,
            "subscriptionId": sub_id,
            "subscription_id": sub_id,
            "subscription": active
        }))
    }

    pub async fn list_admin_transactions(
        state: &AppState,
        q: &AdminPaymentListQuery,
    ) -> AppResult<PageResponse<Value>> {
        let page = q.page.unwrap_or(0);
        let size = q.size.unwrap_or(20).clamp(1, 100);

        let mut query = payment::Entity::find().order_by_desc(payment::Column::CreatedAt);
        if let Some(status) = q.status.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            query = query.filter(payment::Column::Status.eq(status.to_uppercase()));
        }
        if let Some(search) = q.search.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()) {
            query = query.filter(
                Condition::any()
                    .add(payment::Column::ProviderPaymentId.contains(search))
                    .add(payment::Column::ProviderOrderId.contains(search))
                    .add(payment::Column::TransactionId.contains(search)),
            );
        }

        let paginator = query.paginate(&state.db, size);
        let total = paginator.num_items().await?;
        let items = paginator.fetch_page(page).await?;

        // Batch-fetch users and payment orders in parallel (eliminates N+1 queries)
        let user_ids: Vec<i64> = items
            .iter()
            .filter_map(|p| p.user_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let order_ids: Vec<i64> = items
            .iter()
            .map(|p| p.payment_order_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let (users_res, orders_res) = tokio::join!(
            async {
                if user_ids.is_empty() {
                    Ok(Vec::new())
                } else {
                    user::Entity::find()
                        .filter(user::Column::Id.is_in(user_ids))
                        .all(&state.db)
                        .await
                }
            },
            async {
                if order_ids.is_empty() {
                    Ok(Vec::new())
                } else {
                    payment_order::Entity::find()
                        .filter(payment_order::Column::Id.is_in(order_ids))
                        .all(&state.db)
                        .await
                }
            }
        );

        let user_map: HashMap<i64, user::Model> = users_res
            .unwrap_or_default()
            .into_iter()
            .map(|u| (u.id, u))
            .collect();
        let order_map: HashMap<i64, payment_order::Model> = orders_res
            .unwrap_or_default()
            .into_iter()
            .map(|o| (o.id, o))
            .collect();

        // Batch-fetch referenced plans and contents in parallel
        let plan_ids: Vec<i64> = order_map
            .values()
            .filter_map(|o| o.plan_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let content_ids: Vec<i64> = order_map
            .values()
            .filter_map(|o| o.content_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();

        let (plans_res, contents_res) = tokio::join!(
            async {
                if plan_ids.is_empty() {
                    Ok(Vec::new())
                } else {
                    plan::Entity::find()
                        .filter(plan::Column::Id.is_in(plan_ids))
                        .all(&state.db)
                        .await
                }
            },
            async {
                if content_ids.is_empty() {
                    Ok(Vec::new())
                } else {
                    content::Entity::find()
                        .filter(content::Column::Id.is_in(content_ids))
                        .all(&state.db)
                        .await
                }
            }
        );

        let plan_map: HashMap<i64, String> = plans_res
            .unwrap_or_default()
            .into_iter()
            .map(|pl| (pl.id, pl.name))
            .collect();
        let content_map: HashMap<i64, String> = contents_res
            .unwrap_or_default()
            .into_iter()
            .map(|c| (c.id, c.title))
            .collect();

        let mut enriched = Vec::with_capacity(items.len());
        for p in items {
            let u = p.user_id.and_then(|uid| user_map.get(&uid));
            let ord = order_map.get(&p.payment_order_id);
            let order_type = ord
                .and_then(|o| o.order_type.clone())
                .unwrap_or_else(|| "SUBSCRIPTION".to_string());
            let item_title = ord
                .and_then(|o| {
                    if let Some(pid) = o.plan_id {
                        plan_map.get(&pid).cloned()
                    } else if let Some(cid) = o.content_id {
                        content_map.get(&cid).cloned()
                    } else {
                        None
                    }
                })
                .unwrap_or_default();

            let mut row = serde_json::to_value(&p).unwrap_or_else(|_| json!({}));
            if let Some(obj) = row.as_object_mut() {
                obj.insert("userName".into(), json!(u.and_then(|x| x.full_name.clone()).unwrap_or_default()));
                obj.insert("userEmail".into(), json!(u.and_then(|x| x.email.clone()).unwrap_or_default()));
                obj.insert("userPhone".into(), json!(u.and_then(|x| x.phone_number.clone().or(x.phone.clone())).unwrap_or_default()));
                obj.insert("orderType".into(), json!(order_type));
                obj.insert("couponCode".into(), json!(ord.and_then(|o| o.coupon_code.clone())));
                obj.insert("gateway".into(), json!(p.provider.clone().unwrap_or_else(|| "RAZORPAY".to_string())));
                obj.insert("itemTitle".into(), json!(item_title));
            }
            enriched.push(row);
        }

        Ok(PageResponse::of(enriched, total, page, size))
    }

    pub async fn get_payment_analytics_summary(state: &AppState) -> AppResult<Value> {
        let (total_payments_res, success_payments_res, active_subs_res, all_tvod_res) = tokio::join!(
            payment::Entity::find().count(&state.db),
            payment::Entity::find()
                .filter(payment::Column::Status.eq("SUCCESS"))
                .all(&state.db),
            subscription::Entity::find()
                .filter(subscription::Column::Status.eq("ACTIVE"))
                .count(&state.db),
            content_purchase::Entity::find().all(&state.db),
        );

        let total_payments = total_payments_res?;
        let success_payments = success_payments_res?;
        let active_subscriptions = active_subs_res?;
        let all_tvod = all_tvod_res?;

        // Batch-fetch all payment orders referenced by successful payments (eliminates N+1)
        let order_ids: Vec<i64> = success_payments
            .iter()
            .map(|p| p.payment_order_id)
            .collect::<HashSet<_>>()
            .into_iter()
            .collect();
        let tvod_order_ids: HashSet<i64> = if order_ids.is_empty() {
            HashSet::new()
        } else {
            payment_order::Entity::find()
                .filter(payment_order::Column::Id.is_in(order_ids))
                .all(&state.db)
                .await
                .unwrap_or_default()
                .into_iter()
                .filter(|o| {
                    o.order_type
                        .as_deref()
                        .map(|t| t.eq_ignore_ascii_case("TVOD"))
                        .unwrap_or(false)
                })
                .map(|o| o.id)
                .collect()
        };

        let mut total_revenue: f64 = 0.0;
        let mut tvod_revenue: f64 = 0.0;
        let mut sub_revenue: f64 = 0.0;
        let mut tvod_tx: usize = 0;
        let mut sub_tx: usize = 0;

        for p in &success_payments {
            let amt = p.amount.to_f64().unwrap_or(0.0);
            total_revenue += amt;
            if tvod_order_ids.contains(&p.payment_order_id) {
                tvod_revenue += amt;
                tvod_tx += 1;
            } else {
                sub_revenue += amt;
                sub_tx += 1;
            }
        }

        let now = Utc::now();
        let tvod_count = all_tvod.len();
        let active_tvod_rentals = all_tvod
            .iter()
            .filter(|cp| {
                cp.status.as_deref().map(|s| s.eq_ignore_ascii_case("ACTIVE")).unwrap_or(true)
                    && cp.expires_at.or(cp.valid_until).map(|e| e.with_timezone(&Utc) > now).unwrap_or(true)
            })
            .count();

        let success_rate = if total_payments > 0 {
            ((success_payments.len() as f64 / total_payments as f64) * 100.0).round() as i64
        } else {
            100
        };

        Ok(json!({
            "totalPayments": total_payments,
            "totalTransactions": success_payments.len(),
            "successfulPayments": success_payments.len(),
            "successRate": success_rate,
            "totalRevenue": (total_revenue * 100.0).round() / 100.0,
            "tvodRevenue": (tvod_revenue * 100.0).round() / 100.0,
            "subscriptionRevenue": (sub_revenue * 100.0).round() / 100.0,
            "tvodTransactions": tvod_tx,
            "subscriptionTransactions": sub_tx,
            "activeSubscriptions": active_subscriptions,
            "tvodPurchases": tvod_count,
            "totalContentPurchases": tvod_count,
            "activeTvodRentals": active_tvod_rentals
        }))
    }

}
