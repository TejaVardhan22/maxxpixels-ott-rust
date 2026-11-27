package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/bunny"
	"github.com/maxxpixels/go-api/pkg/models"
	"gorm.io/gorm"
)

// --- CMS, Pages, Banners & Sections ---

func (s *Service) ListPages(ctx context.Context) ([]models.Page, error) {
	var rows []models.Page
	err := s.db.WithContext(ctx).Order("COALESCE(display_order, 0) ASC, id ASC").Find(&rows).Error
	return rows, err
}

func (s *Service) GetPageBySlug(ctx context.Context, slug string) (map[string]any, error) {
	var page models.Page
	_ = s.db.WithContext(ctx).Where("LOWER(slug) = LOWER(?)", slug).First(&page).Error
	var banners []models.Banner
	_ = s.db.WithContext(ctx).Where("COALESCE(is_active, TRUE) = TRUE").Order("COALESCE(display_order, 0) ASC").Find(&banners).Error
	var sections []models.Section
	q := s.db.WithContext(ctx).Where("COALESCE(is_active, TRUE) = TRUE")
	if page.ID > 0 {
		q = q.Where("page_id = ?", page.ID)
	}
	_ = q.Order("COALESCE(display_order, 0) ASC").Find(&sections).Error
	return map[string]any{
		"page":     page,
		"slug":     slug,
		"banners":  banners,
		"sections": sections,
	}, nil
}

