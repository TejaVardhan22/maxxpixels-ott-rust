use anyhow::Result;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, warn};
use uuid::Uuid;

use crate::config::AppConfig;

#[derive(Clone)]
pub struct RedisManager {
    client: Option<ConnectionManager>,
    memory_fallback: Arc<RwLock<HashMap<String, (String, Instant)>>>,
    hits: Arc<AtomicU64>,
    misses: Arc<AtomicU64>,
}

impl RedisManager {
    pub async fn connect(config: &AppConfig) -> Self {
        let client = match redis::Client::open(config.redis_url.clone()) {
            Ok(c) => match ConnectionManager::new(c).await {
                Ok(manager) => {
                    tracing::info!("Connected to Redis at {}", config.redis_url);
                    Some(manager)
                }
                Err(e) => {
                    warn!("Redis connection failed: {}. Utilizing in-memory resilient fallback.", e);
                    None
                }
            },
            Err(e) => {
                warn!("Invalid Redis configuration: {}. Utilizing in-memory fallback.", e);
                None
            }
        };

        Self {
            client,
            memory_fallback: Arc::new(RwLock::new(HashMap::new())),
            hits: Arc::new(AtomicU64::new(0)),
            misses: Arc::new(AtomicU64::new(0)),
        }
    }

    pub fn is_healthy(&self) -> bool {
        self.client.is_some()
    }

    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        if let Some(mut client) = self.client.clone() {
            match client.get::<_, Option<String>>(key).await {
                Ok(Some(raw)) => {
                    self.hits.fetch_add(1, Ordering::Relaxed);
                    if let Ok(val) = serde_json::from_str(&raw) {
                        return Some(val);
                    }
                }
                Ok(None) => {
                    self.misses.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => {
                    debug!("Redis get error for {}: {}", key, e);
                }
            }
        }

        // Memory fallback
        let guard = self.memory_fallback.read().await;
        if let Some((raw, expires_at)) = guard.get(key) {
            if Instant::now() < *expires_at {
                self.hits.fetch_add(1, Ordering::Relaxed);
                return serde_json::from_str(raw).ok();
            }
        }
        self.misses.fetch_add(1, Ordering::Relaxed);
        None
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl_seconds: u64) -> Result<()> {
        let serialized = serde_json::to_string(value)?;

        if let Some(mut client) = self.client.clone() {
            let res: Result<(), _> = client.set_ex(key, &serialized, ttl_seconds).await;
            if res.is_ok() {
                return Ok(());
            }
        }

        // Memory fallback
        let mut guard = self.memory_fallback.write().await;
        let expires_at = Instant::now() + Duration::from_secs(ttl_seconds);
        guard.insert(key.to_string(), (serialized, expires_at));
        Ok(())
    }

    pub async fn del(&self, key: &str) -> Result<()> {
        if let Some(mut client) = self.client.clone() {
            let _: Result<(), _> = client.del(key).await;
        }

        let mut guard = self.memory_fallback.write().await;
        guard.remove(key);
        Ok(())
    }

    /// Acquires distributed lock with timeout matching NestJS acquireLock pattern.
    pub async fn acquire_lock(&self, key: &str, ttl_ms: u64) -> Option<String> {
        let token = Uuid::new_v4().to_string();
        let lock_key = format!("lock:{}", key);

        if let Some(mut client) = self.client.clone() {
            let res: Result<bool, _> = redis::cmd("SET")
                .arg(&lock_key)
                .arg(&token)
                .arg("NX")
                .arg("PX")
                .arg(ttl_ms)
                .query_async(&mut client)
                .await;

            if let Ok(true) = res {
                return Some(token);
            }
        }

        None
    }

    /// Releases distributed lock safely using token verification script.
    pub async fn release_lock(&self, key: &str, token: &str) -> bool {
        let lock_key = format!("lock:{}", key);
        if let Some(mut client) = self.client.clone() {
            let script = r#"
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            "#;
            let res: Result<i32, _> = redis::Script::new(script)
                .key(&lock_key)
                .arg(token)
                .invoke_async(&mut client)
                .await;

            return res.unwrap_or(0) == 1;
        }

        true
    }
}

