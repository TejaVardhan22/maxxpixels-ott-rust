package main

import (
	"bufio"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	// 1. Parse command line flags
	gdriveFlag := flag.String("gdrive", "", "Google Drive File URL or File ID")
	titleFlag := flag.String("title", "", "Video Title (optional)")
	libraryFlag := flag.String("library", "", "Bunny Stream Library ID (optional, default from env)")
	apiKeyFlag := flag.String("apikey", "", "Bunny Stream API Key (optional, default from env)")
	cdnHostFlag := flag.String("cdn", "", "Bunny Stream CDN Hostname (optional, default from env)")
	bearerFlag := flag.String("token", "", "Google Drive Bearer Token (optional for private files)")
	serverFlag := flag.Bool("server", false, "Run in HTTP microservice mode")
	portFlag := flag.String("port", "8085", "Port for HTTP microservice mode")
	flag.Parse()

	// 2. Load environment variables from .env if present
	loadEnv()

	libraryID := getEnvOrDefault(*libraryFlag, "BUNNY_STREAM_LIBRARY_ID", "676868")
	apiKey := getEnvOrDefault(*apiKeyFlag, "BUNNY_STREAM_API_KEY", "")
	cdnHostname := getEnvOrDefault(*cdnHostFlag, "BUNNY_STREAM_CDN_HOSTNAME", "vz-bb76d46f-94f.b-cdn.net")

	if apiKey == "" {
		log.Println("[WARN] BUNNY_STREAM_API_KEY is not set. Please supply via flag -apikey or env BUNNY_STREAM_API_KEY.")
	}

	bunnyClient := NewBunnyStreamClient(libraryID, apiKey, cdnHostname)
	pipeline := NewStreamPipeline(bunnyClient)

	// Mode 1: HTTP Microservice Server Mode
	if *serverFlag {
		runServer(*portFlag, pipeline, libraryID, apiKey, cdnHostname)
		return
	}

	// Mode 2: Direct CLI Streaming Mode
	if *gdriveFlag == "" {
		fmt.Println("==================================================================")
		fmt.Println(" MaxxPixels OTT - Google Drive to Bunny.net Stream CLI Tool")
		fmt.Println(" High-Performance Zero-Disk Goroutine Streaming Pipeline")
		fmt.Println("==================================================================")
		fmt.Println("Usage:")
		fmt.Println("  go run . -gdrive=\"<Google Drive URL or File ID>\" [options]")
		fmt.Println("\nOptions:")
		flag.PrintDefaults()
		fmt.Println("\nExamples:")
		fmt.Println("  go run . -gdrive=\"https://drive.google.com/file/d/1A2b3c.../view\" -title=\"Movie Title\"")
		fmt.Println("  go run . -server -port=8085 (starts background REST microservice)")
		fmt.Println("==================================================================")
		os.Exit(0)
	}

	runCLI(pipeline, *gdriveFlag, *titleFlag, *bearerFlag)
}

