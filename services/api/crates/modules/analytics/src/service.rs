use chrono::Utc;
use maxx_common::error::AppError;
use maxx_core::entities::{
    content, payment, playback_session, subscription, user, user_interaction,
};
use maxx_core::AppState;
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait,
    FromQueryResult, PaginatorTrait, QueryFilter, Set, Statement,
};
use serde_json::{json, Value};

type AppResult<T> = Result<T, AppError>;

pub struct AnalyticsService;

#[derive(Debug, FromQueryResult)]
struct ScalarI64 {
    value: Option<i64>,
}

#[derive(Debug, FromQueryResult)]
struct ScalarF64 {
    value: Option<f64>,
}

#[derive(Debug, FromQueryResult)]
struct ScalarString {
    value: Option<String>,
}

impl AnalyticsService {
    pub async fn get_dashboard_overview(state: &AppState, timeframe: Option<&str>) -> AppResult<Value> {
        let tf = timeframe.unwrap_or("30d");

        let total_users = user::Entity::find().count(&state.db).await.unwrap_or(0);
        let total_content = content::Entity::find().count(&state.db).await.unwrap_or(0);
        let active_subscriptions = subscription::Entity::find()
            .filter(subscription::Column::Status.eq("ACTIVE"))
            .count(&state.db)
            .await
            .unwrap_or(0);

        let (active_streams, live_users_count) = Self::active_stream_counts(state).await;
        let total_views = Self::scalar_i64(state, "SELECT COALESCE(SUM(COALESCE(view_count, 0)), 0)::bigint AS value FROM contents").await;
        let unique_views_24h = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT viewer_key)::bigint AS value FROM content_view_events WHERE created_at >= NOW() - INTERVAL '24 hours'",
        )
        .await;
        let watch_events_24h = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value FROM watch_history WHERE COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '24 hours'",
        )
        .await;
        let total_watch_seconds = Self::scalar_i64(
            state,
            "SELECT COALESCE(SUM(GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0))), 0)::bigint AS value FROM watch_history",
        )
        .await;
        let today_watch_seconds = Self::scalar_i64(
            state,
            "SELECT COALESCE(SUM(GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0))), 0)::bigint AS value FROM watch_history WHERE COALESCE(last_watched_at, NOW())::date = CURRENT_DATE",
        )
        .await;
        let total_watch_hours_today = ((today_watch_seconds as f64 / 3600.0) * 10.0).round() / 10.0;

        let success_payments = payment::Entity::find()
            .filter(payment::Column::Status.eq("SUCCESS"))
            .all(&state.db)
            .await
            .unwrap_or_default();
        let total_revenue: f64 = success_payments
            .iter()
            .map(|p| p.amount.to_f64().unwrap_or(0.0))
            .sum();
        let monthly_revenue = Self::scalar_f64(
            state,
            "SELECT COALESCE(SUM(amount), 0)::float8 AS value FROM payments WHERE status = 'SUCCESS' AND COALESCE(paid_at, created_at) >= date_trunc('month', NOW())",
        )
        .await;

        let daily_active_users = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM playback_sessions WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '24 hours'
                UNION
                SELECT user_id FROM watch_history WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '24 hours'
                UNION
                SELECT user_id FROM user_interactions WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '24 hours'
            ) t",
        )
        .await;
        let monthly_active_users = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM playback_sessions WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '30 days'
                UNION
                SELECT user_id FROM watch_history WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '30 days'
                UNION
                SELECT user_id FROM user_interactions WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '30 days'
            ) t",
        )
        .await;

        let avg_completion_rate = Self::scalar_f64(
            state,
            "SELECT COALESCE(AVG(
                CASE
                    WHEN COALESCE(total_duration_seconds, duration_seconds, 0) > 0
                    THEN LEAST(100.0, (GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0))::float8 / GREATEST(COALESCE(total_duration_seconds, duration_seconds, 1), 1)::float8) * 100.0)
                    WHEN COALESCE(is_completed, completed, false) THEN 100.0
                    ELSE NULL
                END
            ), 0)::float8 AS value FROM watch_history",
        )
        .await;

        let pending_approvals = Self::count_pending_approvals(state).await;
        let failed_payments = payment::Entity::find()
            .filter(payment::Column::Status.eq("FAILED"))
            .count(&state.db)
            .await
            .unwrap_or(0);

        let time_series_trends = Self::build_time_series_trends(state).await;
        let weekly_watch_hours = Self::build_weekly_watch_hours(state).await;
        let device_breakdown = Self::build_device_breakdown(state).await;
        let portal_engagement = Self::build_portal_engagement(state).await;
        let top_content = Self::build_top_content(state).await;
        let infrastructure_telemetry = Self::build_infrastructure_telemetry(state).await;

        // Advanced metrics depth (additive, Hotstar/Aha/Netflix-grade admin insights)
        let weekly_active_users = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM playback_sessions WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '7 days'
                UNION
                SELECT user_id FROM watch_history WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '7 days'
                UNION
                SELECT user_id FROM user_interactions WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'
            ) t",
        )
        .await;
        let arpu = if monthly_active_users > 0 {
            (monthly_revenue / monthly_active_users as f64 * 100.0).round() / 100.0
        } else {
            0.0
        };
        let arppu = if active_subscriptions > 0 {
            (monthly_revenue / active_subscriptions as f64 * 100.0).round() / 100.0
        } else {
            0.0
        };
        let revenue_attribution = Self::build_revenue_attribution(state, monthly_revenue).await;
        let subscription_metrics = Self::build_subscription_metrics(state).await;
        let payment_metrics = Self::build_payment_metrics(state).await;
        let funnel_metrics = Self::build_funnel_metrics(state, total_users, monthly_active_users, active_subscriptions).await;
        let geo_metrics = Self::build_geo_metrics(state).await;
        let engagement_metrics = Self::build_engagement_metrics(state, avg_completion_rate).await;
        let content_engagement = Self::build_content_engagement(state).await;

        // Keep additive aliases and legacy fields for existing consumers.
        let total_watch_time_hours = ((total_watch_seconds as f64 / 3600.0) * 100.0).round() / 100.0;
        let rounded_total_revenue = (total_revenue * 100.0).round() / 100.0;
        let rounded_monthly_revenue = (monthly_revenue * 100.0).round() / 100.0;
        let rounded_completion = (avg_completion_rate * 10.0).round() / 10.0;

        Ok(json!({
            // Dashboard-expected fields
            "totalUsers": total_users,
            "activeSubscribers": active_subscriptions,
            "monthlyRevenue": rounded_monthly_revenue,
            "totalContent": total_content,
            "pendingApprovals": pending_approvals,
            "concurrentStreams": active_streams,
            "storageUsedGb": 0,
            "storageTotalGb": 0,
            "avgCompletionRate": rounded_completion,
            "dailyActiveUsers": daily_active_users,
            "monthlyActiveUsers": monthly_active_users,
            "weeklyActiveUsers": weekly_active_users,
            "totalWatchHoursToday": total_watch_hours_today,
            "totalViews": total_views,
            "uniqueViews24h": unique_views_24h,
            "watchEvents24h": watch_events_24h,
            "timeSeriesTrends": time_series_trends,
            "weeklyWatchHours": weekly_watch_hours,
            "deviceBreakdown": device_breakdown,
            "portalEngagement": portal_engagement,
            "topContent": top_content,
            "infrastructureTelemetry": infrastructure_telemetry,
            "failedPayments": failed_payments,
            "bufferRatioPercentage": 0.0,
            "timeframe": tf,

            // Metrics depth / executive insights (additive)
            "arpu": arpu,
            "arppu": arppu,
            "revenueAttribution": revenue_attribution,
            "subscriptionMetrics": subscription_metrics,
            "paymentMetrics": payment_metrics,
            "funnelMetrics": funnel_metrics,
            "geoMetrics": geo_metrics,
            "engagementMetrics": engagement_metrics,
            "contentEngagement": content_engagement,

            // Legacy/compatible fields
            "activeSubscriptions": active_subscriptions,
            "activeStreams": active_streams,
            "liveUsers": live_users_count,
            "totalWatchTimeSeconds": total_watch_seconds,
            "totalWatchTimeMinutes": total_watch_seconds / 60,
            "totalWatchTimeHours": total_watch_time_hours,
            "totalRevenue": rounded_total_revenue,
            "totalTransactions": success_payments.len()
        }))
    }

    /// Lightweight, DB-authoritative counters used by the admin SSE stream.
    pub async fn get_live_counters(state: &AppState) -> AppResult<Value> {
        let total_views = Self::scalar_i64(
            state,
            "SELECT COALESCE(SUM(COALESCE(view_count, 0)), 0)::bigint AS value FROM contents",
        )
        .await;
        let unique_views_24h = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT viewer_key)::bigint AS value FROM content_view_events WHERE created_at >= NOW() - INTERVAL '24 hours'",
        )
        .await;
        let watch_events_24h = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value FROM watch_history WHERE COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '24 hours'",
        )
        .await;
        let (active_streams, live_users) = Self::active_stream_counts(state).await;

        Ok(json!({
            "totalViews": total_views,
            "uniqueViews24h": unique_views_24h,
            "watchEvents24h": watch_events_24h,
            "activeStreams": active_streams,
            "liveUsers": live_users,
            "generatedAt": Utc::now().to_rfc3339()
        }))
    }

    pub async fn get_realtime_stream_telemetry(state: &AppState) -> AppResult<Value> {
        let by_content = Self::query_values(
            state,
            r#"
            SELECT json_build_object(
                'contentId', ps.content_id,
                'contentTitle', COALESCE(c.title, 'Unknown Content'),
                'activeStreams', COUNT(*)::bigint,
                'liveUsers', COUNT(DISTINCT COALESCE(ps.user_id::text, ps.session_id))::bigint
            ) AS value
            FROM playback_sessions ps
            LEFT JOIN contents c ON c.id = ps.content_id
            WHERE ps.is_active = true
              AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at) >= NOW() - INTERVAL '5 minutes'
            GROUP BY ps.content_id, c.title
            ORDER BY COUNT(DISTINCT COALESCE(ps.user_id::text, ps.session_id)) DESC
            "#,
        )
        .await;

        let active_streams = Self::query_values(
            state,
            r#"
            SELECT json_build_object(
                'sessionId', ps.session_id,
                'contentId', ps.content_id,
                'title', COALESCE(c.title, 'Unknown Content'),
                'userName', COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), NULLIF(u.phone_number, ''), NULLIF(u.phone, ''), CASE WHEN ps.user_id IS NOT NULL THEN 'User #' || ps.user_id::text ELSE 'Guest Viewer' END),
                'deviceType', COALESCE(ps.device_type, 'WEB'),
                'deviceId', ps.device_id,
                'currentPositionSeconds', COALESCE(ps.current_position_seconds, 0),
                'totalDurationSeconds', COALESCE(ps.total_duration_seconds, COALESCE(c.duration_seconds, 0), 0),
                'status', COALESCE(ps.status, 'ACTIVE'),
                'startedAt', COALESCE(ps.started_at, NOW())
            ) AS value
            FROM playback_sessions ps
            LEFT JOIN contents c ON c.id = ps.content_id
            LEFT JOIN users u ON u.id = ps.user_id
            WHERE ps.is_active = true
              AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at) >= NOW() - INTERVAL '5 minutes'
            ORDER BY COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at) DESC
            LIMIT 100
            "#,
        )
        .await;

        let recent_interactions = Self::query_values(
            state,
            r#"
            SELECT json_build_object(
                'id', ui.id,
                'interactionType', ui.interaction_type,
                'contentId', ui.content_id,
                'contentTitle', COALESCE(ui.content_title, c.title),
                'userId', ui.user_id,
                'userName', COALESCE(NULLIF(ui.user_name, ''), NULLIF(u.full_name, ''), NULLIF(u.email, ''), 'User'),
                'deviceType', ui.device_type,
                'createdAt', ui.created_at
            ) AS value
            FROM user_interactions ui
            LEFT JOIN contents c ON c.id = ui.content_id
            LEFT JOIN users u ON u.id = ui.user_id
            ORDER BY ui.created_at DESC
            LIMIT 50
            "#,
        )
        .await;

        let active_sessions = playback_session::Entity::find()
            .filter(playback_session::Column::IsActive.eq(true))
            .all(&state.db)
            .await
            .unwrap_or_default();

        let (active_streams_count, live_users_count) = Self::active_stream_counts(state).await;
        let by_content_live_users: i64 = by_content
            .iter()
            .filter_map(|x| x.get("liveUsers").and_then(|v| v.as_i64()))
            .sum();

        Ok(json!({
            // Dashboard-expected fields
            "activeStreams": active_streams,
            "recentInteractions": recent_interactions,
            "concurrentStreams": active_streams_count,

            // Legacy/compatible fields
            "activeStreamsCount": active_streams_count,
            "liveUsersCount": if live_users_count > 0 { live_users_count } else { by_content_live_users },
            "watchingByContent": by_content,
            "sessions": active_sessions
        }))
    }

    pub async fn record_interaction(
        state: &AppState,
        user_id: Option<i64>,
        body: Value,
    ) -> AppResult<Value> {
        let now: chrono::DateTime<chrono::FixedOffset> = Utc::now().into();
        let interaction_type = body
            .get("interactionType")
            .or_else(|| body.get("eventType"))
            .or_else(|| body.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("VIEW")
            .to_uppercase();

        let am = user_interaction::ActiveModel {
            user_id: Set(user_id),
            content_id: Set(body.get("contentId").and_then(|v| v.as_i64())),
            content_title: Set(body
                .get("contentTitle")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            interaction_type: Set(interaction_type),
            device_id: Set(body
                .get("deviceId")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            device_type: Set(body
                .get("deviceType")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())),
            duration_seconds: Set(body
                .get("durationSeconds")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)),
            position_seconds: Set(body
                .get("positionSeconds")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)),
            rating_value: Set(body
                .get("ratingValue")
                .and_then(|v| v.as_f64())
                .and_then(Decimal::from_f64_retain)),
            metadata: Set(body.get("metadata").map(|v| v.to_string())),
            created_at: Set(now),
            ..Default::default()
        };
        let saved = am.insert(&state.db).await?;
        Ok(json!({ "recorded": true, "id": saved.id }))
    }

    async fn active_stream_counts(state: &AppState) -> (i64, i64) {
        let row = state
            .db
            .query_one(Statement::from_string(
                DatabaseBackend::Postgres,
                "SELECT COUNT(*)::bigint AS streams, COUNT(DISTINCT COALESCE(user_id::text, session_id))::bigint AS users
                 FROM playback_sessions
                 WHERE is_active = true
                   AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '5 minutes'".to_string(),
            ))
            .await
            .ok()
            .flatten();

        let streams = row
            .as_ref()
            .and_then(|r| r.try_get::<i64>("", "streams").ok())
            .unwrap_or(0);
        let users = row
            .as_ref()
            .and_then(|r| r.try_get::<i64>("", "users").ok())
            .unwrap_or(0);
        (streams, users)
    }

    async fn scalar_i64(state: &AppState, sql: &str) -> i64 {
        ScalarI64::find_by_statement(Statement::from_string(DatabaseBackend::Postgres, sql.to_string()))
            .one(&state.db)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.value)
            .unwrap_or(0)
    }

    async fn scalar_f64(state: &AppState, sql: &str) -> f64 {
        ScalarF64::find_by_statement(Statement::from_string(DatabaseBackend::Postgres, sql.to_string()))
            .one(&state.db)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.value)
            .unwrap_or(0.0)
    }

    async fn scalar_string(state: &AppState, sql: &str) -> Option<String> {
        ScalarString::find_by_statement(Statement::from_string(DatabaseBackend::Postgres, sql.to_string()))
            .one(&state.db)
            .await
            .ok()
            .flatten()
            .and_then(|r| r.value)
    }

    async fn query_values(state: &AppState, sql: &str) -> Vec<Value> {
        #[derive(Debug, FromQueryResult)]
        struct JsonRow {
            value: Option<Value>,
        }
        JsonRow::find_by_statement(Statement::from_string(DatabaseBackend::Postgres, sql.to_string()))
            .all(&state.db)
            .await
            .unwrap_or_default()
            .into_iter()
            .filter_map(|r| r.value)
            .collect()
    }

    async fn count_pending_approvals(state: &AppState) -> i64 {
        let pending_content = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value FROM contents WHERE UPPER(COALESCE(status, '')) IN ('PENDING','SUBMITTED','PENDING_REVIEW','PENDING_APPROVAL','UNDER_REVIEW','REVIEW')",
        )
        .await;

        let pending_producers = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value
             FROM producer_profiles
             WHERE UPPER(COALESCE(onboarding_status, kyc_status, status, '')) IN ('PENDING','SUBMITTED','UNDER_REVIEW','PENDING_APPROVAL','REVIEW')",
        )
        .await;

        pending_content + pending_producers
    }

    async fn build_weekly_watch_hours(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH days AS (
                SELECT generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
            ),
            wh AS (
                SELECT
                    COALESCE(last_watched_at, NOW())::date AS day,
                    SUM(GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0)))::float8 / 3600.0 AS hours
                FROM watch_history
                WHERE COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '7 days'
                GROUP BY 1
            ),
            ps AS (
                SELECT
                    COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW())::date AS day,
                    COUNT(*)::bigint AS streams
                FROM playback_sessions
                WHERE COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW()) >= NOW() - INTERVAL '7 days'
                GROUP BY 1
            )
            SELECT json_build_object(
                'day', to_char(d.day, 'Dy'),
                'hours', ROUND(COALESCE(wh.hours, 0)::numeric, 1),
                'streams', COALESCE(ps.streams, 0)
            ) AS value
            FROM days d
            LEFT JOIN wh ON wh.day = d.day
            LEFT JOIN ps ON ps.day = d.day
            ORDER BY d.day
            "#,
        )
        .await;
        if rows.is_empty() {
            return vec![
                json!({"day":"Mon","hours":0,"streams":0}),
                json!({"day":"Tue","hours":0,"streams":0}),
                json!({"day":"Wed","hours":0,"streams":0}),
                json!({"day":"Thu","hours":0,"streams":0}),
                json!({"day":"Fri","hours":0,"streams":0}),
                json!({"day":"Sat","hours":0,"streams":0}),
                json!({"day":"Sun","hours":0,"streams":0}),
            ];
        }
        rows
    }

    async fn build_time_series_trends(state: &AppState) -> Value {
        let d7 = Self::trend_daily(state, 7).await;
        let d30 = Self::trend_weekly_30d(state).await;
        let d90 = Self::trend_monthly_90d(state).await;
        let d12 = Self::trend_monthly_12m(state).await;
        json!({
            "7d": d7,
            "30d": d30,
            "90d": d90,
            "12m": d12
        })
    }

    async fn trend_daily(state: &AppState, days: i32) -> Vec<Value> {
        let sql = format!(
            r#"
            WITH days AS (
                SELECT generate_series(CURRENT_DATE - INTERVAL '{days_minus} days', CURRENT_DATE, INTERVAL '1 day')::date AS day
            ),
            rev AS (
                SELECT COALESCE(paid_at, created_at)::date AS day, SUM(amount)::float8 AS revenue
                FROM payments
                WHERE status = 'SUCCESS' AND COALESCE(paid_at, created_at) >= NOW() - INTERVAL '{days} days'
                GROUP BY 1
            ),
            act AS (
                SELECT day, COUNT(DISTINCT user_id)::bigint AS users FROM (
                    SELECT COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW())::date AS day, user_id FROM playback_sessions
                    WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW()) >= NOW() - INTERVAL '{days} days'
                    UNION ALL
                    SELECT COALESCE(last_watched_at, NOW())::date AS day, user_id FROM watch_history
                    WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '{days} days'
                ) t GROUP BY day
            ),
            wh AS (
                SELECT COALESCE(last_watched_at, NOW())::date AS day,
                       SUM(GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0)))::float8 / 3600.0 AS hours
                FROM watch_history
                WHERE COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '{days} days'
                GROUP BY 1
            ),
            st AS (
                SELECT COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW())::date AS day, COUNT(*)::bigint AS streams
                FROM playback_sessions
                WHERE COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW()) >= NOW() - INTERVAL '{days} days'
                GROUP BY 1
            )
            SELECT json_build_object(
                'label', to_char(d.day, 'Dy'),
                'revenue', ROUND(COALESCE(rev.revenue, 0)::numeric, 2),
                'users', COALESCE(act.users, 0),
                'watchHours', ROUND(COALESCE(wh.hours, 0)::numeric, 1),
                'streams', COALESCE(st.streams, 0)
            ) AS value
            FROM days d
            LEFT JOIN rev ON rev.day = d.day
            LEFT JOIN act ON act.day = d.day
            LEFT JOIN wh ON wh.day = d.day
            LEFT JOIN st ON st.day = d.day
            ORDER BY d.day
            "#,
            days_minus = days - 1,
            days = days
        );
        let rows = Self::query_values(state, &sql).await;
        if rows.is_empty() {
            return vec![];
        }
        rows
    }

    async fn trend_weekly_30d(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH weeks AS (
                SELECT generate_series(0, 3) AS idx
            ),
            bounds AS (
                SELECT idx,
                       (CURRENT_DATE - ((3 - idx) * 7 + 6) * INTERVAL '1 day')::date AS start_day,
                       (CURRENT_DATE - ((3 - idx) * 7) * INTERVAL '1 day')::date AS end_day
                FROM weeks
            ),
            rev AS (
                SELECT b.idx, SUM(p.amount)::float8 AS revenue
                FROM bounds b
                LEFT JOIN payments p ON p.status = 'SUCCESS'
                    AND COALESCE(p.paid_at, p.created_at)::date BETWEEN b.start_day AND b.end_day
                GROUP BY b.idx
            ),
            act AS (
                SELECT idx, COUNT(DISTINCT user_id)::bigint AS users FROM (
                    SELECT b.idx, ps.user_id
                    FROM bounds b
                    JOIN playback_sessions ps ON ps.user_id IS NOT NULL
                        AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date BETWEEN b.start_day AND b.end_day
                    UNION ALL
                    SELECT b.idx, wh.user_id
                    FROM bounds b
                    JOIN watch_history wh ON wh.user_id IS NOT NULL
                        AND COALESCE(wh.last_watched_at, NOW())::date BETWEEN b.start_day AND b.end_day
                ) t GROUP BY idx
            ),
            wh AS (
                SELECT b.idx,
                       SUM(GREATEST(COALESCE(wh.watched_duration_seconds, 0), COALESCE(wh.watched_seconds, 0), COALESCE(wh.position_seconds, 0)))::float8 / 3600.0 AS hours
                FROM bounds b
                LEFT JOIN watch_history wh ON COALESCE(wh.last_watched_at, NOW())::date BETWEEN b.start_day AND b.end_day
                GROUP BY b.idx
            ),
            st AS (
                SELECT b.idx, COUNT(ps.*)::bigint AS streams
                FROM bounds b
                LEFT JOIN playback_sessions ps ON COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date BETWEEN b.start_day AND b.end_day
                GROUP BY b.idx
            )
            SELECT json_build_object(
                'label', 'Week ' || (b.idx + 1)::text,
                'revenue', ROUND(COALESCE(rev.revenue, 0)::numeric, 2),
                'users', COALESCE(act.users, 0),
                'watchHours', ROUND(COALESCE(wh.hours, 0)::numeric, 1),
                'streams', COALESCE(st.streams, 0)
            ) AS value
            FROM bounds b
            LEFT JOIN rev ON rev.idx = b.idx
            LEFT JOIN act ON act.idx = b.idx
            LEFT JOIN wh ON wh.idx = b.idx
            LEFT JOIN st ON st.idx = b.idx
            ORDER BY b.idx
            "#,
        )
        .await;
        rows
    }

    async fn trend_monthly_90d(state: &AppState) -> Vec<Value> {
        // Last 3 month windows (including current month)
        let rows = Self::query_values(
            state,
            r#"
            WITH months AS (
                SELECT generate_series(0, 2) AS idx
            ),
            bounds AS (
                SELECT idx,
                       date_trunc('month', CURRENT_DATE) - ((2 - idx) || ' months')::interval AS start_month,
                       (date_trunc('month', CURRENT_DATE) - ((2 - idx) || ' months')::interval + INTERVAL '1 month - 1 day')::date AS end_day
                FROM months
            )
            SELECT json_build_object(
                'label', CASE WHEN b.idx = 2 THEN 'Current Month' ELSE 'Month ' || (b.idx + 1)::text END,
                'revenue', ROUND(COALESCE((SELECT SUM(amount)::float8 FROM payments p WHERE p.status='SUCCESS' AND COALESCE(p.paid_at,p.created_at) >= b.start_month AND COALESCE(p.paid_at,p.created_at)::date <= b.end_day), 0)::numeric, 2),
                'users', COALESCE((SELECT COUNT(DISTINCT user_id)::bigint FROM (
                    SELECT user_id FROM playback_sessions ps WHERE ps.user_id IS NOT NULL AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW()) >= b.start_month AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date <= b.end_day
                    UNION
                    SELECT user_id FROM watch_history wh WHERE wh.user_id IS NOT NULL AND COALESCE(wh.last_watched_at, NOW()) >= b.start_month AND COALESCE(wh.last_watched_at, NOW())::date <= b.end_day
                ) t), 0),
                'watchHours', ROUND(COALESCE((SELECT SUM(GREATEST(COALESCE(watched_duration_seconds,0),COALESCE(watched_seconds,0),COALESCE(position_seconds,0)))::float8/3600.0 FROM watch_history wh WHERE COALESCE(wh.last_watched_at,NOW()) >= b.start_month AND COALESCE(wh.last_watched_at,NOW())::date <= b.end_day), 0)::numeric, 1),
                'streams', COALESCE((SELECT COUNT(*)::bigint FROM playback_sessions ps WHERE COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW()) >= b.start_month AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date <= b.end_day), 0)
            ) AS value
            FROM bounds b
            ORDER BY b.idx
            "#,
        )
        .await;
        rows
    }

    async fn trend_monthly_12m(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH months AS (
                SELECT generate_series(0, 11) AS idx
            ),
            bounds AS (
                SELECT idx,
                       date_trunc('month', CURRENT_DATE) - ((11 - idx) || ' months')::interval AS start_month,
                       (date_trunc('month', CURRENT_DATE) - ((11 - idx) || ' months')::interval + INTERVAL '1 month - 1 day')::date AS end_day
                FROM months
            )
            SELECT json_build_object(
                'label', to_char(b.start_month, 'Mon'),
                'revenue', ROUND(COALESCE((SELECT SUM(amount)::float8 FROM payments p WHERE p.status='SUCCESS' AND COALESCE(p.paid_at,p.created_at) >= b.start_month AND COALESCE(p.paid_at,p.created_at)::date <= b.end_day), 0)::numeric, 2),
                'users', COALESCE((SELECT COUNT(DISTINCT user_id)::bigint FROM (
                    SELECT user_id FROM playback_sessions ps WHERE ps.user_id IS NOT NULL AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW()) >= b.start_month AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date <= b.end_day
                    UNION
                    SELECT user_id FROM watch_history wh WHERE wh.user_id IS NOT NULL AND COALESCE(wh.last_watched_at, NOW()) >= b.start_month AND COALESCE(wh.last_watched_at, NOW())::date <= b.end_day
                ) t), 0),
                'watchHours', ROUND(COALESCE((SELECT SUM(GREATEST(COALESCE(watched_duration_seconds,0),COALESCE(watched_seconds,0),COALESCE(position_seconds,0)))::float8/3600.0 FROM watch_history wh WHERE COALESCE(wh.last_watched_at,NOW()) >= b.start_month AND COALESCE(wh.last_watched_at,NOW())::date <= b.end_day), 0)::numeric, 1),
                'streams', COALESCE((SELECT COUNT(*)::bigint FROM playback_sessions ps WHERE COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW()) >= b.start_month AND COALESCE(ps.last_heartbeat_at, ps.last_heartbeat, ps.started_at, NOW())::date <= b.end_day), 0)
            ) AS value
            FROM bounds b
            ORDER BY b.idx
            "#,
        )
        .await;
        rows
    }

    async fn build_device_breakdown(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH recent AS (
                SELECT
                    CASE
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%TV%' THEN 'Smart TV'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%ANDROID%' THEN 'Android Mobile'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%IOS%' OR UPPER(COALESCE(device_type, '')) LIKE '%APPLE%' OR UPPER(COALESCE(device_type, '')) LIKE '%IPAD%' THEN 'iOS / iPad'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%MOBILE%' THEN 'Android Mobile'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%WEB%' OR UPPER(COALESCE(device_type, '')) LIKE '%DESKTOP%' OR COALESCE(device_type, '') = '' THEN 'Desktop Web'
                        ELSE 'Other'
                    END AS platform,
                    session_id,
                    is_active,
                    COALESCE(last_heartbeat_at, last_heartbeat, started_at) AS ts
                FROM playback_sessions
                WHERE COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW()) >= NOW() - INTERVAL '30 days'
            ),
            agg AS (
                SELECT platform,
                       COUNT(*)::bigint AS sessions_30d,
                       COUNT(*) FILTER (WHERE is_active = true AND ts >= NOW() - INTERVAL '5 minutes')::bigint AS active_sessions
                FROM recent
                GROUP BY platform
            ),
            totals AS (
                SELECT GREATEST(SUM(sessions_30d), 1)::float8 AS total_sessions FROM agg
            )
            SELECT json_build_object(
                'platform', a.platform,
                'device', a.platform,
                'count', a.sessions_30d,
                'activeSessions', a.active_sessions,
                'percentage', ROUND((a.sessions_30d::numeric / t.total_sessions::numeric) * 100, 1),
                'color', CASE a.platform
                    WHEN 'Desktop Web' THEN '#00d2ff'
                    WHEN 'Android Mobile' THEN '#1a4cd8'
                    WHEN 'Smart TV' THEN '#c725a3'
                    WHEN 'iOS / iPad' THEN '#00e676'
                    ELSE '#ffab00'
                END
            ) AS value
            FROM agg a, totals t
            ORDER BY a.sessions_30d DESC
            "#,
        )
        .await;

        if rows.is_empty() {
            return vec![
                json!({"platform":"Desktop Web","device":"Desktop Web","count":0,"activeSessions":0,"percentage":0,"color":"#00d2ff"}),
                json!({"platform":"Android Mobile","device":"Android Mobile","count":0,"activeSessions":0,"percentage":0,"color":"#1a4cd8"}),
                json!({"platform":"Smart TV","device":"Smart TV","count":0,"activeSessions":0,"percentage":0,"color":"#c725a3"}),
                json!({"platform":"iOS / iPad","device":"iOS / iPad","count":0,"activeSessions":0,"percentage":0,"color":"#00e676"}),
            ];
        }
        rows
    }

    async fn build_portal_engagement(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH recent AS (
                SELECT
                    CASE
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%TV%' THEN 'Smart TV & Android TV'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%IOS%' OR UPPER(COALESCE(device_type, '')) LIKE '%APPLE%' OR UPPER(COALESCE(device_type, '')) LIKE '%IPAD%' THEN 'iOS / Apple TV'
                        WHEN UPPER(COALESCE(device_type, '')) LIKE '%ANDROID%' OR UPPER(COALESCE(device_type, '')) LIKE '%MOBILE%' THEN 'Android Mobile App'
                        ELSE 'Web OTT (Next.js)'
                    END AS portal
                FROM playback_sessions
                WHERE COALESCE(last_heartbeat_at, last_heartbeat, started_at, NOW()) >= NOW() - INTERVAL '30 days'
            ),
            agg AS (
                SELECT portal, COUNT(*)::bigint AS views FROM recent GROUP BY portal
            ),
            totals AS (SELECT GREATEST(SUM(views), 1)::float8 AS total_views FROM agg)
            SELECT json_build_object(
                'portal', a.portal,
                'views', a.views,
                'percentage', ROUND((a.views::numeric / t.total_views::numeric) * 100, 1),
                'color', CASE a.portal
                    WHEN 'Web OTT (Next.js)' THEN '#00d2ff'
                    WHEN 'Android Mobile App' THEN '#1a4cd8'
                    WHEN 'Smart TV & Android TV' THEN '#c725a3'
                    ELSE '#ffab00'
                END
            ) AS value
            FROM agg a, totals t
            ORDER BY a.views DESC
            "#,
        )
        .await;

        if rows.is_empty() {
            return vec![
                json!({"portal":"Web OTT (Next.js)","views":0,"percentage":0,"color":"#00d2ff"}),
                json!({"portal":"Android Mobile App","views":0,"percentage":0,"color":"#1a4cd8"}),
                json!({"portal":"Smart TV & Android TV","views":0,"percentage":0,"color":"#c725a3"}),
                json!({"portal":"iOS / Apple TV","views":0,"percentage":0,"color":"#ffab00"}),
            ];
        }
        rows
    }

    async fn build_top_content(state: &AppState) -> Vec<Value> {
        let rows = Self::query_values(
            state,
            r#"
            WITH watch_agg AS (
                SELECT content_id,
                       COALESCE(SUM(GREATEST(COALESCE(watched_duration_seconds, 0), COALESCE(watched_seconds, 0), COALESCE(position_seconds, 0))), 0)::float8 / 3600.0 AS watch_hours
                FROM watch_history
                GROUP BY content_id
            ),
            view_agg AS (
                SELECT content_id,
                       COUNT(DISTINCT viewer_key)::bigint AS unique_views
                FROM content_view_events
                WHERE created_at >= NOW() - INTERVAL '24 hours'
                GROUP BY content_id
            ),
            ad_rev AS (
                SELECT content_id, COALESCE(SUM(COALESCE(gross_revenue, 0)), 0)::float8 AS ad_revenue
                FROM producer_ad_revenue
                GROUP BY content_id
            ),
            tvod_rev AS (
                SELECT content_id, COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0)::float8 AS tvod_revenue
                FROM content_purchases
                WHERE UPPER(COALESCE(status, 'SUCCESS')) IN ('SUCCESS', 'COMPLETED', 'PAID', 'ACTIVE')
                GROUP BY content_id
            )
            SELECT json_build_object(
                'id', c.id,
                'title', c.title,
                'contentType', COALESCE(NULLIF(c.content_type, ''), NULLIF(c.type, ''), 'MOVIE'),
                'totalViews', COALESCE(c.view_count, 0),
                'uniqueViews', COALESCE(v.unique_views, 0),
                'adsEligible', (COALESCE(v.unique_views, 0) >= 1000),
                'uniqueViewsNeeded', GREATEST(1000 - COALESCE(v.unique_views, 0), 0),
                'watchHours', ROUND(COALESCE(w.watch_hours, 0)::numeric, 1),
                'totalRevenue', ROUND((COALESCE(ar.ad_revenue, 0) + COALESCE(tr.tvod_revenue, 0))::numeric, 2),
                'rating', COALESCE(NULLIF(c.age_rating, ''), 'U/A 13+')
            ) AS value
            FROM contents c
            LEFT JOIN watch_agg w ON w.content_id = c.id
            LEFT JOIN view_agg v ON v.content_id = c.id
            LEFT JOIN ad_rev ar ON ar.content_id = c.id
            LEFT JOIN tvod_rev tr ON tr.content_id = c.id
            ORDER BY COALESCE(c.view_count, 0) DESC, COALESCE(w.watch_hours, 0) DESC, c.updated_at DESC
            LIMIT 10
            "#,
        )
        .await;
        rows
    }

    async fn build_revenue_attribution(state: &AppState, monthly_svod_revenue: f64) -> Value {
        let tvod_month = Self::scalar_f64(
            state,
            "SELECT COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0)::float8 AS value
             FROM content_purchases
             WHERE UPPER(COALESCE(status, 'SUCCESS')) IN ('SUCCESS','COMPLETED','PAID','ACTIVE')
               AND COALESCE(purchased_at, NOW()) >= date_trunc('month', NOW())",
        )
        .await;
        let tvod_total = Self::scalar_f64(
            state,
            "SELECT COALESCE(SUM(COALESCE(amount_paid, price, 0)), 0)::float8 AS value
             FROM content_purchases
             WHERE UPPER(COALESCE(status, 'SUCCESS')) IN ('SUCCESS','COMPLETED','PAID','ACTIVE')",
        )
        .await;
        let ads_month = Self::scalar_f64(
            state,
            "SELECT COALESCE(SUM(COALESCE(gross_revenue, producer_amount, platform_amount, 0)), 0)::float8 AS value
             FROM producer_ad_revenue
             WHERE COALESCE(created_at, settled_at, NOW()) >= date_trunc('month', NOW())",
        )
        .await;
        let ads_total = Self::scalar_f64(
            state,
            "SELECT COALESCE(SUM(COALESCE(gross_revenue, producer_amount, platform_amount, 0)), 0)::float8 AS value
             FROM producer_ad_revenue",
        )
        .await;

        let svod_month = (monthly_svod_revenue.max(0.0) * 100.0).round() / 100.0;
        let tvod_month_r = (tvod_month.max(0.0) * 100.0).round() / 100.0;
        let ads_month_r = (ads_month.max(0.0) * 100.0).round() / 100.0;
        let total_month = ((svod_month + tvod_month_r + ads_month_r) * 100.0).round() / 100.0;

        json!({
            "monthly": {
                "svod": svod_month,
                "tvod": tvod_month_r,
                "ads": ads_month_r,
                "total": total_month
            },
            "lifetime": {
                "svod": (Self::scalar_f64(state, "SELECT COALESCE(SUM(amount),0)::float8 AS value FROM payments WHERE status='SUCCESS'").await * 100.0).round() / 100.0,
                "tvod": (tvod_total.max(0.0) * 100.0).round() / 100.0,
                "ads": (ads_total.max(0.0) * 100.0).round() / 100.0
            },
            "currency": "INR",
            "notes": "SVOD uses successful payment revenue; TVOD uses content purchases; Ads uses producer ad revenue records."
        })
    }

    async fn build_subscription_metrics(state: &AppState) -> Value {
        let active = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM subscriptions WHERE UPPER(COALESCE(status,'')) = 'ACTIVE'").await;
        let expired = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM subscriptions WHERE UPPER(COALESCE(status,'')) IN ('EXPIRED','INACTIVE') OR (UPPER(COALESCE(status,''))='ACTIVE' AND end_date < NOW())").await;
        let cancelled = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM subscriptions WHERE UPPER(COALESCE(status,'')) IN ('CANCELLED','CANCELED') OR cancelled_at IS NOT NULL").await;
        let trial = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id WHERE COALESCE(p.trial_days,0) > 0 AND UPPER(COALESCE(s.status,'')) IN ('ACTIVE','TRIALING','TRIAL')").await;
        let new_this_month = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM subscriptions WHERE created_at >= date_trunc('month', NOW())").await;
        let renewals_this_month = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value FROM subscriptions
             WHERE created_at >= date_trunc('month', NOW())
               AND user_id IN (SELECT user_id FROM subscriptions WHERE created_at < date_trunc('month', NOW()))",
        )
        .await;
        let churn_base = active + cancelled + expired;
        let churn_rate = if churn_base > 0 {
            ((cancelled as f64 / churn_base as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };
        let plan_mix = Self::query_values(
            state,
            r#"
            SELECT json_build_object(
                'planId', s.plan_id,
                'planName', COALESCE(p.name, 'Plan #' || s.plan_id::text),
                'billingPeriod', COALESCE(p.billing_period, p.billing_cycle, 'N/A'),
                'activeSubscribers', COUNT(*) FILTER (WHERE UPPER(COALESCE(s.status,'')) = 'ACTIVE')::bigint,
                'totalSubscribers', COUNT(*)::bigint,
                'monthlyRevenue', ROUND(COALESCE(SUM(CASE WHEN UPPER(COALESCE(s.status,''))='ACTIVE' THEN COALESCE(s.amount, p.price, 0) ELSE 0 END), 0)::numeric, 2)
            ) AS value
            FROM subscriptions s
            LEFT JOIN plans p ON p.id = s.plan_id
            GROUP BY s.plan_id, p.name, p.billing_period, p.billing_cycle
            ORDER BY COUNT(*) FILTER (WHERE UPPER(COALESCE(s.status,'')) = 'ACTIVE') DESC, COUNT(*) DESC
            LIMIT 10
            "#,
        )
        .await;

        json!({
            "active": active,
            "expired": expired,
            "cancelled": cancelled,
            "trial": trial,
            "newThisMonth": new_this_month,
            "renewalsThisMonth": renewals_this_month,
            "churnRate": churn_rate,
            "planMix": plan_mix
        })
    }

    async fn build_payment_metrics(state: &AppState) -> Value {
        let success = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM payments WHERE UPPER(COALESCE(status,'')) = 'SUCCESS'").await;
        let failed = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM payments WHERE UPPER(COALESCE(status,'')) = 'FAILED'").await;
        let refunded = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM payments WHERE UPPER(COALESCE(status,'')) = 'REFUNDED' OR COALESCE(refunded_amount,0) > 0").await;
        let pending = Self::scalar_i64(state, "SELECT COUNT(*)::bigint AS value FROM payments WHERE UPPER(COALESCE(status,'')) IN ('PENDING','CREATED','INITIATED','PROCESSING')").await;
        let total_collected = Self::scalar_f64(state, "SELECT COALESCE(SUM(amount),0)::float8 AS value FROM payments WHERE UPPER(COALESCE(status,''))='SUCCESS'").await;
        let refund_amount = Self::scalar_f64(state, "SELECT COALESCE(SUM(COALESCE(refunded_amount, amount)),0)::float8 AS value FROM payments WHERE UPPER(COALESCE(status,''))='REFUNDED' OR COALESCE(refunded_amount,0) > 0").await;
        let failure_reasons = Self::query_values(
            state,
            r#"
            SELECT json_build_object(
                'reason', COALESCE(NULLIF(failure_reason,''), NULLIF(error_description,''), NULLIF(error_code,''), 'Unknown'),
                'count', COUNT(*)::bigint
            ) AS value
            FROM payments
            WHERE UPPER(COALESCE(status,'')) = 'FAILED'
            GROUP BY 1
            ORDER BY COUNT(*) DESC
            LIMIT 8
            "#,
        )
        .await;

        let success_rate = if (success + failed) > 0 {
            ((success as f64 / (success + failed) as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        json!({
            "success": success,
            "failed": failed,
            "refunded": refunded,
            "pending": pending,
            "successRate": success_rate,
            "totalCollected": (total_collected * 100.0).round() / 100.0,
            "refundAmount": (refund_amount * 100.0).round() / 100.0,
            "failureReasons": failure_reasons
        })
    }

    async fn build_funnel_metrics(state: &AppState, total_users: u64, monthly_active_users: i64, active_subscribers: u64) -> Value {
        let engaged_7d = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM playback_sessions WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '7 days'
                UNION
                SELECT user_id FROM watch_history WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '7 days'
            ) t",
        )
        .await;
        let purchasers = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM content_purchases WHERE user_id IS NOT NULL AND UPPER(COALESCE(status,'SUCCESS')) IN ('SUCCESS','COMPLETED','PAID','ACTIVE')
                UNION
                SELECT user_id FROM payments WHERE user_id IS NOT NULL AND UPPER(COALESCE(status,''))='SUCCESS'
            ) t",
        )
        .await;

        json!({
            "registeredUsers": total_users,
            "engagedUsers7d": engaged_7d,
            "activeUsers30d": monthly_active_users,
            "payingUsers": purchasers,
            "activeSubscribers": active_subscribers,
            "signupToActiveRate": if total_users > 0 { ((monthly_active_users as f64 / total_users as f64) * 1000.0).round() / 10.0 } else { 0.0 },
            "signupToPaidRate": if total_users > 0 { ((active_subscribers as f64 / total_users as f64) * 1000.0).round() / 10.0 } else { 0.0 }
        })
    }

    async fn build_geo_metrics(state: &AppState) -> Value {
        let markets = Self::query_values(
            state,
            r#"
            WITH src AS (
                SELECT UPPER(COALESCE(NULLIF(country_code,''), 'UNKNOWN')) AS market
                FROM user_interactions
                WHERE created_at >= NOW() - INTERVAL '30 days'
                UNION ALL
                SELECT UPPER(COALESCE(NULLIF(country_code,''), 'UNKNOWN')) AS market
                FROM users
                WHERE created_at >= NOW() - INTERVAL '90 days' OR updated_at >= NOW() - INTERVAL '90 days'
            )
            SELECT json_build_object(
                'market', market,
                'eventsOrUsers', COUNT(*)::bigint
            ) AS value
            FROM src
            GROUP BY market
            ORDER BY COUNT(*) DESC
            LIMIT 8
            "#,
        )
        .await;
        json!({
            "topMarkets": markets,
            "note": "Derived from available user/interaction country codes (geo instrumentation may be partial)."
        })
    }

    async fn build_engagement_metrics(state: &AppState, avg_completion_rate: f64) -> Value {
        let avg_session_minutes = Self::scalar_f64(
            state,
            "SELECT COALESCE(AVG(GREATEST(COALESCE(duration_seconds,0), COALESCE(position_seconds,0), COALESCE(watch_duration_seconds,0)))::float8 / 60.0, 0)::float8 AS value
             FROM user_interactions
             WHERE created_at >= NOW() - INTERVAL '30 days'",
        )
        .await;
        let returning_users_30d = Self::scalar_i64(
            state,
            "SELECT COUNT(*)::bigint AS value FROM (
                SELECT user_id
                FROM watch_history
                WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '30 days'
                GROUP BY user_id
                HAVING COUNT(*) >= 2
            ) t",
        )
        .await;
        let active_users_30d = Self::scalar_i64(
            state,
            "SELECT COUNT(DISTINCT user_id)::bigint AS value FROM (
                SELECT user_id FROM watch_history WHERE user_id IS NOT NULL AND COALESCE(last_watched_at, NOW()) >= NOW() - INTERVAL '30 days'
                UNION
                SELECT user_id FROM playback_sessions WHERE user_id IS NOT NULL AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) >= NOW() - INTERVAL '30 days'
            ) t",
        )
        .await;
        let retention_rate = if active_users_30d > 0 {
            ((returning_users_30d as f64 / active_users_30d as f64) * 1000.0).round() / 10.0
        } else {
            0.0
        };

        json!({
            "avgSessionDurationMinutes": (avg_session_minutes * 10.0).round() / 10.0,
            "avgCompletionRate": (avg_completion_rate * 10.0).round() / 10.0,
            "returningUsers30d": returning_users_30d,
            "retentionRate30d": retention_rate,
            "bufferRatioPercentage": 0.0
        })
    }

    async fn build_content_engagement(state: &AppState) -> Value {
        let by_type = Self::query_values(
            state,
            r#"
            WITH wh AS (
                SELECT content_id,
                       COALESCE(SUM(GREATEST(COALESCE(watched_duration_seconds,0),COALESCE(watched_seconds,0),COALESCE(position_seconds,0))),0)::float8 / 3600.0 AS watch_hours
                FROM watch_history
                GROUP BY content_id
            )
            SELECT json_build_object(
                'contentType', COALESCE(NULLIF(c.content_type,''), NULLIF(c.type,''), 'UNKNOWN'),
                'titles', COUNT(*)::bigint,
                'views', COALESCE(SUM(COALESCE(c.view_count,0)),0)::bigint,
                'watchHours', ROUND(COALESCE(SUM(COALESCE(wh.watch_hours,0)),0)::numeric, 1)
            ) AS value
            FROM contents c
            LEFT JOIN wh ON wh.content_id = c.id
            GROUP BY 1
            ORDER BY COALESCE(SUM(COALESCE(c.view_count,0)),0) DESC, COUNT(*) DESC
            LIMIT 8
            "#,
        )
        .await;

        let top_engaged = Self::query_values(
            state,
            r#"
            WITH wh AS (
                SELECT content_id,
                       COUNT(*)::bigint AS sessions,
                       COUNT(DISTINCT COALESCE(user_id::text, profile_id::text))::bigint AS viewers,
                       COALESCE(SUM(GREATEST(COALESCE(watched_duration_seconds,0),COALESCE(watched_seconds,0),COALESCE(position_seconds,0))),0)::float8 / 3600.0 AS watch_hours
                FROM watch_history
                GROUP BY content_id
            )
            SELECT json_build_object(
                'title', c.title,
                'contentType', COALESCE(NULLIF(c.content_type,''), NULLIF(c.type,''), 'UNKNOWN'),
                'viewers', COALESCE(wh.viewers,0),
                'sessions', COALESCE(wh.sessions,0),
                'watchHours', ROUND(COALESCE(wh.watch_hours,0)::numeric, 1)
            ) AS value
            FROM contents c
            JOIN wh ON wh.content_id = c.id
            ORDER BY COALESCE(wh.watch_hours,0) DESC, COALESCE(wh.viewers,0) DESC
            LIMIT 5
            "#,
        )
        .await;

        json!({
            "byContentType": by_type,
            "topEngagedTitles": top_engaged
        })
    }

    async fn build_infrastructure_telemetry(state: &AppState) -> Vec<Value> {
        let mut items: Vec<Value> = Vec::new();

        let db_ok = state.db.ping().await.is_ok();
        let db_version = Self::scalar_string(state, "SELECT split_part(version(), ' ', 1) || ' ' || split_part(version(), ' ', 2) AS value").await.unwrap_or_else(|| "PostgreSQL".to_string());
        let db_size = Self::scalar_string(state, "SELECT pg_size_pretty(pg_database_size(current_database())) AS value").await.unwrap_or_else(|| "unknown".to_string());
        items.push(json!({
            "serviceName": "PostgreSQL Database Engine",
            "meta": format!("{} • Size: {} • {}", if db_ok { "Connected" } else { "Unavailable" }, db_size, db_version),
            "status": if db_ok { "Healthy" } else { "Degraded" },
            "statusClass": if db_ok { "green" } else { "amber" }
        }));

        let redis_ok = state.redis.is_healthy();
        items.push(json!({
            "serviceName": "Redis Cache & Session Broker",
            "meta": format!("{} • {}", if redis_ok { "Connected" } else { "In-memory fallback" }, &state.config.redis_url),
            "status": if redis_ok { "Healthy" } else { "Degraded" },
            "statusClass": if redis_ok { "green" } else { "amber" }
        }));

        let kafka_ok = state.config.kafka_enabled;
        items.push(json!({
            "serviceName": "Kafka Event Bus",
            "meta": format!("{} • Brokers: {}", if kafka_ok { "Enabled" } else { "Disabled" }, state.config.kafka_brokers),
            "status": if kafka_ok { "Operational" } else { "Disabled" },
            "statusClass": if kafka_ok { "green" } else { "amber" }
        }));

        let bunny_ok = !state.config.bunny_stream_library_id.is_empty() || !state.config.bunny_storage_zone_name.is_empty();
        items.push(json!({
            "serviceName": "Bunny.net Stream/CDN",
            "meta": if bunny_ok {
                format!("Configured • Zone: {}", if state.config.bunny_storage_zone_name.is_empty() { "stream" } else { &state.config.bunny_storage_zone_name })
            } else {
                "Not configured in environment".to_string()
            },
            "status": if bunny_ok { "Operational" } else { "Not Configured" },
            "statusClass": if bunny_ok { "green" } else { "amber" }
        }));

        items
    }
}

