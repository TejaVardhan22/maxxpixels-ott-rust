package backup

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/maxxpixels/go-api/pkg/bunny"
	"github.com/maxxpixels/go-api/pkg/outbox"
	"gorm.io/gorm"
)

type DBBackupResult struct {
	Database      string `json:"database"`
	Filename      string `json:"filename"`
	TablesCount   int    `json:"tablesCount"`
	RowsCount     int64  `json:"rowsCount"`
	SizeBytes     int    `json:"sizeBytes"`
	BunnyUploaded bool   `json:"bunnyUploaded"`
	BunnyPath     string `json:"bunnyPath,omitempty"`
	BunnyError    string `json:"bunnyError,omitempty"`
	CreatedAt     string `json:"createdAt"`
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func quoteLiteral(v any) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case bool:
		if val {
			return "'true'"
		}
		return "'false'"
	case []byte:
		return "'" + strings.ReplaceAll(string(val), "'", "''") + "'"
	case time.Time:
		return "'" + val.UTC().Format("2006-01-02 15:04:05.999999+00") + "'"
	case string:
		return "'" + strings.ReplaceAll(val, "'", "''") + "'"
	default:
		return "'" + strings.ReplaceAll(fmt.Sprintf("%v", val), "'", "''") + "'"
	}
}

// DumpDatabaseGzip exports all public schema tables + sequence states to a gzipped SQL dump.
func DumpDatabaseGzip(ctx context.Context, sqlDB *sql.DB, dbLabel string) ([]byte, int, int64, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)

	writeLine := func(s string) error {
		_, err := gz.Write([]byte(s + "\n"))
		return err
	}

	_ = writeLine(fmt.Sprintf("-- MaxxPixels Full PostgreSQL Database Backup (%s)", dbLabel))
	_ = writeLine(fmt.Sprintf("-- Generated at: %s", time.Now().UTC().Format(time.RFC3339)))
	_ = writeLine("SET standard_conforming_strings = on;")
	_ = writeLine("SET session_replication_role = 'replica';")
	_ = writeLine("BEGIN;")

	// List all public tables
	tRows, err := sqlDB.QueryContext(ctx, `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`)
	if err != nil {
		_ = gz.Close()
		return nil, 0, 0, err
	}
	var tables []string
	for tRows.Next() {
		var t string
		if err := tRows.Scan(&t); err == nil {
			tables = append(tables, t)
		}
	}
	tRows.Close()

	var totalRows int64
	for _, tbl := range tables {
		qTbl := fmt.Sprintf(`"public".%s`, quoteIdent(tbl))
		_ = writeLine("")
		_ = writeLine(fmt.Sprintf(`-- Table: public.%s`, quoteIdent(tbl)))
		_ = writeLine(fmt.Sprintf(`TRUNCATE TABLE %s CASCADE;`, qTbl))

		rows, err := sqlDB.QueryContext(ctx, fmt.Sprintf(`SELECT * FROM %s`, qTbl))
		if err != nil {
			continue
		}
		cols, err := rows.Columns()
		if err != nil || len(cols) == 0 {
			rows.Close()
			continue
		}
		quotedCols := make([]string, len(cols))
		for i, c := range cols {
			quotedCols[i] = quoteIdent(c)
		}
		colList := strings.Join(quotedCols, ", ")

		rawVals := make([]any, len(cols))
		scanArgs := make([]any, len(cols))
		for i := range rawVals {
			scanArgs[i] = &rawVals[i]
		}

		for rows.Next() {
			if err := rows.Scan(scanArgs...); err != nil {
				continue
			}
			valStrs := make([]string, len(cols))
			for i, v := range rawVals {
				valStrs[i] = quoteLiteral(v)
			}
			if err := writeLine(fmt.Sprintf(`INSERT INTO %s (%s) VALUES (%s);`, qTbl, colList, strings.Join(valStrs, ", "))); err != nil {
				rows.Close()
				_ = gz.Close()
				return nil, len(tables), totalRows, err
			}
			totalRows++
		}
		rows.Close()
	}

	// Sync all serial sequences
	seqRows, err := sqlDB.QueryContext(ctx, `
		SELECT table_name, column_name, pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name)
		FROM information_schema.columns
		WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
	`)
	if err == nil {
		_ = writeLine("")
		_ = writeLine("-- Sequences")
		for seqRows.Next() {
			var tbl, col string
			var seq sql.NullString
			if err := seqRows.Scan(&tbl, &col, &seq); err == nil && seq.Valid && seq.String != "" {
				_ = writeLine(fmt.Sprintf(
					`SELECT setval('%s', COALESCE((SELECT MAX(%s) FROM "public".%s), 1), true);`,
					strings.ReplaceAll(seq.String, "'", "''"),
					quoteIdent(col),
					quoteIdent(tbl),
				))
			}
		}
		seqRows.Close()
	}

	_ = writeLine("COMMIT;")
	_ = writeLine("SET session_replication_role = 'origin';")

	if err := gz.Close(); err != nil {
		return nil, len(tables), totalRows, err
	}
	return buf.Bytes(), len(tables), totalRows, nil
}

