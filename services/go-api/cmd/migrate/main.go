package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/maxxpixels/go-api/internal/games"
	"github.com/maxxpixels/go-api/pkg/database"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	target := flag.String("target", "all", "Which database to migrate: all | ott | games")
	statusOnly := flag.Bool("status", false, "Print applied migrations without applying new ones")
	flag.Parse()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	t := strings.ToLower(strings.TrimSpace(*target))
	if t != "all" && t != "ott" && t != "games" {
		slog.Error("invalid -target; expected all, ott, or games", "target", *target)
		os.Exit(1)
	}

	if t == "all" || t == "ott" {
		ottURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if ottURL == "" {
			slog.Error("DATABASE_URL is required for OTT migrations")
			os.Exit(1)
		}
		db := mustOpen(ottURL)
		if !*statusOnly {
			if err := database.RunMigrations(ctx, db); err != nil {
				slog.Error("OTT migrations failed", "err", err)
				os.Exit(1)
			}
		}
		printStatus(ctx, db, "OTT (rust_schema_migrations)", "rust_schema_migrations")
	}

	if t == "all" || t == "games" {
		gamesURL := strings.TrimSpace(os.Getenv("GAMES_DATABASE_URL"))
		if gamesURL == "" {
			if t == "games" {
				slog.Error("GAMES_DATABASE_URL is required for games migrations")
				os.Exit(1)
			}
			slog.Info("GAMES_DATABASE_URL not set; skipping games migrations")
			return
		}
		db := mustOpen(gamesURL)
		if !*statusOnly {
			if err := games.RunMigrations(ctx, db); err != nil {
				slog.Error("Games migrations failed", "err", err)
				os.Exit(1)
			}
		}
		printStatus(ctx, db, "Games (games_schema_migrations)", "games_schema_migrations")
	}
}

func mustOpen(dsn string) *gorm.DB {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		slog.Error("failed connecting to database", "err", err)
		os.Exit(1)
	}
	return db
}

func printStatus(ctx context.Context, db *gorm.DB, label, table string) {
	rows, err := database.ListAppliedMigrations(ctx, db, table)
	if err != nil {
		slog.Warn("could not list migrations", "table", table, "err", err)
		return
	}
	fmt.Printf("\n=== %s (%d applied) ===\n", label, len(rows))
	for _, r := range rows {
		fmt.Printf("  %s  %-48s  %s  (%dms)\n", r.Version, r.Name, r.AppliedAt.UTC().Format(time.RFC3339), r.ExecutionMs)
	}
}
