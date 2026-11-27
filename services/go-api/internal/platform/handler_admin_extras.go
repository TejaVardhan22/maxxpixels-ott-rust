package platform

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

func (h *Handler) rollbackSetting(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid history id")
		return
	}
	res, err := h.svc.RollbackSetting(r.Context(), id, claims.Email)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, res, "Setting rolled back")
}

func (h *Handler) testS3(w http.ResponseWriter, r *http.Request) {
	ok := os.Getenv("S3_BUCKET") != "" && os.Getenv("AWS_ACCESS_KEY_ID") != ""
	httpx.OK(w, map[string]any{"provider": "S3", "connected": ok})
}

func (h *Handler) getSecuritySettings(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.GetJSONSetting(r.Context(), "security_settings", map[string]any{
		"enforce2FA":        false,
		"maxLoginAttempts":  5,
		"sessionTtlSeconds": 86400,
	}))
}

func (h *Handler) updateSecuritySettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.SaveJSONSetting(r.Context(), "security_settings", body, claims.Email)
	httpx.OK(w, body, "Security settings updated")
}

func (h *Handler) getPermissionMatrix(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.GetJSONSetting(r.Context(), "security_permission_matrix", map[string]any{}))
}

func (h *Handler) updatePermissionMatrix(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.SaveJSONSetting(r.Context(), "security_permission_matrix", body, claims.Email)
	httpx.OK(w, body, "Permission matrix updated")
}

func (h *Handler) listDRMRules(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.ListDRMRules(r.Context()))
}

func (h *Handler) upsertDRMRule(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.UpsertDRMRule(r.Context(), id, body, claims.Email)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) deleteDRMRule(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.DeleteDRMRule(r.Context(), id, claims.Email)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) listBackups(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.ListBackups())
}

func (h *Handler) listMigrations(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.ListMigrations(r.Context()))
}

func (h *Handler) triggerBackup(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.TriggerBackup(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.Created(w, res, "Backup created")
}

func (h *Handler) downloadBackup(w http.ResponseWriter, r *http.Request) {
	fname := chi.URLParam(r, "filename")
	data, err := h.svc.ReadBackup(fname)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Backup file not found")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fname))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

func (h *Handler) deleteBackup(w http.ResponseWriter, r *http.Request) {
	fname := chi.URLParam(r, "filename")
	if err := h.svc.DeleteBackup(fname); err != nil {
		httpx.Error(w, http.StatusNotFound, "Backup file not found")
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "filename": fname})
}

func (h *Handler) adminSendWhatsApp(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone    string   `json:"phone"`
		Mobile   string   `json:"mobile"`
		Phones   []string `json:"phones"`
		Mobiles  []string `json:"mobiles"`
		Template string   `json:"templateName"`
		Message  string   `json:"message"`
	}
	_ = httpx.DecodeJSON(r, &body)
	targets := append([]string{}, body.Phones...)
	targets = append(targets, body.Mobiles...)
	if body.Phone != "" {
		targets = append(targets, body.Phone)
	}
	if body.Mobile != "" {
		targets = append(targets, body.Mobile)
	}
	res, err := h.svc.AdminSendWhatsApp(r.Context(), targets, body.Template, body.Message)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "WhatsApp message dispatched")
}
