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
		sub.Get("/campaigns", h.listCampaigns)
		sub.Get("/track/impression/{id}", h.trackEvent("IMPRESSION"))
		sub.Get("/track/click/{id}", h.trackEvent("CLICK"))
		sub.Post("/events", h.recordEvent)
		sub.Post("/track", h.recordEvent)
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
		sub.Get("/list", h.adminListProducers)
	}

	mountAdminMarketing := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListAgents)
		sub.Get("/list", h.adminListAgents)
		sub.Get("/agents", h.adminListAgents)
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/ads", mountAds)
		r.Route(pref+"/marketing", mountMarketing)
		r.Route(pref+"/admin/producers", mountAdminProducers)
		r.Route(pref+"/admin/marketing", mountAdminMarketing)
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
