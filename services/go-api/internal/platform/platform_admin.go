package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/database"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

var platformBootTime = time.Now().UTC()

var staffRoleCodes = []string{
	"ROLE_SUPER_ADMIN",
	"ROLE_ADMIN",
	"ROLE_CONTENT_MANAGER",
	"ROLE_FINANCE",
	"ROLE_ANALYST",
	"ROLE_MODERATOR",
}

type ServiceProbe struct {
	Name      string `json:"name"`
	URL       string `json:"url"`
	Status    string `json:"status"`
	LatencyMs int64  `json:"latencyMs"`
	Detail    string `json:"detail,omitempty"`
}

type PlatformAdminInput struct {
	FullName    string `json:"fullName"`
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Password    string `json:"password"`
	Role        string `json:"role"`
	Status      string `json:"status"`
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func probeHTTPService(ctx context.Context, name, url string) ServiceProbe {
	start := time.Now()
	client := &http.Client{Timeout: 1500 * time.Millisecond}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ServiceProbe{Name: name, URL: url, Status: "DOWN", LatencyMs: time.Since(start).Milliseconds(), Detail: err.Error()}
	}
	resp, err := client.Do(req)
	lat := time.Since(start).Milliseconds()
	if err != nil {
		return ServiceProbe{Name: name, URL: url, Status: "DOWN", LatencyMs: lat, Detail: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return ServiceProbe{Name: name, URL: url, Status: "UP", LatencyMs: lat, Detail: fmt.Sprintf("HTTP %d", resp.StatusCode)}
	}
	return ServiceProbe{Name: name, URL: url, Status: "DEGRADED", LatencyMs: lat, Detail: fmt.Sprintf("HTTP %d", resp.StatusCode)}
}

func (s *Service) PlatformOverview(ctx context.Context) map[string]any {
	targets := []struct {
		name string
		url  string
	}{
		{"api-gateway", envOr("GATEWAY_SERVICE_URL", "http://api:8081") + "/health"},
		{"identity-service", envOr("IDENTITY_SERVICE_URL", "http://identity-service:8081") + "/health"},
		{"catalog-service", envOr("CATALOG_SERVICE_URL", "http://catalog-service:8082") + "/health"},
		{"streaming-service", envOr("STREAMING_SERVICE_URL", "http://streaming-service:8083") + "/health"},
		{"commerce-service", envOr("COMMERCE_SERVICE_URL", "http://commerce-service:8084") + "/health"},
		{"monetization-service", envOr("MONETIZATION_SERVICE_URL", "http://monetization-service:8085") + "/health"},
		{"platform-service", envOr("PLATFORM_SERVICE_URL", "http://127.0.0.1:8086") + "/health"},
		{"games-service", envOr("GAMES_SERVICE_URL", "http://games-service:8090") + "/healthz"},
		{"media-streamer", envOr("MEDIA_STREAMER_URL", "http://media-streamer:8085") + "/api/gdrive/files"},
	}

	probes := make([]ServiceProbe, len(targets))
	var g errgroup.Group
	for i, t := range targets {
		i, t := i, t
		g.Go(func() error {
			probes[i] = probeHTTPService(ctx, t.name, t.url)
			return nil
		})
	}

	var (
		mu              sync.Mutex
		dbStatsMap      map[string]any
		redisStatsMap   map[string]any
		totalUsers      int64
		adminStaffCount int64
		activeStreams   int64
		errorsLast1h    int64
		errorsLast24h   int64
		outboxPending   int64
		outboxFailed    int64
		outboxPublished int64
		maintenanceMode bool
		maintenanceMsg  string
		migrationsCount int64
	)

	// DB ping + connection pool stats
	g.Go(func() error {
		start := time.Now()
		sqlDB, err := s.db.DB()
		pingErr := error(nil)
		var stats map[string]any
		if err == nil && sqlDB != nil {
			pingErr = sqlDB.PingContext(ctx)
			st := sqlDB.Stats()
			stats = map[string]any{
				"status":          "UP",
				"latencyMs":       time.Since(start).Milliseconds(),
				"openConnections": st.OpenConnections,
				"inUse":           st.InUse,
				"idle":            st.Idle,
				"maxOpen":         st.MaxOpenConnections,
				"waitCount":       st.WaitCount,
			}
			if pingErr != nil {
				stats["status"] = "DOWN"
				stats["error"] = pingErr.Error()
			}
		} else {
			stats = map[string]any{"status": "DOWN", "error": "sql.DB unavailable"}
		}
		mu.Lock()
		dbStatsMap = stats
		mu.Unlock()
		return nil
	})

	// Redis ping
	g.Go(func() error {
		start := time.Now()
		st := map[string]any{"status": "UP", "latencyMs": int64(0)}
		if s.cache == nil {
			st["status"] = "DISABLED"
		} else if err := s.cache.Ping(ctx); err != nil {
			st["status"] = "DOWN"
			st["error"] = err.Error()
			st["latencyMs"] = time.Since(start).Milliseconds()
		} else {
			st["latencyMs"] = time.Since(start).Milliseconds()
		}
		mu.Lock()
		redisStatsMap = st
		mu.Unlock()
		return nil
	})

	// Watchdog DB metrics
	g.Go(func() error {
		now := time.Now().UTC()
		var uCnt, aCnt, sCnt, e1h, e24h, oPend, oFail, oPub, migCnt int64

		_ = s.db.WithContext(ctx).Model(&models.User{}).Count(&uCnt).Error
		_ = s.db.WithContext(ctx).
			Table("user_roles").
			Joins("JOIN roles ON roles.id = user_roles.role_id").
			Where("roles.name IN ?", staffRoleCodes).
			Distinct("user_roles.user_id").
			Count(&aCnt).Error
		_ = s.db.WithContext(ctx).Table("active_streams").
			Where("last_heartbeat_at >= ?", now.Add(-2*time.Minute)).
			Count(&sCnt).Error
		_ = s.db.WithContext(ctx).Table("service_logs").
			Where("UPPER(level) = ? AND created_at >= ?", "ERROR", now.Add(-1*time.Hour)).
			Count(&e1h).Error
		_ = s.db.WithContext(ctx).Table("service_logs").
			Where("UPPER(level) = ? AND created_at >= ?", "ERROR", now.Add(-24*time.Hour)).
			Count(&e24h).Error
		_ = s.db.WithContext(ctx).Table("outbox_events").Where("status = ?", "PENDING").Count(&oPend).Error
		_ = s.db.WithContext(ctx).Table("outbox_events").Where("status = ?", "FAILED").Count(&oFail).Error
		_ = s.db.WithContext(ctx).Table("outbox_events").Where("status = ?", "PUBLISHED").Count(&oPub).Error
		_ = s.db.WithContext(ctx).Table("goose_db_version").Where("is_applied = ?", true).Count(&migCnt).Error

		var mmSetting models.SystemSetting
		mm := false
		if s.db.WithContext(ctx).Where("setting_key IN ?", []string{"maintenanceMode", "MAINTENANCE_MODE_ENABLED"}).First(&mmSetting).Error == nil && mmSetting.SettingValue != nil {
			val := strings.ToLower(strings.TrimSpace(*mmSetting.SettingValue))
			mm = val == "true" || val == "1"
		}
		var mmMsgSetting models.SystemSetting
		mmMsg := ""
		if s.db.WithContext(ctx).Where("setting_key = ?", "maintenanceMessage").First(&mmMsgSetting).Error == nil && mmMsgSetting.SettingValue != nil {
			mmMsg = *mmMsgSetting.SettingValue
		}

		mu.Lock()
		totalUsers = uCnt
		adminStaffCount = aCnt
		activeStreams = sCnt
		errorsLast1h = e1h
		errorsLast24h = e24h
		outboxPending = oPend
		outboxFailed = oFail
		outboxPublished = oPub
		maintenanceMode = mm
		maintenanceMsg = mmMsg
		migrationsCount = migCnt
		mu.Unlock()
		return nil
	})

	_ = g.Wait()

	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	upServices := 0
	for _, p := range probes {
		if p.Status == "UP" {
			upServices++
		}
	}

	backupsList := s.ListBackups()

	return map[string]any{
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"services":  probes,
		"summary": map[string]any{
			"servicesUp":      upServices,
			"servicesTotal":   len(probes),
			"totalUsers":      totalUsers,
			"adminStaffCount": adminStaffCount,
			"activeStreams":   activeStreams,
			"errorsLast1h":    errorsLast1h,
			"errorsLast24h":   errorsLast24h,
			"outboxPending":   outboxPending,
			"outboxFailed":    outboxFailed,
			"outboxPublished": outboxPublished,
			"maintenanceMode": maintenanceMode,
			"maintenanceMsg":  maintenanceMsg,
			"backupsCount":    len(backupsList),
			"migrationsCount": migrationsCount,
		},
		"database": dbStatsMap,
		"redis":    redisStatsMap,
		"runtime": map[string]any{
			"goroutines":    runtime.NumGoroutine(),
			"allocMB":       float64(mem.Alloc) / (1024 * 1024),
			"sysMB":         float64(mem.Sys) / (1024 * 1024),
			"numGC":         mem.NumGC,
			"uptimeSeconds": int64(time.Since(platformBootTime).Seconds()),
		},
	}
}

func (s *Service) ListPlatformAdmins(ctx context.Context) ([]map[string]any, error) {
	var userIDs []int64
	if err := s.db.WithContext(ctx).
		Table("user_roles").
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("roles.name IN ?", staffRoleCodes).
		Distinct("user_roles.user_id").
		Pluck("user_roles.user_id", &userIDs).Error; err != nil {
		return nil, err
	}
	if len(userIDs) == 0 {
		return []map[string]any{}, nil
	}

	var users []models.User
	if err := s.db.WithContext(ctx).Where("id IN ?", userIDs).Order("id ASC").Find(&users).Error; err != nil {
		return nil, err
	}

	type roleJoin struct {
		UserID int64  `gorm:"column:user_id"`
		Name   string `gorm:"column:name"`
	}
	var roleJoins []roleJoin
	_ = s.db.WithContext(ctx).
		Table("user_roles").
		Select("user_roles.user_id, roles.name").
		Joins("JOIN roles ON roles.id = user_roles.role_id").
		Where("user_roles.user_id IN ?", userIDs).
		Scan(&roleJoins).Error

	roleMap := map[int64][]string{}
	for _, rj := range roleJoins {
		roleMap[rj.UserID] = append(roleMap[rj.UserID], rj.Name)
	}

	out := make([]map[string]any, 0, len(users))
	for _, u := range users {
		var devCount int64
		_ = s.db.WithContext(ctx).Table("user_devices").
			Where("user_id = ? AND is_active = ?", u.ID, true).
			Count(&devCount).Error

		fullName := ""
		if u.FullName != nil {
			fullName = *u.FullName
		}
		email := ""
		if u.Email != nil {
			email = *u.Email
		}
		phone := ""
		if u.PhoneNumber != nil {
			phone = *u.PhoneNumber
		} else if u.Phone != nil {
			phone = *u.Phone
		}
		out = append(out, map[string]any{
			"id":                 u.ID,
			"uuid":               u.Uuid,
			"fullName":           fullName,
			"email":              email,
			"phoneNumber":        phone,
			"status":             u.Status,
			"roles":              roleMap[u.ID],
			"activeDevicesCount": devCount,
			"createdAt":          u.CreatedAt,
			"updatedAt":          u.UpdatedAt,
		})
	}
	return out, nil
}

func normalizePlatformRole(r string) string {
	clean := strings.ToUpper(strings.TrimSpace(r))
	if clean == "" {
		return "ROLE_ADMIN"
	}
	if !strings.HasPrefix(clean, "ROLE_") {
		clean = "ROLE_" + clean
	}
	return clean
}

func (s *Service) writePlatformAuditTx(tx *gorm.DB, actorEmail, action, entityID, details string) {
	now := time.Now().UTC()
	_ = tx.Table("system_setting_history").Create(map[string]any{
		"setting_key": action,
		"old_value":   entityID,
		"new_value":   details,
		"changed_by":  actorEmail,
		"created_at":  now,
	}).Error
	_ = tx.Table("service_logs").Create(map[string]any{
		"service":    "platform-admin",
		"level":      "INFO",
		"message":    fmt.Sprintf("[%s] %s (by %s)", action, details, actorEmail),
		"created_at": now,
	}).Error
}

func (s *Service) CreatePlatformAdmin(ctx context.Context, actorEmail string, in PlatformAdminInput) (map[string]any, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	name := strings.TrimSpace(in.FullName)
	phone := strings.TrimSpace(in.PhoneNumber)
	pw := strings.TrimSpace(in.Password)
	if email == "" || name == "" || len(pw) < 6 {
		return nil, errors.New("fullName, email, and password (min 6 chars) are required")
	}
	roleName := normalizePlatformRole(in.Role)
	status := strings.ToUpper(strings.TrimSpace(in.Status))
	if status == "" {
		status = "ACTIVE"
	}

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	pwHash := string(hashBytes)
	authMethod := "EMAIL_PASSWORD"
	emailVer := true
	phoneVer := phone != ""
	now := time.Now().UTC()

	u := models.User{
		Uuid:          uuid.NewString(),
		FullName:      &name,
		Email:         &email,
		PasswordHash:  &pwHash,
		AuthMethod:    &authMethod,
		Status:        status,
		EmailVerified: &emailVer,
		PhoneVerified: &phoneVer,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if phone != "" {
		u.PhoneNumber = &phone
		u.Phone = &phone
	}

	if err := database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		var existing models.User
		if tx.Where("LOWER(email) = ?", email).First(&existing).Error == nil {
			return errors.New("an account with this email already exists")
		}
		if err := tx.Create(&u).Error; err != nil {
			return err
		}
		var roleRow models.Role
		if err := tx.Where("name = ?", roleName).FirstOrCreate(&roleRow, models.Role{Name: roleName}).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.UserRole{UserId: u.ID, RoleId: roleRow.ID}).Error; err != nil {
			return err
		}
		s.writePlatformAuditTx(tx, actorEmail, "ADMIN_CREATED", strconv.FormatInt(u.ID, 10),
			fmt.Sprintf("Created admin %s (%s) with role %s", name, email, roleName))
		return nil
	}); err != nil {
		return nil, err
	}

	return map[string]any{
		"id":          u.ID,
		"fullName":    name,
		"email":       email,
		"phoneNumber": phone,
		"roles":       []string{roleName},
		"status":      status,
		"createdAt":   now,
	}, nil
}

