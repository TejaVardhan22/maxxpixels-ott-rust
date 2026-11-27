package platform

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

type Service struct {
	db      *gorm.DB
	cache   *cache.Store
	eventCh chan models.UserInteraction
}

func NewService(db *gorm.DB, cacheStore *cache.Store) *Service {
	s := &Service{
		db:      db,
		cache:   cacheStore,
		eventCh: make(chan models.UserInteraction, 4096),
	}
	go s.runEventBatchWriter()
	return s
}

// runEventBatchWriter coalesces high-concurrency analytics events into batched GORM inserts.
func (s *Service) runEventBatchWriter() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	batch := make([]models.UserInteraction, 0, 100)

	flush := func() {
		if len(batch) == 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_ = s.db.WithContext(ctx).CreateInBatches(batch, 100).Error
		cancel()
		batch = batch[:0]
	}

	for {
		select {
		case ev := <-s.eventCh:
			batch = append(batch, ev)
			if len(batch) >= 100 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

func (s *Service) EnqueueInteraction(ev models.UserInteraction) {
	if ev.CreatedAt.IsZero() {
		ev.CreatedAt = time.Now().UTC()
	}
	select {
	case s.eventCh <- ev:
	default:
		// drop gracefully under extreme burst rather than blocking HTTP goroutines
	}
}

func (s *Service) GetUserNotifications(ctx context.Context, userID int64) ([]map[string]any, error) {
	var rows []models.UserNotification
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(50).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return []map[string]any{}, nil
	}

	ids := make([]int64, 0, len(rows))
	for _, r := range rows {
		ids = append(ids, r.NotificationId)
	}
	var notifs []models.Notification
	_ = s.db.WithContext(ctx).Where("id IN ?", ids).Find(&notifs).Error
	byID := make(map[int64]models.Notification, len(notifs))
	for _, n := range notifs {
		byID[n.ID] = n
	}

	out := make([]map[string]any, 0, len(rows))
	for _, un := range rows {
		n := byID[un.NotificationId]
		out = append(out, map[string]any{
			"id":             un.ID,
			"notificationId": un.NotificationId,
			"title":          n.Title,
			"message":        n.Message,
			"imageUrl":       n.ImageUrl,
			"actionUrl":      n.ActionUrl,
			"channel":        n.Channel,
			"isRead":         un.IsRead != nil && *un.IsRead,
			"readAt":         un.ReadAt,
			"createdAt":      un.CreatedAt.Format(time.RFC3339),
		})
	}
	return out, nil
}

func (s *Service) GetUnreadCount(ctx context.Context, userID int64) (int64, error) {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.UserNotification{}).
		Where("user_id = ? AND COALESCE(is_read, FALSE) = FALSE", userID).
		Count(&count).Error
	return count, err
}

func (s *Service) MarkNotificationRead(ctx context.Context, userID, id int64) error {
	now := time.Now().UTC()
	return s.db.WithContext(ctx).Model(&models.UserNotification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]any{"is_read": true, "read_at": now}).Error
}

func (s *Service) MarkAllNotificationsRead(ctx context.Context, userID int64) (int64, error) {
	now := time.Now().UTC()
	res := s.db.WithContext(ctx).Model(&models.UserNotification{}).
		Where("user_id = ? AND COALESCE(is_read, FALSE) = FALSE", userID).
		Updates(map[string]any{"is_read": true, "read_at": now})
	return res.RowsAffected, res.Error
}

func (s *Service) ClearAllNotifications(ctx context.Context, userID int64) (int64, error) {
	res := s.db.WithContext(ctx).Where("user_id = ?", userID).Delete(&models.UserNotification{})
	return res.RowsAffected, res.Error
}

func (s *Service) GetPublicSettings(ctx context.Context) (map[string]any, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "platform:public_settings", 30*time.Second, func(c context.Context) (map[string]any, error) {
		var rows []models.SystemSetting
		if err := s.db.WithContext(c).
			Where("COALESCE(is_secret, FALSE) = FALSE").
			Find(&rows).Error; err != nil {
			return nil, err
		}
		kv := make(map[string]string, len(rows))
		for _, r := range rows {
			if r.SettingValue != nil {
				kv[r.SettingKey] = *r.SettingValue
			}
		}
		maintActive := strings.EqualFold(kv["maintenance_mode"], "true") || kv["maintenance_mode"] == "1"
		maintPayload := map[string]any{
			"active":  maintActive,
			"message": nonEmpty(kv["maintenance_message"], "We are performing scheduled maintenance. Please check back shortly."),
			"appName": nonEmpty(kv["app_name"], "MaxxPixels"),
			"logoUrl": kv["app_logo_url"],
		}
		if b, err := json.Marshal(maintPayload); err == nil {
			_ = s.cache.Set(c, "maxx:maintenance_mode", string(b), 60*time.Second)
		}
		return map[string]any{
			"settings":    kv,
			"maintenance": maintPayload,
		}, nil
	})
}

func (s *Service) AdminUpdateSettings(ctx context.Context, updates map[string]string, updatedBy string) error {
	now := time.Now().UTC()
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for k, v := range updates {
			val := v
			res := tx.Model(&models.SystemSetting{}).
				Where("setting_key = ?", k).
				Updates(map[string]any{"setting_value": val, "updated_at": now, "updated_by": updatedBy})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				if err := tx.Create(&models.SystemSetting{
					SettingKey:   k,
					SettingValue: &val,
					UpdatedAt:    now,
					UpdatedBy:    &updatedBy,
				}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err == nil {
		_ = s.cache.Del(ctx, "platform:public_settings", "maxx:maintenance_mode")
		_, _ = s.GetPublicSettings(ctx)
	}
	return err
}

func (s *Service) ListLegalPages(ctx context.Context) ([]models.LegalPage, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "platform:legal_pages", 120*time.Second, func(c context.Context) ([]models.LegalPage, error) {
		var pages []models.LegalPage
		err := s.db.WithContext(c).Where("COALESCE(is_active, TRUE) = TRUE").Order("id ASC").Find(&pages).Error
		return pages, err
	})
}

func (s *Service) GetDashboardOverview(ctx context.Context) (map[string]any, error) {
	var totalUsers, activeSubs, publishedContent, totalInteractions int64
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error { return s.db.WithContext(gctx).Model(&models.User{}).Count(&totalUsers).Error })
	g.Go(func() error {
		return s.db.WithContext(gctx).Model(&models.Subscription{}).
			Where("status = 'ACTIVE' AND end_date > ?", time.Now().UTC()).
			Count(&activeSubs).Error
	})
	g.Go(func() error {
		return s.db.WithContext(gctx).Model(&models.Content{}).
			Where("UPPER(status) IN ('PUBLISHED', 'ACTIVE')").
			Count(&publishedContent).Error
	})
	g.Go(func() error {
		return s.db.WithContext(gctx).Model(&models.UserInteraction{}).Count(&totalInteractions).Error
	})
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return map[string]any{
		"totalUsers":        totalUsers,
		"activeSubscribers": activeSubs,
		"publishedContent":  publishedContent,
		"totalInteractions": totalInteractions,
	}, nil
}

func nonEmpty(v, fallback string) string {
	if strings.TrimSpace(v) != "" {
		return v
	}
	return fallback
}
