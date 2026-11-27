package httpx

import (
	"encoding/json"
	"math"
	"net/http"
	"time"
)

// ApiResponse matches services/api/crates/common/src/response.rs 1:1 (dual data + result keys).
type ApiResponse struct {
	Success   bool   `json:"success"`
	Status    int    `json:"status"`
	Message   string `json:"message"`
	Data      any    `json:"data,omitempty"`
	Result    any    `json:"result,omitempty"`
	Code      string `json:"code,omitempty"`
	Errors    any    `json:"errors,omitempty"`
	Timestamp string `json:"timestamp"`
}

// PageResponse matches NestJS / Rust PageResponse<T>.
type PageResponse struct {
	Content       any   `json:"content"`
	Page          int64 `json:"page"`
	Size          int64 `json:"size"`
	TotalElements int64 `json:"totalElements"`
	TotalPages    int64 `json:"totalPages"`
	Last          bool  `json:"last"`
}

func NewPageResponse(content any, totalElements, page, size int64) PageResponse {
	if size <= 0 {
		size = 20
	}
	totalPages := int64(math.Ceil(float64(totalElements) / float64(size)))
	last := totalPages == 0 || page >= totalPages-1
	return PageResponse{
		Content:       content,
		Page:          page,
		Size:          size,
		TotalElements: totalElements,
		TotalPages:    totalPages,
		Last:          last,
	}
}

func WriteJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func OK(w http.ResponseWriter, data any, message ...string) {
	msg := "Success"
	if len(message) > 0 && message[0] != "" {
		msg = message[0]
	}
	WriteJSON(w, http.StatusOK, ApiResponse{
		Success:   true,
		Status:    http.StatusOK,
		Message:   msg,
		Data:      data,
		Result:    data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func Created(w http.ResponseWriter, data any, message ...string) {
	msg := "Resource created successfully"
	if len(message) > 0 && message[0] != "" {
		msg = message[0]
	}
	WriteJSON(w, http.StatusCreated, ApiResponse{
		Success:   true,
		Status:    http.StatusCreated,
		Message:   msg,
		Data:      data,
		Result:    data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func Error(w http.ResponseWriter, status int, message string, code ...string) {
	c := ""
	if len(code) > 0 {
		c = code[0]
	}
	WriteJSON(w, status, ApiResponse{
		Success:   false,
		Status:    status,
		Message:   message,
		Code:      c,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
}

func DecodeJSON(r *http.Request, dst any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	return dec.Decode(dst)
}