func (s *Service) UpdatePlatformAdminRole(ctx context.Context, actorEmail string, targetID int64, role string) error {
	roleName := normalizePlatformRole(role)
	return database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		var u models.User
		if err := tx.First(&u, targetID).Error; err != nil {
			return errors.New("admin user not found")
		}
		if err := tx.Where("user_id = ?", targetID).Delete(&models.UserRole{}).Error; err != nil {
			return err
		}
		var roleRow models.Role
		if err := tx.Where("name = ?", roleName).FirstOrCreate(&roleRow, models.Role{Name: roleName}).Error; err != nil {
			return err
		}
		if err := tx.Create(&models.UserRole{UserId: targetID, RoleId: roleRow.ID}).Error; err != nil {
			return err
		}
		s.writePlatformAuditTx(tx, actorEmail, "ADMIN_ROLE_CHANGED", strconv.FormatInt(targetID, 10),
			fmt.Sprintf("Updated admin #%d role to %s", targetID, roleName))
		return nil
	})
}

func (s *Service) UpdatePlatformAdminStatus(ctx context.Context, actorID int64, actorEmail string, targetID int64, status string) error {
	clean := strings.ToUpper(strings.TrimSpace(status))
	if clean != "ACTIVE" && clean != "SUSPENDED" && clean != "BLOCKED" {
		return errors.New("status must be ACTIVE or SUSPENDED")
	}
	if actorID == targetID && clean != "ACTIVE" {
		return errors.New("cannot suspend your own active admin account")
	}
	return database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).Where("id = ?", targetID).Updates(map[string]any{
			"status":     clean,
			"updated_at": time.Now().UTC(),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("admin user not found")
		}
		if clean != "ACTIVE" {
			_ = tx.Table("user_devices").Where("user_id = ?", targetID).Update("is_active", false).Error
		}
		s.writePlatformAuditTx(tx, actorEmail, "ADMIN_STATUS_CHANGED", strconv.FormatInt(targetID, 10),
			fmt.Sprintf("Changed admin #%d status to %s", targetID, clean))
		return nil
	})
}