func (s *Service) AdminListBanners(ctx context.Context) ([]models.Banner, error) {
	var rows []models.Banner
	err := s.db.WithContext(ctx).Order("COALESCE(display_order, 0) ASC, id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertBanner(ctx context.Context, id int64, body map[string]any) (*models.Banner, error) {
	now := time.Now().UTC()
	if id == 0 {
		title := psVal(body, "title")
		if title == "" {
			return nil, errors.New("title is required")
		}
		active := true
		ord := pi32(body, "displayOrder", "display_order")
		b := models.Banner{
			Title:          title,
			Subtitle:       pOptStr(psVal(body, "subtitle")),
			ImageUrl:       pOptStr(psVal(body, "imageUrl", "image_url")),
			MobileImageUrl: pOptStr(psVal(body, "mobileImageUrl", "mobile_image_url")),
			ActionUrl:      pOptStr(psVal(body, "actionUrl", "action_url", "targetUrl")),
			TargetUrl:      pOptStr(psVal(body, "targetUrl", "actionUrl")),
			TrailerUrl:     pOptStr(psVal(body, "trailerUrl", "trailer_url")),
			Placement:      pOptStr(psVal(body, "placement")),
			PageSlug:       pOptStr(psVal(body, "pageSlug", "page_slug")),
			DisplayOrder:   &ord,
			IsActive:       &active,
			CreatedAt:      &now,
		}
		if cid := pi64(body, "contentId", "content_id"); cid > 0 {
			b.ContentId = &cid
		}
		if err := s.db.WithContext(ctx).Create(&b).Error; err != nil {
			return nil, err
		}
		return &b, nil
	}
	upd := map[string]any{}
	for _, m := range [][2]string{
		{"title", "title"}, {"subtitle", "subtitle"}, {"imageUrl", "image_url"},
		{"mobileImageUrl", "mobile_image_url"}, {"actionUrl", "action_url"},
		{"targetUrl", "target_url"}, {"trailerUrl", "trailer_url"}, {"placement", "placement"}, {"pageSlug", "page_slug"},
	} {
		if v := psVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = pbVal(body, "isActive")
	}
	if _, ok := body["displayOrder"]; ok {
		upd["display_order"] = pi32(body, "displayOrder")
	}
	_ = s.db.WithContext(ctx).Model(&models.Banner{}).Where("id = ?", id).Updates(upd).Error
	var out models.Banner
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminDeleteBanner(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.Banner{}, id).Error
}

func (s *Service) AdminListSections(ctx context.Context) ([]models.Section, error) {
	var rows []models.Section
	err := s.db.WithContext(ctx).Order("COALESCE(display_order, 0) ASC, id ASC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertSection(ctx context.Context, id int64, body map[string]any) (*models.Section, error) {
	now := time.Now().UTC()
	if id == 0 {
		title := psVal(body, "title")
		if title == "" {
			return nil, errors.New("title is required")
		}
		active := true
		ord := pi32(body, "displayOrder", "display_order")
		secType := psVal(body, "type", "sectionType")
		if secType == "" {
			secType = "MANUAL"
		}
		pageID := pi64(body, "pageId", "page_id")
		if pageID <= 0 {
			pageID = 1
		}
		sec := models.Section{
			Title:        title,
			Subtitle:     pOptStr(psVal(body, "subtitle")),
			Type:         secType,
			SectionType:  &secType,
			Layout:       pOptStr(psVal(body, "layout", "layoutStyle")),
			LayoutStyle:  pOptStr(psVal(body, "layoutStyle", "layout")),
			LanguageCode: pOptStr(psVal(body, "languageCode", "language")),
			PageId:       pageID,
			DisplayOrder: &ord,
			IsActive:     &active,
			CreatedAt:    &now,
		}
		if err := s.db.WithContext(ctx).Create(&sec).Error; err != nil {
			return nil, err
		}
		return &sec, nil
	}
	upd := map[string]any{}
	for _, m := range [][2]string{
		{"title", "title"}, {"subtitle", "subtitle"}, {"type", "type"},
		{"layout", "layout"}, {"layoutStyle", "layout_style"}, {"languageCode", "language_code"},
	} {
		if v := psVal(body, m[0]); v != "" {
			upd[m[1]] = v
		}
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = pbVal(body, "isActive")
	}
	if _, ok := body["displayOrder"]; ok {
		upd["display_order"] = pi32(body, "displayOrder")
	}
	_ = s.db.WithContext(ctx).Model(&models.Section{}).Where("id = ?", id).Updates(upd).Error
	var out models.Section
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminReorderSections(ctx context.Context, ids []int64) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for idx, id := range ids {
			if err := tx.Model(&models.Section{}).Where("id = ?", id).Update("display_order", idx).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Service) AdminDeleteSection(ctx context.Context, id int64) error {
	_ = s.db.WithContext(ctx).Exec("DELETE FROM section_items WHERE section_id = ?", id).Error
	return s.db.WithContext(ctx).Delete(&models.Section{}, id).Error
}

func (s *Service) AdminAddSectionItem(ctx context.Context, sectionID, contentID int64, order int32) error {
	return s.db.WithContext(ctx).Exec(
		"INSERT INTO section_items (section_id, content_id, display_order) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
		sectionID, contentID, order,
	).Error
}

func (s *Service) AdminRemoveSectionItem(ctx context.Context, sectionID, itemID int64) error {
	return s.db.WithContext(ctx).Exec(
		"DELETE FROM section_items WHERE section_id = ? AND (id = ? OR content_id = ?)",
		sectionID, itemID, itemID,
	).Error
}

// --- Settings Suite & Legal Pages ---

func (s *Service) GetSettingByKey(ctx context.Context, key string) (*models.SystemSetting, error) {
	var row models.SystemSetting
	if err := s.db.WithContext(ctx).Where("setting_key = ?", key).First(&row).Error; err != nil {
		return nil, errors.New("setting not found")
	}
	return &row, nil
}

func (s *Service) GetSettingsByGroup(ctx context.Context, group string) ([]models.SystemSetting, error) {
	var rows []models.SystemSetting
	err := s.db.WithContext(ctx).Where("LOWER(category) = LOWER(?) OR LOWER(setting_group) = LOWER(?)", group, group).Find(&rows).Error
	return rows, err
}

func (s *Service) DeleteSettingByKey(ctx context.Context, key string) error {
	return s.db.WithContext(ctx).Where("setting_key = ?", key).Delete(&models.SystemSetting{}).Error
}

func (s *Service) GetSettingsHistory(ctx context.Context) ([]map[string]any, error) {
	var rows []map[string]any
	_ = s.db.WithContext(ctx).Table("system_setting_history").Order("id DESC").Limit(100).Find(&rows).Error
	if rows == nil {
		rows = []map[string]any{}
	}
	return rows, nil
}

func (s *Service) TestIntegration(ctx context.Context, target string) map[string]any {
	t := strings.ToLower(strings.TrimSpace(target))
	switch t {
	case "bunny-storage", "bunny_storage":
		c := bunny.NewStorageClientFromEnv("")
		ok := c.StorageZone != "" && c.APIKey != ""
		return map[string]any{"provider": "BUNNY_STORAGE", "connected": ok, "zone": c.StorageZone}
	case "bunny-stream", "bunny_stream":
		c := bunny.NewStreamClientFromEnv()
		ok := c.LibraryID != "" && c.APIKey != ""
		return map[string]any{"provider": "BUNNY_STREAM", "connected": ok, "libraryId": c.LibraryID}
	case "razorpay":
		ok := os.Getenv("RAZORPAY_KEY_ID") != "" && os.Getenv("RAZORPAY_KEY_SECRET") != ""
		return map[string]any{"provider": "RAZORPAY", "connected": ok}
	case "stripe":
		ok := os.Getenv("STRIPE_SECRET_KEY") != ""
		return map[string]any{"provider": "STRIPE", "connected": ok}
	default:
		dbOK := s.db.WithContext(ctx).Exec("SELECT 1").Error == nil
		redisOK := s.cache.Ping(ctx) == nil
		return map[string]any{"provider": "CORE", "connected": dbOK && redisOK, "database": dbOK, "redis": redisOK}
	}
}

func (s *Service) GetLegalPage(ctx context.Context, slug string) (*models.LegalPage, error) {
	var row models.LegalPage
	if err := s.db.WithContext(ctx).Where("LOWER(slug) = LOWER(?)", slug).First(&row).Error; err != nil {
		return nil, errors.New("legal page not found")
	}
	return &row, nil
}

func (s *Service) UpsertLegalPage(ctx context.Context, slug, title, content string) (*models.LegalPage, error) {
	now := time.Now().UTC()
	var row models.LegalPage
	err := s.db.WithContext(ctx).Where("LOWER(slug) = LOWER(?)", slug).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		row = models.LegalPage{
			Slug:      slug,
			Title:     title,
			Content:   content,
			UpdatedAt: now,
		}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	_ = s.db.WithContext(ctx).Model(&row).Updates(map[string]any{
		"title":      title,
		"content":    content,
		"updated_at": now,
	}).Error
	return s.GetLegalPage(ctx, slug)
}

// --- Admin Devices, RBAC Roles, DRM Rules & Cast / Master Taxonomy CRUD ---

func (s *Service) AdminListDevices(ctx context.Context) ([]models.Device, error) {
	var rows []models.Device
	err := s.db.WithContext(ctx).Order("last_active_at DESC").Limit(200).Find(&rows).Error
	return rows, err
}

func (s *Service) AdminRevokeDevice(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Model(&models.Device{}).Where("id = ?", id).Update("is_active", false).Error
}

func (s *Service) AdminDeleteDevice(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.Device{}, id).Error
}

func (s *Service) AdminDisconnectUserDevices(ctx context.Context, userID int64) (int64, error) {
	res := s.db.WithContext(ctx).Model(&models.Device{}).Where("user_id = ?", userID).Update("is_active", false)
	_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).Where("user_id = ? AND is_active = TRUE", userID).Update("is_active", false).Error
	return res.RowsAffected, res.Error
}

func (s *Service) AdminListRoles(ctx context.Context) ([]models.Role, error) {
	var rows []models.Role
	err := s.db.WithContext(ctx).Order("id ASC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertRole(ctx context.Context, id int64, name, desc string) (*models.Role, error) {
	now := time.Now().UTC()
	if id == 0 {
		sys := false
		r := models.Role{Name: strings.ToUpper(strings.TrimSpace(name)), Description: pOptStr(desc), IsSystemRole: &sys, CreatedAt: &now}
		if err := s.db.WithContext(ctx).Create(&r).Error; err != nil {
			return nil, err
		}
		return &r, nil
	}
	_ = s.db.WithContext(ctx).Model(&models.Role{}).Where("id = ?", id).Updates(map[string]any{
		"name":        strings.ToUpper(strings.TrimSpace(name)),
		"description": desc,
	}).Error
	var out models.Role
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminDeleteRole(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.Role{}, id).Error
}

// --- Master Taxonomy CRUD (ContentTypes, Categories, Genres, Languages) ---

func (s *Service) AdminUpsertContentType(ctx context.Context, id int64, body map[string]any) (*models.ContentType, error) {
	now := time.Now().UTC()
	title := psVal(body, "title", "name")
	slug := psVal(body, "slug")
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(title, " ", "-"))
	}
	if id == 0 {
		active := true
		row := models.ContentType{Title: title, Name: &title, Slug: slug, Description: pOptStr(psVal(body, "description")), IconUrl: pOptStr(psVal(body, "iconUrl")), IsActive: &active, CreatedAt: &now, UpdatedAt: &now}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	_ = s.db.WithContext(ctx).Model(&models.ContentType{}).Where("id = ?", id).Updates(map[string]any{"title": title, "name": title, "slug": slug, "updated_at": now}).Error
	var out models.ContentType
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminUpsertCategory(ctx context.Context, id int64, body map[string]any) (*models.Category, error) {
	name := psVal(body, "name", "title")
	slug := psVal(body, "slug")
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(name, " ", "-"))
	}
	if id == 0 {
		active := true
		row := models.Category{Name: name, Slug: slug, Description: pOptStr(psVal(body, "description")), ImageUrl: pOptStr(psVal(body, "imageUrl")), IsActive: &active}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	_ = s.db.WithContext(ctx).Model(&models.Category{}).Where("id = ?", id).Updates(map[string]any{"name": name, "slug": slug}).Error
	var out models.Category
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminUpsertGenre(ctx context.Context, id int64, body map[string]any) (*models.Genre, error) {
	name := psVal(body, "name", "title")
	slug := psVal(body, "slug")
	if slug == "" {
		slug = strings.ToLower(strings.ReplaceAll(name, " ", "-"))
	}
	if id == 0 {
		row := models.Genre{Name: name, Slug: slug}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	_ = s.db.WithContext(ctx).Model(&models.Genre{}).Where("id = ?", id).Updates(map[string]any{"name": name, "slug": slug}).Error
	var out models.Genre
	err := s.db.WithContext(ctx).First(&out, id).Error
	return &out, err
}

func (s *Service) AdminUpsertLanguage(ctx context.Context, code string, body map[string]any) (*models.Language, error) {
	name := psVal(body, "name")
	if code == "" {
		code = strings.ToLower(psVal(body, "code"))
	}
	var row models.Language
	if s.db.WithContext(ctx).Where("LOWER(code) = LOWER(?)", code).First(&row).Error != nil {
		active := true
		row = models.Language{Code: code, Name: name, NativeName: pOptStr(psVal(body, "nativeName")), IsActive: &active}
		if err := s.db.WithContext(ctx).Create(&row).Error; err != nil {
			return nil, err
		}
		return &row, nil
	}
	_ = s.db.WithContext(ctx).Model(&row).Updates(map[string]any{"name": name, "native_name": psVal(body, "nativeName")}).Error
	return &row, nil
}

// --- Admin Notifications & Realtime Analytics ---

func (s *Service) AdminNotificationHistory(ctx context.Context) ([]models.Notification, error) {
	var rows []models.Notification
	err := s.db.WithContext(ctx).Order("created_at DESC").Limit(100).Find(&rows).Error
	return rows, err
}

func (s *Service) AdminPushToUser(ctx context.Context, userID int64, title, message, notifType string) (*models.Notification, error) {
	if notifType == "" {
		notifType = "PUSH"
	}
	now := time.Now().UTC()
	uidStr := fmt.Sprintf("%d", userID)
	st := "SENT"
	tType := "USER"
	n := models.Notification{
		Title:        title,
		Message:      message,
		Channel:      &notifType,
		Status:       &st,
		TargetType:   &tType,
		TargetUserId: &uidStr,
		SentAt:       &now,
		CreatedAt:    now,
	}
	if err := s.db.WithContext(ctx).Create(&n).Error; err != nil {
		return nil, err
	}
	// Also insert into user_notifications inbox so the user sees it immediately
	_ = s.db.WithContext(ctx).Exec(
		"INSERT INTO user_notifications (user_id, title, body, message, notification_type, is_read, created_at) VALUES (?, ?, ?, ?, ?, FALSE, NOW())",
		userID, title, message, message, notifType,
	).Error
	return &n, nil
}

func (s *Service) GetRealtimeAnalytics(ctx context.Context) map[string]any {
	cutoff := time.Now().UTC().Add(-2 * time.Minute)
	var liveSessions int64
	_ = s.db.WithContext(ctx).Model(&models.PlaybackSession{}).
		Where("is_active = TRUE AND COALESCE(last_heartbeat_at, started_at) > ?", cutoff).
		Count(&liveSessions).Error
	var recentEvents int64
	_ = s.db.WithContext(ctx).Model(&models.UserInteraction{}).
		Where("created_at > ?", time.Now().UTC().Add(-1*time.Hour)).
		Count(&recentEvents).Error
	return map[string]any{
		"liveConcurrentStreams": liveSessions,
		"eventsLastHour":        recentEvents,
		"timestamp":             time.Now().UTC().Format(time.RFC3339),
	}
}

func (s *Service) StreamAnalyticsSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	send := func() {
		payload, _ := json.Marshal(s.GetRealtimeAnalytics(r.Context()))
		_, _ = fmt.Fprintf(w, "data: %s\n\n", payload)
		flusher.Flush()
	}
	send()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			send()
		}
	}
}

func psVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func pbVal(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if b, ok := v.(bool); ok {
				return b
			}
		}
	}
	return false
}

func pi32(m map[string]any, keys ...string) int32 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return int32(f)
			}
		}
	}
	return 0
}

func pi64(m map[string]any, keys ...string) int64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return int64(f)
			}
		}
	}
	return 0
}

func pOptStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
