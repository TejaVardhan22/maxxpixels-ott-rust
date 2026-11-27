package database

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"
)

// WithTx executes fn inside a GORM ACID transaction with automatic retry on
// transient deadlock / serialization failures (PostgreSQL 40P01/40001, MySQL 1213).
// Use this across all microservices for multi-write consistency under high concurrency.
func WithTx(ctx context.Context, db *gorm.DB, fn func(tx *gorm.DB) error) error {
	const maxAttempts = 3
	var err error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		err = db.WithContext(ctx).Transaction(fn)
		if err == nil || !isRetryableTxError(err) || attempt == maxAttempts {
			return err
		}
		backoff := time.Duration(attempt*attempt) * 25 * time.Millisecond
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(backoff):
		}
	}
	return err
}

func isRetryableTxError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "deadlock") ||
		strings.Contains(msg, "40p01") ||
		strings.Contains(msg, "40001") ||
		strings.Contains(msg, "could not serialize access") ||
		strings.Contains(msg, "lock wait timeout")
}
