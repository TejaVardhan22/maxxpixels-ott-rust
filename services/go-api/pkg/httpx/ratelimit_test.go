package httpx

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
)

func TestRateLimitMiddleware_Concurrent(t *testing.T) {
	mw := RateLimitMiddleware(nil, RateLimitConfig{
		GeneralPerMinute: 100,
		AuthPerMinute:    10,
		PaymentPerMinute: 5,
	})
	handler := mw(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Fire 25 concurrent goroutines against /api/v1/auth/login (limit=10)
	var okCount, limitedCount atomic.Int64
	var wg sync.WaitGroup
	for i := 0; i < 25; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
			req.RemoteAddr = "10.0.0.1:54321"
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			switch rec.Code {
			case http.StatusOK:
				okCount.Add(1)
			case http.StatusTooManyRequests:
				limitedCount.Add(1)
			}
		}()
	}
	wg.Wait()

	if okCount.Load() != 10 || limitedCount.Load() != 15 {
		t.Fatalf("expected 10 allowed and 15 rate-limited, got ok=%d limited=%d", okCount.Load(), limitedCount.Load())
	}

	// Health endpoint must always bypass rate limiting
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.RemoteAddr = "10.0.0.1:54321"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected /health bypass 200, got %d", rec.Code)
	}
}
