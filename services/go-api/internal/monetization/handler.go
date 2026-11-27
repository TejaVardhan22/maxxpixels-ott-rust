package monetization

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
	mountAds := func(sub chi.Router) {
		sub.Get("/vast", h.vastXML)
		sub.Get("/vast.xml", h.vastXML)
		sub.Get("/queue", h.listCampaigns)
		sub.Get("/ad-queue", h.listCampaigns)
		sub.Get("/config/{contentId}", h.adConfig)
		sub.With(h.tokens.OptionalAuth).Post("/session", h.createAdSession)
		sub.With(h.tokens.OptionalAuth).Post("/sessions", h.createAdSession)
		sub.Get("/campaigns", h.listCampaigns)
		sub.Get("/revenue", h.adRevenue)
		sub.Get("/producer-revenue", h.producerRevenue)
		sub.Get("/content-analytics", h.producerRevenue)
		sub.Get("/track/impression/{id}", h.trackEvent("IMPRESSION"))
		sub.Get("/track/click/{id}", h.trackEvent("CLICK"))
		sub.Post("/events", h.recordEvent)
		sub.Post("/event", h.recordEvent)
		sub.Post("/track", h.recordEvent)
		sub.Post("/ad-track", h.recordEvent)
	}

	mountAdminAds := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/providers", h.adminListProviders)
		sub.Post("/providers", h.adminUpsertProvider)
		sub.Put("/providers/{id}", h.adminUpsertProvider)
		sub.Get("/placements", h.adminListPlacements)
		sub.Post("/placements", h.adminUpsertPlacement)
		sub.Put("/placements/{id}", h.adminUpsertPlacement)
		sub.Get("/", h.listCampaigns)
		sub.Post("/", h.adminUpsertCampaign)
		sub.Get("/campaigns", h.listCampaigns)
		sub.Post("/campaigns", h.adminUpsertCampaign)
		sub.Post("/campaigns/{id}/toggle", h.adminToggleCampaign)
		sub.Post("/{id}/toggle", h.adminToggleCampaign)
		sub.Get("/campaigns/{id}", h.adminGetCampaign)
		sub.Put("/campaigns/{id}", h.adminUpsertCampaign)
		sub.Delete("/campaigns/{id}", h.adminDeleteCampaign)
		sub.Get("/{id}", h.adminGetCampaign)
		sub.Put("/{id}", h.adminUpsertCampaign)
		sub.Delete("/{id}", h.adminDeleteCampaign)
		sub.Get("/revenue", h.adRevenue)
		sub.Get("/producer-revenue", h.producerRevenue)
		sub.Get("/content-analytics", h.producerRevenue)
	}

	mountProducerPortal := func(sub chi.Router) {
		sub.Post("/register", h.producerRegister)
		sub.Post("/signup", h.producerRegister)
		sub.With(h.tokens.OptionalAuth).Post("/submit-content", h.publicProducerSubmit)
		sub.With(h.tokens.OptionalAuth).Post("/submit", h.publicProducerSubmit)
		sub.Post("/collect/send-otp", h.collectSendOTP)
		sub.Post("/collect/verify-otp", h.collectVerifyOTP)
		sub.Get("/collect/status/{token}", h.collectStatus)
		sub.Post("/collect/kyc/{token}", h.collectSubmitKYC)
		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Get("/profile", h.producerProfile)
			pr.Post("/kyc/documents", h.producerUpdateKYC)
			pr.Post("/kyc", h.producerUpdateKYC)
			pr.Get("/agreement", h.producerProfile)
			pr.Post("/agreement", h.producerUpdateKYC)
			pr.Post("/agreement/upload", h.producerUpdateKYC)
			pr.Get("/analytics/movies", h.producerAnalytics)
			pr.Get("/analytics/dashboard", h.producerAnalytics)
			pr.Get("/analytics/content-overview", h.producerAnalytics)
			pr.Get("/analytics/ad-breakdown", h.producerAnalytics)
			pr.Get("/submissions", h.producerMySubmissions)
			pr.Post("/submissions", h.publicProducerSubmit)
		})
	}

	mountMarketing := func(sub chi.Router) {
		sub.Get("/validate", h.validateAgent)
		sub.Get("/validate/{code}", h.validateAgent)
		sub.Get("/agents/validate", h.validateAgent)
		sub.Get("/agents/validate/{code}", h.validateAgent)
	}

	mountAdminProducers := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListProducers)
		sub.Post("/", h.producerRegister)
		sub.Get("/list", h.adminListProducers)
		sub.Post("/onboard", h.producerRegister)
		sub.Post("/onboarding", h.producerRegister)
		sub.Get("/onboardings", h.adminListProducers)
		sub.Get("/submissions", h.adminListSubmissions)
		sub.Post("/onboardings/{id}/review", h.adminReviewProducer)
		sub.Post("/onboardings/{id}", h.adminReviewProducer)
		sub.Post("/{id}/kyc/review", h.adminReviewProducer)
		sub.Post("/{id}/review", h.adminReviewProducer)
		sub.Post("/{id}/toggle-status", h.adminToggleProducer)
		sub.Post("/{id}/reset-password", h.adminResetProducerPassword)
		sub.Post("/{id}/credentials", h.adminResetProducerPassword)
		sub.Get("/{id}", h.adminGetProducer)
		sub.Put("/{id}", h.adminUpdateProducer)
		sub.Delete("/{id}", h.adminDeleteProducer)
	}

	mountAdminMarketing := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListAgents)
		sub.Post("/", h.adminCreateAgent)
		sub.Get("/list", h.adminListAgents)
		sub.Get("/agents", h.adminListAgents)
		sub.Post("/agents", h.adminCreateAgent)
		sub.Get("/{id}", h.adminGetAgent)
		sub.Post("/{id}/toggle-status", h.adminToggleAgent)
		sub.Get("/{id}/members", h.adminListAgentMembers)
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Get(pref+"/ads.txt", h.adsTxt)
		r.Get(pref+"/app-ads.txt", h.adsTxt)
		r.Route(pref+"/ads", mountAds)
		r.Route(pref+"/admin/ads", mountAdminAds)
		r.Route(pref+"/admin/advertisements", mountAdminAds)
		r.Route(pref+"/producer", mountProducerPortal)
		r.Route(pref+"/producers", mountAdminProducers)
		r.Route(pref+"/admin/producers", mountAdminProducers)
		r.Route(pref+"/marketing", mountMarketing)
		r.Route(pref+"/admin/marketing", mountAdminMarketing)
		r.With(h.tokens.RequireAuth, auth.RequireAdmin).Get(pref+"/admin/content/submissions", h.adminListSubmissions)
		r.With(h.tokens.RequireAuth, auth.RequireAdmin).Post(pref+"/admin/content/submissions/{id}/review", h.adminReviewSubmission)
	}
}

