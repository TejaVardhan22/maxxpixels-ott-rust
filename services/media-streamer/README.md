# MaxxPixels OTT — Google Drive to Bunny.net Stream Pipeline (Go)

A high-throughput, zero-disk, multi-gigabyte video pipeline written in **Go** utilizing **goroutines (coroutines)** and streaming pipes (`io.Pipe`).

Stream massive video files (1 GB – 100+ GB) directly from **Google Drive** to **Bunny.net Stream** without downloading to local disk or running out of memory.

---

## ⚡ Key Highlights

- **Zero-Disk Streaming**: Employs `io.Pipe()`. Data read from Google Drive is streamed directly into the Bunny.net HTTP `PUT` request body. Memory footprint stays constant at ~1 MB – 32 MB even on 50 GB+ 4K files.
- **Concurrent Coroutines (Goroutines)**:
  - **Producer Goroutine**: Fetches chunks from Google Drive, bypasses Google's large-file virus interstitial screens, and streams to the pipe.
  - **Consumer Goroutine**: Streams bytes directly to Bunny.net Stream's edge servers (`https://video.bunnycdn.com/library/.../videos/...`).
  - **Telemetry Goroutine**: Emits live transfer rate (MB/s), % progress, elapsed time, and ETA every 500 ms.
- **Dual Mode**:
  1. **CLI Tool**: Interactive terminal command with dynamic progress bar.
  2. **HTTP Microservice Daemon**: REST endpoints with Server-Sent Events (SSE) for admin dashboard integration.

---

## 🏗 Architecture

```
[ Google Drive URL / ID ]
           │
           ▼
┌───────────────────────────┐
│ Google Drive Downloader   │ (Cookie Jar & Virus Scan Interstitial Bypass)
└─────────────┬─────────────┘
              │  HTTP Stream
              ▼
    [ Goroutine: Producer ]
              │
              │  io.Pipe() In-Memory Stream (1MB chunk buffer)
              ▼
    [ Goroutine: Consumer ]
              │
              ▼  HTTP PUT
┌───────────────────────────┐
│    Bunny.net Stream API   │ ──► Generates HLS, Direct Play Iframe & WebP Previews
└───────────────────────────┘
```

---

## 🚀 Quick Start (CLI Mode)

### 1. Build the Binary
```powershell
cd "c:\Users\ADMIN\Desktop\MaxxPixels OTT\gdrive-bunny-stream"
go build -o gdrive-bunny-stream.exe .
```

### 2. Stream a File
Run directly with a Google Drive share link or File ID:

```powershell
.\gdrive-bunny-stream.exe -gdrive="https://drive.google.com/file/d/1gUyeZgz1DzXanYYSSgEyNOTAc5VN2MSg/view" -title="BRISTI NAMAR PORE - Bengali"
```

The tool will automatically read credentials from your root `.env` file (`BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, and `BUNNY_STREAM_CDN_HOSTNAME`).

You can also specify credentials explicitly:
```powershell
.\gdrive-bunny-stream.exe `
  -gdrive="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" `
  -title="Episode 1" `
  -library="676868" `
  -apikey="CHANGE_ME"
```

### Terminal Progress Output:
```text
🚀 Initializing Goroutine Stream Pipeline...
   Google Drive Source: https://drive.google.com/file/d/1BxiMVs0X.../view
   Target Video Title:  Episode 1

⏳ [48.5%] 2.15 GB / 4.43 GB | Speed: 18.25 MB/s | ETA: 02m:05s
```

Once completed, it prints the streaming metadata:
```text
✅ [SUCCESS] Video successfully streamed directly to Bunny.net!
------------------------------------------------------------------
 Video GUID:       12345678-abcd-1234-abcd-123456789abc
 Direct Play URL:  https://iframe.mediadelivery.net/play/676868/12345678-abcd-1234-abcd-123456789abc
 HLS Playlist:     https://vz-bb76d46f-94f.b-cdn.net/12345678-abcd-1234-abcd-123456789abc/playlist.m3u8
 Thumbnail URL:    https://vz-bb76d46f-94f.b-cdn.net/12345678-abcd-1234-abcd-123456789abc/thumbnail.jpg
 Preview URL:      https://vz-bb76d46f-94f.b-cdn.net/12345678-abcd-1234-abcd-123456789abc/preview.webp
------------------------------------------------------------------
```

---

## 🌐 Microservice Mode (HTTP Daemon)

Start the server on port `8085` (or any custom port):

```powershell
.\gdrive-bunny-stream.exe -server -port=8085
```

### Endpoints

#### 1. Trigger Async Upload
```http
POST /api/stream-gdrive
Content-Type: application/json

{
  "gdriveUrl": "https://drive.google.com/file/d/1XyZ.../view?usp=sharing",
  "title": "Blockbuster Movie 2026",
  "bearerToken": ""  // Optional: only if using Google Drive OAuth token for private files
}
```

**Response (HTTP 202 Accepted):**
```json
{
  "jobId": "job_1771927800000000000",
  "status": "ACCEPTED",
  "message": "Goroutine pipeline spawned. Stream running asynchronously."
}
```

#### 2. Poll Job Status
```http
GET /api/jobs/{jobId}
```

**Response (HTTP 200 OK):**
```json
{
  "id": "job_1771927800000000000",
  "gdriveUrl": "https://drive.google.com/file/d/1XyZ.../view",
  "videoTitle": "Blockbuster Movie 2026",
  "status": "STREAMING",
  "progress": {
    "bytesTransferred": 2306867200,
    "totalBytes": 4758992896,
    "percentage": 48.47,
    "speedMBps": 19.34,
    "etaSeconds": 126,
    "elapsedTimeSec": 119
  },
  "videoMetadata": {
    "guid": "c092f69e-58c0-4229-87a2-bb5bbcf2d3ae",
    "libraryId": "676868",
    "title": "Blockbuster Movie 2026",
    "hlsUrl": "https://vz-bb76d46f-94f.b-cdn.net/c092f69e-58c0-4229-87a2-bb5bbcf2d3ae/playlist.m3u8",
    "directPlayUrl": "https://iframe.mediadelivery.net/play/676868/c092f69e-58c0-4229-87a2-bb5bbcf2d3ae",
    "thumbnailUrl": "https://vz-bb76d46f-94f.b-cdn.net/c092f69e-58c0-4229-87a2-bb5bbcf2d3ae/thumbnail.jpg",
    "previewUrl": "https://vz-bb76d46f-94f.b-cdn.net/c092f69e-58c0-4229-87a2-bb5bbcf2d3ae/preview.webp"
  }
}
```

#### 3. Real-Time Server-Sent Events (SSE)
```http
GET /api/jobs/{jobId}/events
```
Emits real-time progress chunks every 500 ms to display live progress bars on web UI dashboards.

---

## ⚙️ Environment Variables

Defined in `.env`:
```env
BUNNY_STREAM_LIBRARY_ID=676868
BUNNY_STREAM_API_KEY=CHANGE_ME
BUNNY_STREAM_CDN_HOSTNAME=vz-bb76d46f-94f.b-cdn.net
```
