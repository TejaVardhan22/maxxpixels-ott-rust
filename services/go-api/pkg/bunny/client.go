package bunny

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

var sharedHTTP = &http.Client{
	Timeout: 60 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 32,
		IdleConnTimeout:     90 * time.Second,
	},
}

// StreamClient mirrors Rust BunnyStreamClient 1:1.
type StreamClient struct {
	CDNHostname string
	TokenKey    string
	LibraryID   string
	APIKey      string
}

func NewStreamClientFromEnv() *StreamClient {
	tokKey := os.Getenv("BUNNY_STREAM_TOKEN_KEY")
	if tokKey == "" {
		tokKey = os.Getenv("BUNNY_STREAM_TOKEN_AUTH_KEY")
	}
	return &StreamClient{
		CDNHostname: strings.TrimRight(strings.TrimSpace(os.Getenv("BUNNY_STREAM_CDN_HOSTNAME")), "/"),
		TokenKey:    strings.TrimSpace(tokKey),
		LibraryID:   strings.TrimSpace(os.Getenv("BUNNY_STREAM_LIBRARY_ID")),
		APIKey:      strings.TrimSpace(os.Getenv("BUNNY_STREAM_API_KEY")),
	}
}

func (c *StreamClient) SignHLSURL(videoGUID string, ttlSeconds int64) string {
	clean := strings.TrimSpace(videoGUID)
	path := fmt.Sprintf("/%s/playlist.m3u8", clean)
	if c.TokenKey == "" {
		return fmt.Sprintf("https://%s%s", c.CDNHostname, path)
	}
	expires := time.Now().Unix() + ttlSeconds
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s%s%d", c.TokenKey, path, expires)))
	return fmt.Sprintf("https://%s%s?token=%s&expires=%d", c.CDNHostname, path, hex.EncodeToString(sum[:]), expires)
}

