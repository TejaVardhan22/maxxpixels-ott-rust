package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/maxxpixels/go-api/internal/games"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	cfg := games.LoadConfig()
	if cfg.GamesDatabaseURL == "" {
		slog.Error("GAMES_DATABASE_URL (or DATABASE_URL) is required (set it in .env)")
		os.Exit(1)
	}
	if cfg.JWTSecret == "" {
		slog.Error("JWT_SECRET is required (set it in .env)")
		os.Exit(1)
	}

	logLevel := logger.Warn
	if cfg.Env == "development" {
		logLevel = logger.Info
	}
	db, err := gorm.Open(postgres.Open(cfg.GamesDatabaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		slog.Error("failed connecting to games database", "err", err)
		os.Exit(1)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetMaxIdleConns(2)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}

	if err := games.RunMigrations(context.Background(), db); err != nil {
		slog.Error("games schema migration failed", "err", err)
		os.Exit(1)
	}
	slog.Info("Games database schema ensured (players, ledger, recharges, sessions, stats, coin_orders)")

	svc := games.NewService(db, cfg)
	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Handler:           svc.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("games-service listening", "addr", srv.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("games-service failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	slog.Info("games-service stopped cleanly")
}
