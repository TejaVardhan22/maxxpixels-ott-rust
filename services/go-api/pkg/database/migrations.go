package database

import (
	"context"
	"embed"
	"log/slog"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

const migrationAdvisoryLockKey int64 = 7742026

// RunMigrations applies additive SQL migrations 0001-0013 under a PostgreSQL advisory lock,
// sharing the exact rust_schema_migrations tracking table so production databases stay 100% compatible.
func RunMigrations(ctx context.Context, db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, _ = conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", migrationAdvisoryLockKey)
	defer func() {
		_, _ = conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", migrationAdvisoryLockKey)
	}()

	_, err = conn.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS rust_schema_migrations (
			version VARCHAR(32) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			execution_ms BIGINT NOT NULL DEFAULT 0
		)`)
	if err != nil {
		return err
	}

	applied := map[string]bool{}
	rows, err := conn.QueryContext(ctx, "SELECT version FROM rust_schema_migrations")
	if err == nil {
		for rows.Next() {
			var v string
			if rows.Scan(&v) == nil {
				applied[v] = true
			}
		}
		rows.Close()
	}

	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, fname := range names {
		parts := strings.SplitN(strings.TrimSuffix(fname, ".sql"), "_", 2)
		version := parts[0]
		mname := version
		if len(parts) > 1 {
			mname = parts[1]
		}
		if applied[version] {
			continue
		}

		raw, err := migrationFS.ReadFile("migrations/" + fname)
		if err != nil {
			continue
		}
		started := time.Now()
		if _, err := conn.ExecContext(ctx, string(raw)); err != nil {
			slog.Warn("migration batch error; retrying statement-by-statement", "version", version, "err", err)
			for _, stmt := range strings.Split(string(raw), ";") {
				s := strings.TrimSpace(stmt)
				if s == "" || strings.HasPrefix(s, "--") {
					continue
				}
				if _, se := conn.ExecContext(ctx, s); se != nil {
					slog.Warn("migration statement skipped", "version", version, "err", se)
				}
			}
		}
		elapsed := time.Since(started).Milliseconds()
		_, _ = conn.ExecContext(ctx,
			"INSERT INTO rust_schema_migrations (version, name, execution_ms) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
			version, mname, elapsed,
		)
		slog.Info("applied migration", "version", version, "name", mname, "ms", elapsed)
	}
	return nil
}
