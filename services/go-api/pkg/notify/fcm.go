package notify

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type serviceAccount struct {
	ProjectID   string `json:"project_id"`
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
}

type cachedOAuthToken struct {
	accessToken string
	expiresAt   time.Time
}

var (
	fcmTokenMu    sync.Mutex
	fcmTokenCache *cachedOAuthToken
)

// FCMClient implements Firebase Cloud Messaging HTTP v1 with RS256 service-account OAuth2
// authentication and in-memory token caching (1:1 parity with Rust FcmClient).
type FCMClient struct {
	projectID   string
	clientEmail string
	privateKey  *rsa.PrivateKey
	tokenURI    string
	configured  bool
}

func NewFCMFromEnv() *FCMClient {
	raw := readServiceAccountJSON()
	if raw == "" {
		return &FCMClient{configured: false}
	}
	var sa serviceAccount
	if err := json.Unmarshal([]byte(raw), &sa); err != nil {
		slog.Warn("FCMClient: failed to parse service account JSON", "err", err)
		return &FCMClient{configured: false}
	}
	projectID := firstEnv("FCM_PROJECT_ID", "FIREBASE_PROJECT_ID", "GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = strings.TrimSpace(sa.ProjectID)
	}
	tokenURI := strings.TrimSpace(sa.TokenURI)
	if tokenURI == "" {
		tokenURI = "https://oauth2.googleapis.com/token"
	}
	if projectID == "" || strings.TrimSpace(sa.ClientEmail) == "" || strings.TrimSpace(sa.PrivateKey) == "" {
		slog.Warn("FCMClient: incomplete service account credentials")
		return &FCMClient{configured: false}
	}
	key, err := parseRSAPrivateKey(sa.PrivateKey)
	if err != nil {
		slog.Warn("FCMClient: invalid service account private_key", "err", err)
		return &FCMClient{configured: false}
	}
	return &FCMClient{
		projectID:   projectID,
		clientEmail: strings.TrimSpace(sa.ClientEmail),
		privateKey:  key,
		tokenURI:    tokenURI,
		configured:  true,
	}
}

func (c *FCMClient) IsConfigured() bool {
	return c != nil && c.configured
}

// SendToTarget dispatches an FCM HTTP v1 push to a device token or `/topics/<topic>`.
func (c *FCMClient) SendToTarget(ctx context.Context, to, title, body, imageURL, actionURL string) bool {
	if !c.IsConfigured() {
		slog.Warn("FCMClient: push attempted while unconfigured (no service account)", "title", title)
		return false
	}
	accessTok, err := c.getAccessToken(ctx)
	if err != nil {
		slog.Error("FCMClient: OAuth2 token acquisition failed", "err", err)
		return false
	}

	notif := map[string]any{
		"title": title,
		"body":  body,
	}
	if img := strings.TrimSpace(imageURL); img != "" {
		notif["image"] = img
	}

	msg := map[string]any{
		"notification": notif,
		"android": map[string]any{
			"priority": "HIGH",
			"notification": map[string]any{
				"sound":       "maxxpixels_notify",
				"channelId":   "maxxpixels_alerts",
				"clickAction": "FLUTTER_NOTIFICATION_CLICK",
			},
		},
		"data": map[string]any{
			"actionUrl":    actionURL,
			"click_action": "FLUTTER_NOTIFICATION_CLICK",
			"sound":        "maxxpixels_notify",
			"channelId":    "maxxpixels_alerts",
		},
	}

	var targetLabel string
	switch {
	case strings.HasPrefix(to, "/topics/"):
		topic := strings.TrimPrefix(to, "/topics/")
		msg["topic"] = topic
		targetLabel = "topic/" + topic
	case strings.HasPrefix(to, "topics/"):
		topic := strings.TrimPrefix(to, "topics/")
		msg["topic"] = topic
		targetLabel = "topic/" + topic
	default:
		msg["token"] = to
		if len(to) > 8 {
			targetLabel = "token/" + to[:4] + "..." + to[len(to)-4:]
		} else {
			targetLabel = "token/***"
		}
	}

	payload, _ := json.Marshal(map[string]any{"message": msg})
	endpoint := fmt.Sprintf("https://fcm.googleapis.com/v1/projects/%s/messages:send", c.projectID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return false
	}
	req.Header.Set("Authorization", "Bearer "+accessTok)
	req.Header.Set("Content-Type", "application/json")

	resp, err := sharedNotifyHTTP.Do(req)
	if err != nil {
		slog.Error("FCMClient: send request error", "target", targetLabel, "err", err)
		return false
	}
	respBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		slog.Info("FCMClient: push delivered", "target", targetLabel)
		return true
	}
	slog.Error("FCMClient: send failed", "target", targetLabel, "status", resp.StatusCode, "body", truncateStr(string(respBody), 300))
	return false
}

func (c *FCMClient) getAccessToken(ctx context.Context) (string, error) {
	fcmTokenMu.Lock()
	if fcmTokenCache != nil && time.Now().Before(fcmTokenCache.expiresAt) {
		tok := fcmTokenCache.accessToken
		fcmTokenMu.Unlock()
		return tok, nil
	}
	fcmTokenMu.Unlock()

	now := time.Now().Unix()
	claims := jwt.MapClaims{
		"iss":   c.clientEmail,
		"sub":   c.clientEmail,
		"aud":   c.tokenURI,
		"scope": "https://www.googleapis.com/auth/firebase.messaging",
		"iat":   now,
		"exp":   now + 3600,
	}
	signed, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(c.privateKey)
	if err != nil {
		return "", fmt.Errorf("sign service account JWT: %w", err)
	}

	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", signed)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.tokenURI, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := sharedNotifyHTTP.Do(req)
	if err != nil {
		return "", err
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("oauth2 token endpoint returned HTTP %d: %s", resp.StatusCode, truncateStr(string(body), 300))
	}

	var out struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int64  `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &out); err != nil || out.AccessToken == "" {
		return "", errors.New("invalid oauth2 token response")
	}
	ttl := out.ExpiresIn - 60
	if ttl < 60 {
		ttl = 60
	}

	fcmTokenMu.Lock()
	fcmTokenCache = &cachedOAuthToken{
		accessToken: out.AccessToken,
		expiresAt:   time.Now().Add(time.Duration(ttl) * time.Second),
	}
	fcmTokenMu.Unlock()
	return out.AccessToken, nil
}

func readServiceAccountJSON() string {
	if v := firstEnv("FCM_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT_JSON", "GOOGLE_CREDENTIALS_JSON", "FCM_CREDENTIALS_JSON"); v != "" {
		return v
	}
	if p := firstEnv("FCM_SERVICE_ACCOUNT_PATH", "FIREBASE_SERVICE_ACCOUNT_PATH", "GOOGLE_APPLICATION_CREDENTIALS"); p != "" {
		if b, err := os.ReadFile(p); err == nil && strings.TrimSpace(string(b)) != "" {
			return string(b)
		}
	}
	return ""
}

func firstEnv(keys ...string) string {
	for _, k := range keys {
		if v := strings.TrimSpace(os.Getenv(k)); v != "" {
			return v
		}
	}
	return ""
}

func parseRSAPrivateKey(pemStr string) (*rsa.PrivateKey, error) {
	normalized := strings.ReplaceAll(pemStr, `\n`, "\n")
	block, _ := pem.Decode([]byte(normalized))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := k.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, errors.New("key is not RSA")
	}
	return x509.ParsePKCS1PrivateKey(block.Bytes)
}