func pruneOldLocalBackups(backupsDir string, keepDays int) {
	entries, err := os.ReadDir(backupsDir)
	if err != nil {
		return
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -keepDays)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().UTC().Before(cutoff) {
			_ = os.Remove(filepath.Join(backupsDir, e.Name()))
		}
	}
}

// RunAllDatabasesBackup dumps the primary OTT DB plus optional GAMES_DATABASE_URL and EXTRA_BACKUP_DATABASE_URLS,
// saves gzipped SQL backups locally (pruning >14d), and uploads every dump to Bunny.net Storage under db-backups/YYYY-MM-DD/.
func RunAllDatabasesBackup(ctx context.Context, primaryDB *gorm.DB, backupsDir string) ([]DBBackupResult, error) {
	if err := os.MkdirAll(backupsDir, 0o755); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	ts := now.Format("20060102-150405")
	dateDir := now.Format("2006-01-02")
	storage := bunny.NewBackupStorageClientFromEnv()

	type dbTarget struct {
		name  string
		sqlDB *sql.DB
		close bool
	}

	var targets []dbTarget
	if primaryDB != nil {
		if sdb, err := primaryDB.DB(); err == nil && sdb != nil {
			targets = append(targets, dbTarget{name: "ott", sqlDB: sdb, close: false})
		}
	}

	// Optional Games DB
	if gamesURL := strings.TrimSpace(os.Getenv("GAMES_DATABASE_URL")); gamesURL != "" {
		if gdb, err := sql.Open("pgx", gamesURL); err == nil {
			targets = append(targets, dbTarget{name: "games", sqlDB: gdb, close: true})
		} else {
			slog.Warn("backup: failed to open GAMES_DATABASE_URL", "err", err)
		}
	}

	// Optional extra project DBs: EXTRA_BACKUP_DATABASE_URLS="analytics=postgres://...,billing=postgres://..."
	if extra := strings.TrimSpace(os.Getenv("EXTRA_BACKUP_DATABASE_URLS")); extra != "" {
		for _, pair := range strings.Split(extra, ",") {
			parts := strings.SplitN(strings.TrimSpace(pair), "=", 2)
			if len(parts) != 2 {
				continue
			}
			name := strings.ToLower(strings.TrimSpace(parts[0]))
			dsn := strings.TrimSpace(parts[1])
			if name == "" || dsn == "" {
				continue
			}
			if edb, err := sql.Open("pgx", dsn); err == nil {
				targets = append(targets, dbTarget{name: name, sqlDB: edb, close: true})
			} else {
				slog.Warn("backup: failed to open extra DB", "name", name, "err", err)
			}
		}
	}

	results := make([]DBBackupResult, 0, len(targets))
	for _, tgt := range targets {
		data, tablesCnt, rowsCnt, err := DumpDatabaseGzip(ctx, tgt.sqlDB, tgt.name)
		if tgt.close {
			_ = tgt.sqlDB.Close()
		}
		if err != nil {
			slog.Error("db backup dump failed", "database", tgt.name, "err", err)
			outbox.RecordLog(primaryDB, outbox.ServiceLog{
				Service: "db-backup",
				Level:   "ERROR",
				Message: fmt.Sprintf("Backup failed for database %s: %v", tgt.name, err),
			})
			continue
		}

		fname := fmt.Sprintf("maxxpixels-%s-backup-%s.sql.gz", tgt.name, ts)
		localPath := filepath.Join(backupsDir, fname)
		if err := os.WriteFile(localPath, data, 0o644); err != nil {
			slog.Warn("db backup local write failed", "file", localPath, "err", err)
		}

		res := DBBackupResult{
			Database:    tgt.name,
			Filename:    fname,
			TablesCount: tablesCnt,
			RowsCount:   rowsCnt,
			SizeBytes:   len(data),
			CreatedAt:   now.Format(time.RFC3339),
		}

		remotePath := fmt.Sprintf("db-backups/%s/%s", dateDir, fname)
		if bunnyPath, err := storage.UploadRawPath(ctx, remotePath, data, "application/gzip"); err == nil {
			res.BunnyUploaded = true
			res.BunnyPath = bunnyPath
		} else {
			res.BunnyError = err.Error()
		}

		lvl := "INFO"
		msg := fmt.Sprintf("Backup complete [%s]: %d tables, %d rows, %d bytes (bunny=%v %s)",
			tgt.name, tablesCnt, rowsCnt, len(data), res.BunnyUploaded, res.BunnyPath)
		if !res.BunnyUploaded && res.BunnyError != "" {
			lvl = "WARN"
			msg = fmt.Sprintf("Backup saved locally [%s] (%d bytes), Bunny upload skipped/failed: %s",
				tgt.name, len(data), res.BunnyError)
		}
		outbox.RecordLog(primaryDB, outbox.ServiceLog{
			Service: "db-backup",
			Level:   lvl,
			Message: msg,
		})
		results = append(results, res)
	}

	pruneOldLocalBackups(backupsDir, 14)
	if len(results) == 0 {
		return nil, fmt.Errorf("no databases backed up")
	}
	return results, nil
}
