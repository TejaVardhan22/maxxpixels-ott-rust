package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/outbox"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/dbresolver"
)

// Connect initializes a high-concurrency GORM v2 connection pool tuned for OTT workloads:
// - PrepareStmt: true (prepared statement cache across goroutines)
// - SkipDefaultTransaction: true (eliminates ~30% unnecessary BEGIN/COMMIT overhead on single queries)
// - Optional Read Replica via dbresolver when DATABASE_REPLICA_URL is provided
func Connect(cfg *config.AppConfig) (*gorm.DB, error) {
	logLevel := logger.Warn
	if cfg.Env == "development" {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
		PrepareStmt:            true,
		SkipDefaultTransaction: true,
		Logger:                 logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return nil, fmt.Errorf("gorm open postgres: %w", err)
	}

	if cfg.DatabaseReplicaURL != "" {
		if err := db.Use(dbresolver.Register(dbresolver.Config{
			Replicas: []gorm.Dialector{postgres.Open(cfg.DatabaseReplicaURL)},
			Policy:   dbresolver.RandomPolicy{},
		}).
			SetMaxOpenConns(cfg.DBMaxConnections).
			SetMaxIdleConns(cfg.DBMinConnections).
			SetConnMaxIdleTime(cfg.DBIdleTimeout).
			SetConnMaxLifetime(30 * time.Minute)); err != nil {
			slog.Warn("failed to register read replica, continuing with primary", "err", err)
		}
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("gorm underlying sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(cfg.DBMaxConnections)
	sqlDB.SetMaxIdleConns(cfg.DBMinConnections)
	sqlDB.SetConnMaxIdleTime(cfg.DBIdleTimeout)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.DBConnectTimeout)
	defer cancel()
	if err := sqlDB.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("postgres ping failed: %w", err)
	}

	if err := RunMigrations(ctx, db); err != nil {
		slog.Warn("startup migrations warning", "err", err)
	}

	// Register centralized log sink so 4xx/5xx and slow requests from all microservices land in service_logs
	httpx.SetLogSink(func(ev httpx.LogEvent) {
		reqID := ev.RequestID
		method := ev.Method
		path := ev.Path
		status := ev.Status
		dur := ev.DurationMs
		outbox.RecordLog(db, outbox.ServiceLog{
			Service:    ev.Service,
			Level:      ev.Level,
			RequestID:  &reqID,
			Method:     &method,
			Path:       &path,
			Status:     &status,
			DurationMs: &dur,
			Message:    ev.Message,
		})
	})

	return db, nil
}

func HealthCheck(ctx context.Context, db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db not initialized")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}
