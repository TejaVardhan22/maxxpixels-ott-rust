package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/maxxpixels/go-api/internal/games"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../../.env")

	target := flag.String("target", "all", "Database target: all | ott | games")
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, `MaxxPixels Go Migration Tool (powered by pressly/goose/v3)

Usage:
  migrate [-target=all|ott|games] <command> [args]

Commands:
  up              Apply all pending migrations (default)
  up-by-one       Apply the next single migration
  down            Roll back the most recent migration
  status          Print applied & pending migrations
  version         Print current schema version
  create <name>   Create a new timestamped .sql migration file (requires -target=ott or -target=games)

Examples:
  go run ./cmd/migrate -target=all up
  go run ./cmd/migrate -target=all status
  go run ./cmd/migrate -target=ott create add_user_badges
  go run ./cmd/migrate -target=games down
`)
	}
	flag.Parse()

	cmd := "up"
	if flag.NArg() > 0 {
		cmd = strings.ToLower(strings.TrimSpace(flag.Arg(0)))
	}

	t := strings.ToLower(strings.TrimSpace(*target))
	if t != "all" && t != "ott" && t != "games" {
		slog.Error("invalid -target; expected all, ott, or games", "target", *target)
		os.Exit(1)
	}

	if cmd == "create" {
		if flag.NArg() < 2 {
			slog.Error("create requires a migration name, e.g. migrate -target=ott create add_user_badges")
			os.Exit(1)
		}
		dir := "pkg/database/migrations"
		if t == "games" {
			dir = "internal/games/migrations"
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			slog.Error("failed creating migrations dir", "dir", dir, "err", err)
			os.Exit(1)
		}
		name := flag.Arg(1)
		if err := goose.Create(nil, dir, name, "sql"); err != nil {
			slog.Error("goose create failed", "err", err)
			os.Exit(1)
		}
		fmt.Printf("Created new goose SQL migration in %s\n", filepath.Clean(dir))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if t == "all" || t == "ott" {
		ottURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if ottURL == "" {
			slog.Error("DATABASE_URL is required for OTT migrations")
			os.Exit(1)
		}
		db := mustOpen(ottURL)
		provider, err := database.NewOTTGooseProvider(db)
		if err != nil {
			slog.Error("failed initializing OTT goose provider", "err", err)
			os.Exit(1)
		}
		runCommand(ctx, "OTT", provider, cmd)
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
		provider, err := games.NewGooseProvider(db)
		if err != nil {
			slog.Error("failed initializing Games goose provider", "err", err)
			os.Exit(1)
		}
		runCommand(ctx, "Games", provider, cmd)
	}
}

func runCommand(ctx context.Context, label string, provider *goose.Provider, cmd string) {
	switch cmd {
	case "up":
		results, err := provider.Up(ctx)
		if err != nil {
			slog.Error("goose up failed", "db", label, "err", err)
			os.Exit(1)
		}
		fmt.Printf("[%s] Applied %d migration(s)\n", label, len(results))
		for _, r := range results {
			fmt.Printf("  UP  %04d  %-48s  (%dms)\n", r.Source.Version, r.Source.Path, r.Duration.Milliseconds())
		}
		printStatus(ctx, label, provider)
	case "up-by-one":
		r, err := provider.UpByOne(ctx)
		if err != nil {
			slog.Error("goose up-by-one failed", "db", label, "err", err)
			os.Exit(1)
		}
		if r != nil {
			fmt.Printf("[%s] UP  %04d  %s (%dms)\n", label, r.Source.Version, r.Source.Path, r.Duration.Milliseconds())
		}
	case "down":
		r, err := provider.Down(ctx)
		if err != nil {
			slog.Error("goose down failed", "db", label, "err", err)
			os.Exit(1)
		}
		if r != nil {
			fmt.Printf("[%s] DOWN %04d  %s (%dms)\n", label, r.Source.Version, r.Source.Path, r.Duration.Milliseconds())
		}
	case "status":
		printStatus(ctx, label, provider)
	case "version":
		v, err := provider.GetDBVersion(ctx)
		if err != nil {
			slog.Error("goose version failed", "db", label, "err", err)
			os.Exit(1)
		}
		fmt.Printf("[%s] Current schema version: %d\n", label, v)
	default:
		slog.Error("unknown command", "cmd", cmd)
		flag.Usage()
		os.Exit(1)
	}
}

func printStatus(ctx context.Context, label string, provider *goose.Provider) {
	rows, err := database.StatusFromProvider(ctx, provider)
	if err != nil {
		slog.Error("goose status failed", "db", label, "err", err)
		os.Exit(1)
	}
	fmt.Printf("\n=== %s Goose Migrations (%d total) ===\n", label, len(rows))
	for _, r := range rows {
		ts := "pending"
		if !r.AppliedAt.IsZero() {
			ts = r.AppliedAt.UTC().Format(time.RFC3339)
		}
		fmt.Printf("  %-8s  %04d  %-52s  %s\n", r.State, r.Version, r.Name, ts)
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
