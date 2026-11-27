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
		sub.Post("/register-token", h.registerToken)
	}

	mountAnalytics := func(sub chi.Router) {
		sub.Use(h.tokens.OptionalAuth)
		sub.Post("/events", h.recordEvent)
		sub.Post("/event", h.recordEvent)
		sub.Post("/track", h.recordEvent)
		sub.Post("/interaction", h.recordEvent)
	}

	mountAdmin := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)

		// Settings & Connection Testers
		sub.Get("/settings", h.publicSettings)
		sub.Put("/settings", h.updateSettings)
		sub.Post("/settings", h.updateSettings)
		sub.Get("/settings/key/{key}", h.getSettingByKey)
		sub.Put("/settings/key/{key}", h.upsertSettingByKey)
		sub.Delete("/settings/key/{key}", h.deleteSettingByKey)
		sub.Get("/settings/group/{group}", h.settingsByGroup)
		sub.Get("/settings/history", h.settingsHistory)
		sub.Get("/settings/audit-logs", h.settingsHistory)
		sub.Post("/settings/rollback/{id}", h.rollbackSetting)
		sub.Post("/settings/test-connection", h.testConnection("core"))
		sub.Post("/settings/test", h.testConnection("core"))
		sub.Post("/settings/test-bunny-storage", h.testConnection("bunny-storage"))
		sub.Post("/settings/test-bunny-stream", h.testConnection("bunny-stream"))
		sub.Post("/settings/test-s3", h.testS3)
		sub.Post("/settings/test-razorpay", h.testConnection("razorpay"))
		sub.Post("/settings/test-stripe", h.testConnection("stripe"))

		// CMS, Banners & Sections
		sub.Get("/cms/pages", h.listPages)
		sub.Get("/cms/sections", h.adminListSections)
		sub.Post("/cms/sections", h.adminUpsertSection)
		sub.Patch("/cms/sections/order", h.adminReorderSections)
		sub.Put("/cms/sections/{id}", h.adminUpsertSection)
		sub.Delete("/cms/sections/{id}", h.adminDeleteSection)
		sub.Post("/cms/sections/{id}/items", h.adminAddSectionItem)
		sub.Delete("/cms/sections/{id}/items/{item_id}", h.adminRemoveSectionItem)
		sub.Get("/cms/banners", h.adminListBanners)
		sub.Post("/cms/banners", h.adminUpsertBanner)
		sub.Put("/cms/banners/{id}", h.adminUpsertBanner)
		sub.Delete("/cms/banners/{id}", h.adminDeleteBanner)
		sub.Get("/banners", h.adminListBanners)
		sub.Post("/banners", h.adminUpsertBanner)
		sub.Put("/banners/{id}", h.adminUpsertBanner)
		sub.Delete("/banners/{id}", h.adminDeleteBanner)

		// Legal Pages write
		sub.Get("/legal", h.legalPages)
		sub.Post("/legal", h.upsertLegalPage)
		sub.Get("/legal/{slug}", h.getLegalPage)
		sub.Put("/legal/{slug}", h.upsertLegalPage)
		sub.Get("/legal-pages", h.legalPages)
		sub.Post("/legal-pages", h.upsertLegalPage)

		// Admin Devices & Security / RBAC / Audit Logs
		sub.Get("/devices", h.adminListDevices)
		sub.Delete("/devices/{id}", h.adminDeleteDevice)
		sub.Post("/devices/{id}/revoke", h.adminRevokeDevice)
		sub.Post("/devices/{id}/disconnect", h.adminRevokeDevice)
		sub.Post("/devices/user/{user_id}/disconnect-all", h.adminDisconnectUserDevices)
		sub.Get("/security/roles", h.adminListRoles)
		sub.Post("/security/roles", h.adminUpsertRole)
		sub.Put("/security/roles/{id}", h.adminUpsertRole)
		sub.Delete("/security/roles/{id}", h.adminDeleteRole)
		sub.Get("/security/settings", h.getSecuritySettings)
		sub.Put("/security/settings", h.updateSecuritySettings)
		sub.Get("/security/matrix", h.getPermissionMatrix)
		sub.Put("/security/matrix", h.updatePermissionMatrix)
		sub.Get("/security/audit-logs", h.settingsHistory)
		sub.Get("/audit-logs", h.settingsHistory)

		// DRM Rules CRUD
		for _, drmPref := range []string{"/drm/rules", "/drm-rules"} {
			sub.Get(drmPref, h.listDRMRules)
			sub.Post(drmPref, h.upsertDRMRule)
			sub.Put(drmPref+"/{id}", h.upsertDRMRule)
			sub.Delete(drmPref+"/{id}", h.deleteDRMRule)
		}

		// Backups & Migrations
		sub.Get("/backup", h.listBackups)
		sub.Get("/backup/list", h.listBackups)
		sub.Get("/backup/migrations", h.listMigrations)
		sub.Post("/backup/export", h.triggerBackup)
		sub.Post("/backup/trigger", h.triggerBackup)
		sub.Post("/backup/run", h.triggerBackup)
		sub.Get("/backup/download/{filename}", h.downloadBackup)
		sub.Delete("/backup/{filename}", h.deleteBackup)

		// Master Taxonomy & Cast CRUD
		sub.Get("/cast", h.listCastMembers)
		sub.Post("/cast", h.upsertCastMember)
		sub.Put("/cast/{id}", h.upsertCastMember)
		sub.Delete("/cast/{id}", h.deleteCastMember)
		sub.Get("/content-types", h.adminListContentTypes)
		sub.Post("/content-types", h.adminUpsertContentType)
		sub.Put("/content-types/{id}", h.adminUpsertContentType)
		sub.Delete("/content-types/{id}", h.adminDeleteContentType)
		sub.Get("/categories", h.adminListCategories)
		sub.Post("/categories", h.adminUpsertCategory)
		sub.Put("/categories/{id}", h.adminUpsertCategory)
		sub.Delete("/categories/{id}", h.adminDeleteCategory)
		sub.Get("/genres", h.adminListGenres)
		sub.Post("/genres", h.adminUpsertGenre)
		sub.Put("/genres/{id}", h.adminUpsertGenre)
		sub.Delete("/genres/{id}", h.adminDeleteGenre)
		sub.Get("/languages", h.adminListLanguages)
		sub.Post("/languages", h.adminUpsertLanguage)
		sub.Put("/languages/{code}", h.adminUpsertLanguage)
		sub.Delete("/languages/{code}", h.adminDeleteLanguage)

		// Admin Notifications (FCM HTTP v1 Push + MSG91 SMS + Templates + Daily Expiry)
		sub.Get("/notifications/history", h.adminNotificationHistory)
		sub.Get("/notifications/devices", h.adminListDevices)
		sub.Get("/notifications/config", h.adminNotificationConfig)
		sub.Post("/notifications/config", h.adminNotificationConfig)
		sub.Post("/notifications/config/{channel}", h.adminNotificationConfig)
		sub.Post("/notifications/test", h.adminNotificationConfig)
		sub.Post("/notifications/push/topic", h.adminPushTopic)
		sub.Post("/notifications/push/user/{userId}", h.adminPushUser)
		sub.Post("/notifications/sms/send", h.adminSendSMS)
		sub.Get("/notifications/templates", h.adminListNotificationTemplates)
		sub.Post("/notifications/templates", h.adminUpsertNotificationTemplate)
		sub.Put("/notifications/templates/{id}", h.adminUpsertNotificationTemplate)
		sub.Delete("/notifications/templates/{id}", h.adminDeleteNotificationTemplate)
		sub.Post("/notifications/run-expiry-check", h.adminRunExpiryNotifications)

		// Centralized Service Logs & Transactional Outbox Inspector
		sub.Get("/logs", h.adminListServiceLogs)
		sub.Get("/outbox", h.adminListOutboxEvents)
		sub.Post("/outbox/retry", h.adminRetryOutboxEvents)

		// Dedicated Platform Admin Command Center (live probes, DB/Redis pool, atomic admin CRUD)
		sub.Get("/platform/overview", h.platformOverview)
		sub.Get("/platform/admins", h.platformListAdmins)
		sub.Post("/platform/admins", h.platformCreateAdmin)
		sub.Put("/platform/admins/{id}/role", h.platformUpdateAdminRole)
		sub.Post("/platform/admins/{id}/status", h.platformUpdateAdminStatus)
		sub.Post("/platform/admins/{id}/reset-password", h.platformResetAdminPassword)
		sub.Post("/platform/maintenance", h.platformToggleMaintenance)
		sub.Get("/activity-logs", h.adminListActivityLogs)
		sub.Post("/notifications/sms/bulk", h.adminSendSMS)
		sub.Post("/notifications/whatsapp/send", h.adminSendWhatsApp)
		sub.Post("/notifications/whatsapp/bulk", h.adminSendWhatsApp)

		// Admin Analytics & Realtime SSE
		sub.Get("/analytics", h.dashboardOverview)
		sub.Get("/analytics/overview", h.dashboardOverview)
		sub.Get("/analytics/summary", h.dashboardOverview)
		sub.Get("/analytics/stats", h.dashboardOverview)
		sub.Get("/analytics/dashboard", h.dashboardOverview)
		sub.Get("/analytics/realtime", h.realtimeAnalytics)
		sub.Get("/analytics/live-streams", h.realtimeAnalytics)
		sub.Get("/analytics/live", h.realtimeAnalytics)
		sub.Get("/analytics/stream", h.analyticsSSE)
		sub.Get("/analytics/sse", h.analyticsSSE)
		sub.Get("/analytics/ops-chat", h.listOpsChat)
		sub.Post("/analytics/ops-chat", h.postOpsChat)
		sub.Get("/dashboard", h.dashboardOverview)
		sub.Get("/dashboard/ops-chat", h.listOpsChat)
		sub.Post("/dashboard/ops-chat", h.postOpsChat)
	}

	mountBackup := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.listBackups)
		sub.Get("/list", h.listBackups)
		sub.Get("/migrations", h.listMigrations)
		sub.Post("/export", h.triggerBackup)
		sub.Post("/trigger", h.triggerBackup)
		sub.Post("/run", h.triggerBackup)
		sub.Get("/download/{filename}", h.downloadBackup)
		sub.Delete("/{filename}", h.deleteBackup)
	}

	r.Post("/internal/admin-audit", h.internalIngestAdminAudit)

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/notifications", mountNotifs)
		r.Route(pref+"/analytics", mountAnalytics)
		r.Route(pref+"/admin", mountAdmin)
		r.Route(pref+"/backup", mountBackup)
		r.Get(pref+"/cast", h.listCastMembers)
		r.Get(pref+"/settings", h.publicSettings)
		r.Get(pref+"/settings/public", h.publicSettings)
		r.Get(pref+"/general_setting", h.publicSettings)
		r.Get(pref+"/system/maintenance", h.maintenanceStatus)
		r.Get(pref+"/cms/home", h.homePage)
		r.Get(pref+"/cms/pages/home", h.homePage)
		r.Get(pref+"/cms/pages/{slug}", h.pageBySlug)
		r.Get(pref+"/home", h.homePage)
		r.Get(pref+"/pages", h.listPages)
		r.Get(pref+"/pages/home", h.homePage)
		r.Get(pref+"/pages/{slug}", h.pageBySlug)
		r.Get(pref+"/legal", h.legalPages)
		r.Get(pref+"/legal/{slug}", h.getLegalPage)
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
	tf := r.URL.Query().Get("timeframe")
	if tf == "" {
		tf = "30d"
	}
	data, err := h.svc.GetDetailedAnalytics(r.Context(), tf)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data)
}
