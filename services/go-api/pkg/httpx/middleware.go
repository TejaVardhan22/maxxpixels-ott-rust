package httpx

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
)

// SecurityHeaders mirrors Rust's response_envelope_middleware baseline hardening.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		h.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
		next.ServeHTTP(w, r)
	})
}

// RequestID ensures every request carries an X-Request-Id header for distributed tracing.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := r.Header.Get("X-Request-Id")
		if reqID == "" {
			reqID = uuid.NewString()
		}
		w.Header().Set("X-Request-Id", reqID)
		next.ServeHTTP(w, r)
	})
}

// LogEvent represents a structured HTTP log event emitted by AccessLogger.
type LogEvent struct {
	Service    string
	Level      string
	RequestID  string
	Method     string
	Path       string
	Status     int
	DurationMs int64
	Message    string
}

var centralLogSink func(LogEvent)

// SetLogSink registers an optional centralized log sink (e.g. Postgres service_logs) for warnings/errors/slow requests.
func SetLogSink(fn func(LogEvent)) {
	centralLogSink = fn
}

// AccessLogger emits low-overhead structured slog access logs and forwards 4xx/5xx or slow requests to the central log sink.
func AccessLogger(serviceName string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			end := time.Now()
			durMs := end.Sub(start).Milliseconds()
			status := ww.Status()
			if status == 0 {
				status = http.StatusOK
			}
			reqID := w.Header().Get("X-Request-Id")
			recordHTTPMetric(serviceName, r.Method, status, durMs)
			exportOTLPSpanAsync(serviceName, r.Method, r.URL.Path, r.Header.Get("X-Trace-Id"), "", status, start, end)
			slog.Info("http_request",
				"service", serviceName,
				"method", r.Method,
				"path", r.URL.Path,
				"status", status,
				"duration_ms", durMs,
				"request_id", reqID,
			)
			if centralLogSink != nil && (status >= 400 || durMs >= 1000) {
				lvl := "WARN"
				if status >= 500 {
					lvl = "ERROR"
				}
				centralLogSink(LogEvent{
					Service:    serviceName,
					Level:      lvl,
					RequestID:  reqID,
					Method:     r.Method,
					Path:       r.URL.Path,
					Status:     status,
					DurationMs: durMs,
					Message:    "http_request",
				})
			}
		})
	}
}

func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	return cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-Id", "X-Device-Id", "X-Platform"},
		ExposedHeaders:   []string{"X-Request-Id"},
		AllowCredentials: true,
		MaxAge:           300,
	})
}
