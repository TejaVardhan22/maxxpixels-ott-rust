package notify

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

// EmailClient mirrors Rust's Resend EmailClient 1:1.
type EmailClient struct {
	APIURL    string
	APIKey    string
	FromEmail string
}

func NewEmailFromEnv() *EmailClient {
	apiURL := strings.TrimSpace(os.Getenv("EMAIL_API_URL"))
	if apiURL == "" {
		apiURL = "https://api.resend.com/emails"
	}
	key := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	if key == "" {
		key = strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	}
	from := strings.TrimSpace(os.Getenv("EMAIL_FROM"))
	if from == "" {
		from = "noreply@maxxpixels.com"
	}
	return &EmailClient{APIURL: apiURL, APIKey: key, FromEmail: from}
}

func (c *EmailClient) IsConfigured() bool {
	return c.APIKey != ""
}

func (c *EmailClient) SendEmail(ctx context.Context, to, subject, html string) bool {
	if c.APIKey == "" {
		slog.Info("EmailClient dry-run (RESEND_API_KEY unset)", "to", to, "subject", subject)
		return true
	}
	raw, _ := json.Marshal(map[string]any{
		"from":    c.FromEmail,
		"to":      []string{to},
		"subject": subject,
		"html":    html,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.APIURL, bytes.NewReader(raw))
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := sharedNotifyHTTP.Do(req)
	if err != nil {
		slog.Warn("EmailClient request error", "err", err)
		return false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return true
	}
	b, _ := io.ReadAll(resp.Body)
	slog.Warn("EmailClient send failed", "status", resp.StatusCode, "body", truncateStr(string(b), 250))
	return false
}

// SendWhatsApp dispatches a WhatsApp template message via MSG91 WhatsApp API when configured.
func (c *MSG91Client) SendWhatsApp(ctx context.Context, phones []string, templateName, message string) (int, string, error) {
	if c.AuthKey == "" {
		return 0, "UNCONFIGURED", fmt.Errorf("MSG91_AUTH_KEY is required for WhatsApp dispatch")
	}
	clean := make([]string, 0, len(phones))
	for _, p := range phones {
		m := FormatIndianMobile(p)
		if len(m) >= 12 {
			clean = append(clean, m)
		}
	}
	if len(clean) == 0 {
		return 0, "NO_RECIPIENTS", fmt.Errorf("no valid phone numbers provided")
	}
	integrated := strings.TrimSpace(os.Getenv("MSG91_WHATSAPP_NUMBER"))
	if integrated == "" {
		slog.Info("MSG91 WhatsApp dry-run (MSG91_WHATSAPP_NUMBER unset)", "recipients", len(clean))
		return len(clean), "MSG91_WHATSAPP_DRY_RUN", nil
	}
	payload, _ := json.Marshal(map[string]any{
		"integrated_number": integrated,
		"content_type":      "template",
		"payload": map[string]any{
			"messaging_product": "whatsapp",
			"type":              "template",
			"template": map[string]any{
				"name":     templateName,
				"language": map[string]string{"code": "en", "policy": "deterministic"},
				"to_and_components": []map[string]any{{
					"to": clean,
					"components": map[string]any{
						"body_1": map[string]string{"type": "text", "value": message},
					},
				}},
			},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/", bytes.NewReader(payload))
	if err != nil {
		return 0, "FAILED", err
	}
	req.Header.Set("authkey", c.AuthKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := sharedNotifyHTTP.Do(req)
	if err != nil {
		return 0, "FAILED", err
	}
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		return 0, "FAILED", fmt.Errorf("MSG91 WhatsApp returned HTTP %d", resp.StatusCode)
	}
	return len(clean), "MSG91_WHATSAPP", nil
}
