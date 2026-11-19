use anyhow::{Context, Result};
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::time::Duration;
use tracing::info;

use crate::config::AppConfig;

pub struct DatabaseManager;

impl DatabaseManager {
    pub async fn connect(config: &AppConfig) -> Result<DatabaseConnection> {
        let mut opt = ConnectOptions::new(&config.database_url);
        opt.max_connections(config.db_max_connections)
            .min_connections(config.db_min_connections)
            .connect_timeout(Duration::from_secs(config.db_connect_timeout_sec))
            .idle_timeout(Duration::from_secs(config.db_idle_timeout_sec))
            .sqlx_logging(config.env == "development")
            .sqlx_logging_level(tracing::log::LevelFilter::Debug);

        let db = Database::connect(opt)
            .await
            .context("Failed connecting to PostgreSQL database")?;

        info!(
            "Connected to PostgreSQL database with pool bounds [min: {}, max: {}]",
            config.db_min_connections, config.db_max_connections
        );

        Ok(db)
    }
}

