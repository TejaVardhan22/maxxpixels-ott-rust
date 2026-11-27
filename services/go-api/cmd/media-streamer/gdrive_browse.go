package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"os"
	"strings"
	"time"
)

func getValidGDriveAccessToken() (string, error) {
	cfg, err := loadOAuthClientConfig()
	if err != nil {
		return "", err
	}
	tokBytes, err := os.ReadFile(tokenFilePath())
	if err != nil {
		return "", fmt.Errorf("Google Drive not connected; please sign in first")
	}
	var cached cachedOAuthToken
	if err := json.Unmarshal(tokBytes, &cached); err != nil {
		return "", fmt.Errorf("invalid cached Google Drive token")
	}
	if cached.AccessToken != "" && time.Now().Add(1*time.Minute).Before(cached.Expiry) {
		return cached.AccessToken, nil
	}
	if cached.RefreshToken == "" {
		return "", fmt.Errorf("Google Drive session expired; please reconnect")
	}
	fresh, err := refreshDesktopToken(cfg, cached.RefreshToken)
	if err != nil {
		return "", err
	}
	return fresh.AccessToken, nil
}

func registerGDriveBrowseRoutes(mux *http.ServeMux) {
	// GET /api/gdrive/files?scope=shared|my|all&type=image|video|all&q=...
	mux.HandleFunc("/api/gdrive/files", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		tok, err := getValidGDriveAccessToken()
		if err != nil {
			// Return 200 with connected=false so Angular's 401 auth interceptor does not log the admin out
			json.NewEncoder(w).Encode(map[string]any{
				"connected": false,
				"files":     []any{},
				"message":   "Google Drive is not connected yet. Click Connect Google Drive to sign in.",
			})
			return
		}

		scope := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("scope")))
		if scope == "" {
			scope = "shared"
		}
		mediaType := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("type")))
		if mediaType == "" {
			mediaType = "all"
		}
		searchQ := strings.TrimSpace(r.URL.Query().Get("q"))

		clauses := []string{"trashed = false"}
		switch scope {
		case "shared":
			clauses = append(clauses, "sharedWithMe = true")
		case "my":
			clauses = append(clauses, "'me' in owners")
		}
		switch mediaType {
		case "image":
			clauses = append(clauses, "mimeType contains 'image/'")
		case "video":
			clauses = append(clauses, "mimeType contains 'video/'")
		default:
			clauses = append(clauses, "(mimeType contains 'image/' or mimeType contains 'video/')")
		}
		if searchQ != "" {
			safeQ := strings.ReplaceAll(searchQ, "'", "\\'")
			clauses = append(clauses, fmt.Sprintf("name contains '%s'", safeQ))
		}

		params := url.Values{
			"q":                         {strings.Join(clauses, " and ")},
			"fields":                    {"files(id,name,mimeType,size,thumbnailLink,webViewLink,modifiedTime)"},
			"orderBy":                   {"modifiedTime desc"},
			"pageSize":                  {"60"},
			"includeItemsFromAllDrives": {"true"},
			"supportsAllDrives":         {"true"},
		}
		req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, "https://www.googleapis.com/drive/v3/files?"+params.Encode(), nil)
		req.Header.Set("Authorization", "Bearer "+tok)

		resp, err := (&http.Client{Timeout: 20 * time.Second}).Do(req)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Google Drive API error: %v", err)})
			return
		}
		defer resp.Body.Close()
		raw, _ := io.ReadAll(resp.Body)
		if resp.StatusCode >= 300 {
			w.WriteHeader(resp.StatusCode)
			json.NewEncoder(w).Encode(map[string]any{"error": string(raw)})
			return
		}

		var parsed struct {
			Files []map[string]any `json:"files"`
		}
		_ = json.Unmarshal(raw, &parsed)
		if parsed.Files == nil {
			parsed.Files = []map[string]any{}
		}
		json.NewEncoder(w).Encode(map[string]any{
			"connected": true,
			"scope":     scope,
			"type":      mediaType,
			"files":     parsed.Files,
		})
	})

	// POST /api/gdrive/import-image -> downloads Drive image & uploads directly to Go catalog-service /api/v1/storage/upload
	mux.HandleFunc("/api/gdrive/import-image", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		tok, err := getValidGDriveAccessToken()
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		var body struct {
			FileID   string `json:"fileId"`
			FileName string `json:"fileName"`
			MimeType string `json:"mimeType"`
			Folder   string `json:"folder"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.FileID) == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": "fileId is required"})
			return
		}
		if body.Folder == "" {
			body.Folder = "posters"
		}
		if body.FileName == "" {
			body.FileName = body.FileID + ".jpg"
		}
		if body.MimeType == "" {
			body.MimeType = "image/jpeg"
		}

		// 1. Download from Google Drive
		dlURL := fmt.Sprintf("https://www.googleapis.com/drive/v3/files/%s?alt=media&supportsAllDrives=true", url.PathEscape(strings.TrimSpace(body.FileID)))
		dlReq, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, dlURL, nil)
		dlReq.Header.Set("Authorization", "Bearer "+tok)
		dlResp, err := (&http.Client{Timeout: 60 * time.Second}).Do(dlReq)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Drive download error: %v", err)})
			return
		}
		defer dlResp.Body.Close()
		if dlResp.StatusCode >= 300 {
			errBody, _ := io.ReadAll(dlResp.Body)
			w.WriteHeader(dlResp.StatusCode)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Drive download failed: %s", string(errBody))})
			return
		}
		imgBytes, err := io.ReadAll(io.LimitReader(dlResp.Body, 32<<20))
		if err != nil || len(imgBytes) == 0 {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": "Downloaded image was empty"})
			return
		}

		// 2. Forward multipart upload directly to Go API Gateway -> catalog-service -> Bunny Storage
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_ = mw.WriteField("folder", body.Folder)
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, strings.ReplaceAll(body.FileName, `"`, "")))
		h.Set("Content-Type", body.MimeType)
		fw, err := mw.CreatePart(h)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		_, _ = fw.Write(imgBytes)
		_ = mw.Close()

		apiBase := strings.TrimRight(strings.TrimSpace(os.Getenv("API_BACKEND_URL")), "/")
		if apiBase == "" {
			apiBase = "http://api:8081"
		}
		upReq, _ := http.NewRequestWithContext(r.Context(), http.MethodPost, apiBase+"/api/v1/storage/upload", &buf)
		upReq.Header.Set("Content-Type", mw.FormDataContentType())
		if authz := r.Header.Get("Authorization"); authz != "" {
			upReq.Header.Set("Authorization", authz)
		}

		upResp, err := (&http.Client{Timeout: 60 * time.Second}).Do(upReq)
		if err != nil {
			w.WriteHeader(http.StatusBadGateway)
			json.NewEncoder(w).Encode(map[string]any{"error": fmt.Sprintf("Storage upload error: %v", err)})
			return
		}
		defer upResp.Body.Close()
		upBody, _ := io.ReadAll(upResp.Body)
		w.WriteHeader(upResp.StatusCode)
		_, _ = w.Write(upBody)
	})
}
