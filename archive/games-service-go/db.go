package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBTX interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func ConnectDB(ctx context.Context, databaseURL, env string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse games database url: %w", err)
	}
	cfg.MaxConns = 10
	cfg.MinConns = 1
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed connecting to games database: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("failed pinging games database: %w", err)
	}
	return pool, nil
}

func RunMigrations(ctx context.Context, db DBTX) error {
	m1, err := os.ReadFile("migrations/001_init.sql")
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, string(m1)); err != nil {
		return fmt.Errorf("migration 001: %w", err)
	}
	m2, err := os.ReadFile("migrations/002_coin_orders.sql")
	if err != nil {
		return err
	}
	if _, err := db.Exec(ctx, string(m2)); err != nil {
		return fmt.Errorf("migration 002: %w", err)
	}
	return nil
}

func queryPlayerJSON(ctx context.Context, db DBTX, sql string, args ...any) (map[string]any, error) {
	row := db.QueryRow(ctx, sql, args...)
	var raw []byte
	if err := row.Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		// Some drivers/queries may return no row differently; be safe.
		return nil, err
	}
	if len(raw) == 0 {
		return nil, nil
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		// could be null
		var anyv any
		if err2 := json.Unmarshal(raw, &anyv); err2 == nil && anyv == nil {
			return nil, nil
		}
		return nil, err
	}
	return m, nil
}

func queryJSONRows(ctx context.Context, db DBTX, sql string, args ...any) ([]map[string]any, error) {
	rows, err := db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		if len(raw) == 0 {
			continue
		}
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err == nil {
			out = append(out, m)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func execRows(ctx context.Context, db DBTX, sql string, args ...any) (int64, error) {
	tag, err := db.Exec(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
