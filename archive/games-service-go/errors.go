package main

import (
	"encoding/json"
	"net/http"
	"time"
)

type AppError struct {
	Status  int
	Code    string
	Message string
}

func (e *AppError) Error() string { return e.Message }

func NewNotFound(msg string) *AppError     { return &AppError{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: msg} }
func NewBadRequest(msg string) *AppError   { return &AppError{Status: http.StatusBadRequest, Code: "BAD_REQUEST", Message: msg} }
func NewUnauthorized(msg string) *AppError { return &AppError{Status: http.StatusUnauthorized, Code: "UNAUTHORIZED", Message: msg} }
func NewForbidden(msg string) *AppError    { return &AppError{Status: http.StatusForbidden, Code: "FORBIDDEN", Message: msg} }
func NewDatabase(msg string) *AppError     { return &AppError{Status: http.StatusInternalServerError, Code: "DATABASE_ERROR", Message: msg} }
func NewInternal(msg string) *AppError     { return &AppError{Status: http.StatusInternalServerError, Code: "INTERNAL_ERROR", Message: msg} }

func writeAppError(w http.ResponseWriter, err error) {
	app, ok := err.(*AppError)
	if !ok {
		app = NewInternal(err.Error())
	}
	body := map[string]interface{}{
		"success":   false,
		"status":    app.Status,
		"message":   app.Message,
		"code":      app.Code,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(app.Status)
	_ = json.NewEncoder(w).Encode(body)
}
