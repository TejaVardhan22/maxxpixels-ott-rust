package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

func main() {
	cfg, err := config.Load(8080)
	if err != nil {
		slog.Error("failed to load config", "err", err)
		os.Exit(1)
	}

	redisStore := cache.New(cfg.RedisURL)

	transport := &http.Transport{
		MaxIdleConns:          500,
		MaxIdleConnsPerHost:   100,
		MaxConnsPerHost:       200,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ForceAttemptHTTP2:     true,
	}

	newProxy := func(rawURL string) http.Handler {
		target, err := url.Parse(rawURL)
		if err != nil {
			slog.Error("invalid upstream url", "url", rawURL, "err", err)
			os.Exit(1)
		}
		p := httputil.NewSingleHostReverseProxy(target)
		p.Transport = transport
		p.ErrorHandler = func(w http.ResponseWriter, r *http.Request, e error) {
			slog.Warn("upstream proxy error", "target", rawURL, "path", r.URL.Path, "err", e)
			httpx.Error(w, http.StatusBadGateway, "Upstream microservice temporarily unavailable", "UPSTREAM_UNAVAILABLE")
		}
		return p
	}

	identityProxy := newProxy(cfg.IdentityServiceURL)
	catalogProxy := newProxy(cfg.CatalogServiceURL)
	streamingProxy := newProxy(cfg.StreamingServiceURL)
	commerceProxy := newProxy(cfg.CommerceServiceURL)
	monetizationProxy := newProxy(cfg.MonetizationServiceURL)
	platformProxy := newProxy(cfg.PlatformServiceURL)
	gamesProxy := newProxy(cfg.GamesServiceURL)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.RequestID)
	r.Use(httpx.CORSMiddleware(cfg.CORSAllowedOrigins))
	r.Use(httpx.SecurityHeaders)
	r.Use(httpx.AccessLogger("api-gateway"))
	r.Use(maintenanceMiddleware(redisStore))

	// Health & Observability aliases (NestJS / Spring / Rust parity)
	pingFn := func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{"pong": true, "engine": "go-microservices"})
	}
	healthFn := func(w http.ResponseWriter, r *http.Request) {
		redisOK := redisStore.Ping(r.Context()) == nil
		httpx.OK(w, map[string]any{
			"status":  "UP",
			"service": "api-gateway",
			"redis":   redisOK,
			"ts":      time.Now().UTC().Format(time.RFC3339),
		})
	}
	for _, p := range []string{"/ping", "/api/ping", "/api/v1/ping"} {
		r.Get(p, pingFn)
	}
	for _, p := range []string{"/health", "/api/health", "/api/v1/health", "/actuator/health", "/api/actuator/health", "/api/v1/actuator/health"} {
		r.Get(p, healthFn)
	}
	startedAt := time.Now().UTC()
	metricsFn := func(w http.ResponseWriter, r *http.Request) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		_, _ = fmt.Fprintf(w,
			"# HELP maxx_uptime_seconds Gateway uptime in seconds\n# TYPE maxx_uptime_seconds gauge\nmaxx_uptime_seconds %.2f\n"+
				"# HELP maxx_goroutines Current number of goroutines\n# TYPE maxx_goroutines gauge\nmaxx_goroutines %d\n"+
				"# HELP maxx_memory_alloc_bytes Allocated heap bytes\n# TYPE maxx_memory_alloc_bytes gauge\nmaxx_memory_alloc_bytes %d\n",
			time.Since(startedAt).Seconds(), runtime.NumGoroutine(), mem.Alloc,
		)
	}
	r.Get("/metrics", metricsFn)
	r.Get("/prometheus", metricsFn)

	// Prefix-agnostic microservice dispatcher (supports /api/v1/*, /api/*, and /*)
	r.HandleFunc("/*", func(w http.ResponseWriter, req *http.Request) {
		norm := normalizePath(req.URL.Path)
		switch {
		case hasAnyPrefix(norm, "/auth", "/me", "/profile", "/profiles", "/devices", "/referrals", "/admin/users"):
			identityProxy.ServeHTTP(w, req)
		case hasAnyPrefix(norm, "/catalog", "/content", "/contents", "/search", "/cms/banners", "/cms/sections", "/cms/portal-banners", "/cms/intro-video", "/home-content", "/graphql", "/categories", "/genres", "/languages", "/content-types", "/types", "/banners", "/sections", "/movies", "/series", "/seasons", "/episodes", "/live", "/live-channels", "/storage", "/uploads", "/posters", "/branding", "/intro-video", "/intro-videos", "/portal-banners", "/admin/movies", "/admin/series", "/admin/live", "/admin/live-channels", "/admin/storage", "/admin/intro-video", "/admin/intro-videos", "/admin/portal-banners"):
			catalogProxy.ServeHTTP(w, req)
		case hasAnyPrefix(norm, "/playback", "/video", "/watch", "/watch-history", "/watchlist"):
			streamingProxy.ServeHTTP(w, req)
		case hasAnyPrefix(norm, "/subscriptions", "/subscription-plans", "/payments", "/coupons", "/tvod", "/plans", "/orders", "/admin/plans", "/admin/coupons", "/admin/payments"):
			commerceProxy.ServeHTTP(w, req)
		case hasAnyPrefix(norm, "/ads", "/ads.txt", "/app-ads.txt", "/vast", "/producers", "/producer", "/marketing", "/admin/ads", "/admin/advertisements", "/admin/producers", "/admin/marketing", "/admin/content/submissions"):
			monetizationProxy.ServeHTTP(w, req)
		case hasAnyPrefix(norm, "/games"):
			gamesProxy.ServeHTTP(w, req)
		default:
			platformProxy.ServeHTTP(w, req)
		}
	})

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       300 * time.Second,
		WriteTimeout:      300 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("api-gateway listening", "addr", srv.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("api-gateway failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	slog.Info("api-gateway stopped cleanly")
}

func normalizePath(p string) string {
	switch {
	case strings.HasPrefix(p, "/api/v1/"):
		return p[len("/api/v1"):]
	case strings.HasPrefix(p, "/api/"):
		return p[len("/api"):]
	default:
		return p
	}
}

func hasAnyPrefix(p string, prefixes ...string) bool {
	for _, pref := range prefixes {
		if p == pref || strings.HasPrefix(p, pref+"/") {
			return true
		}
	}
	return false
}

// maintenanceMiddleware returns 503 for consumer traffic when Redis maintenance flag is active.
func maintenanceMiddleware(store *cache.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			norm := normalizePath(r.URL.Path)
			if hasAnyPrefix(norm, "/health", "/ping", "/actuator", "/admin", "/auth/login", "/settings/public", "/system/maintenance") {
				next.ServeHTTP(w, r)
				return
			}
			if raw, ok := store.Get(r.Context(), "maxx:maintenance_mode"); ok && raw != "" && raw != "false" {
				var payload map[string]any
				if err := json.Unmarshal([]byte(raw), &payload); err == nil {
					if active, _ := payload["active"].(bool); active {
						httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]any{
							"success":     false,
							"status":      http.StatusServiceUnavailable,
							"code":        "MAINTENANCE_MODE",
							"maintenance": payload,
							"message":     payload["message"],
						})
						return
					}
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}
