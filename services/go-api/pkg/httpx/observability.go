package httpx

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	metricsStartedAt = time.Now().UTC()
	metricsMu        sync.Mutex
	reqCounts        = map[string]int64{}
	reqDurSum        = map[string]int64{}
	reqDurCnt        = map[string]int64{}
	otlpClient       = &http.Client{Timeout: 2 * time.Second}
)

func recordHTTPMetric(service, method string, status int, durMs int64) {
	key := service + "|" + method + "|" + strconv.Itoa(status)
	metricsMu.Lock()
	reqCounts[key]++
	reqDurSum[service] += durMs
	reqDurCnt[service]++
	metricsMu.Unlock()
}

// MetricsHandler exposes Prometheus-format HTTP & Go runtime metrics for Grafana/Prometheus.
func MetricsHandler(serviceName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		var b strings.Builder
		fmt.Fprintf(&b, "# HELP maxx_uptime_seconds Service uptime in seconds\n# TYPE maxx_uptime_seconds gauge\nmaxx_uptime_seconds{service=%q} %.2f\n", serviceName, time.Since(metricsStartedAt).Seconds())
		fmt.Fprintf(&b, "# HELP maxx_goroutines Current goroutines\n# TYPE maxx_goroutines gauge\nmaxx_goroutines{service=%q} %d\n", serviceName, runtime.NumGoroutine())
		fmt.Fprintf(&b, "# HELP maxx_memory_alloc_bytes Allocated heap bytes\n# TYPE maxx_memory_alloc_bytes gauge\nmaxx_memory_alloc_bytes{service=%q} %d\n", serviceName, mem.Alloc)

		metricsMu.Lock()
		fmt.Fprintf(&b, "# HELP maxx_http_requests_total Total HTTP requests\n# TYPE maxx_http_requests_total counter\n")
		for k, cnt := range reqCounts {
			parts := strings.SplitN(k, "|", 3)
			if len(parts) == 3 {
				fmt.Fprintf(&b, "maxx_http_requests_total{service=%q,method=%q,status=%q} %d\n", parts[0], parts[1], parts[2], cnt)
			}
		}
		fmt.Fprintf(&b, "# HELP maxx_http_request_duration_ms_sum Sum of HTTP request durations in ms\n# TYPE maxx_http_request_duration_ms_sum counter\n")
		for svc, sum := range reqDurSum {
			fmt.Fprintf(&b, "maxx_http_request_duration_ms_sum{service=%q} %d\n", svc, sum)
		}
		fmt.Fprintf(&b, "# HELP maxx_http_request_duration_ms_count Count of HTTP requests\n# TYPE maxx_http_request_duration_ms_count counter\n")
		for svc, cnt := range reqDurCnt {
			fmt.Fprintf(&b, "maxx_http_request_duration_ms_count{service=%q} %d\n", svc, cnt)
		}
		metricsMu.Unlock()

		_, _ = w.Write([]byte(b.String()))
	}
}

func randomHex(nBytes int) string {
	b := make([]byte, nBytes)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// exportOTLPSpanAsync sends a lightweight OTLP/HTTP JSON span to Jaeger (when JAEGER_OTLP_ENDPOINT is set).
func exportOTLPSpanAsync(service, method, path, traceID, spanID string, status int, start, end time.Time) {
	endpoint := strings.TrimSpace(os.Getenv("JAEGER_OTLP_ENDPOINT"))
	if endpoint == "" {
		return
	}
	if traceID == "" {
		traceID = randomHex(16)
	}
	if spanID == "" {
		spanID = randomHex(8)
	}
	payload := map[string]any{
		"resourceSpans": []any{
			map[string]any{
				"resource": map[string]any{
					"attributes": []any{
						map[string]any{"key": "service.name", "value": map[string]any{"stringValue": service}},
					},
				},
				"scopeSpans": []any{
					map[string]any{
						"spans": []any{
							map[string]any{
								"traceId":           traceID,
								"spanId":            spanID,
								"name":              method + " " + path,
								"kind":              2,
								"startTimeUnixNano": strconv.FormatInt(start.UnixNano(), 10),
								"endTimeUnixNano":   strconv.FormatInt(end.UnixNano(), 10),
								"attributes": []any{
									map[string]any{"key": "http.method", "value": map[string]any{"stringValue": method}},
									map[string]any{"key": "http.target", "value": map[string]any{"stringValue": path}},
									map[string]any{"key": "http.status_code", "value": map[string]any{"intValue": strconv.Itoa(status)}},
								},
							},
						},
					},
				},
			},
		},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	go func() {
		req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := otlpClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}()
}