func (s *Service) ResetPlatformAdminPassword(ctx context.Context, actorEmail string, targetID int64, newPassword string) error {
	pw := strings.TrimSpace(newPassword)
	if len(pw) < 6 {
		return errors.New("password must be at least 6 characters")
	}
	hashBytes, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	pwHash := string(hashBytes)
	return database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		res := tx.Model(&models.User{}).Where("id = ?", targetID).Updates(map[string]any{
			"password_hash": pwHash,
			"updated_at":    time.Now().UTC(),
		})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("admin user not found")
		}
		_ = tx.Table("user_devices").Where("user_id = ?", targetID).Update("is_active", false).Error
		s.writePlatformAuditTx(tx, actorEmail, "ADMIN_PASSWORD_RESET", strconv.FormatInt(targetID, 10),
			fmt.Sprintf("Reset password and revoked sessions for admin #%d", targetID))
		return nil
	})
}

func (s *Service) TogglePlatformMaintenance(ctx context.Context, actorEmail string, enabled bool, msg string) error {
	valStr := "false"
	if enabled {
		valStr = "true"
	}
	if err := database.WithTx(ctx, s.db, func(tx *gorm.DB) error {
		now := time.Now().UTC()
		grp := "SYSTEM"
		for _, k := range []string{"maintenanceMode", "MAINTENANCE_MODE_ENABLED"} {
			var row models.SystemSetting
			if tx.Where("setting_key = ?", k).First(&row).Error == nil {
				if err := tx.Model(&row).Updates(map[string]any{"setting_value": valStr, "updated_at": now}).Error; err != nil {
					return err
				}
			} else {
				v := valStr
				if err := tx.Create(&models.SystemSetting{
					SettingKey:   k,
					SettingValue: &v,
					SettingGroup: &grp,
					UpdatedAt:    now,
				}).Error; err != nil {
					return err
				}
			}
		}
		if strings.TrimSpace(msg) != "" {
			cleanMsg := strings.TrimSpace(msg)
			var mRow models.SystemSetting
			if tx.Where("setting_key = ?", "maintenanceMessage").First(&mRow).Error == nil {
				_ = tx.Model(&mRow).Updates(map[string]any{"setting_value": cleanMsg, "updated_at": now}).Error
			} else {
				_ = tx.Create(&models.SystemSetting{
					SettingKey:   "maintenanceMessage",
					SettingValue: &cleanMsg,
					SettingGroup: &grp,
					UpdatedAt:    now,
				}).Error
			}
		}
		s.writePlatformAuditTx(tx, actorEmail, "MAINTENANCE_MODE_TOGGLED", "maintenanceMode",
			fmt.Sprintf("Maintenance mode set to %s", valStr))
		return nil
	}); err != nil {
		return err
	}
	if s.cache != nil {
		_ = s.cache.Set(ctx, "platform:maintenance_mode", valStr, 0)
	}
	return nil
}

