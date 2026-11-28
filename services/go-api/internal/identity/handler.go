package identity

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

type Handler struct {
	svc    *Service
	tokens *auth.TokenManager
}

func NewHandler(svc *Service, tokens *auth.TokenManager) *Handler {
	return &Handler{svc: svc, tokens: tokens}
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	mountAuth := func(sub chi.Router) {
		sub.Post("/login", h.login)
		sub.Post("/register", h.register)
		sub.Post("/signup", h.register)
		sub.Post("/refresh", h.refresh)
		sub.Post("/refresh-token", h.refresh)
		sub.Post("/send-otp", h.sendOTP)
		sub.Post("/resend-otp", h.sendOTP)
		sub.Post("/otp/send", h.sendOTP)
		sub.Post("/verify-otp", h.verifyOTP)
		sub.Post("/otp/verify", h.verifyOTP)
		sub.Post("/firebase-verify", h.verifyOTP)
		sub.Post("/tv/code", h.generateTVCode)
		sub.Get("/tv-code", h.generateTVCode)
		sub.Post("/tv-code", h.generateTVCode)
		sub.Post("/tv-check", h.pollTVCode)
		sub.Get("/tv/poll/{code}", h.pollTVCode)

		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Post("/logout", h.logout)
			pr.Get("/me", h.me)
			pr.Get("/profile", h.me)
			pr.Put("/me", h.updateProfile)
			pr.Put("/profile", h.updateProfile)
			pr.Post("/me/avatar", h.uploadAvatar)
			pr.Delete("/me/avatar", h.deleteAvatar)
			pr.Post("/profile/avatar", h.uploadAvatar)
			pr.Delete("/profile/avatar", h.deleteAvatar)
			pr.Post("/change-password", h.changePassword)
			pr.Post("/password", h.changePassword)
			pr.Post("/device-token", h.deviceToken)
			pr.Post("/fcm-token", h.deviceToken)
			pr.Post("/tv/activate", h.activateTVCode)
			pr.Post("/tv-login", h.activateTVCode)
			pr.Get("/profiles", h.listSubProfiles)
			pr.Post("/profiles", h.createSubProfile)
			pr.Get("/devices", h.listDevices)
			pr.Get("/devices/summary", h.deviceSummary)
			pr.Post("/devices/register", h.registerDevice)
			pr.Post("/devices/logout-others", h.logoutOtherDevices)
			pr.Delete("/devices/{device_id}", h.revokeDevice)
			pr.Get("/referrals/me", h.myReferrals)
			pr.Post("/referrals/apply", h.applyReferral)
		})
	}

	mountUsers := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Put("/me", h.updateProfile)
		sub.Post("/me/avatar", h.uploadAvatar)
		sub.Delete("/me/avatar", h.deleteAvatar)
		sub.Put("/profile", h.updateProfile)
		sub.Post("/profile/avatar", h.uploadAvatar)
		sub.Delete("/profile/avatar", h.deleteAvatar)
		sub.Get("/profiles", h.listSubProfiles)
		sub.Post("/profiles", h.createSubProfile)
		sub.Get("/devices", h.listDevices)
		sub.Get("/devices/summary", h.deviceSummary)
		sub.Post("/devices/register", h.registerDevice)
		sub.Post("/devices/logout-others", h.logoutOtherDevices)
		sub.Delete("/devices/{device_id}", h.revokeDevice)
		sub.Get("/referrals/me", h.myReferrals)
		sub.Post("/referrals/apply", h.applyReferral)
	}

	mountAdminUsers := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListUsers)
		sub.Post("/", h.adminCreateUser)
		sub.Get("/{id}", h.adminGetUser)
		sub.Put("/{id}", h.adminUpdateUser)
		sub.Delete("/{id}", h.adminDeleteUser)
		sub.Patch("/{id}/status", h.adminPatchStatus)
		sub.Patch("/{id}/toggle-status", h.adminToggleStatus)
		sub.Post("/{id}/block", h.adminBlockUser)
		sub.Post("/{id}/unblock", h.adminUnblockUser)
		sub.Post("/{id}/revoke-devices", h.adminRevokeDevices)
		sub.Post("/{id}/reset-password", h.adminResetPassword)
		sub.Post("/{id}/password", h.adminResetPassword)
	}

	// Triple-prefix compatibility (/api/v1, /api, /)
	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/auth", mountAuth)
		r.Route(pref+"/admin/users", mountAdminUsers)
		if pref != "" {
			r.Route(pref, mountUsers)
		}
	}
}

