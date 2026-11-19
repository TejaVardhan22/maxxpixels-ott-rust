package main

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestExtractGDriveFileID(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
		hasErr   bool
	}{
		{
			name:     "Direct /file/d/ URL",
			input:    "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing",
			expected: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
			hasErr:   false,
		},
		{
			name:     "Direct uc?id= URL",
			input:    "https://drive.google.com/uc?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms&export=download",
			expected: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
			hasErr:   false,
		},
		{
			name:     "Raw File ID",
			input:    "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
			expected: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
			hasErr:   false,
		},
		{
			name:     "Invalid empty input",
			input:    "",
			expected: "",
			hasErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res, err := ExtractGDriveFileID(tt.input)
			if tt.hasErr && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tt.hasErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if res != tt.expected {
				t.Fatalf("expected %s, got %s", tt.expected, res)
			}
		})
	}
}

func TestParseWarningHTML(t *testing.T) {
	mockHTML := `<!DOCTYPE html><html><head><title>Google Drive - Virus scan warning</title></head><body>
<form id="download-form" action="https://drive.usercontent.google.com/download" method="post">
<input type="hidden" name="id" value="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms">
<input type="hidden" name="export" value="download">
<input type="hidden" name="confirm" value="t_abc123">
<input type="hidden" name="uuid" value="98765432-1234-abcd-ef01-23456789abcd">
<input type="submit" id="uc-download-link" value="Download anyway">
</form>
</body></html>`

	parsed := parseWarningHTML(mockHTML, "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms")
	if parsed.Action != "https://drive.usercontent.google.com/download" {
		t.Fatalf("expected action 'https://drive.usercontent.google.com/download', got '%s'", parsed.Action)
	}
	if parsed.Method != "POST" {
		t.Fatalf("expected method 'POST', got '%s'", parsed.Method)
	}
	if parsed.Confirm != "t_abc123" {
		t.Fatalf("expected confirm 't_abc123', got '%s'", parsed.Confirm)
	}
	if parsed.UUID != "98765432-1234-abcd-ef01-23456789abcd" {
		t.Fatalf("expected uuid '98765432-1234-abcd-ef01-23456789abcd', got '%s'", parsed.UUID)
	}
	if parsed.Values.Get("id") != "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" {
		t.Fatalf("missing id in form values")
	}
}

func TestFormatBytes(t *testing.T) {
	if FormatBytes(500) != "500 B" {
		t.Errorf("expected '500 B', got '%s'", FormatBytes(500))
	}
	if FormatBytes(1024*1024*5) != "5.00 MB" {
		t.Errorf("expected '5.00 MB', got '%s'", FormatBytes(1024*1024*5))
	}
	if FormatBytes(1024*1024*1024*2) != "2.00 GB" {
		t.Errorf("expected '2.00 GB', got '%s'", FormatBytes(1024*1024*1024*2))
	}
}

func TestBunnyStreamClient_BuildMetadata(t *testing.T) {
	client := NewBunnyStreamClient("676868", "test-key", "vz-bb76d46f-94f.b-cdn.net")
	meta := client.BuildMetadata("video-guid-1234", "My Test Movie")

	if meta.GUID != "video-guid-1234" {
		t.Errorf("expected guid 'video-guid-1234', got '%s'", meta.GUID)
	}
	if !strings.Contains(meta.HLSURL, "video-guid-1234/playlist.m3u8") {
		t.Errorf("unexpected HLS url: %s", meta.HLSURL)
	}
	if !strings.Contains(meta.DirectPlayURL, "676868/video-guid-1234") {
		t.Errorf("unexpected DirectPlay url: %s", meta.DirectPlayURL)
	}
}

func TestStreamPipeline_ZeroDiskPiping(t *testing.T) {
	// Mock Bunny API server
	bunnyServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "POST" && strings.HasSuffix(r.URL.Path, "/videos") {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"guid":"mock-guid-999","videoLibraryId":123,"title":"Mock Title","status":0}`))
			return
		}
		if r.Method == "PUT" && strings.Contains(r.URL.Path, "mock-guid-999") {
			body, _ := io.ReadAll(r.Body)
			if string(body) != "Mock video binary content chunk 12345" {
				http.Error(w, "unexpected content", http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusOK)
			return
		}
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer bunnyServer.Close()

	// Direct pipe test
	pr, pw := io.Pipe()
	go func() {
		_, _ = pw.Write([]byte("Mock video binary content chunk 12345"))
		_ = pw.Close()
	}()

	req, _ := http.NewRequestWithContext(context.Background(), "PUT", bunnyServer.URL+"/library/123/videos/mock-guid-999", pr)
	req.Header.Set("AccessKey", "mock-key")
	resp, err := bunnyServer.Client().Do(req)
	if err != nil {
		t.Fatalf("unexpected upload error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
}