// --- HTTP Handlers ---

func actorFromRequest(r *http.Request) (int64, string) {
	if claims, ok := auth.FromContext(r.Context()); ok && claims != nil {
		email := claims.Email
		if email == "" {
			email = claims.Subject
		}
		return claims.UserID, email
	}
	return 0, "admin"
}

func (h *Handler) platformOverview(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, h.svc.PlatformOverview(r.Context()))
}

func (h *Handler) platformListAdmins(w http.ResponseWriter, r *http.Request) {
	admins, err := h.svc.ListPlatformAdmins(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, admins)
}

func (h *Handler) platformCreateAdmin(w http.ResponseWriter, r *http.Request) {
	var in PlatformAdminInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	_, email := actorFromRequest(r)
	created, err := h.svc.CreatePlatformAdmin(r.Context(), email, in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, created, "Platform admin created")
}

func (h *Handler) platformUpdateAdminRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid admin id")
		return
	}
	var body struct {
		Role string `json:"role"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	_, email := actorFromRequest(r)
	if err := h.svc.UpdatePlatformAdminRole(r.Context(), email, id, body.Role); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"id": id, "role": normalizePlatformRole(body.Role)}, "Admin role updated")
}

func (h *Handler) platformUpdateAdminStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid admin id")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	actorID, email := actorFromRequest(r)
	if err := h.svc.UpdatePlatformAdminStatus(r.Context(), actorID, email, id, body.Status); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"id": id, "status": strings.ToUpper(body.Status)}, "Admin status updated")
}

func (h *Handler) platformResetAdminPassword(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid admin id")
		return
	}
	var body struct {
		Password    string `json:"password"`
		NewPassword string `json:"newPassword"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	pw := body.NewPassword
	if pw == "" {
		pw = body.Password
	}
	_, email := actorFromRequest(r)
	if err := h.svc.ResetPlatformAdminPassword(r.Context(), email, id, pw); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"id": id, "reset": true}, "Admin password reset")
}