func detectPlatformFromRequest(r *http.Request) (platform, deviceType, deviceName string) {
	if p := strings.ToUpper(strings.TrimSpace(r.Header.Get("X-Platform"))); p != "" {
		return p, p, p + " Client"
	}
	ua := strings.ToLower(r.Header.Get("User-Agent"))
	switch {
	case strings.Contains(ua, "android") && (strings.Contains(ua, "tv") || strings.Contains(ua, "aft") || strings.Contains(ua, "bravia")):
		return "ANDROID_TV", "SMART_TV", "Android TV"
	case strings.Contains(ua, "smart-tv") || strings.Contains(ua, "tizen") || strings.Contains(ua, "webos") || strings.Contains(ua, "roku"):
		return "SMART_TV", "SMART_TV", "Smart TV"
	case strings.Contains(ua, "android"):
		return "ANDROID", "MOBILE", "Android Device"
	case strings.Contains(ua, "iphone") || strings.Contains(ua, "ipad") || strings.Contains(ua, "ios"):
		return "IOS", "MOBILE", "iOS Device"
	default:
		return "WEB", "WEB", "Web Browser"
	}
}

func (h *Handler) recordLoginDevice(r *http.Request, res *AuthResult) {
	if res == nil || res.User == nil {
		return
	}
	var uid int64
	switch v := res.User["id"].(type) {
	case int64:
		uid = v
	case float64:
		uid = int64(v)
	case int:
		uid = int64(v)
	}
	if uid <= 0 {
		return
	}
	plat, devType, devName := detectPlatformFromRequest(r)
	devID := strings.TrimSpace(r.Header.Get("X-Device-Id"))
	if devID == "" {
		devID = strings.ToLower(plat) + "-" + strconv.FormatInt(uid, 10)
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_, _ = h.svc.RegisterDevice(ctx, uid, RegisterDeviceInput{
			DeviceID:   devID,
			DeviceName: devName,
			DeviceType: devType,
			Platform:   plat,
		})
	}()
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Identifier  string `json:"identifier"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		PhoneNumber string `json:"phoneNumber"`
		Password    string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	id := firstNonEmpty(body.Identifier, body.Email, body.PhoneNumber, body.Phone)
	res, err := h.svc.Login(r.Context(), id, body.Password)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error(), "UNAUTHORIZED")
		return
	}
	h.recordLoginDevice(r, res)
	httpx.OK(w, res, "Login successful")
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		FullName    string `json:"fullName"`
		Name        string `json:"name"`
		Email       string `json:"email"`
		Phone       string `json:"phone"`
		PhoneNumber string `json:"phoneNumber"`
		Password    string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	res, err := h.svc.Register(
		r.Context(),
		firstNonEmpty(body.FullName, body.Name),
		body.Email,
		firstNonEmpty(body.PhoneNumber, body.Phone),
		body.Password,
	)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error(), "REGISTER_FAILED")
		return
	}
	httpx.Created(w, res, "Registration successful")
}

func (h *Handler) sendOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		PhoneNumber string `json:"phoneNumber"`
		Mobile      string `json:"mobile"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	phone := firstNonEmpty(body.PhoneNumber, body.Phone, body.Mobile)
	_, err := h.svc.SendOTP(r.Context(), phone)
	if err != nil {
		httpx.Error(w, http.StatusTooManyRequests, err.Error(), "OTP_ERROR")
		return
	}
	httpx.OK(w, map[string]any{"sent": true, "phone": phone}, "OTP sent successfully")
}

