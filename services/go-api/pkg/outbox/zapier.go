package outbox

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

var zapierClient = &http.Client{Timeout: 8 * time.Second}

// ForwardToZapier sends an outbox event to a configured Zapier Catch Hook URL (from .env).
// Supports topic-specific hooks (ZAPIER_PAYMENTS_WEBHOOK_URL, ZAPIER_EXPIRY_WEBHOOK_URL)
// or a single catch-all ZAPIER_WEBHOOK_URL.
func ForwardToZapier(ctx context.Context, ev Event) error {
	target := resolveZapierURL(ev.Topic, ev.EventType)
	if target == "" {
		return nil
	}

	var parsed any
	_ = json.Unmarshal([]byte(ev.Payload), &parsed)
	body, err := json.Marshal(map[string]any{
		"id":            ev.ID,
		"topic":         ev.Topic,
		"eventType":     ev.EventType,
		"aggregateType": ev.AggregateType,
		"aggregateId":   ev.AggregateID,
		"timestamp":     ev.CreatedAt.UTC().Format(time.RFC3339),
		"data":          parsed,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, target, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MaxxPixels-Topic", ev.Topic)
	req.Header.Set("X-MaxxPixels-Event", ev.EventType)

	resp, err := zapierClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("zapier webhook returned HTTP %d", resp.StatusCode)
	}
	return nil
}

func resolveZapierURL(topic, eventType string) string {
	switch topic {
	case TopicPayments:
		if u := strings.TrimSpace(os.Getenv("ZAPIER_PAYMENTS_WEBHOOK_URL")); u != "" {
			return u
		}
	case TopicNotifications:
		if u := strings.TrimSpace(os.Getenv("ZAPIER_EXPIRY_WEBHOOK_URL")); u != "" {
			return u
		}
	}
	// Never spam Zapier with high-volume playback heartbeats unless explicitly configured
	if topic == TopicContentViews || topic == TopicWatchHistory {
		return strings.TrimSpace(os.Getenv("ZAPIER_VIEWS_WEBHOOK_URL"))
	}
	return strings.TrimSpace(os.Getenv("ZAPIER_WEBHOOK_URL"))
}
