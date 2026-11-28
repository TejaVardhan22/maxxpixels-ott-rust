package database

import (
	"context"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/outbox"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/plugin/dbresolver"
)

// NormalizePostgresDSN resolves the primary OTT database DSN from DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD
// (when set in .env) or falls back to NormalizePostgresURL(raw).
func NormalizePostgresDSN(raw string) string {
	dbHost := strings.TrimSpace(os.Getenv("DB_HOST"))
	dbPort := strings.TrimSpace(os.Getenv("DB_PORT"))
	dbName := strings.TrimSpace(os.Getenv("DB_NAME"))
	dbUser := strings.TrimSpace(os.Getenv("DB_USER"))
	dbPass := os.Getenv("DB_PASSWORD")

	if dbHost != "" && dbUser != "" && dbName != "" {
		if dbPort == "" {
			dbPort = "5432"
		}
		sslMode := strings.TrimSpace(os.Getenv("DB_SSLMODE"))
		if sslMode == "" {
			sslMode = "disable"
		}
		u := &url.URL{
			Scheme:   "postgres",
			User:     url.UserPassword(dbUser, dbPass),
			Host:     fmt.Sprintf("%s:%s", dbHost, dbPort),
			Path:     "/" + dbName,
			RawQuery: "sslmode=" + sslMode,
		}
		return u.String()
	}

	return NormalizePostgresURL(raw)
}

// NormalizePostgresURL safely escapes passwords containing unescaped '@' / '!' / '#' in postgres:// URLs.
func NormalizePostgresURL(raw string) string {

	dsn := strings.TrimSpace(raw)
	if !strings.HasPrefix(dsn, "postgres://") && !strings.HasPrefix(dsn, "postgresql://") {
		return dsn
	}
	schemeEnd := strings.Index(dsn, "://")
	scheme := dsn[:schemeEnd]
	rest := dsn[schemeEnd+3:]

	// Split authority from path/query first
	slashIdx := strings.Index(rest, "/")
	authority := rest
	pathAndQuery := ""
	if slashIdx >= 0 {
		authority = rest[:slashIdx]
		pathAndQuery = rest[slashIdx:]
	}
	// Split userinfo from host on the LAST '@' so passwords containing '@' don't corrupt host parsing
	atIdx := strings.LastIndex(authority, "@")
	if atIdx < 0 {
		return dsn
	}
	userInfo := authority[:atIdx]
	hostPart := authority[atIdx+1:]

	user := userInfo
	pass := ""
	hasPass := false
	if colonIdx := strings.Index(userInfo, ":"); colonIdx >= 0 {
		user = userInfo[:colonIdx]
		pass = userInfo[colonIdx+1:]
		hasPass = true
	}
	// Decode first in case it was already percent-encoded, then re-encode cleanly
	if decodedUser, err := url.QueryUnescape(user); err == nil {
		user = decodedUser
	}
	if hasPass {
		if decodedPass, err := url.QueryUnescape(pass); err == nil {
			pass = decodedPass
		}
	}
	var uInfo *url.Userinfo
	if hasPass {
		uInfo = url.UserPassword(user, pass)
	} else {
		uInfo = url.User(user)
	}
	pathPart := pathAndQuery
	rawQuery := ""
	if qIdx := strings.Index(pathAndQuery, "?"); qIdx >= 0 {
		pathPart = pathAndQuery[:qIdx]
		rawQuery = pathAndQuery[qIdx+1:]
	}
	if !strings.Contains(strings.ToLower(rawQuery), "sslmode=") {
		if rawQuery != "" {
			rawQuery += "&sslmode=disable"
		} else {
			rawQuery = "sslmode=disable"
		}
	}
	u := &url.URL{
		Scheme:   scheme,
		User:     uInfo,
		Host:     hostPart,
		Path:     pathPart,
		RawQuery: rawQuery,
	}
	return u.String()
}

// Connect initializes a high-concurrency GORM v2 connection pool tuned for OTT workloads:
// - PrepareStmt: true (prepared statement cache across goroutines)
// - SkipDefaultTransaction: true (eliminates ~30% unnecessary BEGIN/COMMIT overhead on single queries)
// - Optional Read Replica via dbresolver when DATABASE_REPLICA_URL is provided
func Connect(cfg *config.AppConfig) (*gorm.DB, error) {
	logLevel := logger.Warn
	if cfg.Env == "development" {
		logLevel = logger.Info
	}

	dsn := NormalizePostgresDSN(cfg.DatabaseURL)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
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
