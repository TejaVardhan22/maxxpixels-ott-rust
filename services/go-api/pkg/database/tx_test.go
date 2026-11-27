package database

import (
	"errors"
	"testing"
)

func TestIsRetryableTxError(t *testing.T) {
	if !isRetryableTxError(errors.New("ERROR: deadlock detected (SQLSTATE 40P01)")) {
		t.Fatal("expected 40P01 deadlock to be retryable")
	}
	if !isRetryableTxError(errors.New("ERROR: could not serialize access due to concurrent update (SQLSTATE 40001)")) {
		t.Fatal("expected 40001 serialization failure to be retryable")
	}
	if isRetryableTxError(errors.New("duplicate key value violates unique constraint")) {
		t.Fatal("unique constraint violation must not be retried")
	}
}