func runCLI(pipeline *StreamPipeline, gdriveURL, title, bearerToken string) {
	fmt.Printf("\n🚀 Initializing Goroutine Stream Pipeline...\n")
	fmt.Printf("   Google Drive Source: %s\n", gdriveURL)
	if title != "" {
		fmt.Printf("   Target Video Title:  %s\n", title)
	}

	jobID := fmt.Sprintf("job_%d", time.Now().UnixNano())
	ctx := context.Background()

	onProgress := func(p StreamProgress) {
		pctStr := fmt.Sprintf("%.1f%%", p.Percentage)
		if p.TotalBytes <= 0 {
			pctStr = "Streaming..."
		}
		etaStr := "--"
		if p.ETASeconds > 0 {
			etaStr = fmt.Sprintf("%02dm:%02ds", p.ETASeconds/60, p.ETASeconds%60)
		}

		fmt.Printf("\r⏳ [%s] %s / %s | Speed: %.2f MB/s | ETA: %s  ",
			pctStr,
			FormatBytes(p.BytesTransferred),
			FormatBytes(p.TotalBytes),
			p.SpeedMBps,
			etaStr,
		)
	}

	metadata, err := pipeline.StreamGDriveToBunny(ctx, jobID, gdriveURL, title, bearerToken, onProgress)
	if err != nil {
		fmt.Printf("\n\n❌ Upload Pipeline Failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n\n✅ [SUCCESS] Video successfully streamed directly to Bunny.net!\n")
	fmt.Println("------------------------------------------------------------------")
	fmt.Printf(" Video GUID:       %s\n", metadata.GUID)
	fmt.Printf(" Direct Play URL:  %s\n", metadata.DirectPlayURL)
	fmt.Printf(" HLS Playlist:     %s\n", metadata.HLSURL)
	fmt.Printf(" Thumbnail URL:    %s\n", metadata.ThumbnailURL)
	fmt.Printf(" Preview URL:      %s\n", metadata.PreviewURL)
	fmt.Println("------------------------------------------------------------------")
}

func runServer(port string, pipeline *StreamPipeline, defaultLibraryID, defaultAPIKey, defaultCDNHost string) {
	mux := http.NewServeMux()
	registerGDriveOAuthRoutes(mux)

	// Health endpoint
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "UP",
			"timestamp": time.Now(),
			"service":   "gdrive-bunny-stream",
		})
	})

	// Upload start endpoint
	mux.HandleFunc("/api/stream-gdrive", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
			return
		}

		type StreamRequest struct {
			GDriveURL   string `json:"gdriveUrl"`
			Title       string `json:"title"`
			BearerToken string `json:"bearerToken"`
		}

		var req StreamRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf(`{"error":"Invalid request payload: %v"}`, err), http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.GDriveURL) == "" {
			http.Error(w, `{"error":"gdriveUrl is required"}`, http.StatusBadRequest)
			return
		}

		jobID := fmt.Sprintf("job_%d", time.Now().UnixNano())

		// Launch in non-blocking background goroutine
		go func() {
			_, _ = pipeline.StreamGDriveToBunny(
				context.Background(),
				jobID,
				req.GDriveURL,
				req.Title,
				req.BearerToken,
				nil,
			)
		}()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jobId":   jobID,
			"status":  "ACCEPTED",
			"message": "Goroutine pipeline spawned. Stream running asynchronously.",
		})
	})

	// Job polling endpoint
	mux.HandleFunc("/api/jobs/", func(w http.ResponseWriter, r *http.Request) {
		jobID := strings.TrimPrefix(r.URL.Path, "/api/jobs/")
		if jobID == "" {
			http.Error(w, `{"error":"Missing job ID"}`, http.StatusBadRequest)
			return
		}

		// Check if SSE requested
		if strings.HasSuffix(jobID, "/events") {
			cleanID := strings.TrimSuffix(jobID, "/events")
			handleSSE(w, r, pipeline, cleanID)
			return
		}

		job, exists := pipeline.GetJob(jobID)
		if !exists {
			http.Error(w, `{"error":"Job not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		job.mu.RLock()
		json.NewEncoder(w).Encode(job)
		job.mu.RUnlock()
	})

	addr := ":" + port
	log.Printf("🔥 MaxxPixels GDrive-to-Bunny Stream microservice listening on http://localhost%s\n", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}

// handleSSE streams live progress updates using Server-Sent Events
func handleSSE(w http.ResponseWriter, r *http.Request, pipeline *StreamPipeline, jobID string) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	job, exists := pipeline.GetJob(jobID)
	if !exists {
		http.Error(w, `{"error":"Job not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			job.mu.RLock()
			data, _ := json.Marshal(map[string]interface{}{
				"status":        job.Status,
				"progress":      job.Progress,
				"error":         job.Error,
				"videoMetadata": job.VideoMetadata,
			})
			done := job.Status == StatusCompleted || job.Status == StatusFailed
			job.mu.RUnlock()

			fmt.Fprintf(w, "data: %s\n\n", string(data))
			flusher.Flush()

			if done {
				return
			}
		}
	}
}

func getEnvOrDefault(flagVal, envKey, defaultVal string) string {
	if flagVal != "" {
		return flagVal
	}
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	return defaultVal
}

// loadEnv searches for .env in current and parent directory and sets variables
func loadEnv() {
	paths := []string{".env", "../.env"}
	for _, p := range paths {
		abs, err := filepath.Abs(p)
		if err != nil {
			continue
		}
		f, err := os.Open(abs)
		if err != nil {
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				k := strings.TrimSpace(parts[0])
				v := strings.TrimSpace(parts[1])
				v = strings.Trim(v, `"'`)
				if os.Getenv(k) == "" {
					os.Setenv(k, v)
				}
			}
		}
		break
	}
}
