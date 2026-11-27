package platform

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
)

type Handler struct {
	svc    *Service
	tokens *auth.TokenManager
}

func NewHandler(svc *Service, tokens *auth.TokenManager) *Handler {
	return &Handler{svc: svc, tokens: tokens}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	mountNotifs := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Get("/", h.listNotifications)
		sub.Get("/my", h.listNotifications)
		sub.Get("/unread-count", h.unreadCount)
		sub.Post("/read-all", h.markAllRead)
		sub.Delete("/clear-all", h.clearAll)
		sub.Post("/{id}/read", h.markRead)
		sub.Post("/device-token", h.registerToken)
		sub.Post("/fcm-token", h.registerToken)
	}

	mountAnalytics := func(sub chi.Router) {
		sub.Use(h.tokens.OptionalAuth)
		sub.Post("/events", h.recordEvent)
		sub.Post("/event", h.recordEvent)
	}

	mountAdmin := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/settings", h.publicSettings)
		sub.Put("/settings", h.updateSettings)
		sub.Post("/settings", h.updateSettings)
		sub.Get("/analytics/overview", h.dashboardOverview)
		sub.Get("/dashboard", h.dashboardOverview)
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/notifications", mountNotifs)
		r.Route(pref+"/analytics", mountAnalytics)
		r.Route(pref+"/admin", mountAdmin)
		r.Get(pref+"/settings/public", h.publicSettings)
		r.Get(pref+"/system/maintenance", h.maintenanceStatus)
		r.Get(pref+"/legal", h.legalPages)
		r.Get(pref+"/legal-pages", h.legalPages)
	}
}

func (h *Handler) listNotifications(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.GetUserNotifications(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) unreadCount(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	cnt, err := h.svc.GetUnreadCount(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"unreadCount": cnt})
}

func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid notification id")
		return
	}
	_ = h.svc.MarkNotificationRead(r.Context(), uid, id)
	httpx.OK(w, map[string]any{"id": id, "isRead": true})
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	n, _ := h.svc.MarkAllNotificationsRead(r.Context(), uid)
	httpx.OK(w, map[string]any{"markedRead": n})
}

func (h *Handler) clearAll(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	n, _ := h.svc.ClearAllNotifications(r.Context(), uid)
	httpx.OK(w, map[string]any{"cleared": n})
}

func (h *Handler) registerToken(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, map[string]any{"registered": true})
}

func (h *Handler) recordEvent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ContentID       *int64  `json:"contentId"`
		ContentTitle    *string `json:"contentTitle"`
		InteractionType string  `json:"interactionType"`
		EventType       string  `json:"eventType"`
		DeviceType      *string `json:"deviceType"`
	}
	_ = httpx.DecodeJSON(r, &body)
	var uidPtr *int64
	if claims, ok := auth.FromContext(r.Context()); ok {
		if uid, err := claims.ParsedUserID(); err == nil && uid > 0 {
			uidPtr = &uid
		}
	}
	iType := body.InteractionType
	if iType == "" {
		iType = body.EventType
	}
	if iType == "" {
		iType = "VIEW"
	}
	h.svc.EnqueueInteraction(models.UserInteraction{
		UserId:          uidPtr,
		ContentId:       body.ContentID,
		ContentTitle:    body.ContentTitle,
		InteractionType: iType,
		DeviceType:      body.DeviceType,
	})
	httpx.OK(w, map[string]any{"queued": true})
}

func (h *Handler) publicSettings(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetPublicSettings(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data)
}

func (h *Handler) maintenanceStatus(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetPublicSettings(r.Context())
	if err != nil {
		httpx.OK(w, map[string]any{"active": false})
		return
	}
	httpx.OK(w, data["maintenance"])
}

func (h *Handler) updateSettings(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	var updates map[string]string
	if err := httpx.DecodeJSON(r, &updates); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Expected JSON map of key/value settings")
		return
	}
	if err := h.svc.AdminUpdateSettings(r.Context(), updates, claims.Email); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"updated": len(updates)})
}

func (h *Handler) legalPages(w http.ResponseWriter, r *http.Request) {
	pages, err := h.svc.ListLegalPages(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, pages)
}

func (h *Handler) dashboardOverview(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetDashboardOverview(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data)
}
