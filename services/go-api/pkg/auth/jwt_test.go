package auth

import (
	"testing"
	"time"
)

func TestSignAndParseAccessToken(t *testing.T) {
	tm := NewTokenManager("super-secret-test-key", time.Hour, 24*time.Hour)
	tok, err := tm.SignAccessToken(42, "dev@maxxpixels.com", "+919999999999", []string{"USER", "ADMIN"})
	if err != nil {
		t.Fatalf("sign access token failed: %v", err)
	}
	claims, err := tm.Parse(tok)
	if err != nil {
		t.Fatalf("parse token failed: %v", err)
	}
	uid, err := claims.ParsedUserID()
	if err != nil || uid != 42 {
		t.Fatalf("expected uid=42, got %d (err=%v)", uid, err)
	}
	if !claims.IsAdmin() {
		t.Fatalf("expected IsAdmin() to be true")
	}
}
