package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOKEnvelopeDualKeys(t *testing.T) {
	rec := httptest.NewRecorder()
	OK(rec, map[string]any{"hello": "world"}, "Loaded")
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var env ApiResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("unmarshal envelope: %v", err)
	}
	if !env.Success || env.Data == nil || env.Result == nil || env.Message != "Loaded" {
		t.Fatalf("unexpected envelope: %+v", env)
	}
}