func (h *Handler) vastXML(w http.ResponseWriter, r *http.Request) {
	xmlStr, err := h.svc.BuildVastXML(r.Context())
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(xmlStr))
}

func (h *Handler) listCampaigns(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListActiveCampaigns(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) trackEvent(evType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "Invalid campaign id")
			return
		}
		_ = h.svc.TrackAdEvent(r.Context(), id, evType, nil)
		httpx.OK(w, map[string]any{"tracked": true, "eventType": evType})
	}
}

func (h *Handler) recordEvent(w http.ResponseWriter, r *http.Request) {
	var body struct {
		CampaignID int64  `json:"campaignId"`
		EventType  string `json:"eventType"`
		ContentID  *int64 `json:"contentId"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	_ = h.svc.TrackAdEvent(r.Context(), body.CampaignID, body.EventType, body.ContentID)
	httpx.OK(w, map[string]any{"recorded": true})
}

func (h *Handler) validateAgent(w http.ResponseWriter, r *http.Request) {
	code := chi.URLParam(r, "code")
	if code == "" {
		code = r.URL.Query().Get("code")
	}
	agent, err := h.svc.ValidateMarketingAgent(r.Context(), code)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Invalid marketing agent code", "INVALID_AGENT")
		return
	}
	httpx.OK(w, agent)
}

func (h *Handler) adminListProducers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListProducers(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminListAgents(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListMarketingAgents(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}
