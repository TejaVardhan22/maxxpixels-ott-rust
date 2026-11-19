use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use std::time::Duration;
use tracing::{info, warn};

pub fn spawn_event_worker(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let stmt = Statement::from_string(
                sea_orm::DatabaseBackend::Postgres,
                "UPDATE playback_sessions SET is_active = false, status = 'ENDED' WHERE is_active = true AND COALESCE(last_heartbeat_at, last_heartbeat, started_at) < NOW() - INTERVAL '5 minutes'".to_string(),
            );
            match db.execute(stmt).await {
                Ok(res) if res.rows_affected() > 0 => {
                    info!("event_worker: closed {} stale playback sessions", res.rows_affected());
                }
                Err(e) => warn!("event_worker tick error: {}", e),
                _ => {}
            }
        }
    });
}
