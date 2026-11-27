package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/maxxpixels/go-api/internal/platform"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
	"gorm.io/gorm"
)

// worker-service replaces the 4 Rust background workers (billing, notifications, sessions, analytics)
// with bounded Go goroutine workers and graceful cancellation.
func main() {
	cfg, err := config.Load(8087)
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
	platSvc := platform.NewService(db, redisStore)

	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup

	// 1. Billing Expiry Worker (every 5 minutes)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, 5*time.Minute, "billing_worker", func(c context.Context) {
			now := time.Now().UTC()
			subRes := db.WithContext(c).Model(&models.Subscription{}).
				Where("status = 'ACTIVE' AND end_date < ?", now).
				Update("status", "EXPIRED")
			tvodRes := db.WithContext(c).Model(&models.ContentPurchase{}).
				Where("status = 'ACTIVE' AND expires_at IS NOT NULL AND expires_at < ?", now).
				Update("status", "EXPIRED")
			if subRes.RowsAffected > 0 || tvodRes.RowsAffected > 0 {
				slog.Info("expired entitlements", "subscriptions", subRes.RowsAffected, "tvod", tvodRes.RowsAffected)
			}
		})
	}()

	// 2. Stale Playback Session Cleanup Worker (every 2 minutes)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, 2*time.Minute, "session_cleanup_worker", func(c context.Context) {
			cutoff := time.Now().UTC().Add(-15 * time.Minute)
			res := db.WithContext(c).Model(&models.PlaybackSession{}).
				Where("COALESCE(is_active, TRUE) = TRUE AND COALESCE(last_heartbeat_at, started_at) < ?", cutoff).
				Updates(map[string]any{"is_active": false, "status": "ENDED"})
			if res.RowsAffected > 0 {
				slog.Info("closed stale playback sessions", "count", res.RowsAffected)
			}
		})
	}()

	// 3. Maintenance Mode & Settings Redis Sync Worker (every 30 seconds)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, 30*time.Second, "settings_sync_worker", func(c context.Context) {
			_, _ = platSvc.GetPublicSettings(c)
		})
	}()

	// 4. Scheduled Notification Fan-out Worker (every 1 minute)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, time.Minute, "notification_worker", func(c context.Context) {
			dispatchScheduledNotifications(c, db)
		})
	}()

	// Lightweight health probe HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{"status": "UP", "service": "worker-service", "db": database.HealthCheck(r.Context(), db) == nil})
	})
	srv := &http.Server{Addr: fmt.Sprintf("%s:%d", cfg.Host, cfg.Port), Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		slog.Info("worker-service health probe listening", "addr", srv.Addr)
		_ = srv.ListenAndServe()
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	slog.Info("shutting down worker-service...")
	cancel()
	wg.Wait()
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutCancel()
	_ = srv.Shutdown(shutCtx)
	slog.Info("worker-service stopped cleanly")
}

func runPeriodic(ctx context.Context, interval time.Duration, name string, fn func(context.Context)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	fn(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			tCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
			fn(tCtx)
			cancel()
		}
	}
}

func dispatchScheduledNotifications(ctx context.Context, db *gorm.DB) {
	now := time.Now().UTC()
	var due []models.Notification
	if err := db.WithContext(ctx).
		Where("UPPER(COALESCE(status, '')) = 'SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= ?", now).
		Limit(20).
		Find(&due).Error; err != nil || len(due) == 0 {
		return
	}

	var userIDs []int64
	_ = db.WithContext(ctx).Model(&models.User{}).Where("UPPER(status) = 'ACTIVE'").Pluck("id", &userIDs).Error
	for _, n := range due {
		if len(userIDs) > 0 {
			isRead := false
			batch := make([]models.UserNotification, 0, len(userIDs))
			for _, uid := range userIDs {
				batch = append(batch, models.UserNotification{
					UserId:         uid,
					NotificationId: n.ID,
					IsRead:         &isRead,
					CreatedAt:      now,
				})
			}
			_ = db.WithContext(ctx).CreateInBatches(batch, 500).Error
		}
		_ = db.WithContext(ctx).Model(&models.Notification{}).Where("id = ?", n.ID).
			Updates(map[string]any{"status": "SENT", "sent_at": now}).Error
		slog.Info("dispatched scheduled notification", "notification_id", n.ID, "recipients", len(userIDs))
	}
}
