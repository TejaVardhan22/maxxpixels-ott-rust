package platform

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
	"github.com/maxxpixels/go-api/pkg/notify"
	"github.com/maxxpixels/go-api/pkg/outbox"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ---------------------------------------------------------------------------
// 1. Centralized Service Logs (GET /api/v1/admin/logs)
// ---------------------------------------------------------------------------

func (h *Handler) adminListServiceLogs(w http.ResponseWriter, r *http.Request) {
	q := h.svc.db.WithContext(r.Context()).Model(&outbox.ServiceLog{})
	if svc := strings.TrimSpace(r.URL.Query().Get("service")); svc != "" {
		q = q.Where("service = ?", svc)
	}
	if lvl := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("level"))); lvl != "" {
		q = q.Where("UPPER(level) = ?", lvl)
	}
	if reqID := strings.TrimSpace(r.URL.Query().Get("requestId")); reqID != "" {
		q = q.Where("request_id = ?", reqID)
	}
	if search := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q"))); search != "" {
		like := "%" + search + "%"
		q = q.Where("LOWER(message) LIKE ? OR LOWER(path) LIKE ?", like, like)
	}
	limit := 100
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 500 {
		limit = l
	}

	var rows []outbox.ServiceLog
	_ = q.Order("created_at DESC").Limit(limit).Find(&rows).Error
	if rows == nil {
		rows = []outbox.ServiceLog{}
	}
	httpx.OK(w, map[string]any{
		"logs":  rows,
		"count": len(rows),
	})
}

// ---------------------------------------------------------------------------
// 2. Transactional Outbox Inspector & Retry (GET/POST /api/v1/admin/outbox)
// ---------------------------------------------------------------------------

func (h *Handler) adminListOutboxEvents(w http.ResponseWriter, r *http.Request) {
	q := h.svc.db.WithContext(r.Context()).Model(&outbox.Event{})
	if status := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("status"))); status != "" {
		q = q.Where("status = ?", status)
	}
	if topic := strings.TrimSpace(r.URL.Query().Get("topic")); topic != "" {
		q = q.Where("topic = ?", topic)
	}
	limit := 100
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 && l <= 500 {
		limit = l
	}
	var rows []outbox.Event
	_ = q.Order("id DESC").Limit(limit).Find(&rows).Error
	if rows == nil {
		rows = []outbox.Event{}
	}

	var pending, published, failed int64
	_ = h.svc.db.WithContext(r.Context()).Model(&outbox.Event{}).Where("status = 'PENDING'").Count(&pending).Error
	_ = h.svc.db.WithContext(r.Context()).Model(&outbox.Event{}).Where("status = 'PUBLISHED'").Count(&published).Error
	_ = h.svc.db.WithContext(r.Context()).Model(&outbox.Event{}).Where("status = 'FAILED'").Count(&failed).Error

	httpx.OK(w, map[string]any{
		"events": rows,
		"counts": map[string]int64{
			"pending":   pending,
			"published": published,
			"failed":    failed,
		},
	})
}

func (h *Handler) adminRetryOutboxEvents(w http.ResponseWriter, r *http.Request) {
	res := h.svc.db.WithContext(r.Context()).Model(&outbox.Event{}).
		Where("status = 'FAILED'").
		Updates(map[string]any{
			"status":        "PENDING",
			"attempts":      0,
			"next_retry_at": time.Now().UTC(),
		})
	httpx.OK(w, map[string]any{"requeued": res.RowsAffected})
}

// ---------------------------------------------------------------------------
// 3. Notification Templates CRUD (/api/v1/admin/notifications/templates)
// ---------------------------------------------------------------------------

