package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	TopicContentViews  = "ott.content.views"
	TopicWatchHistory  = "ott.watch.history"
	TopicPayments      = "ott.payments"
	TopicNotifications = "ott.notifications"
)

// Event represents a row in outbox_events.
type Event struct {
	ID            int64      `gorm:"column:id;primaryKey" json:"id"`
	AggregateType string     `gorm:"column:aggregate_type" json:"aggregateType"`
	AggregateID   string     `gorm:"column:aggregate_id" json:"aggregateId"`
	Topic         string     `gorm:"column:topic" json:"topic"`
	EventType     string     `gorm:"column:event_type" json:"eventType"`
	Payload       string     `gorm:"column:payload;type:jsonb" json:"payload"`
	Status        string     `gorm:"column:status" json:"status"`
	Attempts      int        `gorm:"column:attempts" json:"attempts"`
	MaxAttempts   int        `gorm:"column:max_attempts" json:"maxAttempts"`
	LastError     *string    `gorm:"column:last_error" json:"lastError,omitempty"`
	NextRetryAt   time.Time  `gorm:"column:next_retry_at" json:"nextRetryAt"`
	PublishedAt   *time.Time `gorm:"column:published_at" json:"publishedAt,omitempty"`
	CreatedAt     time.Time  `gorm:"column:created_at" json:"createdAt"`
}

func (Event) TableName() string { return "outbox_events" }

// ServiceLog represents a centralized log row in service_logs.
type ServiceLog struct {
	ID         int64     `gorm:"column:id;primaryKey" json:"id"`
	Service    string    `gorm:"column:service" json:"service"`
	Level      string    `gorm:"column:level" json:"level"`
	RequestID  *string   `gorm:"column:request_id" json:"requestId,omitempty"`
	UserID     *int64    `gorm:"column:user_id" json:"userId,omitempty"`
	Method     *string   `gorm:"column:method" json:"method,omitempty"`
	Path       *string   `gorm:"column:path" json:"path,omitempty"`
	Status     *int      `gorm:"column:status" json:"status,omitempty"`
	DurationMs *int64    `gorm:"column:duration_ms" json:"durationMs,omitempty"`
	Message    string    `gorm:"column:message" json:"message"`
	Metadata   *string   `gorm:"column:metadata;type:jsonb" json:"metadata,omitempty"`
	CreatedAt  time.Time `gorm:"column:created_at" json:"createdAt"`
}

func (ServiceLog) TableName() string { return "service_logs" }

// NotificationTemplate represents an editable template in notification_templates.
type NotificationTemplate struct {
	ID            int64     `gorm:"column:id;primaryKey" json:"id"`
	Code          string    `gorm:"column:code" json:"code"`
	Name          string    `gorm:"column:name" json:"name"`
	Channel       string    `gorm:"column:channel" json:"channel"`
	TitleTemplate string    `gorm:"column:title_template" json:"titleTemplate"`
	BodyTemplate  string    `gorm:"column:body_template" json:"bodyTemplate"`
	ActionURL     string    `gorm:"column:action_url" json:"actionUrl"`
	IsActive      bool      `gorm:"column:is_active" json:"isActive"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"createdAt"`
	UpdatedAt     time.Time `gorm:"column:updated_at" json:"updatedAt"`
}

func (NotificationTemplate) TableName() string { return "notification_templates" }

// Enqueue writes a transactional outbox event into outbox_events (pass tx or db).
func Enqueue(ctx context.Context, db *gorm.DB, topic, aggregateType, aggregateID, eventType string, payload any) error {
	if db == nil {
		return nil
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	ev := Event{
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		Topic:         topic,
		EventType:     eventType,
		Payload:       string(raw),
		Status:        "PENDING",
		Attempts:      0,
		MaxAttempts:   5,
		NextRetryAt:   now,
		CreatedAt:     now,
	}
	if err := db.WithContext(ctx).Create(&ev).Error; err != nil {
		slog.Warn("outbox enqueue failed", "topic", topic, "eventType", eventType, "err", err)
		return err
	}
	return nil
}

// RecordLog persists a structured log entry into service_logs asynchronously so HTTP latency is unaffected.
func RecordLog(db *gorm.DB, entry ServiceLog) {
	if db == nil {
		return
	}
	if entry.CreatedAt.IsZero() {
		entry.CreatedAt = time.Now().UTC()
	}
	if entry.Level == "" {
		entry.Level = "INFO"
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = db.WithContext(ctx).Create(&entry).Error
	}()
}

// RenderTemplate substitutes {{key}} placeholders in notification templates.
func RenderTemplate(tpl string, vars map[string]string) string {
	out := tpl
	for k, v := range vars {
		out = strings.ReplaceAll(out, "{{"+k+"}}", v)
	}
	return out
}
