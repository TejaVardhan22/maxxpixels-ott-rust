package games

import (
	"context"
	"embed"

	"github.com/maxxpixels/go-api/pkg/database"
	"gorm.io/gorm"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// RunMigrations applies versioned SQL migrations from internal/games/migrations/*.sql
// under a PostgreSQL advisory lock, tracked in games_schema_migrations.
func RunMigrations(ctx context.Context, db *gorm.DB) error {
	return database.RunEmbeddedMigrations(
		ctx,
		db,
		migrationFS,
		"migrations",
		"games_schema_migrations",
		database.GamesMigrationAdvisoryLockKey,
	)
}
