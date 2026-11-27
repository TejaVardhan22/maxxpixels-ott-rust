package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/maxxpixels/go-api/internal/catalog"
	"github.com/maxxpixels/go-api/internal/commerce"
	"github.com/maxxpixels/go-api/internal/identity"
	"github.com/maxxpixels/go-api/internal/monetization"
	"github.com/maxxpixels/go-api/internal/platform"
	"github.com/maxxpixels/go-api/internal/streaming"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

// all-in-one mounts all 6 Go microservices in a single high-concurrency binary for effortless
// local development (`make run-all`) while production deploys each service independently via Docker.
func main() {
	cfg, err := config.Load(8080)
	if err != nil {
		slog.Error("config load failed", "err", err)
		os.Exit(1)
	}
	db, err := database.Connect(cfg)
	if err != nil {
		slog.Error("database connect failed", "err", err)
		os.Exit(1)
	}

	redisStore := cache.New(cfg.RedisURL)
	tokens := auth.NewTokenManager(cfg.JWTSecret, cfg.JWTExpiration, cfg.JWTRefreshExpiration)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.RequestID)
	r.Use(httpx.CORSMiddleware(cfg.CORSAllowedOrigins))
	r.Use(httpx.SecurityHeaders)
	r.Use(httpx.AccessLogger("all-in-one"))

	pingFn := func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{"pong": true, "engine": "go-all-in-one"})
	}
	healthFn := func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{
			"status":  "UP",
			"service": "maxxpixels-go-all-in-one",
			"db":      database.HealthCheck(r.Context(), db) == nil,
			"redis":   redisStore.Ping(r.Context()) == nil,
		})
	}
	for _, p := range []string{"/ping", "/api/ping", "/api/v1/ping"} {
		r.Get(p, pingFn)
	}
	for _, p := range []string{"/health", "/api/health", "/api/v1/health", "/actuator/health"} {
		r.Get(p, healthFn)
	}

	// Register all 6 microservices on the unified router
	identity.NewHandler(identity.NewService(db, redisStore, tokens), tokens).RegisterRoutes(r)
	catalog.NewHandler(catalog.NewService(db, redisStore, cfg.PublicBaseURL)).RegisterRoutes(r)
	streaming.NewHandler(streaming.NewService(db, cfg), tokens).RegisterRoutes(r)
	commerce.NewHandler(commerce.NewService(db, redisStore, cfg), tokens).RegisterRoutes(r)
	monetization.NewHandler(monetization.NewService(db, redisStore, cfg.PublicBaseURL), tokens).RegisterRoutes(r)
	platform.NewHandler(platform.NewService(db, redisStore), tokens).RegisterRoutes(r)

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("maxxpixels Go all-in-one server listening", "addr", srv.Addr, "env", cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	slog.Info("all-in-one stopped cleanly")
}