func (h *Handler) adminListNotificationTemplates(w http.ResponseWriter, r *http.Request) {
	var rows []outbox.NotificationTemplate
	_ = h.svc.db.WithContext(r.Context()).Order("id ASC").Find(&rows).Error
	if rows == nil {
		rows = []outbox.NotificationTemplate{}
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertNotificationTemplate(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Code          string `json:"code"`
		Name          string `json:"name"`
		Channel       string `json:"channel"`
		TitleTemplate string `json:"titleTemplate"`
		BodyTemplate  string `json:"bodyTemplate"`
		ActionURL     string `json:"actionUrl"`
		IsActive      *bool  `json:"isActive"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	now := time.Now().UTC()
	channel := strings.ToUpper(strings.TrimSpace(body.Channel))
	if channel == "" {
		channel = "PUSH"
	}
	actionURL := strings.TrimSpace(body.ActionURL)
	if actionURL == "" {
		actionURL = "/plans"
	}
	isActive := true
	if body.IsActive != nil {
		isActive = *body.IsActive
	}

	if id > 0 {
		upd := map[string]any{
			"name":           body.Name,
			"channel":        channel,
			"title_template": body.TitleTemplate,
			"body_template":  body.BodyTemplate,
			"action_url":     actionURL,
			"is_active":      isActive,
			"updated_at":     now,
		}
		if strings.TrimSpace(body.Code) != "" {
			upd["code"] = strings.ToUpper(strings.TrimSpace(body.Code))
		}
		if err := h.svc.db.WithContext(r.Context()).Model(&outbox.NotificationTemplate{}).Where("id = ?", id).Updates(upd).Error; err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		var updated outbox.NotificationTemplate
		_ = h.svc.db.WithContext(r.Context()).First(&updated, id).Error
		httpx.OK(w, updated)
		return
	}

	row := outbox.NotificationTemplate{
		Code:          strings.ToUpper(strings.TrimSpace(body.Code)),
		Name:          strings.TrimSpace(body.Name),
		Channel:       channel,
		TitleTemplate: body.TitleTemplate,
		BodyTemplate:  body.BodyTemplate,
		ActionURL:     actionURL,
		IsActive:      isActive,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if row.Code == "" || row.TitleTemplate == "" || row.BodyTemplate == "" {
		httpx.Error(w, http.StatusBadRequest, "code, titleTemplate, and bodyTemplate are required")
		return
	}
	if err := h.svc.db.WithContext(r.Context()).Create(&row).Error; err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row)
}

func (h *Handler) adminDeleteNotificationTemplate(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.db.WithContext(r.Context()).Delete(&outbox.NotificationTemplate{}, id).Error
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminRunExpiryNotifications(w http.ResponseWriter, r *http.Request) {
	sent, skipped, err := RunDailyExpiryNotifications(r.Context(), h.svc.db)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{
		"sent":    sent,
		"skipped": skipped,
		"date":    time.Now().UTC().Format("2006-01-02"),
	})
}

// ---------------------------------------------------------------------------
// 4. Daily Plan-Expiry Push Notification Engine (used by worker-service + Admin)
// ---------------------------------------------------------------------------

type expiringSubRow struct {
	SubscriptionID int64
	UserID         int64
	UserName       string
	PlanName       string
	EndDate        time.Time
}

// RunDailyExpiryNotifications finds active subscriptions expiring within 7 days (or expired in last 24h),
// renders the matching template from notification_templates, sends FCM HTTP v1 push notifications,
// writes in-app notifications + ott.notifications outbox events, and guarantees max 1 push/user/template/day.
func RunDailyExpiryNotifications(ctx context.Context, db *gorm.DB) (sentCount int, skippedCount int, err error) {
	now := time.Now().UTC()
	todayDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	windowStart := now.Add(-24 * time.Hour)
	windowEnd := now.Add(7*24*time.Hour + 12*time.Hour)

	var subs []expiringSubRow
	err = db.WithContext(ctx).
		Table("subscriptions AS s").
		Select("s.id AS subscription_id, s.user_id, COALESCE(NULLIF(u.full_name, ''), NULLIF(u.email, ''), 'Subscriber') AS user_name, COALESCE(NULLIF(p.name, ''), 'Premium') AS plan_name, s.end_date").
		Joins("JOIN users AS u ON u.id = s.user_id").
		Joins("LEFT JOIN plans AS p ON p.id = s.plan_id").
		Where("s.end_date BETWEEN ? AND ?", windowStart, windowEnd).
		Where("UPPER(COALESCE(s.status, '')) IN ?", []string{"ACTIVE", "EXPIRED"}).
		Where("UPPER(COALESCE(u.status, 'ACTIVE')) = ?", "ACTIVE").
		Order("s.end_date ASC").
		Limit(2000).
		Scan(&subs).Error
	if err != nil {
		return 0, 0, err
	}
	if len(subs) == 0 {
		return 0, 0, nil
	}

	var tplRows []outbox.NotificationTemplate
	_ = db.WithContext(ctx).Where("is_active = ?", true).Find(&tplRows).Error
	tplByCode := make(map[string]outbox.NotificationTemplate, len(tplRows))
	for _, t := range tplRows {
		tplByCode[strings.ToUpper(t.Code)] = t
	}

	fcm := notify.NewFCMFromEnv()

	for _, sub := range subs {
		hoursLeft := sub.EndDate.Sub(now).Hours()
		daysLeft := int(math.Ceil(hoursLeft / 24.0))

		var code string
		switch {
		case hoursLeft <= 0:
			code = "PLAN_EXPIRED"
		case daysLeft <= 0 || hoursLeft <= 12:
			code = "PLAN_EXPIRING_TODAY"
		case daysLeft == 1:
			code = "PLAN_EXPIRING_1D"
		case daysLeft == 2:
			code = "PLAN_EXPIRING_2D"
		case daysLeft == 3:
			code = "PLAN_EXPIRING_3D"
		default:
			code = "PLAN_EXPIRING_7D"
		}

		tpl, ok := tplByCode[code]
		if !ok {
			skippedCount++
			continue
		}

		// Daily deduplication gate using pure GORM OnConflict (DB-agnostic)
		subID := sub.SubscriptionID
		dispatchRow := outbox.NotificationDispatchLog{
			UserID:         sub.UserID,
			SubscriptionID: &subID,
			TemplateCode:   code,
			Channel:        tpl.Channel,
			DispatchDate:   todayDate,
			Status:         "SENT",
			CreatedAt:      now,
		}
		res := db.WithContext(ctx).
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "user_id"}, {Name: "template_code"}, {Name: "dispatch_date"}},
				DoNothing: true,
			}).
			Create(&dispatchRow)
		if res.Error != nil || res.RowsAffected == 0 {
			skippedCount++
			continue
		}

		if daysLeft < 0 {
			daysLeft = 0
		}
		vars := map[string]string{
			"userName":   sub.UserName,
			"planName":   sub.PlanName,
			"daysLeft":   strconv.Itoa(daysLeft),
			"expiryDate": sub.EndDate.Format("02 Jan 2006"),
		}
		title := outbox.RenderTemplate(tpl.TitleTemplate, vars)
		body := outbox.RenderTemplate(tpl.BodyTemplate, vars)
		actionURL := tpl.ActionURL
		if actionURL == "" {
			actionURL = "/plans"
		}

		// 1. Send FCM HTTP v1 push to all active device tokens of the user
		var devs []models.Device
		_ = db.WithContext(ctx).
			Where("user_id = ? AND COALESCE(is_active, TRUE) = TRUE AND fcm_token IS NOT NULL AND fcm_token <> ''", sub.UserID).
			Find(&devs).Error
		for _, d := range devs {
			if d.FcmToken != nil {
				_ = fcm.SendToTarget(ctx, *d.FcmToken, title, body, "", actionURL)
			}
		}

		// 2. Persist in-app notification inbox entry
		channel := tpl.Channel
		status := "SENT"
		targetUID := strconv.FormatInt(sub.UserID, 10)
		sentOne := int32(1)
		notif := models.Notification{
			Title:        title,
			Message:      body,
			Channel:      &channel,
			Status:       &status,
			TargetUserId: &targetUID,
			ActionUrl:    &actionURL,
			SentAt:       &now,
			SentCount:    &sentOne,
			CreatedAt:    now,
		}
		if db.WithContext(ctx).Create(&notif).Error == nil {
			isRead := false
			_ = db.WithContext(ctx).Create(&models.UserNotification{
				UserId:         sub.UserID,
				NotificationId: notif.ID,
				IsRead:         &isRead,
				CreatedAt:      now,
			}).Error
		}

		// 3. Emit outbox event for Kafka audit/analytics
		_ = outbox.Enqueue(ctx, db, outbox.TopicNotifications, "subscription", fmt.Sprintf("%d", sub.SubscriptionID), "plan.expiry_notified", map[string]any{
			"userId":         sub.UserID,
			"subscriptionId": sub.SubscriptionID,
			"templateCode":   code,
			"title":          title,
			"daysLeft":       daysLeft,
			"expiryDate":     sub.EndDate.Format(time.RFC3339),
		})

		sentCount++
	}

	if sentCount > 0 {
		slog.Info("daily plan-expiry push notifications sent", "sent", sentCount, "skipped", skippedCount)
	}
	return sentCount, skippedCount, nil
}
