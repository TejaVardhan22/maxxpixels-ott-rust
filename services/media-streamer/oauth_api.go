package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func tokenFilePath() string {
	if p := strings.TrimSpace(os.Getenv("GDRIVE_TOKEN_PATH")); p != "" {
		return p
	}
	if _, err := os.Stat("/app/data"); err == nil {
		return "/app/data/token.json"
	}
	return "token.json"
}

func credsFilePath() string {
	if p := strings.TrimSpace(os.Getenv("GDRIVE_CREDENTIALS_PATH")); p != "" {
		return p
	}
	return "credentials.json"
}

type oauthInstalledConfig struct {
	Installed oauthDesktopClient `json:"installed"`
	Web       oauthDesktopClient `json:"web"`
}

func loadOAuthClientConfig() (oauthDesktopClient, error) {
	b, err := os.ReadFile(credsFilePath())
	if err != nil {
		return oauthDesktopClient{}, fmt.Errorf("credentials.json not found")
	}
	var cfg oauthInstalledConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return oauthDesktopClient{}, err
	}
	if cfg.Installed.ClientID != "" {
		return cfg.Installed, nil
	}
	if cfg.Web.ClientID != "" {
		return cfg.Web, nil
	}
	return oauthDesktopClient{}, fmt.Errorf("no client_id in credentials.json")
}

func registerGDriveOAuthRoutes(mux *http.ServeMux) {
	// 1. Check whether credentials.json & a valid refreshable token exist
	mux.HandleFunc("/api/gdrive/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		cfg, err := loadOAuthClientConfig()
		if err != nil {
			json.NewEncoder(w).Encode(map[string]any{
				"configured": false,
				"connected":  false,
				"message":    "credentials.json not mounted",
			})
			return
		}
		connected := false
		if tokBytes, err := os.ReadFile(tokenFilePath()); err == nil {
			var cached cachedOAuthToken
			if json.Unmarshal(tokBytes, &cached) == nil {
				if cached.AccessToken != "" && time.Now().Add(1*time.Minute).Before(cached.Expiry) {
					connected = true
				} else if cached.RefreshToken != "" {
					if _, rerr := refreshDesktopToken(cfg, cached.RefreshToken); rerr == nil {
						connected = true
					}
				}
			}
		}
		json.NewEncoder(w).Encode(map[string]any{
			"configured": true,
			"connected":  connected,
		})
	})

	// 2. Generate Google OAuth consent URL for Admin browser login
	mux.HandleFunc("/api/gdrive/auth-url", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		cfg, err := loadOAuthClientConfig()
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		redirectURI := strings.TrimSpace(r.URL.Query().Get("redirectUri"))
		if redirectURI == "" {
			redirectURI = "http://localhost"
		}
		params := url.Values{
			"client_id":     {cfg.ClientID},
			"redirect_uri":  {redirectURI},
			"response_type": {"code"},
			"scope":         {"https://www.googleapis.com/auth/drive.readonly"},
			"access_type":   {"offline"},
			"prompt":        {"consent"},
		}
		authURL := "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode()
		json.NewEncoder(w).Encode(map[string]any{
			"authUrl":     authURL,
			"redirectUri": redirectURI,
		})
	})

	// 3. Exchange authorization code (or pasted redirect URL) for refresh_token & save token.json
	mux.HandleFunc("/api/gdrive/exchange", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(map[string]any{"error": "Method not allowed"})
			return
		}
		cfg, err := loadOAuthClientConfig()
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		var body struct {
			Code        string `json:"code"`
			RedirectURI string `json:"redirectUri"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "Invalid JSON body"})
			return
		}
		code := strings.TrimSpace(body.Code)
		// Allow pasting the full redirected URL (e.g. http://localhost/?code=4/0A...&scope=...)
		if strings.Contains(code, "code=") {
			if parsed, perr := url.Parse(code); perr == nil {
				if qCode := parsed.Query().Get("code"); qCode != "" {
					code = qCode
				}
			}
		}
		if code == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "Authorization code is required"})
			return
		}
		redirectURI := strings.TrimSpace(body.RedirectURI)
		if redirectURI == "" {
			redirectURI = "http://localhost"
		}

		resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
			"client_id":     {cfg.ClientID},
			"client_secret": {cfg.ClientSecret},
			"code":          {code},
			"redirect_uri":  {redirectURI},
			"grant_type":    {"authorization_code"},
		})
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Google token request failed: %v", err)})
			return
		}
		defer resp.Body.Close()
		respBytes, _ := io.ReadAll(resp.Body)
		if resp.StatusCode != http.StatusOK {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Google rejected code (HTTP %d): %s", resp.StatusCode, string(respBytes))})
			return
		}

		var tok struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
			ExpiresIn    int    `json:"expires_in"`
		}
		if err := json.Unmarshal(respBytes, &tok); err != nil || tok.AccessToken == "" {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": "Failed to parse Google token response"})
			return
		}

		saved := cachedOAuthToken{
			AccessToken:  tok.AccessToken,
			RefreshToken: tok.RefreshToken,
			Expiry:       time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second),
		}
		// Keep existing refresh_token if Google omitted it on re-auth
		if saved.RefreshToken == "" {
			if oldBytes, err := os.ReadFile(tokenFilePath()); err == nil {
				var old cachedOAuthToken
				if json.Unmarshal(oldBytes, &old) == nil && old.RefreshToken != "" {
					saved.RefreshToken = old.RefreshToken
				}
			}
		}

		tPath := tokenFilePath()
		_ = os.MkdirAll(filepath.Dir(tPath), 0755)
		outBytes, _ := json.MarshalIndent(saved, "", "  ")
		if err := os.WriteFile(tPath, outBytes, 0600); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Failed to persist token: %v", err)})
			return
		}
		// Also copy to local token.json if different
		if tPath != "token.json" {
			_ = os.WriteFile("token.json", outBytes, 0600)
		}

		json.NewEncoder(w).Encode(map[string]any{
			"connected": true,
			"message":   "Google Drive connected! Private files shared with your Gmail can now be streamed.",
		})
	})

	registerGDriveBrowseRoutes(mux)
}