func (h *Handler) platformToggleMaintenance(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Enabled bool   `json:"enabled"`
		Message string `json:"message"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	_, email := actorFromRequest(r)
	if err := h.svc.TogglePlatformMaintenance(r.Context(), email, body.Enabled, body.Message); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"maintenanceMode": body.Enabled}, "Maintenance mode updated")
}

// --- Global Admin Action Activity Log (Ingest from api-gateway + Query) ---

type AdminActionLogEntry struct {
	Action     string `json:"action"`
	Module     string `json:"module"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	Status     int    `json:"status"`
	LatencyMs  int64  `json:"latencyMs"`
	ActorEmail string `json:"actorEmail"`
	ActorID    int64  `json:"actorId"`
	IP         string `json:"ip"`
	Payload    string `json:"payload"`
	CreatedAt  string `json:"createdAt"`
}

func (h *Handler) internalIngestAdminAudit(w http.ResponseWriter, r *http.Request) {
	var in AdminActionLogEntry
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid payload")
		return
	}
	now := time.Now().UTC()
	level := "INFO"
	if in.Status >= 500 {
		level = "ERROR"
	} else if in.Status >= 400 {
		level = "WARN"
	}
	metaJSON := fmt.Sprintf(`{"action":%q,"module":%q,"method":%q,"path":%q,"status":%d,"latencyMs":%d,"actorEmail":%q,"actorId":%d,"ip":%q,"payload":%q}`,
		in.Action, in.Module, in.Method, in.Path, in.Status, in.LatencyMs, in.ActorEmail, in.ActorID, in.IP, in.Payload)

	_ = h.svc.db.WithContext(r.Context()).Table("service_logs").Create(map[string]any{
		"service":    "admin-audit",
		"level":      level,
		"message":    fmt.Sprintf("[%s:%s] %s %s (%d, %dms) by %s", in.Action, in.Module, in.Method, in.Path, in.Status, in.LatencyMs, in.ActorEmail),
		"trace_id":   in.Module,
		"metadata":   metaJSON,
		"created_at": now,
	}).Error

	httpx.OK(w, map[string]any{"recorded": true})
}

