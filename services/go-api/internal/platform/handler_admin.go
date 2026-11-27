package platform

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
)

// --- Public CMS & Legal ---

func (h *Handler) listPages(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.ListPages(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) homePage(w http.ResponseWriter, r *http.Request) {
	data, _ := h.svc.GetPageBySlug(r.Context(), "home")
	httpx.OK(w, data)
}

func (h *Handler) pageBySlug(w http.ResponseWriter, r *http.Request) {
	data, _ := h.svc.GetPageBySlug(r.Context(), chi.URLParam(r, "slug"))
	httpx.OK(w, data)
}

func (h *Handler) getLegalPage(w http.ResponseWriter, r *http.Request) {
	row, err := h.svc.GetLegalPage(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) upsertLegalPage(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Slug    string `json:"slug"`
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	_ = httpx.DecodeJSON(r, &body)
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		slug = body.Slug
	}
	row, err := h.svc.UpsertLegalPage(r.Context(), slug, body.Title, body.Content)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Legal page saved")
}

// --- Admin CMS Banners & Sections ---

func (h *Handler) adminListBanners(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListBanners(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertBanner(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertBanner(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteBanner(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteBanner(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminListSections(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListSections(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertSection(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertSection(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminReorderSections(w http.ResponseWriter, r *http.Request) {
	var body struct {
		IDs []int64 `json:"ids"`
	}
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.AdminReorderSections(r.Context(), body.IDs)
	httpx.OK(w, map[string]any{"reordered": true})
}

func (h *Handler) adminDeleteSection(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteSection(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminAddSectionItem(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		ContentID    int64 `json:"contentId"`
		DisplayOrder int32 `json:"displayOrder"`
	}
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.AdminAddSectionItem(r.Context(), sid, body.ContentID, body.DisplayOrder)
	httpx.OK(w, map[string]any{"added": true})
}

func (h *Handler) adminRemoveSectionItem(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	iid, _ := strconv.ParseInt(chi.URLParam(r, "item_id"), 10, 64)
	_ = h.svc.AdminRemoveSectionItem(r.Context(), sid, iid)
	httpx.OK(w, map[string]any{"removed": true})
}

// --- Settings Suite ---

func (h *Handler) getSettingByKey(w http.ResponseWriter, r *http.Request) {
	row, err := h.svc.GetSettingByKey(r.Context(), chi.URLParam(r, "key"))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) upsertSettingByKey(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	key := chi.URLParam(r, "key")
	var body struct {
		Value string `json:"value"`
	}
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.AdminUpdateSettings(r.Context(), map[string]string{key: body.Value}, claims.Email)
	httpx.OK(w, map[string]any{"key": key, "value": body.Value})
}

func (h *Handler) deleteSettingByKey(w http.ResponseWriter, r *http.Request) {
	key := chi.URLParam(r, "key")
	_ = h.svc.DeleteSettingByKey(r.Context(), key)
	httpx.OK(w, map[string]any{"deleted": true, "key": key})
}

func (h *Handler) settingsByGroup(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.GetSettingsByGroup(r.Context(), chi.URLParam(r, "group"))
	httpx.OK(w, rows)
}

func (h *Handler) settingsHistory(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.GetSettingsHistory(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) testConnection(target string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		httpx.OK(w, h.svc.TestIntegration(r.Context(), target))
	}
}

// --- Admin Devices, Roles, Masters, Notifications & Realtime Analytics ---

func (h *Handler) adminListDevices(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListDevices(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminRevokeDevice(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminRevokeDevice(r.Context(), id)
	httpx.OK(w, map[string]any{"revoked": true, "id": id})
}

func (h *Handler) adminDeleteDevice(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteDevice(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminDisconnectUserDevices(w http.ResponseWriter, r *http.Request) {
	uid, _ := strconv.ParseInt(chi.URLParam(r, "user_id"), 10, 64)
	n, _ := h.svc.AdminDisconnectUserDevices(r.Context(), uid)
	httpx.OK(w, map[string]any{"disconnected": n})
}

func (h *Handler) adminListRoles(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListRoles(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertRole(r.Context(), id, body.Name, body.Description)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteRole(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminUpsertContentType(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertContentType(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteContentType(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.db.WithContext(r.Context()).Model(&models.ContentType{}).Where("id = ?", id).Update("is_active", false).Error
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminUpsertCategory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertCategory(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.db.WithContext(r.Context()).Model(&models.Category{}).Where("id = ?", id).Update("is_active", false).Error
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminUpsertGenre(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertGenre(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteGenre(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.db.WithContext(r.Context()).Delete(&models.Genre{}, id).Error
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminUpsertLanguage(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertLanguage(r.Context(), code, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteLanguage(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	_ = h.svc.db.WithContext(r.Context()).Model(&models.Language{}).Where("LOWER(code) = LOWER(?)", code).Update("is_active", false).Error
	httpx.OK(w, map[string]any{"deleted": true, "code": code})
}

func (h *Handler) adminNotificationHistory(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminNotificationHistory(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminPushUser(w http.ResponseWriter, r *http.Request) {
	uid, _ := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	var body struct {
		Title   string `json:"title"`
		Message string `json:"message"`
		Body    string `json:"body"`
		Type    string `json:"type"`
	}
	_ = httpx.DecodeJSON(r, &body)
	msg := body.Message
	if msg == "" {
		msg = body.Body
	}
	res, err := h.svc.AdminPushToUser(r.Context(), uid, body.Title, msg, body.Type)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "Notification dispatched")
}

func (h *Handler) adminPushTopic(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Topic     string `json:"topic"`
		Audience  string `json:"targetAudience"`
		Title     string `json:"title"`
		Message   string `json:"message"`
		Body      string `json:"body"`
		ImageURL  string `json:"imageUrl"`
		ActionURL string `json:"actionUrl"`
	}
	_ = httpx.DecodeJSON(r, &body)
	topic := body.Topic
	if topic == "" {
		topic = body.Audience
	}
	msg := body.Message
	if msg == "" {
		msg = body.Body
	}
	res, err := h.svc.AdminPushTopic(r.Context(), topic, body.Title, msg, body.ImageURL, body.ActionURL)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "Topic push dispatched via FCM")
}

func (h *Handler) adminSendSMS(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone      string   `json:"phone"`
		Mobile     string   `json:"mobile"`
		Phones     []string `json:"phones"`
		Mobiles    []string `json:"mobiles"`
		TemplateID string   `json:"templateId"`
		Message    string   `json:"message"`
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
	res, err := h.svc.AdminSendSMS(r.Context(), targets, body.TemplateID, body.Message)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "SMS dispatched via MSG91")
}

func (h *Handler) adminNotificationConfig(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.AdminNotificationConfig())
}

func (h *Handler) realtimeAnalytics(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.GetRealtimeAnalytics(r.Context()))
}

func (h *Handler) analyticsSSE(w http.ResponseWriter, r *http.Request) {
	h.svc.StreamAnalyticsSSE(w, r)
}

func (h *Handler) listCastMembers(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.ListCastMembers(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) upsertCastMember(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.UpsertCastMember(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) deleteCastMember(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.DeleteCastMember(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) listOpsChat(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.ListOpsChat(r.Context()))
}

func (h *Handler) postOpsChat(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	var body struct {
		Message string `json:"message"`
		Text    string `json:"text"`
	}
	_ = httpx.DecodeJSON(r, &body)
	msg := body.Message
	if msg == "" {
		msg = body.Text
	}
	sender := claims.Email
	if sender == "" {
		sender = "Admin"
	}
	httpx.Created(w, h.svc.PostOpsChat(r.Context(), sender, msg))
}
