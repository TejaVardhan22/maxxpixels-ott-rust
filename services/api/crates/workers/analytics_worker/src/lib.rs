use sea_orm::{ConnectionTrait, DatabaseBackend, DatabaseConnection, Statement};
use std::time::Duration;
use tracing::{info, warn};

pub fn spawn_analytics_worker(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            run_analytics_cycle(&db).await;
        }
    });
}

async fn run_analytics_cycle(db: &DatabaseConnection) {
    // 1. Repair view_count from the idempotent view ledger. Watch history is a
    // separate "unique viewers" signal and must never overwrite play counts.
    let sync_views = Statement::from_string(
        DatabaseBackend::Postgres,
        r#"
        UPDATE contents c
        SET view_count = GREATEST(COALESCE(c.view_count, 0), sub.cnt)
        FROM (
            SELECT content_id, COUNT(*)::bigint AS cnt
            FROM content_view_events
            GROUP BY content_id
        ) sub
        WHERE c.id = sub.content_id
        "#
        .to_string(),
    );
    match db.execute(sync_views).await {
        Ok(res) if res.rows_affected() > 0 => {
            info!(
                "analytics_worker: synced view_count for {} contents",
                res.rows_affected()
            );
        }
        Err(e) => warn!("analytics_worker view_count sync error: {}", e),
        _ => {}
    }

    // 2. Refresh is_trending for top 20 watched contents in last 7 days
    let mark_trending = Statement::from_string(
        DatabaseBackend::Postgres,
        r#"
        UPDATE contents
        SET is_trending = (
            id IN (
                SELECT content_id
                FROM watch_history
                WHERE last_watched_at >= NOW() - INTERVAL '7 days'
                GROUP BY content_id
                ORDER BY COUNT(*) DESC
                LIMIT 20
            )
        )
        WHERE status = 'PUBLISHED'
        "#
        .to_string(),
    );
    if let Err(e) = db.execute(mark_trending).await {
        warn!("analytics_worker trending refresh error: {}", e);
    }

    // 3. Roll up ad_events (impressions, clicks, spent_budget) into ad_campaigns
    let rollup_ads = Statement::from_string(
        DatabaseBackend::Postgres,
        r#"
        UPDATE ad_campaigns ac
        SET
            impressions_delivered = GREATEST(COALESCE(ac.impressions_delivered, 0), agg.imps),
            impressions_count = GREATEST(COALESCE(ac.impressions_count, 0), agg.imps),
            clicks_count = GREATEST(COALESCE(ac.clicks_count, 0), agg.clicks),
            spent_budget = GREATEST(COALESCE(ac.spent_budget, 0), agg.spent_inr),
            updated_at = NOW()
        FROM (
            SELECT
                campaign_id,
                COUNT(*) FILTER (WHERE UPPER(event_type) = 'IMPRESSION')::bigint AS imps,
                COUNT(*) FILTER (WHERE UPPER(event_type) = 'CLICK')::bigint AS clicks,
                COALESCE(SUM(COALESCE(revenue_paise, 0)) / 100.0, 0)::double precision AS spent_inr
            FROM ad_events
            WHERE campaign_id IS NOT NULL
            GROUP BY campaign_id
        ) agg
        WHERE ac.id = agg.campaign_id
        "#
        .to_string(),
    );
    match db.execute(rollup_ads).await {
        Ok(res) if res.rows_affected() > 0 => {
            info!(
                "analytics_worker: rolled up ad metrics for {} campaigns",
                res.rows_affected()
            );
        }
        Err(e) => warn!("analytics_worker ad rollup error: {}", e),
        _ => {}
    }
}
