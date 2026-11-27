package identity

import (
	"net/http"
	"strconv"

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

		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Post("/logout", h.logout)
			pr.Get("/me", h.me)
			pr.Get("/profile", h.me)
			pr.Put("/me", h.updateProfile)
			pr.Put("/profile", h.updateProfile)
		})
	}

	mountUsers := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Get("/profiles", h.listSubProfiles)
		sub.Get("/devices", h.listDevices)
	}

	mountAdminUsers := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListUsers)
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
	if v, ok := body["fullName"]; ok {
		mapped["full_name"] = v
	}
	if v, ok := body["full_name"]; ok {
		mapped["full_name"] = v
	}
	if v, ok := body["email"]; ok {
		mapped["email"] = v
	}
	if v, ok := body["avatarUrl"]; ok {
		mapped["avatar_url"] = v
	}
	if v, ok := body["avatar_url"]; ok {
		mapped["avatar_url"] = v
	}
	data, err := h.svc.UpdateProfile(r.Context(), uid, mapped)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error(), "UPDATE_FAILED")
		return
	}
	httpx.OK(w, data, "Profile updated")
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

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