func (c *StreamClient) SignTusUpload(videoGUID string, expireUnix int64) string {
	raw := fmt.Sprintf("%s%s%d%s", c.LibraryID, c.APIKey, expireUnix, strings.TrimSpace(videoGUID))
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (c *StreamClient) CreateVideo(ctx context.Context, title string) (string, error) {
	if c.LibraryID == "" || c.APIKey == "" {
		return uuid.NewString(), nil
	}
	payload, _ := json.Marshal(map[string]string{"title": title})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos", c.LibraryID), bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := sharedHTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("bunny stream returned HTTP %d", resp.StatusCode)
	}
	var out struct {
		GUID string `json:"guid"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.GUID == "" {
		return "", fmt.Errorf("missing guid in Bunny Stream response")
	}
	return out.GUID, nil
}

func (c *StreamClient) UploadVideoBytes(ctx context.Context, guid string, data []byte) error {
	if c.LibraryID == "" || c.APIKey == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos/%s", c.LibraryID, guid), bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/octet-stream")
	resp, err := sharedHTTP.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("bunny stream upload returned HTTP %d", resp.StatusCode)
	}
	return nil
}

// StorageClient mirrors Rust BunnyStorageClient 1:1.
type StorageClient struct {
	StorageZone     string
	APIKey          string
	StorageEndpoint string
	CDNURL          string
	PublicBaseURL   string
}

func NewStorageClientFromEnv(publicBaseURL string) *StorageClient {
	ep := strings.TrimRight(strings.TrimSpace(os.Getenv("BUNNY_STORAGE_ENDPOINT")), "/")
	if ep == "" {
		region := strings.ToLower(strings.TrimSpace(os.Getenv("BUNNY_STORAGE_REGION")))
		if region != "" && region != "de" && region != "falkenstein" {
			ep = fmt.Sprintf("https://%s.storage.bunnycdn.com", region)
		} else {
			ep = "https://storage.bunnycdn.com"
		}
	}
	zone := os.Getenv("BUNNY_STORAGE_ZONE")
	if zone == "" {
		zone = os.Getenv("BUNNY_STORAGE_ZONE_NAME")
	}
	key := os.Getenv("BUNNY_STORAGE_API_KEY")
	if key == "" {
		key = os.Getenv("BUNNY_STORAGE_ZONE_PASSWORD")
	}
	cdn := os.Getenv("BUNNY_STORAGE_CDN_URL")
	if cdn == "" {
		cdn = os.Getenv("BUNNY_PULL_ZONE_DOMAIN")
	}
	return &StorageClient{
		StorageZone:     strings.TrimSpace(zone),
		APIKey:          strings.TrimSpace(key),
		StorageEndpoint: ep,
		CDNURL:          strings.TrimRight(strings.TrimSpace(cdn), "/"),
		PublicBaseURL:   strings.TrimRight(strings.TrimSpace(publicBaseURL), "/"),
	}
}

func (c *StorageClient) UploadFile(ctx context.Context, folder, fileName string, data []byte, contentType string) (map[string]any, error) {
	safeFolder := sanitizeToken(folder, false)
	if safeFolder == "" {
		safeFolder = "media"
	}
	safeName := sanitizeToken(fileName, true)
	if safeName == "" {
		safeName = "file.bin"
	}
	uniqueName := fmt.Sprintf("%d-%s", time.Now().UnixMilli(), safeName)

	if c.APIKey == "" || c.StorageZone == "" {
		return c.saveLocalFallback(safeFolder, uniqueName, data)
	}

	remoteURL := fmt.Sprintf("%s/%s/%s/%s", c.StorageEndpoint, c.StorageZone, safeFolder, uniqueName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, remoteURL, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("AccessKey", c.APIKey)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req.Header.Set("Content-Type", contentType)

	resp, err := sharedHTTP.Do(req)
	if err != nil {
		return c.saveLocalFallback(safeFolder, uniqueName, data)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return c.saveLocalFallback(safeFolder, uniqueName, data)
	}

	// Return a path-relative URL so it resolves correctly from any origin
	// (admin refine at port 4200, web app, mobile, etc.). The nginx proxy
	// routes /api/ to the Go API which serves the media via ServeMedia.
	mediaURL := fmt.Sprintf("/api/v1/uploads/%s/%s", safeFolder, uniqueName)

	// Also include the absolute URL for consumers that need it (e.g. mobile apps,
	// email notifications). Prefer the proxy URL so it works through nginx.
	absURL := fmt.Sprintf("%s/api/v1/uploads/%s/%s", c.PublicBaseURL, safeFolder, uniqueName)
	if c.PublicBaseURL == "" {
		absURL = mediaURL
	}

	return map[string]any{
		"provider": "BUNNY_STORAGE",
		"folder":   safeFolder,
		"fileName": uniqueName,
		"url":      mediaURL,
		"fileUrl":  mediaURL,
		"absoluteUrl": absURL,
	}, nil
}

func (c *StorageClient) saveLocalFallback(safeFolder, uniqueName string, data []byte) (map[string]any, error) {
	dir := fmt.Sprintf("./uploads/%s", safeFolder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	if err := os.WriteFile(fmt.Sprintf("%s/%s", dir, uniqueName), data, 0o644); err != nil {
		return nil, err
	}
	mediaURL := fmt.Sprintf("/api/v1/uploads/%s/%s", safeFolder, uniqueName)
	absURL := mediaURL
	if c.PublicBaseURL != "" {
		absURL = fmt.Sprintf("%s/api/v1/uploads/%s/%s", c.PublicBaseURL, safeFolder, uniqueName)
	}
	return map[string]any{
		"provider":     "LOCAL_STORAGE",
		"folder":       safeFolder,
		"fileName":     uniqueName,
		"url":          mediaURL,
		"fileUrl":      mediaURL,
		"absoluteUrl":  absURL,
	}, nil
}

// NewBackupStorageClientFromEnv creates a Bunny Storage client for DB backups,
// preferring optional dedicated BUNNY_BACKUP_STORAGE_* vars and falling back to BUNNY_STORAGE_*.
func NewBackupStorageClientFromEnv() *StorageClient {
	c := NewStorageClientFromEnv("")
	if z := strings.TrimSpace(os.Getenv("BUNNY_BACKUP_STORAGE_ZONE")); z != "" {
		c.StorageZone = z
	}
	if k := strings.TrimSpace(os.Getenv("BUNNY_BACKUP_STORAGE_PASSWORD")); k != "" {
		c.APIKey = k
	}
	if ep := strings.TrimSpace(os.Getenv("BUNNY_BACKUP_STORAGE_ENDPOINT")); ep != "" {
		if !strings.HasPrefix(ep, "http://") && !strings.HasPrefix(ep, "https://") {
			ep = "https://" + ep
		}
		c.StorageEndpoint = strings.TrimRight(ep, "/")
	}
	return c
}

// UploadRawPath uploads bytes directly to an exact path in Bunny Storage (e.g. db-backups/2026-11-28/file.sql.gz).
func (c *StorageClient) UploadRawPath(ctx context.Context, remotePath string, data []byte, contentType string) (string, error) {
	if c.APIKey == "" || c.StorageZone == "" {
		return "", fmt.Errorf("bunny storage credentials not configured")
	}
	cleanPath := strings.TrimLeft(strings.TrimSpace(remotePath), "/")
	targetURL := fmt.Sprintf("%s/%s/%s", c.StorageEndpoint, c.StorageZone, cleanPath)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, targetURL, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	req.Header.Set("AccessKey", c.APIKey)
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	req.Header.Set("Content-Type", contentType)

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("bunny storage upload failed HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return fmt.Sprintf("bunny://%s/%s", c.StorageZone, cleanPath), nil
}

// DownloadFile proxies directly from Bunny Edge Storage API with fallback folder search.
func (c *StorageClient) DownloadFile(ctx context.Context, folder, fileName string) ([]byte, string, bool) {
	cleanFolder := strings.Trim(folder, "/")
	cleanName := strings.Trim(fileName, "/")
	if cleanName == "" || strings.Contains(cleanName, "..") || c.APIKey == "" || c.StorageZone == "" {
		return nil, "", false
	}

	var candidates []string
	if cleanFolder != "" {
		candidates = append(candidates, cleanFolder+"/"+cleanName)
	}
	candidates = append(candidates, cleanName)
	for _, f := range []string{"posters", "banners", "branding"} {
		if cleanFolder != f {
			candidates = append(candidates, f+"/"+cleanName)
		}
	}

	guessed := GuessMime(cleanName)
	for _, rel := range candidates {
		u := fmt.Sprintf("%s/%s/%s", c.StorageEndpoint, c.StorageZone, rel)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			continue
		}
		req.Header.Set("AccessKey", c.APIKey)
		resp, err := sharedHTTP.Do(req)
		if err != nil {
			continue
		}
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			body, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err == nil && len(body) > 0 {
				ct := resp.Header.Get("Content-Type")
				if ct == "" || strings.HasPrefix(ct, "application/octet-stream") {
					ct = guessed
				}
				return body, ct, true
			}
			continue
		}
		resp.Body.Close()
	}
	return nil, "", false
}

func GuessMime(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".png"):
		return "image/png"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	case strings.HasSuffix(lower, ".gif"):
		return "image/gif"
	case strings.HasSuffix(lower, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(lower, ".pdf"):
		return "application/pdf"
	case strings.HasSuffix(lower, ".mp4"):
		return "video/mp4"
	case strings.HasSuffix(lower, ".vtt"):
		return "text/vtt"
	default:
		return "image/jpeg"
	}
}

func sanitizeToken(s string, allowDot bool) string {
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || (allowDot && r == '.') {
			b.WriteRune(r)
		} else if allowDot {
			b.WriteByte('_')
		}
	}
	return b.String()
}
