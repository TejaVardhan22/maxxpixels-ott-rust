package database

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"time"

	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/lock"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// AppliedMigration represents a recorded migration status row.
type AppliedMigration struct {
	Version   int64     `json:"version"`
	Name      string    `json:"name"`
	State     string    `json:"state"`
	AppliedAt time.Time `json:"appliedAt"`
}

// NewGooseProvider builds a concurrency-safe pressly/goose/v3 Provider backed by
// an embedded SQL directory and a PostgreSQL session advisory lock.
func NewGooseProvider(sqlDB *sql.DB, fsys fs.FS, dir string) (*goose.Provider, error) {
	subFS, err := fs.Sub(fsys, dir)
	if err != nil {
		return nil, fmt.Errorf("sub fs %s: %w", dir, err)
	}
	locker, err := lock.NewPostgresSessionLocker(
		lock.WithLockTimeout(5, 60),
	)
	if err != nil {
		return nil, fmt.Errorf("create postgres advisory locker: %w", err)
	}
	provider, err := goose.NewProvider(
		goose.DialectPostgres,
		sqlDB,
		subFS,
		goose.WithSessionLocker(locker),
		goose.WithAllowOutofOrder(true),
	)
	if err != nil {
		return nil, fmt.Errorf("create goose provider: %w", err)
	}
	return provider, nil
}

// NewOTTGooseProvider returns the goose Provider for the main OTT database (0001-0013+).
func NewOTTGooseProvider(db *gorm.DB) (*goose.Provider, error) {
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	return NewGooseProvider(sqlDB, migrationFS, "migrations")
}

// RunMigrations applies all pending OTT SQL migrations using pressly/goose/v3.
func RunMigrations(ctx context.Context, db *gorm.DB) error {
	provider, err := NewOTTGooseProvider(db)
	if err != nil {
		return err
	}
	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("goose up (ott): %w", err)
	}
	for _, r := range results {
		slog.Info("goose applied migration", "db", "ott", "version", r.Source.Version, "path", r.Source.Path, "ms", r.Duration.Milliseconds())
	}
	return nil
}

// StatusFromProvider converts goose.Provider.Status into structured rows.
func StatusFromProvider(ctx context.Context, provider *goose.Provider) ([]AppliedMigration, error) {
	statuses, err := provider.Status(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AppliedMigration, 0, len(statuses))
	for _, st := range statuses {
		out = append(out, AppliedMigration{
			Version:   st.Source.Version,
			Name:      st.Source.Path,
			State:     string(st.State),
			AppliedAt: st.AppliedAt,
		})
	}
	return out, nil
}
