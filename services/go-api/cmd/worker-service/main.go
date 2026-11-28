package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/maxxpixels/go-api/internal/platform"
	"github.com/maxxpixels/go-api/pkg/backup"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/kafka"
	"github.com/maxxpixels/go-api/pkg/models"
	"github.com/maxxpixels/go-api/pkg/notify"
	"github.com/maxxpixels/go-api/pkg/outbox"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// worker-service runs all background workers with bounded concurrency and graceful shutdown:
// 1. Billing expiry worker (5m)
// 2. Stale playback session cleanup (2m)
// 3. Maintenance & settings Redis sync (30s)
// 4. Scheduled notifications fan-out (1m)
// 5. Daily plan-expiry push notifications with template rendering (1h, deduped 1/day/user)
// 6. Transactional Outbox Relay -> Kafka (2s, FOR UPDATE SKIP LOCKED + exponential backoff)
// 7. Kafka Consumers for ott.content.views, ott.watch.history, ott.payments (when KAFKA_ENABLED=true)
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
	kafkaPub := kafka.NewPublisher(cfg.KafkaEnabled, cfg.KafkaBrokers)
	defer kafkaPub.Close()

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

	// 5. Daily Plan-Expiry Push Notification Worker (checks every 1 hour; deduped to max 1/day/user/template)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, time.Hour, "plan_expiry_push_worker", func(c context.Context) {
			if _, _, err := platform.RunDailyExpiryNotifications(c, db); err != nil {
				slog.Warn("plan_expiry_push_worker error", "err", err)
			}
		})
	}()

	// 5b. Daily Automated Full SQL Database Backup -> Bunny.net Storage (all project databases)
	if !strings.EqualFold(os.Getenv("DB_BACKUP_ENABLED"), "false") {
		wg.Add(1)
		go func() {
			defer wg.Done()
			backupHour := 2 // Default 02:00 UTC (07:30 IST)
			if raw := strings.TrimSpace(os.Getenv("DB_BACKUP_HOUR_UTC")); raw != "" {
				if h, err := strconv.Atoi(raw); err == nil && h >= 0 && h <= 23 {
					backupHour = h
				}
			}
			var lastBackupDay string
			runPeriodic(ctx, 30*time.Minute, "daily_db_backup_worker", func(c context.Context) {
				now := time.Now().UTC()
				today := now.Format("2006-01-02")
				if lastBackupDay == today || now.Hour() < backupHour {
					return
				}
				results, err := backup.RunAllDatabasesBackup(c, db, "./backups")
				if err != nil {
					slog.Error("daily_db_backup_worker failed", "err", err)
					return
				}
				lastBackupDay = today
				slog.Info("daily_db_backup_worker completed", "databases", len(results))
			})
		}()
	}

	// 6. Transactional Outbox Relay Worker (every 2 seconds -> Kafka or local audit)
	wg.Add(1)
	go func() {
		defer wg.Done()
		runPeriodic(ctx, 2*time.Second, "outbox_relay_worker", func(c context.Context) {
			relayOutboxBatch(c, db, kafkaPub)
		})
	}()

	// 7. Kafka Consumers (when KAFKA_ENABLED=true) — idempotent DB persistence for views, watch history & payments
	if cfg.KafkaEnabled && len(cfg.KafkaBrokers) > 0 {
		for _, topic := range []string{outbox.TopicContentViews, outbox.TopicWatchHistory, outbox.TopicPayments} {
			t := topic
			wg.Add(1)
			go func() {
				defer wg.Done()
				kafka.ConsumeTopic(ctx, cfg.KafkaBrokers, cfg.KafkaConsumerGroup, t, func(c context.Context, key string, val []byte) error {
					return handleKafkaEvent(c, db, t, key, val)
				})
			}()
		}
	}

	// Lightweight health & Prometheus metrics probe HTTP server
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, map[string]any{
			"status":       "UP",
			"service":      "worker-service",
			"db":           database.HealthCheck(r.Context(), db) == nil,
			"kafkaEnabled": kafkaPub.Enabled(),
		})
	})
	mux.HandleFunc("/metrics", httpx.MetricsHandler("worker-service"))
	srv := &http.Server{Addr: fmt.Sprintf("%s:%d", cfg.Host, cfg.Port), Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		slog.Info("worker-service health probe listening", "addr", srv.Addr, "kafka_enabled", kafkaPub.Enabled())
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

func handleKafkaEvent(ctx context.Context, db *gorm.DB, topic, key string, val []byte) error {
	switch topic {
	case outbox.TopicContentViews:
		var ev struct {
			EventID   string `json:"eventId"`
			ContentID int64  `json:"contentId"`
			UserID    *int64 `json:"userId"`
			ViewerKey string `json:"viewerKey"`
		}
		if err := json.Unmarshal(val, &ev); err != nil || ev.ContentID <= 0 || ev.EventID == "" {
			return nil
		}
		now := time.Now().UTC()
		viewRow := outbox.ContentViewEvent{
			EventID:   ev.EventID,
			ContentID: ev.ContentID,
			UserID:    ev.UserID,
			ViewerKey: ev.ViewerKey,
			SessionID: ev.EventID,
			EventType: "start",
			CreatedAt: now,
		}
		res := db.WithContext(ctx).
			Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "event_id"}}, DoNothing: true}).
			Create(&viewRow)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected > 0 {
			_ = db.WithContext(ctx).Model(&models.Content{}).Where("id = ?", ev.ContentID).Updates(map[string]any{
				"view_count": gorm.Expr("COALESCE(view_count, 0) + 1"),
				"updated_at": now,
			}).Error
		}
		return nil

	case outbox.TopicWatchHistory:
		var ev struct {
			UserID          int64   `json:"userId"`
			ContentID       int64   `json:"contentId"`
			EpisodeID       *int64  `json:"episodeId"`
			PositionSeconds int32   `json:"positionSeconds"`
			DurationSeconds int32   `json:"durationSeconds"`
			Percentage      float64 `json:"percentage"`
			Completed       bool    `json:"completed"`
		}
		if err := json.Unmarshal(val, &ev); err != nil || ev.UserID <= 0 || ev.ContentID <= 0 {
			return nil
		}
		now := time.Now().UTC()
		res := db.WithContext(ctx).Model(&models.WatchHistory{}).
			Where("user_id = ? AND content_id = ?", ev.UserID, ev.ContentID).
			Updates(map[string]any{
				"episode_id":             ev.EpisodeID,
				"position_seconds":       ev.PositionSeconds,
				"duration_seconds":       ev.DurationSeconds,
				"watched_seconds":        ev.PositionSeconds,
				"total_duration_seconds": ev.DurationSeconds,
				"percentage":             ev.Percentage,
				"completed":              ev.Completed,
				"is_completed":           ev.Completed,
				"last_watched_at":        now,
			})
		if res.Error != nil {
			return res.Error
		}
		return nil

	case outbox.TopicPayments:
		outbox.RecordLog(db, outbox.ServiceLog{
			Service: "kafka-consumer",
			Level:   "INFO",
			Message: fmt.Sprintf("processed kafka payment event key=%s", key),
		})
		return nil
	}
	return nil
}

