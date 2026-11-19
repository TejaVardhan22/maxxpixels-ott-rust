use sea_orm::DatabaseConnection;
use std::sync::Arc;
use std::time::Instant;

use crate::config::AppConfig;
use crate::redis::RedisManager;
use maxx_integration_kafka::KafkaEventBus;

#[derive(Clone)]
pub struct AppState {
    pub db: DatabaseConnection,
    pub redis: RedisManager,
    pub config: Arc<AppConfig>,
    pub kafka: Arc<KafkaEventBus>,
    pub start_time: Instant,
}

impl AppState {
    pub fn new(db: DatabaseConnection, redis: RedisManager, config: AppConfig) -> Self {
        let kafka = Arc::new(KafkaEventBus::from_env());
        Self {
            db,
            redis,
            config: Arc::new(config),
            kafka,
            start_time: Instant::now(),
        }
    }

    pub fn uptime_seconds(&self) -> u64 {
        self.start_time.elapsed().as_secs()
    }
}

