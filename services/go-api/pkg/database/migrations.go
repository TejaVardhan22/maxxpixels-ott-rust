package database

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

const (
	OTTMigrationAdvisoryLockKey   int64 = 7742026
	GamesMigrationAdvisoryLockKey int64 = 7742027
)

// AppliedMigration represents a recorded migration row in a schema_migrations table.
type AppliedMigration struct {
	Version     string    `json:"version"`
	Name        string    `json:"name"`
	AppliedAt   time.Time `json:"appliedAt"`
	ExecutionMs int64     `json:"executionMs"`
}

// RunMigrations applies additive OTT SQL migrations (0001-0013+) under a PostgreSQL advisory lock,
// sharing the rust_schema_migrations tracking table so existing production databases stay 100% compatible.
func RunMigrations(ctx context.Context, db *gorm.DB) error {
	return RunEmbeddedMigrations(ctx, db, migrationFS, "migrations", "rust_schema_migrations", OTTMigrationAdvisoryLockKey)
}

// RunEmbeddedMigrations applies sorted *.sql files from an embedded filesystem under a PostgreSQL
// advisory lock, recording each applied version in tableName.
func RunEmbeddedMigrations(ctx context.Context, db *gorm.DB, fsys fs.ReadFileFS, dir, tableName string, lockKey int64) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	conn, err := sqlDB.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	_, _ = conn.ExecContext(ctx, "SELECT pg_advisory_lock($1)", lockKey)
	defer func() {
		_, _ = conn.ExecContext(context.Background(), "SELECT pg_advisory_unlock($1)", lockKey)
	}()

	createTableSQL := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s (
			version VARCHAR(32) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			execution_ms BIGINT NOT NULL DEFAULT 0
		)`, tableName)
	if _, err := conn.ExecContext(ctx, createTableSQL); err != nil {
		return fmt.Errorf("create %s: %w", tableName, err)
	}

	applied := map[string]bool{}
	rows, err := conn.QueryContext(ctx, fmt.Sprintf("SELECT version FROM %s", tableName))
	if err == nil {
		for rows.Next() {
			var v string
			if rows.Scan(&v) == nil {
				applied[v] = true
			}
		}
		rows.Close()
	}

	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return fmt.Errorf("read embedded migrations dir %s: %w", dir, err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	insertSQL := fmt.Sprintf(
		"INSERT INTO %s (version, name, execution_ms) VALUES ($1, $2, $3) ON CONFLICT (version) DO NOTHING",
		tableName,
	)

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

		raw, err := fsys.ReadFile(dir + "/" + fname)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", fname, err)
		}
		started := time.Now()
		if _, err := conn.ExecContext(ctx, string(raw)); err != nil {
			slog.Warn("migration batch error; retrying statement-by-statement", "table", tableName, "version", version, "err", err)
			for _, stmt := range strings.Split(string(raw), ";") {
				s := strings.TrimSpace(stmt)
				if s == "" || strings.HasPrefix(s, "--") {
					continue
				}
				if _, se := conn.ExecContext(ctx, s); se != nil {
					slog.Warn("migration statement skipped", "table", tableName, "version", version, "err", se)
				}
			}
		}
		elapsed := time.Since(started).Milliseconds()
		_, _ = conn.ExecContext(ctx, insertSQL, version, mname, elapsed)
		slog.Info("applied migration", "table", tableName, "version", version, "name", mname, "ms", elapsed)
	}
	return nil
}

// ListAppliedMigrations returns all recorded migrations from tableName ordered by version.
func ListAppliedMigrations(ctx context.Context, db *gorm.DB, tableName string) ([]AppliedMigration, error) {
	var out []AppliedMigration
	err := db.WithContext(ctx).Table(tableName).Order("version ASC").Find(&out).Error
	return out, err
}