func (h *Handler) adminListActivityLogs(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	actionFilter := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("action")))
	moduleFilter := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("module")))
	q := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))

	type logRow struct {
		ID        int64     `gorm:"column:id"`
		Level     string    `gorm:"column:level"`
		Message   string    `gorm:"column:message"`
		Metadata  string    `gorm:"column:metadata"`
		CreatedAt time.Time `gorm:"column:created_at"`
	}
	var rows []logRow
	_ = h.svc.db.WithContext(r.Context()).
		Table("service_logs").
		Select("id, level, message, metadata, created_at").
		Where("service = ?", "admin-audit").
		Order("id DESC").
		Limit(limit).
		Scan(&rows).Error

	out := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		var meta map[string]any
		_ = json.Unmarshal([]byte(row.Metadata), &meta)
		action := fmt.Sprintf("%v", meta["action"])
		module := fmt.Sprintf("%v", meta["module"])
		actor := fmt.Sprintf("%v", meta["actorEmail"])
		path := fmt.Sprintf("%v", meta["path"])

		if actionFilter != "" && actionFilter != "ALL" && !strings.EqualFold(action, actionFilter) {
			continue
		}
		if moduleFilter != "" && moduleFilter != "ALL" && !strings.EqualFold(module, moduleFilter) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(row.Message+" "+actor+" "+path+" "+module), q) {
			continue
		}
		out = append(out, map[string]any{
			"id":         row.ID,
			"level":      row.Level,
			"message":    row.Message,
			"action":     meta["action"],
			"module":     meta["module"],
			"method":     meta["method"],
			"path":       meta["path"],
			"status":     meta["status"],
			"latencyMs":  meta["latencyMs"],
			"actorEmail": meta["actorEmail"],
			"actorId":    meta["actorId"],
			"ip":         meta["ip"],
			"payload":    meta["payload"],
			"createdAt":  row.CreatedAt,
		})
	}
	httpx.OK(w, out)
}
