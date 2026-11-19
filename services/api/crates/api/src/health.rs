use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use prometheus::{Encoder, TextEncoder};
use sea_orm::{ConnectionTrait, DatabaseBackend, Statement};
use serde_json::json;
use std::time::Instant;

use maxx_common::ApiResponse;
use maxx_core::{AppState, MigrationRunner};

/// Lightweight liveness ping matching NestJS HealthController.ping
pub async fn ping_handler() -> impl IntoResponse {
    let payload = json!({
        "status": "UP",
        "service": "MaxxPixels OTT Backend (Rust + Axum)",
        "timestamp": Utc::now().to_rfc3339()
    });
    Json(ApiResponse::ok(payload))
}

/// Comprehensive live health & infrastructure telemetry check
pub async fn health_handler(State(state): State<AppState>) -> impl IntoResponse {
    let db_start = Instant::now();
    let db_stats = state
        .db
        .query_one(Statement::from_string(
            DatabaseBackend::Postgres,
            r#"
            SELECT
                version() AS pg_version,
                current_database() AS db_name,
                pg_size_pretty(pg_database_size(current_database())) AS db_size,
                (SELECT COUNT(*)::bigint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') AS table_count,
                (SELECT COUNT(*)::bigint FROM pg_stat_activity WHERE datname = current_database()) AS active_connections
            "#
            .to_string(),
        ))
        .await;
    let db_latency_ms = db_start.elapsed().as_millis() as u64;

    let (db_healthy, pg_version, db_name, db_size, table_count, active_connections) = match db_stats {
        Ok(Some(row)) => {
            let full_ver = row.try_get::<String>("", "pg_version").unwrap_or_else(|_| "PostgreSQL".into());
            let short_ver = full_ver
                .split_whitespace()
                .take(2)
                .collect::<Vec<_>>()
                .join(" ");
            (
                true,
                short_ver,
                row.try_get::<String>("", "db_name").unwrap_or_else(|_| "maxxpixels_ott".into()),
                row.try_get::<String>("", "db_size").unwrap_or_else(|_| "0 B".into()),
                row.try_get::<i64>("", "table_count").unwrap_or(0),
                row.try_get::<i64>("", "active_connections").unwrap_or(0),
            )
        }
        _ => (false, "Unavailable".into(), "unknown".into(), "0 B".into(), 0, 0),
    };

    let redis_healthy = state.redis.is_healthy();
    let bunny_configured = !state.config.bunny_storage_zone_name.trim().is_empty()
        && !state.config.bunny_storage_zone_password.trim().is_empty();
    let bunny_stream_configured = !state.config.bunny_stream_library_id.trim().is_empty()
        && !state.config.bunny_stream_api_key.trim().is_empty();

    let migrations = MigrationRunner::list_status(&state.db).await;
    let applied_migrations = migrations.iter().filter(|m| m.applied).count();
    let total_migrations = migrations.len();
    let latest_version = migrations
        .iter()
        .rev()
        .find(|m| m.applied)
        .map(|m| format!("{}_{}", m.version, m.name))
        .unwrap_or_else(|| "none".to_string());

    let status_str = if db_healthy { "UP" } else { "DEGRADED" };

    let payload = json!({
        "status": status_str,
        "timestamp": Utc::now().to_rfc3339(),
        "uptimeSeconds": state.uptime_seconds(),
        "environment": state.config.env,
        "components": {
            "db": {
                "status": if db_healthy { "UP" } else { "DOWN" },
                "database": pg_version,
                "name": db_name,
                "size": db_size,
                "tableCount": table_count,
                "activeConnections": active_connections,
                "maxConnections": state.config.db_max_connections,
                "latencyMs": db_latency_ms,
                "pool": "SeaORM + SQLx"
            },
            "redis": {
                "status": if redis_healthy { "UP" } else { "FALLBACK" },
                "engine": if redis_healthy { "Redis 7 (Live)" } else { "In-Memory Fallback" }
            },
            "kafka": {
                "status": if state.config.kafka_enabled { "UP" } else { "DISABLED" },
                "brokers": state.config.kafka_brokers,
                "consumerGroup": state.config.kafka_consumer_group
            },
            "bunny": {
                "status": if bunny_configured || bunny_stream_configured { "CONFIGURED" } else { "NOT_CONFIGURED" },
                "storageZone": state.config.bunny_storage_zone_name,
                "streamLibraryId": state.config.bunny_stream_library_id,
                "cdnHostname": state.config.bunny_stream_cdn_hostname
            },
            "migrations": {
                "status": if applied_migrations == total_migrations { "UP_TO_DATE" } else { "PENDING" },
                "applied": applied_migrations,
                "total": total_migrations,
                "latest": latest_version
            },
            "runtime": {
                "engine": "Tokio Multi-Threaded Rust",
                "version": env!("CARGO_PKG_VERSION")
            }
        }
    });

    (StatusCode::OK, Json(ApiResponse::ok(payload)))
}

/// Prometheus metrics endpoint matching NestJS prom-client
pub async fn metrics_handler() -> Response {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = vec![];

    if encoder.encode(&metric_families, &mut buffer).is_err() {
        return (StatusCode::INTERNAL_SERVER_ERROR, "Failed to encode metrics").into_response();
    }

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, encoder.format_type())
        .body(axum::body::Body::from(buffer))
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Response error").into_response())
}