func (h *Handler) verifyOTP(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Phone       string `json:"phone"`
		PhoneNumber string `json:"phoneNumber"`
		Mobile      string `json:"mobile"`
		OTP         string `json:"otp"`
		Code        string `json:"code"`
		FullName    string `json:"fullName"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	res, err := h.svc.VerifyOTP(
		r.Context(),
		firstNonEmpty(body.PhoneNumber, body.Phone, body.Mobile),
		firstNonEmpty(body.OTP, body.Code),
		body.FullName,
	)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error(), "INVALID_OTP")
		return
	}
	httpx.OK(w, res, "OTP verified")
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refreshToken"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	res, err := h.svc.Refresh(r.Context(), body.RefreshToken)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error(), "INVALID_REFRESH_TOKEN")
		return
	}
	httpx.OK(w, res, "Token refreshed")
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	httpx.OK(w, map[string]any{"loggedOut": true}, "Logged out")
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, err := claims.ParsedUserID()
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "Invalid token", "UNAUTHORIZED")
		return
	}
	data, err := h.svc.GetProfile(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error(), "NOT_FOUND")
		return
	}
	httpx.OK(w, data)
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, err := claims.ParsedUserID()
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "Invalid token", "UNAUTHORIZED")
		return
	}
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload", "BAD_REQUEST")
		return
	}
	mapped := map[string]any{}
	for _, pair := range [][2]string{
		{"fullName", "full_name"}, {"full_name", "full_name"},
		{"email", "email"}, {"avatarUrl", "avatar_url"}, {"avatar_url", "avatar_url"},
		{"pincode", "pincode"}, {"profession", "profession"},
		{"dateOfBirth", "date_of_birth"}, {"date_of_birth", "date_of_birth"},
		{"preferredLanguages", "preferred_languages"}, {"preferred_languages", "preferred_languages"},
	} {
		if v, ok := body[pair[0]]; ok {
			mapped[pair[1]] = v
		}
	}
	data, err := h.svc.UpdateProfile(r.Context(), uid, mapped)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error(), "UPDATE_FAILED")
		return
	}
	httpx.OK(w, data, "Profile updated")
}

func (h *Handler) uploadAvatar(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		AvatarURL string `json:"avatarUrl"`
		URL       string `json:"url"`
	}
	_ = httpx.DecodeJSON(r, &body)
	url := firstNonEmpty(body.AvatarURL, body.URL)
	if url == "" {
		httpx.Error(w, http.StatusBadRequest, "avatarUrl is required")
		return
	}
	data, err := h.svc.UpdateProfile(r.Context(), uid, map[string]any{"avatar_url": url})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data, "Avatar updated")
}

func (h *Handler) deleteAvatar(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	data, err := h.svc.RemoveAvatar(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data, "Avatar removed")
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		CurrentPassword string `json:"currentPassword"`
		OldPassword     string `json:"oldPassword"`
		NewPassword     string `json:"newPassword"`
		Password        string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	if err := h.svc.ChangePassword(r.Context(), uid, firstNonEmpty(body.CurrentPassword, body.OldPassword), firstNonEmpty(body.NewPassword, body.Password)); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"updated": true}, "Password updated successfully")
}

func (h *Handler) deviceToken(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		DeviceID    string `json:"deviceId"`
		DeviceName  string `json:"deviceName"`
		FCMToken    string `json:"fcmToken"`
		DeviceToken string `json:"deviceToken"`
		Platform    string `json:"platform"`
		OS          string `json:"os"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.UpdateDeviceToken(r.Context(), uid, body.DeviceID, body.DeviceName, firstNonEmpty(body.FCMToken, body.DeviceToken), firstNonEmpty(body.Platform, body.OS))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) generateTVCode(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DeviceID   string `json:"deviceId"`
		DeviceName string `json:"deviceName"`
		Platform   string `json:"platform"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.GenerateTVCode(r.Context(), body.DeviceID, body.DeviceName, body.Platform)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) pollTVCode(w http.ResponseWriter, r *http.Request) {
	code := firstNonEmpty(chi.URLParam(r, "code"), r.URL.Query().Get("code"))
	if code == "" && r.Body != nil {
		var body struct {
			Code       string `json:"code"`
			UniqueCode string `json:"uniqueCode"`
			Unique     string `json:"unique_code"`
		}
		_ = httpx.DecodeJSON(r, &body)
		code = firstNonEmpty(body.Code, body.UniqueCode, body.Unique)
	}
	res, err := h.svc.PollTVCode(r.Context(), code)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) activateTVCode(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		Code       string `json:"code"`
		UniqueCode string `json:"uniqueCode"`
		DeviceName string `json:"deviceName"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.ActivateTVCode(r.Context(), uid, firstNonEmpty(body.Code, body.UniqueCode), body.DeviceName)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "TV activated successfully")
}

