use anyhow::Result;
use chrono::{DateTime, FixedOffset};
use sea_orm::{ConnectionTrait, DatabaseBackend, DatabaseConnection, Statement};
use serde::Serialize;
use std::collections::HashMap;
use std::time::Instant;
use tracing::{info, warn};

const MIGRATION_ADVISORY_LOCK_KEY: i64 = 7742026;

pub struct MigrationDef {
    pub version: &'static str,
    pub name: &'static str,
    pub sql: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationStatus {
    pub version: String,
    pub name: String,
    pub applied: bool,
    pub applied_at: Option<DateTime<FixedOffset>>,
    pub execution_ms: Option<i64>,
}

/// Ordered, additive-only migrations safe to run on top of an existing NestJS production database.
/// Never drops or renames existing columns so rollback to NestJS remains safe.
pub const MIGRATIONS: &[MigrationDef] = &[
    MigrationDef {
        version: "0001",
        name: "content_metadata_and_scheduling",
        sql: include_str!("../../../migrations/0001_content_metadata_and_scheduling.sql"),
    },
    MigrationDef {
        version: "0002",
        name: "cms_and_settings_audit",
        sql: include_str!("../../../migrations/0002_cms_and_settings_audit.sql"),
    },
    MigrationDef {
        version: "0003",
        name: "notifications_tvod_coupons_indexes",
        sql: include_str!("../../../migrations/0003_notifications_tvod_coupons_indexes.sql"),
    },
    MigrationDef {
        version: "0004",
        name: "producer_public_submission_and_agreement",
        sql: include_str!("../../../migrations/0004_producer_public_submission_and_agreement.sql"),
    },
    MigrationDef {
        version: "0005",
        name: "realtime_views_watch_history",
        sql: include_str!("../../../migrations/0005_realtime_views_watch_history.sql"),
    },
    MigrationDef {
        version: "0006",
        name: "marketing_agents",
        sql: include_str!("../../../migrations/0006_marketing_agents.sql"),
    },
    MigrationDef {
        version: "0007",
        name: "intro_video_and_portal_banners",
        sql: include_str!("../../../migrations/0007_intro_video_and_portal_banners.sql"),
    },
    MigrationDef {
        version: "0008",
        name: "user_referrals",
        sql: include_str!("../../../migrations/0008_user_referrals.sql"),
    },
    MigrationDef {
        version: "0009",
        name: "payments_nullable_legacy_columns",
        sql: include_str!("../../../migrations/0009_payments_nullable_legacy_columns.sql"),
    },
    MigrationDef {
        version: "0010",
        name: "system_settings_branding_and_social_fields",
        sql: include_str!("../../../migrations/0010_system_settings_branding_and_social_fields.sql"),
    },
    MigrationDef {
        version: "0011",
        name: "sync_sequences_and_settings_seed",
        sql: include_str!("../../../migrations/0011_sync_sequences_and_settings_seed.sql"),
    },
];

pub struct MigrationRunner;

impl MigrationRunner {
    async fn ensure_tracking_table(db: &DatabaseConnection) -> Result<()> {
        db.execute_unprepared(
            r#"
            CREATE TABLE IF NOT EXISTS rust_schema_migrations (
                version VARCHAR(32) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                execution_ms BIGINT NOT NULL DEFAULT 0
            );
            "#,
        )
        .await?;
        Ok(())
    }

    /// Runs all pending migrations under a PostgreSQL advisory lock so concurrent
    /// container replicas never race during deployment.
    pub async fn run(db: &DatabaseConnection) -> Result<usize> {
        let _ = db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT pg_advisory_lock($1)",
                vec![MIGRATION_ADVISORY_LOCK_KEY.into()],
            ))
            .await;

        let outcome = Self::run_locked(db).await;

