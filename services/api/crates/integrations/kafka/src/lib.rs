use anyhow::Result;
use rskafka::client::partition::UnknownTopicHandling;
use rskafka::client::{Client, ClientBuilder};
use rskafka::record::Record;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;
use tracing::{info, warn};

pub const TOPIC_WATCH_HISTORY: &str = "ott.watch.history";
pub const TOPIC_VIEW_EVENTS: &str = "ott.content.views";
pub const TOPIC_TELEMETRY_HEARTBEAT: &str = "ott.telemetry.heartbeat";
pub const TOPIC_SUBSCRIPTION_EVENTS: &str = "ott.subscriptions.events";
pub const TOPIC_PAYMENT_EVENTS: &str = "ott.payments.razorpay";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchHistoryEvent {
    pub event_id: Option<String>,
    pub user_id: Option<i64>,
    pub profile_id: Option<i64>,
    pub content_id: i64,
    pub episode_id: Option<i64>,
    pub progress_seconds: Option<i64>,
    pub duration_seconds: Option<i64>,
    pub completed: Option<bool>,
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewEvent {
    pub event_id: Option<String>,
    pub user_id: Option<i64>,
    pub content_id: i64,
    pub event_type: String, // start|progress|complete|heartbeat
    pub timestamp: Option<String>,
}

#[derive(Clone)]
pub struct KafkaEventBus {
    client: Option<Arc<Client>>,
    enabled: bool,
}

impl KafkaEventBus {
    pub fn from_env() -> Self {
        let enabled = std::env::var("KAFKA_ENABLED").unwrap_or_else(|_| "false".into()) == "true";
        let brokers_raw = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "127.0.0.1:19092".into());
        let brokers = brokers_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();
        if !enabled || brokers.is_empty() {
            info!("KafkaEventBus disabled (KAFKA_ENABLED!=true or no brokers)");
            return Self { client: None, enabled: false };
        }
        // rskafka ClientBuilder takes bootstrap broker list; init lazily in async context is better,
        // but we keep a simple env-based constructor and connect on first publish via helper.
        info!("KafkaEventBus configured for brokers={:?}", brokers);
        Self { client: None, enabled: true }
    }

    pub fn is_enabled(&self) -> bool { self.enabled }

    async fn get_or_connect(&self) -> Result<Arc<Client>> {
        if let Some(c) = &self.client { return Ok(c.clone()); }
        let brokers_raw = std::env::var("KAFKA_BROKERS").unwrap_or_else(|_| "127.0.0.1:19092".into());
        let brokers = brokers_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();
        let client = ClientBuilder::new(brokers).build().await?;
        Ok(Arc::new(client))
    }

    pub async fn publish_json<T: Serialize>(&self, topic: &str, key: Option<String>, payload: &T) -> Result<()> {
        if !self.enabled { return Ok(()); }
        let client = match self.get_or_connect().await {
            Ok(c) => c,
            Err(e) => { warn!("Kafka publish skipped (connect failed): {e}"); return Ok(()); }
        };
        let partition_client = match client.partition_client(topic.to_string(), 0, UnknownTopicHandling::Retry).await {
            Ok(pc) => pc,
            Err(e) => { warn!("Kafka partition client failed for {topic}: {e}"); return Ok(()); }
        };
        let body = serde_json::to_vec(payload)?;
        let record = Record { key: key.map(|k| k.into_bytes()), value: Some(body), headers: BTreeMap::new(), timestamp: chrono::Utc::now() };
        if let Err(e) = partition_client.produce(vec![record], Default::default()).await {
            warn!("Kafka produce failed for {topic}: {e}");
        }
        Ok(())
    }

    pub async fn publish_watch_history(&self, evt: &WatchHistoryEvent) -> Result<()> {
        let key = evt.user_id.map(|u| u.to_string()).or_else(|| evt.profile_id.map(|p| p.to_string()));
        self.publish_json(TOPIC_WATCH_HISTORY, key, evt).await
    }

    pub async fn publish_view_event(&self, evt: &ViewEvent) -> Result<()> {
        self.publish_json(TOPIC_VIEW_EVENTS, Some(evt.content_id.to_string()), evt).await
    }
}

/// Kafka is now a downstream analytics side channel only. View counts and watch
/// progress are written directly to PostgreSQL with idempotency keys, so the old
/// batching consumer (which double-counted and replayed from offset 0) is retired.
/// The function is kept for compatibility with existing startup code.
pub fn spawn_kafka_workers(_db: DatabaseConnection) {
    info!("Kafka view consumer retired; view counts are DB-authoritative and realtime");
}

/// Kept as a no-op for callers that still reference it.
pub fn spawn_kafka_view_consumer(_db: DatabaseConnection) {}