func relayOutboxBatch(ctx context.Context, db *gorm.DB, pub *kafka.Publisher) {
	now := time.Now().UTC()
	tx := db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return
	}

	var events []outbox.Event
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("status = ? AND next_retry_at <= ?", "PENDING", now).
		Order("id ASC").
		Limit(100).
		Find(&events).Error; err != nil || len(events) == 0 {
		tx.Rollback()
		return
	}

	// Fan out network publishes (Kafka + Zapier) in parallel across a bounded 10-worker pool
	type publishResult struct {
		ev  outbox.Event
		err error
	}
	results := make([]publishResult, len(events))
	var g errgroup.Group
	g.SetLimit(10)
	for i, ev := range events {
		idx, item := i, ev
		g.Go(func() error {
			var pErr error
			if pub.Enabled() {
				pErr = pub.Publish(ctx, item.Topic, item.AggregateID, []byte(item.Payload))
			}
			if pErr == nil {
				if zErr := outbox.ForwardToZapier(ctx, item); zErr != nil {
					slog.Warn("zapier webhook dispatch failed", "eventId", item.ID, "topic", item.Topic, "err", zErr)
				}
			}
			results[idx] = publishResult{ev: item, err: pErr}
			return nil
		})
	}
	_ = g.Wait()

	for _, r := range results {
		if r.err != nil {
			attempts := r.ev.Attempts + 1
			status := "PENDING"
			if attempts >= r.ev.MaxAttempts {
				status = "FAILED"
			}
			backoff := time.Duration(1<<min(attempts, 6)) * 5 * time.Second
			errMsg := r.err.Error()
			_ = tx.Model(&outbox.Event{}).Where("id = ?", r.ev.ID).Updates(map[string]any{
				"attempts":      attempts,
				"status":        status,
				"last_error":    errMsg,
				"next_retry_at": now.Add(backoff),
			}).Error
			outbox.RecordLog(db, outbox.ServiceLog{
				Service: "worker-service",
				Level:   "ERROR",
				Message: fmt.Sprintf("outbox kafka publish failed (topic=%s, id=%d): %s", r.ev.Topic, r.ev.ID, errMsg),
			})
			continue
		}
		_ = tx.Model(&outbox.Event{}).Where("id = ?", r.ev.ID).Updates(map[string]any{
			"status":       "PUBLISHED",
			"attempts":     r.ev.Attempts + 1,
			"published_at": now,
		}).Error
	}
	_ = tx.Commit().Error
}

