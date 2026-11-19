package main

import (
	"context"
	"fmt"
	"io"
	"sync"
	"sync/atomic"
	"time"
)

type JobStatus string

const (
	StatusQueued       JobStatus = "QUEUED"
	StatusInitializing JobStatus = "INITIALIZING"
	StatusStreaming    JobStatus = "STREAMING"
	StatusCompleted    JobStatus = "COMPLETED"
	StatusFailed       JobStatus = "FAILED"
)

type StreamProgress struct {
	BytesTransferred int64   `json:"bytesTransferred"`
	TotalBytes       int64   `json:"totalBytes"`
	Percentage       float64 `json:"percentage"`
	SpeedMBps        float64 `json:"speedMBps"`
	ETASeconds       int64   `json:"etaSeconds"`
	ElapsedTimeSec   int64   `json:"elapsedTimeSec"`
}

type StreamJob struct {
	ID            string         `json:"id"`
	GDriveURL     string         `json:"gdriveUrl"`
	VideoTitle    string         `json:"videoTitle"`
	Status        JobStatus      `json:"status"`
	Progress      StreamProgress `json:"progress"`
	Error         string         `json:"error,omitempty"`
	VideoMetadata *VideoMetadata `json:"videoMetadata,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	CompletedAt   *time.Time     `json:"completedAt,omitempty"`

	// Concurrency synchronization
	mu               sync.RWMutex
	bytesTransferred atomic.Int64
	doneChan         chan struct{}
}

type ProgressCallback func(p StreamProgress)

type StreamPipeline struct {
	bunnyClient *BunnyStreamClient
	jobsMu      sync.RWMutex
	jobs        map[string]*StreamJob
}

func NewStreamPipeline(bunnyClient *BunnyStreamClient) *StreamPipeline {
	return &StreamPipeline{
		bunnyClient: bunnyClient,
		jobs:        make(map[string]*StreamJob),
	}
}

func (p *StreamPipeline) GetJob(id string) (*StreamJob, bool) {
	p.jobsMu.RLock()
	defer p.jobsMu.RUnlock()
	job, exists := p.jobs[id]
	return job, exists
}

// StreamGDriveToBunny executes the concurrent coroutine pipeline connecting Google Drive to Bunny.net Stream
func (p *StreamPipeline) StreamGDriveToBunny(
	ctx context.Context,
	jobID string,
	gdriveURL string,
	videoTitle string,
	bearerToken string,
	onProgress ProgressCallback,
) (*VideoMetadata, error) {

	job := &StreamJob{
		ID:         jobID,
		GDriveURL:  gdriveURL,
		VideoTitle: videoTitle,
		Status:     StatusInitializing,
		CreatedAt:  time.Now(),
		doneChan:   make(chan struct{}),
	}

	p.jobsMu.Lock()
	p.jobs[jobID] = job
	p.jobsMu.Unlock()

	defer func() {
		close(job.doneChan)
		now := time.Now()
		job.mu.Lock()
		job.CompletedAt = &now
		job.mu.Unlock()
	}()

	// Step 1: Open Google Drive Stream
	streamInfo, err := DownloadGDriveStream(ctx, gdriveURL, bearerToken)
	if err != nil {
		job.mu.Lock()
		job.Status = StatusFailed
		job.Error = fmt.Sprintf("Failed to connect to Google Drive: %v", err)
		job.mu.Unlock()
		return nil, fmt.Errorf("gdrive error: %w", err)
	}
	defer streamInfo.Body.Close()

	if videoTitle == "" {
		videoTitle = streamInfo.FileName
	}
	job.VideoTitle = videoTitle
	totalBytes := streamInfo.ContentLength

	// Step 2: Create Bunny.net Stream Video Container
	videoResp, err := p.bunnyClient.CreateVideo(ctx, videoTitle)
	if err != nil {
		job.mu.Lock()
		job.Status = StatusFailed
		job.Error = fmt.Sprintf("Failed to initialize Bunny.net video: %v", err)
		job.mu.Unlock()
		return nil, fmt.Errorf("bunny create error: %w", err)
	}

	metadata := p.bunnyClient.BuildMetadata(videoResp.GUID, videoTitle)
	job.mu.Lock()
	job.VideoMetadata = metadata
	job.Status = StatusStreaming
	job.mu.Unlock()

	// Step 3: Zero-Disk Streaming via io.Pipe & Goroutines (Coroutines)
	// io.Pipe connects the GDrive reader goroutine directly to the Bunny PUT uploader goroutine.
	pr, pw := io.Pipe()

	var wg sync.WaitGroup
	var uploadErr error
	var downloadErr error

	startTime := time.Now()

	// Goroutine 1 (Producer Coroutine): Read chunks from Google Drive and write to pipe
	wg.Add(1)
	go func() {
		defer wg.Done()
		// 1MB chunk buffer for optimal throughput
		buf := make([]byte, 1024*1024)
		for {
			select {
			case <-ctx.Done():
				pw.CloseWithError(ctx.Err())
				return
			default:
			}

			n, err := streamInfo.Body.Read(buf)
			if n > 0 {
				wn, writeErr := pw.Write(buf[:n])
				if writeErr != nil {
					downloadErr = fmt.Errorf("pipe write error: %w", writeErr)
					pw.CloseWithError(writeErr)
					return
				}
				job.bytesTransferred.Add(int64(wn))
			}

			if err != nil {
				if err == io.EOF {
					pw.Close() // Finished successfully
					return
				}
				downloadErr = fmt.Errorf("gdrive read error: %w", err)
				pw.CloseWithError(err)
				return
			}
		}
	}()

	// Goroutine 2 (Consumer Coroutine): Bunny Stream TUS Resumable Chunked Uploader
	uploadDone := make(chan error, 1)
	go func() {
		err := p.bunnyClient.UploadResumableStream(ctx, metadata.GUID, videoTitle, pr, totalBytes)
		uploadDone <- err
	}()

	// Goroutine 3 (Telemetry Monitor Coroutine): Emits speed, % progress, and ETA
	progressTicker := time.NewTicker(500 * time.Millisecond)
	defer progressTicker.Stop()

	go func() {
		var lastBytes int64
		var lastTime = time.Now()

		for {
			select {
			case <-job.doneChan:
				return
			case <-progressTicker.C:
				currentBytes := job.bytesTransferred.Load()
				now := time.Now()
				elapsed := now.Sub(startTime)
				intervalSec := now.Sub(lastTime).Seconds()

				var currentSpeed float64
				if intervalSec > 0 {
					currentSpeed = float64(currentBytes-lastBytes) / intervalSec / (1024 * 1024) // MB/s
				}
				lastBytes = currentBytes
				lastTime = now

				var pct float64
				var etaSec int64
				if totalBytes > 0 {
					pct = (float64(currentBytes) / float64(totalBytes)) * 100.0
					if currentSpeed > 0 {
						remainingBytes := totalBytes - currentBytes
						etaSec = int64(float64(remainingBytes) / (currentSpeed * 1024 * 1024))
					}
				}

				prog := StreamProgress{
					BytesTransferred: currentBytes,
					TotalBytes:       totalBytes,
					Percentage:       pct,
					SpeedMBps:        currentSpeed,
					ETASeconds:       etaSec,
					ElapsedTimeSec:   int64(elapsed.Seconds()),
				}

				job.mu.Lock()
				job.Progress = prog
				job.mu.Unlock()

				if onProgress != nil {
					onProgress(prog)
				}
			}
		}
	}()

	// Wait for producer goroutine to finish piping
	wg.Wait()

	// Wait for consumer upload to complete
	select {
	case uploadErr = <-uploadDone:
	case <-ctx.Done():
		uploadErr = ctx.Err()
	}

	if downloadErr != nil {
		job.mu.Lock()
		job.Status = StatusFailed
		job.Error = downloadErr.Error()
		job.mu.Unlock()
		return nil, downloadErr
	}

	if uploadErr != nil {
		job.mu.Lock()
		job.Status = StatusFailed
		job.Error = uploadErr.Error()
		job.mu.Unlock()
		return nil, fmt.Errorf("bunny upload error: %w", uploadErr)
	}

	// Final success progress update
	finalBytes := job.bytesTransferred.Load()
	elapsed := time.Since(startTime)
	job.mu.Lock()
	job.Status = StatusCompleted
	job.Progress = StreamProgress{
		BytesTransferred: finalBytes,
		TotalBytes:       finalBytes,
		Percentage:       100.0,
		SpeedMBps:        float64(finalBytes) / elapsed.Seconds() / (1024 * 1024),
		ETASeconds:       0,
		ElapsedTimeSec:   int64(elapsed.Seconds()),
	}
	job.mu.Unlock()

	return metadata, nil
}
