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
			redirectURI = resolveGDriveRedirectURI(r)
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

	// 2b. Direct OAuth callback handler — exchanges code automatically and closes popup
	mux.HandleFunc("/api/gdrive/callback", func(w http.ResponseWriter, r *http.Request) {
		if oauthErr := strings.TrimSpace(r.URL.Query().Get("error")); oauthErr != "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, "<h3>Google Drive sign-in cancelled: %s</h3><p>You can close this tab.</p>", oauthErr)
			return
		}
		code := strings.TrimSpace(r.URL.Query().Get("code"))
		if code == "" {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprint(w, "<h3>Missing OAuth authorization code.</h3>")
			return
		}
		cfg, err := loadOAuthClientConfig()
		if err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, "<h3>Configuration error: %s</h3>", err.Error())
			return
		}
		redirectURI := resolveGDriveRedirectURI(r)
		if err := exchangeAndSaveGDriveCode(cfg, code, redirectURI); err != nil {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintf(w, "<h3>Failed connecting Google Drive</h3><pre>%s</pre>", err.Error())
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		fmt.Fprint(w, `<!doctype html><html><body style="font-family:system-ui;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center;padding:32px;border-radius:16px;background:#1e293b;border:1px solid #334155"><h2 style="color:#4ade80;margin-top:0">Google Drive Connected!</h2><p style="color:#cbd5e1">You can now browse Shared with me &amp; My Drive in MaxxPixels Admin.</p><p style="font-size:13px;color:#94a3b8">This window will close automatically...</p></div><script>try{if(window.opener){window.opener.postMessage({type:'GDRIVE_CONNECTED',connected:true},'*');}}catch(e){}setTimeout(function(){window.close();},1200);</script></body></html>`)
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
		if err := exchangeAndSaveGDriveCode(cfg, code, redirectURI); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		json.NewEncoder(w).Encode(map[string]any{
			"connected": true,
			"message":   "Google Drive connected! Private files shared with your Gmail can now be streamed.",
		})
	})

	registerGDriveBrowseRoutes(mux)
}

func resolveGDriveRedirectURI(r *http.Request) string {
	// 1. Optional explicit override (useful for custom reverse proxies)
	if envURI := strings.TrimSpace(os.Getenv("GDRIVE_REDIRECT_URI")); envURI != "" {
		return envURI
	}
	// 2. Dynamic resolution from incoming request (works in local :4200, :8085, and prod https://admin.maxxpixels.com)
	host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = strings.TrimSpace(r.Host)
	}
	if idx := strings.Index(host, ","); idx != -1 {
		host = strings.TrimSpace(host[:idx])
	}
	if host == "" || host == "localhost" || host == "127.0.0.1" {
		host = "127.0.0.1:8085"
	}
	scheme := strings.TrimSpace(r.Header.Get("X-Forwarded-Proto"))
	if idx := strings.Index(scheme, ","); idx != -1 {
		scheme = strings.TrimSpace(scheme[:idx])
	}
	if scheme == "" {
		if r.TLS != nil {
			scheme = "https"
		} else {
			scheme = "http"
		}
	}
	return fmt.Sprintf("%s://%s/api/gdrive/callback", scheme, host)
}

func exchangeAndSaveGDriveCode(cfg oauthDesktopClient, code, redirectURI string) error {
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"client_id":     {cfg.ClientID},
		"client_secret": {cfg.ClientSecret},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil {
		return fmt.Errorf("Google token request failed: %v", err)
	}
	defer resp.Body.Close()
	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Google rejected code (HTTP %d): %s", resp.StatusCode, string(respBytes))
	}

	var tok struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.Unmarshal(respBytes, &tok); err != nil || tok.AccessToken == "" {
		return fmt.Errorf("Failed to parse Google token response")
	}

	saved := cachedOAuthToken{
		AccessToken:  tok.AccessToken,
		RefreshToken: tok.RefreshToken,
		Expiry:       time.Now().Add(time.Duration(tok.ExpiresIn) * time.Second),
	}
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
		return fmt.Errorf("Failed to persist token: %v", err)
	}
	if tPath != "token.json" {
		_ = os.WriteFile("token.json", outBytes, 0600)
	}
	return nil
}
