package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type BunnyStreamClient struct {
	LibraryID   string
	APIKey      string
	CDNHostname string
	HTTPClient  *http.Client
}

type CreateVideoResponse struct {
	GUID           string `json:"guid"`
	VideoLibraryID int    `json:"videoLibraryId"`
	Title          string `json:"title"`
	Status         int    `json:"status"`
}

type VideoMetadata struct {
	GUID          string `json:"guid"`
	LibraryID     string `json:"libraryId"`
	Title         string `json:"title"`
	HLSURL        string `json:"hlsUrl"`
	DirectPlayURL string `json:"directPlayUrl"`
	ThumbnailURL  string `json:"thumbnailUrl"`
	PreviewURL    string `json:"previewUrl"`
}

func NewBunnyStreamClient(libraryID, apiKey, cdnHostname string) *BunnyStreamClient {
	if cdnHostname == "" {
		cdnHostname = "vz-bb76d46f-94f.b-cdn.net"
	}
	cdnHostname = strings.TrimPrefix(cdnHostname, "https://")
	cdnHostname = strings.TrimPrefix(cdnHostname, "http://")
	cdnHostname = strings.TrimRight(cdnHostname, "/")

	return &BunnyStreamClient{
		LibraryID:   libraryID,
		APIKey:      apiKey,
		CDNHostname: cdnHostname,
		HTTPClient: &http.Client{
			Timeout: 0, // No global timeout for long multi-GB streaming uploads
		},
	}
}

// CreateVideo initiates an empty video container on Bunny.net Stream
func (c *BunnyStreamClient) CreateVideo(ctx context.Context, title string) (*CreateVideoResponse, error) {
	if title == "" {
		title = fmt.Sprintf("MaxxPixels Video %d", time.Now().Unix())
	}

	url := fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos", c.LibraryID)
	payload, err := json.Marshal(map[string]string{"title": title})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal video create payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request to create video failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bunny stream create video failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var res CreateVideoResponse
	if err := json.Unmarshal(bodyBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse bunny stream response: %w (body: %s)", err, string(bodyBytes))
	}

	if res.GUID == "" {
		return nil, fmt.Errorf("bunny stream returned empty video GUID")
	}

	return &res, nil
}

