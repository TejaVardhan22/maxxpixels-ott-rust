package httpx

import (
	"context"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RateLimitStore is satisfied by *cache.Store (Redis) or nil (uses built-in thread-safe memory fallback).
type RateLimitStore interface {
	AllowRate(ctx context.Context, key string, limit int64, window time.Duration) (bool, int64)
}

type RateLimitConfig struct {
	Disabled         bool
	GeneralPerMinute int64
	AuthPerMinute    int64
	PaymentPerMinute int64
}

type memBucket struct {
	count   int64
	resetAt time.Time
}

type memoryRateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*memBucket
}

func newMemoryRateLimiter() *memoryRateLimiter {
	return &memoryRateLimiter{buckets: make(map[string]*memBucket)}
}

func (m *memoryRateLimiter) allow(key string, limit int64, window time.Duration) (bool, int64) {
	now := time.Now()
	m.mu.Lock()
	defer m.mu.Unlock()

	// Lazy cleanup to keep memory bounded under high cardinality
	if len(m.buckets) > 10000 {
		for k, b := range m.buckets {
			if now.After(b.resetAt) {
				delete(m.buckets, k)
			}
		}
	}

	b, ok := m.buckets[key]
	if !ok || now.After(b.resetAt) {
		b = &memBucket{count: 0, resetAt: now.Add(window)}
		m.buckets[key] = b
	}
	b.count++
	rem := limit - b.count
	if rem < 0 {
		rem = 0
	}
	return b.count <= limit, rem
}

// RateLimitMiddleware enforces per-IP, per-tier (auth / payment / general) rate limits using Redis
// with an automatic thread-safe in-memory fallback.
func RateLimitMiddleware(store RateLimitStore, cfg RateLimitConfig) func(http.Handler) http.Handler {
	if cfg.GeneralPerMinute <= 0 {
		cfg.GeneralPerMinute = 600
	}
	if cfg.AuthPerMinute <= 0 {
		cfg.AuthPerMinute = 30
	}
	if cfg.PaymentPerMinute <= 0 {
		cfg.PaymentPerMinute = 30
	}
	fallback := newMemoryRateLimiter()
	window := time.Minute

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if cfg.Disabled {
				next.ServeHTTP(w, r)
				return
			}
			p := strings.ToLower(r.URL.Path)
			if p == "/health" || p == "/healthz" || p == "/ping" || p == "/metrics" || p == "/prometheus" ||
				strings.HasSuffix(p, "/health") || strings.Contains(p, "/webhook") {
				next.ServeHTTP(w, r)
				return
			}

			tier := "general"
			limit := cfg.GeneralPerMinute
			switch {
			case strings.Contains(p, "/auth/login") || strings.Contains(p, "/auth/register") ||
				strings.Contains(p, "/auth/send-otp") || strings.Contains(p, "/auth/verify-otp") ||
				strings.Contains(p, "/auth/forgot-password"):
				tier = "auth"
				limit = cfg.AuthPerMinute
			case strings.Contains(p, "/payments/") || strings.Contains(p, "/orders") ||
				strings.Contains(p, "/subscriptions/checkout") || strings.Contains(p, "/coins/order"):
				tier = "payment"
				limit = cfg.PaymentPerMinute
			}

			ip := clientIP(r)
			key := tier + ":" + ip

			var allowed bool
			var remaining int64
			if store != nil {
				allowed, remaining = store.AllowRate(r.Context(), key, limit, window)
			} else {
				allowed, remaining = fallback.allow(key, limit, window)
			}

			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			if !allowed {
				w.Header().Set("Retry-After", "60")
				Error(w, http.StatusTooManyRequests, "Too many requests — please slow down and retry shortly", "RATE_LIMIT_EXCEEDED")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return xff
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}
