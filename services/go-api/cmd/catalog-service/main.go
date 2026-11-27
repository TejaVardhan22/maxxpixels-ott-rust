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
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

func main() {
	cfg, err := config.Load(8082)
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
	svc := catalog.NewService(db, redisStore, cfg.PublicBaseURL)
	handler := catalog.NewHandler(svc, tokens)

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.RequestID)
	r.Use(httpx.SecurityHeaders)
	r.Use(httpx.AccessLogger("catalog-service"))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{
			"status":  "UP",
			"service": "catalog-service",
			"db":      database.HealthCheck(r.Context(), db) == nil,
			"redis":   redisStore.Ping(r.Context()) == nil,
		})
	})

	handler.RegisterRoutes(r)

	srv := &http.Server{
		Addr:              fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		slog.Info("catalog-service listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("catalog-service failed", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
	slog.Info("catalog-service stopped cleanly")
}
