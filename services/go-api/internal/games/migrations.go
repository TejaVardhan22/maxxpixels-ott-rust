package games

import (
	"context"
	"embed"
	"fmt"
	"log/slog"

	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/pressly/goose/v3"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// NewGooseProvider returns the pressly/goose/v3 Provider for the separate games database.
func NewGooseProvider(db *gorm.DB) (*goose.Provider, error) {
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	return database.NewGooseProvider(sqlDB, migrationFS, "migrations")
}

// RunMigrations applies all pending games SQL migrations using pressly/goose/v3.
func RunMigrations(ctx context.Context, db *gorm.DB) error {
	provider, err := NewGooseProvider(db)
	if err != nil {
		return err
	}
	results, err := provider.Up(ctx)
	if err != nil {
		return fmt.Errorf("goose up (games): %w", err)
	}
	for _, r := range results {
		slog.Info("goose applied migration", "db", "games", "version", r.Source.Version, "path", r.Source.Path, "ms", r.Duration.Milliseconds())
	}
	return nil
}
