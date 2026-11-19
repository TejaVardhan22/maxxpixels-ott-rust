use sea_orm::{ConnectionTrait, DatabaseConnection, Statement};
use std::time::Duration;
use tracing::{info, warn};

pub fn spawn_billing_worker(db: DatabaseConnection) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            let stmt = Statement::from_string(
                sea_orm::DatabaseBackend::Postgres,
                "UPDATE subscriptions SET status = 'EXPIRED', updated_at = NOW() WHERE status = 'ACTIVE' AND auto_renew = false AND end_date < NOW()".to_string(),
            );
            match db.execute(stmt).await {
                Ok(res) if res.rows_affected() > 0 => {
                    info!("billing_worker: expired {} ended subscriptions", res.rows_affected());
                }
                Err(e) => warn!("billing_worker tick error: {}", e),
                _ => {}
            }
        }
    });
}