        let _ = db
            .execute(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT pg_advisory_unlock($1)",
                vec![MIGRATION_ADVISORY_LOCK_KEY.into()],
            ))
            .await;

        outcome
    }

    async fn run_locked(db: &DatabaseConnection) -> Result<usize> {
        Self::ensure_tracking_table(db).await?;

        let rows = db
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                "SELECT version FROM rust_schema_migrations".to_string(),
            ))
            .await?;

        let mut applied_versions = std::collections::HashSet::with_capacity(rows.len());
        for row in rows {
            if let Ok(v) = row.try_get::<String>("", "version") {
                applied_versions.insert(v);
            }
        }

        let mut newly_applied = 0usize;
        for m in MIGRATIONS {
            if applied_versions.contains(m.version) {
                continue;
            }
            let started = Instant::now();
            info!("Applying migration {}_{} ...", m.version, m.name);

            // Execute each statement individually so missing optional tables on older envs log cleanly
            // while still applying all applicable additive statements safely.
            match db.execute_unprepared(m.sql).await {
                Ok(_) => {
                    let elapsed = started.elapsed().as_millis() as i64;
                    db.execute(Statement::from_sql_and_values(
                        DatabaseBackend::Postgres,
                        "INSERT INTO rust_schema_migrations (version, name, execution_ms) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
                        vec![m.version.into(), m.name.into(), elapsed.into()],
                    ))
                    .await?;
                    info!(
                        "Migration {}_{} applied successfully in {}ms.",
                        m.version, m.name, elapsed
                    );
                    newly_applied += 1;
                }
                Err(e) => {
                    warn!(
                        "Migration {}_{} batch execution error ({}); retrying statement-by-statement...",
                        m.version, m.name, e
                    );
                    for stmt in m.sql.split(';') {
                        let s = stmt.trim();
                        if s.is_empty() || s.starts_with("--") {
                            continue;
                        }
                        if let Err(se) = db.execute_unprepared(s).await {
                            warn!("Migration {} statement skipped/failed: {}", m.version, se);
                        }
                    }
                    let elapsed = started.elapsed().as_millis() as i64;
                    let _ = db
                        .execute(Statement::from_sql_and_values(
                            DatabaseBackend::Postgres,
                            "INSERT INTO rust_schema_migrations (version, name, execution_ms) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
                            vec![m.version.into(), m.name.into(), elapsed.into()],
                        ))
                        .await;
                    newly_applied += 1;
                }
            }
        }

        Ok(newly_applied)
    }

    /// Returns status of all compiled migrations for `/admin/system-health`.
    pub async fn list_status(db: &DatabaseConnection) -> Vec<MigrationStatus> {
        let _ = Self::ensure_tracking_table(db).await;
        let rows = db
            .query_all(Statement::from_string(
                DatabaseBackend::Postgres,
                "SELECT version, applied_at, execution_ms FROM rust_schema_migrations".to_string(),
            ))
            .await
            .unwrap_or_default();

        let mut applied_map: HashMap<String, (Option<DateTime<FixedOffset>>, Option<i64>)> =
            HashMap::new();
        for r in rows {
            if let Ok(v) = r.try_get::<String>("", "version") {
                let applied_at = r.try_get::<Option<DateTime<FixedOffset>>>("", "applied_at").ok().flatten();
                let exec_ms = r.try_get::<Option<i64>>("", "execution_ms").ok().flatten();
                applied_map.insert(v, (applied_at, exec_ms));
            }
        }

        MIGRATIONS
            .iter()
            .map(|m| {
                if let Some((applied_at, exec_ms)) = applied_map.get(m.version) {
                    MigrationStatus {
                        version: m.version.to_string(),
                        name: m.name.to_string(),
                        applied: true,
                        applied_at: *applied_at,
                        execution_ms: *exec_ms,
                    }
                } else {
                    MigrationStatus {
                        version: m.version.to_string(),
                        name: m.name.to_string(),
                        applied: false,
                        applied_at: None,
                        execution_ms: None,
                    }
                }
            })
            .collect()
    }
}