// UploadStream directly streams bytes into Bunny.net Stream via HTTP PUT
func (c *BunnyStreamClient) UploadStream(ctx context.Context, videoID string, reader io.Reader, contentLength int64) error {
	url := fmt.Sprintf("https://video.bunnycdn.com/library/%s/videos/%s", c.LibraryID, videoID)

	req, err := http.NewRequestWithContext(ctx, "PUT", url, reader)
	if err != nil {
		return fmt.Errorf("failed to create upload request: %w", err)
	}

	req.Header.Set("AccessKey", c.APIKey)
	req.Header.Set("Content-Type", "application/octet-stream")

	if contentLength > 0 {
		req.ContentLength = contentLength
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return fmt.Errorf("upload stream failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("bunny stream upload failed (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	return nil
}

// UploadResumableStream uploads a stream via Bunny.net TUS 1.0.0 resumable chunked protocol (8MB chunks with auto-retry).
func (c *BunnyStreamClient) UploadResumableStream(
	ctx context.Context,
	videoID string,
	title string,
	reader io.Reader,
	contentLength int64,
) error {
	if contentLength <= 0 {
		return c.UploadStream(ctx, videoID, reader, contentLength)
	}

	expire := time.Now().Unix() + 86400
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s%s%d%s", c.LibraryID, c.APIKey, expire, videoID)))
	signature := hex.EncodeToString(sum[:])

	tusEndpoint := "https://video.bunnycdn.com/tusupload"
	createReq, err := http.NewRequestWithContext(ctx, "POST", tusEndpoint, nil)
	if err != nil {
		return fmt.Errorf("tus create request: %w", err)
	}
	createReq.Header.Set("Tus-Resumable", "1.0.0")
	createReq.Header.Set("Upload-Length", strconv.FormatInt(contentLength, 10))
	createReq.Header.Set("AuthorizationSignature", signature)
	createReq.Header.Set("AuthorizationExpire", strconv.FormatInt(expire, 10))
	createReq.Header.Set("VideoId", videoID)
	createReq.Header.Set("LibraryId", c.LibraryID)
	createReq.Header.Set(
		"Upload-Metadata",
		fmt.Sprintf("filename %s,filetype %s",
			base64.StdEncoding.EncodeToString([]byte(title+".mp4")),
			base64.StdEncoding.EncodeToString([]byte("video/mp4")),
		),
	)

	createResp, err := c.HTTPClient.Do(createReq)
	if err != nil {
		return fmt.Errorf("tus create call: %w", err)
	}
	createBody, _ := io.ReadAll(createResp.Body)
	createResp.Body.Close()
	if createResp.StatusCode < 200 || createResp.StatusCode >= 300 {
		return fmt.Errorf("tus create failed (HTTP %d): %s", createResp.StatusCode, string(createBody))
	}

	uploadURL := createResp.Header.Get("Location")
	if uploadURL == "" {
		return fmt.Errorf("tus create returned empty Location header")
	}
	if strings.HasPrefix(uploadURL, "/") {
		uploadURL = "https://video.bunnycdn.com" + uploadURL
	}

	const chunkSize = 8 * 1024 * 1024 // 8MB resumable chunks
	buf := make([]byte, chunkSize)
	var offset int64

	for offset < contentLength {
		toRead := int64(chunkSize)
		if rem := contentLength - offset; rem < toRead {
			toRead = rem
		}
		n, readErr := io.ReadFull(reader, buf[:toRead])
		if n == 0 && (readErr == io.EOF || readErr == io.ErrUnexpectedEOF) {
			break
		}
		if readErr != nil && readErr != io.EOF && readErr != io.ErrUnexpectedEOF {
			return fmt.Errorf("stream read at offset %d: %w", offset, readErr)
		}

		chunk := buf[:n]
		var patchErr error
		for attempt := 0; attempt < 5; attempt++ {
			if attempt > 0 {
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(time.Duration(attempt*2) * time.Second):
				}
				// Re-sync exact server Upload-Offset via TUS HEAD before retrying
				if headReq, herr := http.NewRequestWithContext(ctx, "HEAD", uploadURL, nil); herr == nil {
					headReq.Header.Set("Tus-Resumable", "1.0.0")
					headReq.Header.Set("AuthorizationSignature", signature)
					headReq.Header.Set("AuthorizationExpire", strconv.FormatInt(expire, 10))
					headReq.Header.Set("VideoId", videoID)
					headReq.Header.Set("LibraryId", c.LibraryID)
					if hResp, hdo := c.HTTPClient.Do(headReq); hdo == nil {
						if srvOff, perr := strconv.ParseInt(hResp.Header.Get("Upload-Offset"), 10, 64); perr == nil && srvOff > offset {
							skip := srvOff - offset
							if skip >= int64(len(chunk)) {
								offset = srvOff
								patchErr = nil
								hResp.Body.Close()
								break
							}
							chunk = chunk[skip:]
							offset = srvOff
						}
						hResp.Body.Close()
					}
				}
			}

			patchReq, perr := http.NewRequestWithContext(ctx, "PATCH", uploadURL, bytes.NewReader(chunk))
			if perr != nil {
				patchErr = perr
				continue
			}
			patchReq.Header.Set("Tus-Resumable", "1.0.0")
			patchReq.Header.Set("Content-Type", "application/offset+octet-stream")
			patchReq.Header.Set("Upload-Offset", strconv.FormatInt(offset, 10))
			patchReq.Header.Set("AuthorizationSignature", signature)
			patchReq.Header.Set("AuthorizationExpire", strconv.FormatInt(expire, 10))
			patchReq.Header.Set("VideoId", videoID)
			patchReq.Header.Set("LibraryId", c.LibraryID)
			patchReq.ContentLength = int64(len(chunk))

			resp, derr := c.HTTPClient.Do(patchReq)
			if derr != nil {
				patchErr = derr
				continue
			}
			rbody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				if nextOff, parseErr := strconv.ParseInt(resp.Header.Get("Upload-Offset"), 10, 64); parseErr == nil {
					offset = nextOff
				} else {
					offset += int64(len(chunk))
				}
				patchErr = nil
				break
			}
			patchErr = fmt.Errorf("tus patch HTTP %d: %s", resp.StatusCode, string(rbody))
		}
		if patchErr != nil {
			return fmt.Errorf("tus upload failed at offset %d after retries: %w", offset, patchErr)
		}
		if readErr == io.EOF || readErr == io.ErrUnexpectedEOF {
			break
		}
	}

	return nil
}

// BuildMetadata formats complete playback and preview URLs for client applications
func (c *BunnyStreamClient) BuildMetadata(guid, title string) *VideoMetadata {
	return &VideoMetadata{
		GUID:          guid,
		LibraryID:     c.LibraryID,
		Title:         title,
		HLSURL:        fmt.Sprintf("https://%s/%s/playlist.m3u8", c.CDNHostname, guid),
		DirectPlayURL: fmt.Sprintf("https://iframe.mediadelivery.net/play/%s/%s", c.LibraryID, guid),
		ThumbnailURL:  fmt.Sprintf("https://%s/%s/thumbnail.jpg", c.CDNHostname, guid),
		PreviewURL:    fmt.Sprintf("https://%s/%s/preview.webp", c.CDNHostname, guid),
	}
}