func dispatchScheduledNotifications(ctx context.Context, db *gorm.DB) {
	now := time.Now().UTC()
	var due []models.Notification
	if err := db.WithContext(ctx).
		Where("UPPER(COALESCE(status, '')) = 'SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= ?", now).
		Limit(50).
		Find(&due).Error; err != nil || len(due) == 0 {
		return
	}

	fcm := notify.NewFCMFromEnv()
	var userIDs []int64
	_ = db.WithContext(ctx).Model(&models.User{}).Where("UPPER(status) = 'ACTIVE'").Limit(5000).Pluck("id", &userIDs).Error

	for _, n := range due {
		channel := "PUSH"
		if n.Channel != nil && *n.Channel != "" {
			channel = strings.ToUpper(*n.Channel)
		}
		imgURL := ""
		if n.ImageUrl != nil {
			imgURL = *n.ImageUrl
		}
		actURL := ""
		if n.ActionUrl != nil {
			actURL = *n.ActionUrl
		}

		if channel == "PUSH" || channel == "FCM" {
			if n.TargetUserId != nil && *n.TargetUserId != "" {
				if uid, err := strconv.ParseInt(*n.TargetUserId, 10, 64); err == nil {
					var devs []models.Device
					_ = db.WithContext(ctx).Where("user_id = ? AND fcm_token IS NOT NULL AND fcm_token <> ''", uid).Find(&devs).Error
					for _, d := range devs {
						if d.FcmToken != nil {
							_ = fcm.SendToTarget(ctx, *d.FcmToken, n.Title, n.Message, imgURL, actURL)
						}
					}
				}
			} else {
				topic := "all_users"
				if n.TargetAudience != nil && strings.TrimSpace(*n.TargetAudience) != "" {
					t := strings.ToUpper(strings.TrimSpace(*n.TargetAudience))
					if t != "ALL" && t != "ALL_USERS" && t != "EVERYONE" {
						topic = strings.ToLower(t)
					}
				}
				_ = fcm.SendToTarget(ctx, "/topics/"+topic, n.Title, n.Message, imgURL, actURL)
			}
		}

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
			Updates(map[string]any{"status": "SENT", "sent_at": now, "sent_count": len(userIDs)}).Error
		slog.Info("dispatched scheduled notification", "notification_id", n.ID, "recipients", len(userIDs), "fcm_configured", fcm.IsConfigured())
	}
}
