//! Lightweight realtime signal used by admin dashboards.
//!
//! Views and watch progress are written to PostgreSQL as the source of truth.
//! After a successful write we bump a Redis version key; SSE streams watch that
//! key and fetch the fresh counters, so dashboards update in ~1s without
//! making Kafka part of the counting path.

use anyhow::Result;
use redis::AsyncCommands;
use tracing::debug;

pub const ANALYTICS_VERSION_KEY: &str = "maxx:realtime:analytics:version";

fn redis_url() -> String {
    std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://redis:6379/0".to_string())
}

/// Signals that live analytics counters changed. Best-effort: dashboards keep
/// their polling fallback when Redis is unavailable.
pub async fn bump_analytics_version() {
    let url = redis_url();
    let result: Result<()> = async {
        let client = redis::Client::open(url)?;
        let mut conn = client.get_multiplexed_async_connection().await?;
        let _: i64 = redis::cmd("INCR").arg(ANALYTICS_VERSION_KEY).query_async(&mut conn).await?;
        let _: () = redis::cmd("EXPIRE")
            .arg(ANALYTICS_VERSION_KEY)
            .arg(60)
            .query_async(&mut conn)
            .await?;
        Ok(())
    }
    .await;

    if let Err(e) = result {
        debug!("realtime analytics signal skipped: {e}");
    }
}

/// Returns the current analytics version, or 0 when Redis is unavailable.
pub async fn analytics_version() -> i64 {
    let url = redis_url();
    let result: Result<Option<i64>> = async {
        let client = redis::Client::open(url)?;
        let mut conn = client.get_multiplexed_async_connection().await?;
        let v: Option<i64> = conn.get(ANALYTICS_VERSION_KEY).await?;
        Ok(v)
    }
    .await;

    result.ok().flatten().unwrap_or(0)
}
