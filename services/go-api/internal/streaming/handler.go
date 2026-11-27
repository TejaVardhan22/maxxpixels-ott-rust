package streaming

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
	mountPlayback := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Post("/authorize", h.authorizePost)
		sub.Post("/sessions", h.authorizePost)
		sub.Post("/start", h.authorizePost)
		sub.Post("/init", h.authorizePost)
		sub.Post("/play", h.authorizePost)
		sub.Get("/authorize/{content_id}", h.authorizeGet)
		sub.Get("/stream/{content_id}", h.authorizeGet)
		sub.Post("/heartbeat", h.heartbeat)
		sub.Post("/progress", h.heartbeat)
		sub.Post("/sessions/{session_id}/heartbeat", h.heartbeat)
		sub.Post("/stop", h.stop)
	}

	mountWatch := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Get("/", h.watchHistory)
		sub.Get("/history", h.watchHistory)
		sub.Post("/history", h.heartbeat)
		sub.Post("/progress", h.heartbeat)
		sub.Get("/continue-watching", h.continueWatching)
		sub.Get("/continue", h.continueWatching)
		sub.Get("/watchlist", h.watchlist)
		sub.Post("/watchlist", h.toggleWatchlist)
		sub.Post("/watchlist/{content_id}", h.toggleWatchlist)
		sub.Delete("/watchlist/{content_id}", h.removeWatchlist)
	}

	mountWatchlist := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Get("/", h.watchlist)
		sub.Post("/", h.toggleWatchlist)
		sub.Post("/{content_id}", h.toggleWatchlist)
		sub.Delete("/{content_id}", h.removeWatchlist)
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/playback", mountPlayback)
		r.Route(pref+"/video", mountPlayback)
		r.Route(pref+"/watch", mountWatch)
		r.Route(pref+"/watch-history", mountWatch)
		r.Route(pref+"/watchlist", mountWatchlist)
	}
}

func (h *Handler) authorizePost(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		ContentID int64  `json:"contentId"`
		VideoID   int64  `json:"videoId"`
		EpisodeID *int64 `json:"episodeId"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	cid := body.ContentID
	if cid <= 0 {
		cid = body.VideoID
	}
	res, err := h.svc.AuthorizePlayback(r.Context(), uid, cid, body.EpisodeID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, err.Error(), "PLAYBACK_FORBIDDEN")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) authorizeGet(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	cid, err := strconv.ParseInt(chi.URLParam(r, "content_id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid content_id")
		return
	}
	var epID *int64
	if rawEp := r.URL.Query().Get("episodeId"); rawEp != "" {
		if parsed, e := strconv.ParseInt(rawEp, 10, 64); e == nil && parsed > 0 {
			epID = &parsed
		}
	}
	res, err := h.svc.AuthorizePlayback(r.Context(), uid, cid, epID)
	if err != nil {
		httpx.Error(w, http.StatusForbidden, err.Error(), "PLAYBACK_FORBIDDEN")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		SessionToken    string `json:"sessionToken"`
		ContentID       int64  `json:"contentId"`
		EpisodeID       *int64 `json:"episodeId"`
		PositionSeconds int32  `json:"positionSeconds"`
		DurationSeconds int32  `json:"durationSeconds"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	sess := body.SessionToken
	if sess == "" {
		sess = chi.URLParam(r, "session_id")
	}
	if err := h.svc.SaveProgress(r.Context(), uid, body.ContentID, body.EpisodeID, body.PositionSeconds, body.DurationSeconds, sess); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"saved": true})
}

func (h *Handler) stop(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		SessionToken    string `json:"sessionToken"`
		ContentID       int64  `json:"contentId"`
		PositionSeconds int32  `json:"positionSeconds"`
		DurationSeconds int32  `json:"durationSeconds"`
	}
	_ = httpx.DecodeJSON(r, &body)
	_ = h.svc.StopSession(r.Context(), uid, body.ContentID, body.PositionSeconds, body.DurationSeconds, body.SessionToken)
	httpx.OK(w, map[string]any{"stopped": true})
}

func (h *Handler) continueWatching(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.GetContinueWatching(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) watchHistory(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.GetWatchHistory(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) watchlist(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.GetWatchlist(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) toggleWatchlist(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	cid, _ := strconv.ParseInt(chi.URLParam(r, "content_id"), 10, 64)
	if cid <= 0 {
		var body struct {
			ContentID int64 `json:"contentId"`
		}
		_ = httpx.DecodeJSON(r, &body)
		cid = body.ContentID
	}
	if cid <= 0 {
		httpx.Error(w, http.StatusBadRequest, "contentId is required")
		return
	}
	added, err := h.svc.ToggleWatchlist(r.Context(), uid, cid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"inWatchlist": added, "contentId": cid}, "Watchlist updated")
}

func (h *Handler) removeWatchlist(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	cid, err := strconv.ParseInt(chi.URLParam(r, "content_id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid content_id")
		return
	}
	if err := h.svc.RemoveFromWatchlist(r.Context(), uid, cid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"inWatchlist": false, "contentId": cid}, "Removed from watchlist")
}
