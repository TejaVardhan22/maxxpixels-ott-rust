use anyhow::Result;
use std::net::SocketAddr;
use tokio::signal;
use tracing::{info, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use maxx_core::{AppConfig, AppState, DatabaseManager, MigrationRunner, RedisManager};

mod health;
mod maintenance;
mod router;

use router::build_app_router;

#[tokio::main]
async fn main() -> Result<()> {
    // 1. Initialize structured logging
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "maxx_api=debug,maxx_core=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    info!("Starting MaxxPixels OTT Rust Backend Engine...");

    // 2. Load strongly typed environment configuration
    let config = AppConfig::from_env()?;
    info!(
        "Configuration loaded successfully. Environment: {}, Target Port: {}",
        config.env, config.port
    );

    // 3. Establish PostgreSQL connection via SeaORM
    let db = DatabaseManager::connect(&config).await?;

    // 3a. Run versioned, additive-only, advisory-locked migrations (safe on live NestJS prod DB)
    match MigrationRunner::run(&db).await {
        Ok(applied) => info!("Schema migrations up to date ({} newly applied).", applied),
        Err(e) => warn!("Schema migration warning (continuing safely): {}", e),
    }

    // 3b. Spawn background workers
    maxx_worker_event_worker::spawn_event_worker(db.clone());
    maxx_worker_analytics_worker::spawn_analytics_worker(db.clone());
    maxx_worker_notification_worker::spawn_notification_worker(db.clone());
    maxx_worker_billing_worker::spawn_billing_worker(db.clone());
    // Content auto-publish & license expiry scheduler (every 30s)
    spawn_content_scheduler(db.clone());
    // Kafka-based async consumers for high-throughput view/event processing
    maxx_integration_kafka::spawn_kafka_workers(db.clone());
    info!("Background workers started (event, analytics, notification, billing, content-scheduler, kafka-consumers).");

    // 4. Connect to Redis (with in-memory fallback)
    let redis = RedisManager::connect(&config).await;

    // 5. Build global shared application state
    let state = AppState::new(db, redis, config.clone());

    // 5b. Start daily 1:00 AM IST automated full DB backup cron → Bunny.net Storage
    maxx_module_admin::spawn_daily_backup_cron(state.clone());

    // 6. Build Axum router
    let app = build_app_router(state);

    // 7. Bind to internal migration port (8081)
    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    info!("MaxxPixels OTT Rust Backend listening on http://{}", addr);
    info!("Actuator Health check: http://{}/health", addr);
    info!("Liveness ping: http://{}/ping", addr);
    info!("Prometheus metrics: http://{}/metrics", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("MaxxPixels OTT Rust Backend has gracefully shut down.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C signal handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            warn!("Shutdown signal received (Ctrl+C). Terminating operations...");
        },
        _ = terminate => {
            warn!("Termination signal received (SIGTERM). Terminating operations...");
        },
    }
}

/// Automatically promotes SCHEDULED contents to PUBLISHED once scheduled_publish_at <= NOW(),
/// and archives PUBLISHED contents whose license expires_at <= NOW().
fn spawn_content_scheduler(db: sea_orm::DatabaseConnection) {
    use sea_orm::ConnectionTrait;
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            match db
                .execute_unprepared(
                    "UPDATE contents \
                     SET status = 'PUBLISHED', updated_at = NOW() \
                     WHERE status = 'SCHEDULED' \
                       AND scheduled_publish_at IS NOT NULL \
                       AND scheduled_publish_at <= NOW()",
                )
                .await
            {
                Ok(res) if res.rows_affected() > 0 => {
                    info!(
                        "content-scheduler: auto-published {} scheduled title(s).",
                        res.rows_affected()
                    );
                }
                Err(e) => warn!("content-scheduler auto-publish error: {}", e),
                _ => {}
            }

            match db
                .execute_unprepared(
                    "UPDATE contents \
                     SET status = 'ARCHIVED', updated_at = NOW() \
                     WHERE status = 'PUBLISHED' \
                       AND expires_at IS NOT NULL \
                       AND expires_at <= NOW()",
                )
                .await
            {
                Ok(res) if res.rows_affected() > 0 => {
                    info!(
                        "content-scheduler: auto-expired {} licensed title(s).",
                        res.rows_affected()
                    );
                }
                Err(e) => warn!("content-scheduler auto-expire error: {}", e),
                _ => {}
            }

            // Auto-close expired producer submissions (7-day rule)
            match db
                .execute_unprepared(
                    "UPDATE contents \
                     SET status = 'EXPIRED', updated_at = NOW() \
                     WHERE status IN ('SUBMITTED', 'AGREEMENT_SHARED', 'AWAITING_AGREEMENT') \
                       AND expires_at IS NOT NULL \
                       AND expires_at <= NOW()",
                )
                .await
            {
                Ok(res) if res.rows_affected() > 0 => {
                    info!(
                        "content-scheduler: auto-closed {} expired producer submission(s).",
                        res.rows_affected()
                    );
                }
                Err(e) => warn!("content-scheduler auto-close error: {}", e),
                _ => {}
            }

            let _ = db
                .execute_unprepared(
                    "UPDATE producer_submissions \
                     SET status = 'EXPIRED', updated_at = NOW() \
                     WHERE status IN ('SUBMITTED', 'AGREEMENT_SHARED', 'AWAITING_AGREEMENT') \
                       AND expires_at IS NOT NULL \
                       AND expires_at <= NOW()",
                )
                .await;
        }
    });
}

