package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"gorm.io/gorm"
)

var sharedNotifyHTTP = &http.Client{
	Timeout: 20 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        64,
		MaxIdleConnsPerHost: 16,
		IdleConnTimeout:     90 * time.Second,
	},
}

// MSG91Client mirrors Rust's MSG91 Flow API + Direct OTP fallback 1:1.
type MSG91Client struct {
	AuthKey    string
	TemplateID string
	SenderID   string
}

func NewMSG91FromEnv() *MSG91Client {
	sender := strings.TrimSpace(os.Getenv("MSG91_SENDER_ID"))
	if sender == "" {
		sender = "MAXXOT"
	}
	return &MSG91Client{
		AuthKey:    strings.TrimSpace(os.Getenv("MSG91_AUTH_KEY")),
		TemplateID: strings.TrimSpace(os.Getenv("MSG91_TEMPLATE_ID")),
		SenderID:   sender,
	}
}

// NewMSG91FromDBAndEnv loads MSG91 credentials from PostgreSQL system_settings first,
// falling back to environment variables when unset.
func NewMSG91FromDBAndEnv(ctx context.Context, db *gorm.DB) *MSG91Client {
	client := NewMSG91FromEnv()
	if db == nil {
		return client
	}
	var rows []struct {
		Key   string `gorm:"column:k"`
		Value string `gorm:"column:v"`
	}
	_ = db.WithContext(ctx).Raw(`
		SELECT setting_key AS k, COALESCE(setting_value, '') AS v
		FROM system_settings
		WHERE LOWER(COALESCE(setting_key, '')) LIKE '%msg91%'
	`).Scan(&rows).Error

	kv := make(map[string]string, len(rows))
	for _, r := range rows {
		val := strings.TrimSpace(r.Value)
		if val == "" || val == "..." || strings.Contains(val, "****") {
			continue
		}
		kv[r.Key] = val
	}
	pick := func(keys ...string) string {
		for _, k := range keys {
			if v := kv[k]; v != "" {
				return v
			}
		}
		return ""
	}
	if v := pick("MSG91_AUTH_KEY", "msg91AuthKey", "msg91_auth_key", "msg91auth_key"); v != "" {
		client.AuthKey = v
	}
	if v := pick("MSG91_TEMPLATE_ID", "msg91OtpTemplateId", "msg91TemplateId", "msg91_template_id", "msg91template_id"); v != "" {
		client.TemplateID = v
	}
	if v := pick("MSG91_SENDER_ID", "msg91SenderId", "msg91_sender_id", "msg91sender_id"); v != "" {
		client.SenderID = v
	}
	return client
}

func (c *MSG91Client) IsConfigured() bool {
	return c.AuthKey != "" && c.TemplateID != ""
}

// FormatIndianMobile extracts digits and ensures 91<10-digit> format expected by MSG91.
func FormatIndianMobile(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	digits := b.String()
	if len(digits) >= 10 {
		return "91" + digits[len(digits)-10:]
	}
	return "91" + digits
}

// SendOTP dispatches OTP via MSG91 Flow API first, then falls back to MSG91 Direct OTP API.
func (c *MSG91Client) SendOTP(ctx context.Context, rawPhone, otp string) string {
	mobile := FormatIndianMobile(rawPhone)
	if !c.IsConfigured() {
		slog.Info("MSG91 dev/fallback mode (MSG91_AUTH_KEY or MSG91_TEMPLATE_ID unset)", "mobile", mobile)
		return "FALLBACK_LOGGER"
	}

	// 1. Primary: MSG91 Flow API
	payload := map[string]any{
		"template_id": c.TemplateID,
		"flow_id":     c.TemplateID,
		"sender":      c.SenderID,
		"short_url":   "0",
		"mobiles":     mobile,
		"otp":         otp,
		"OTP":         otp,
		"var1":        otp,
		"VAR1":        otp,
		"code":        otp,
		"recipients": []map[string]any{{
			"mobiles": mobile,
			"otp":     otp,
			"OTP":     otp,
			"var1":    otp,
			"VAR1":    otp,
			"code":    otp,
		}},
	}
	if ok := c.postFlow(ctx, payload); ok {
		slog.Info("OTP dispatched via MSG91 Flow API", "mobile", mobile, "sender", c.SenderID, "template_id", c.TemplateID)
		return "MSG91"
	}

	// 2. Fallback: MSG91 Direct OTP API
	q := url.Values{}
	q.Set("template_id", c.TemplateID)
	q.Set("mobile", mobile)
	q.Set("otp", otp)
	q.Set("authkey", c.AuthKey)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://control.msg91.com/api/v5/otp?"+q.Encode(), nil)
	if err == nil {
		req.Header.Set("accept", "application/json")
		if resp, err := sharedNotifyHTTP.Do(req); err == nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 && !isMSG91BodyError(body) {
				slog.Info("OTP dispatched via MSG91 Direct OTP fallback", "mobile", mobile)
				return "MSG91"
			}
			slog.Warn("MSG91 Direct OTP returned error", "status", resp.StatusCode, "body", truncateStr(string(body), 250))
		}
	}

	slog.Warn("All MSG91 routes exhausted; fallback verification active", "mobile", mobile)
	return "FALLBACK_AFTER_ERROR"
}

// SendSMS sends a transactional or promotional SMS via MSG91 Flow API to one or more numbers.
func (c *MSG91Client) SendSMS(ctx context.Context, phones []string, templateID, message string) (int, string, error) {
	tpl := strings.TrimSpace(templateID)
	if tpl == "" {
		tpl = c.TemplateID
	}
	if c.AuthKey == "" || tpl == "" {
		return 0, "UNCONFIGURED", fmt.Errorf("MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required to send SMS")
	}
	recipients := make([]map[string]any, 0, len(phones))
	for _, p := range phones {
		m := FormatIndianMobile(p)
		if len(m) >= 12 {
			recipients = append(recipients, map[string]any{
				"mobiles": m,
				"var1":    message,
				"message": message,
			})
		}
	}
	if len(recipients) == 0 {
		return 0, "NO_RECIPIENTS", fmt.Errorf("no valid recipient phone numbers provided")
	}

	payload := map[string]any{
		"template_id": tpl,
		"flow_id":     tpl,
		"sender":      c.SenderID,
		"short_url":   "0",
		"recipients":  recipients,
	}
	if !c.postFlow(ctx, payload) {
		return 0, "FAILED", fmt.Errorf("MSG91 Flow API rejected the SMS request")
	}
	return len(recipients), "MSG91", nil
}

func (c *MSG91Client) postFlow(ctx context.Context, payload map[string]any) bool {
	raw, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://control.msg91.com/api/v5/flow/", bytes.NewReader(raw))
	if err != nil {
		return false
	}
	req.Header.Set("authkey", c.AuthKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accept", "application/json")

	resp, err := sharedNotifyHTTP.Do(req)
	if err != nil {
		slog.Warn("MSG91 Flow API network error", "err", err)
		return false
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 || isMSG91BodyError(body) {
		slog.Warn("MSG91 Flow API error", "status", resp.StatusCode, "body", truncateStr(string(body), 250))
		return false
	}
	return true
}

func isMSG91BodyError(body []byte) bool {
	var parsed map[string]any
	if json.Unmarshal(body, &parsed) != nil {
		return false
	}
	if t, ok := parsed["type"].(string); ok && strings.EqualFold(t, "error") {
		return true
	}
	if s, ok := parsed["status"].(string); ok && strings.EqualFold(s, "error") {
		return true
	}
	return false
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
