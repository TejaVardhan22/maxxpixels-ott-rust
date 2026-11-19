package main

import (
	"encoding/json"
	"net/http"
	"time"
)

type APIResponse struct {
	Success   bool        `json:"success"`
	Status    int         `json:"status"`
	Message   string      `json:"message"`
	Data      interface{} `json:"data"`
	Result    interface{} `json:"result"`
	Timestamp string      `json:"timestamp"`
}

func writeSuccess(w http.ResponseWriter, data interface{}, message string, status int) {
	ts := time.Now().UTC().Format(time.RFC3339Nano)
	// Match typical envelope; keep data/result same object.
	resp := APIResponse{Success: true, Status: status, Message: message, Data: data, Result: data, Timestamp: ts}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(resp)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
