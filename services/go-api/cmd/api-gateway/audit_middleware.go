package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/auth"
)

type adminAuditEvent struct {
	Action     string `json:"action"`
	Module     string `json:"module"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	Status     int    `json:"status"`
	LatencyMs  int64  `json:"latencyMs"`
	ActorEmail string `json:"actorEmail"`
	ActorID    int64  `json:"actorId"`
	IP         string `json:"ip"`
	Payload    string `json:"payload"`
	CreatedAt  string `json:"createdAt"`
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (sr *statusRecorder) WriteHeader(code int) {
	sr.status = code
	sr.ResponseWriter.WriteHeader(code)
}

func (sr *statusRecorder) Flush() {
	if f, ok := sr.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

var sensitiveKeys = []string{"password", "secret", "token", "apikey", "api_key", "authorization"}

func redactJSONMap(v any) any {
	switch val := v.(type) {
	case map[string]any:
		out := make(map[string]any, len(val))
		for k, item := range val {
			lk := strings.ToLower(k)
			redacted := false
			for _, sk := range sensitiveKeys {
				if strings.Contains(lk, sk) {
					out[k] = "***REDACTED***"
					redacted = true
					break
				}
			}
			if !redacted {
				out[k] = redactJSONMap(item)
			}
		}
		return out
	case []any:
		out := make([]any, len(val))
		for i, item := range val {
			out[i] = redactJSONMap(item)
		}
		return out
	default:
		return v
	}
}

func sanitizePayloadPreview(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var parsed any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return ""
	}
	b, err := json.Marshal(redactJSONMap(parsed))
	if err != nil {
		return ""
	}
	if len(b) > 2000 {
		return string(b[:2000]) + "..."
	}
	return string(b)
}

func inferModuleFromPath(norm string) string {
	p := strings.TrimPrefix(norm, "/admin/")
	p = strings.TrimPrefix(p, "/")
	seg := strings.SplitN(p, "/", 2)[0]
	if seg == "" {
		return "ADMIN"
	}
	return strings.ToUpper(strings.ReplaceAll(seg, "-", "_"))
}

func inferActionFromMethod(method string) string {
	switch method {
	case http.MethodPost:
		return "CREATE"
	case http.MethodPut, http.MethodPatch:
		return "UPDATE"
	case http.MethodDelete:
		return "DELETE"
	default:
		return method
	}
}

func clientIP(r *http.Request) string {
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func adminAuditMiddleware(platformURL, jwtSecret string) func(http.Handler) http.Handler {
	tokens := auth.NewTokenManager(jwtSecret, 24*time.Hour, 30*24*time.Hour)
	ch := make(chan adminAuditEvent, 1024)
	endpoint := strings.TrimRight(platformURL, "/") + "/internal/admin-audit"
	client := &http.Client{Timeout: 3 * time.Second}

	go func() {
		for ev := range ch {
			body, err := json.Marshal(ev)
			if err != nil {
				continue
			}
			req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
			if err != nil {
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			resp, err := client.Do(req)
			if err == nil && resp != nil {
				_, _ = io.Copy(io.Discard, resp.Body)
				_ = resp.Body.Close()
			}
		}
	}()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodPost && r.Method != http.MethodPut && r.Method != http.MethodPatch && r.Method != http.MethodDelete {
				next.ServeHTTP(w, r)
				return
			}
			norm := normalizePath(r.URL.Path)
			if !strings.HasPrefix(norm, "/admin/") && !strings.HasPrefix(norm, "/backup/") {
				next.ServeHTTP(w, r)
				return
			}

			var payloadPreview string
			ct := strings.ToLower(r.Header.Get("Content-Type"))
			if strings.Contains(ct, "application/json") && r.Body != nil {
				raw, _ := io.ReadAll(io.LimitReader(r.Body, 16*1024))
				rest, _ := io.ReadAll(r.Body)
				full := append(raw, rest...)
				r.Body = io.NopCloser(bytes.NewReader(full))
				payloadPreview = sanitizePayloadPreview(raw)
			}

			actorEmail := "admin"
			var actorID int64
			if authHdr := r.Header.Get("Authorization"); strings.HasPrefix(authHdr, "Bearer ") {
				if claims, err := tokens.Parse(strings.TrimSpace(strings.TrimPrefix(authHdr, "Bearer "))); err == nil && claims != nil {
					actorID = claims.UserID
					if claims.Email != "" {
						actorEmail = claims.Email
					} else if claims.Subject != "" {
						actorEmail = claims.Subject
					}
				}
			}

			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(rec, r)

			ev := adminAuditEvent{
				Action:     inferActionFromMethod(r.Method),
				Module:     inferModuleFromPath(norm),
				Method:     r.Method,
				Path:       norm,
				Status:     rec.status,
				LatencyMs:  time.Since(start).Milliseconds(),
				ActorEmail: actorEmail,
				ActorID:    actorID,
				IP:         clientIP(r),
				Payload:    payloadPreview,
				CreatedAt:  time.Now().UTC().Format(time.RFC3339),
			}
			select {
			case ch <- ev:
			default:
			}
		})
	}
}