func (h *Handler) listSubProfiles(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.ListSubProfiles(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) createSubProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatarUrl"`
		IsKids    bool   `json:"isKids"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.CreateSubProfile(r.Context(), uid, body.Name, body.AvatarURL, body.IsKids)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Profile created")
}

func (h *Handler) listDevices(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.ListDevices(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) deviceSummary(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	res, err := h.svc.GetDeviceSummary(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) registerDevice(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var in RegisterDeviceInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	dev, err := h.svc.RegisterDevice(r.Context(), uid, in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, dev, "Device registered")
}

func (h *Handler) logoutOtherDevices(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		CurrentDeviceID string `json:"currentDeviceId"`
		DeviceID        string `json:"deviceId"`
	}
	_ = httpx.DecodeJSON(r, &body)
	revoked, err := h.svc.RevokeOtherDevices(r.Context(), uid, firstNonEmpty(body.CurrentDeviceID, body.DeviceID))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"revokedCount": revoked}, "Other devices logged out")
}

func (h *Handler) revokeDevice(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	if err := h.svc.RevokeDevice(r.Context(), uid, chi.URLParam(r, "device_id")); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"revoked": true}, "Device revoked")
}

func (h *Handler) myReferrals(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	res, err := h.svc.GetMyReferrals(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) applyReferral(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		ReferralCode  string `json:"referralCode"`
		ReferralSnake string `json:"referral_code"`
		ReferenceCode string `json:"referenceCode"`
		AgentCode     string `json:"agentCode"`
		Code          string `json:"code"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	code := firstNonEmpty(body.ReferralCode, body.ReferralSnake, body.ReferenceCode, body.AgentCode, body.Code)
	res, status, err := h.svc.ApplyReferralCode(r.Context(), uid, code)
	if err != nil {
		httpx.Error(w, status, err.Error())
		return
	}
	httpx.OK(w, res, "Referral code applied")
}

// --- Admin Users Handlers ---

func (h *Handler) adminListUsers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	search := r.URL.Query().Get("search")
	users, total, err := h.svc.AdminListUsers(r.Context(), page, size, search)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(users, total, int64(page), int64(size)))
}

func (h *Handler) adminCreateUser(w http.ResponseWriter, r *http.Request) {
	var in AdminUserInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.AdminCreateUser(r.Context(), in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, res, "User created")
}

func (h *Handler) adminGetUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	res, err := h.svc.AdminGetUser(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	var in AdminUserInput
	if err := httpx.DecodeJSON(r, &in); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.AdminUpdateUser(r.Context(), id, in)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "User updated")
}

func (h *Handler) adminDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	if err := h.svc.AdminSoftDeleteUser(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "id": id}, "User deleted")
}

func (h *Handler) adminPatchStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.AdminUpdateStatus(r.Context(), id, body.Status)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "User status updated")
}

func (h *Handler) adminToggleStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid user id")
		return
	}
	res, err := h.svc.AdminToggleStatus(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "User status toggled")
}

func (h *Handler) adminBlockUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	res, err := h.svc.AdminUpdateStatus(r.Context(), id, "BLOCKED")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "User blocked")
}

func (h *Handler) adminUnblockUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	res, err := h.svc.AdminUpdateStatus(r.Context(), id, "ACTIVE")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "User unblocked")
}

func (h *Handler) adminRevokeDevices(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	cnt, err := h.svc.AdminRevokeAllDevices(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"revokedCount": cnt}, "All user devices revoked")
}

func (h *Handler) adminResetPassword(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		NewPassword string `json:"newPassword"`
		Password    string `json:"password"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	if err := h.svc.AdminResetPassword(r.Context(), id, firstNonEmpty(body.NewPassword, body.Password)); err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"reset": true, "id": id}, "Password reset successfully")
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
