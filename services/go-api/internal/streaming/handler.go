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
		sub.Group(func(opt chi.Router) {
			opt.Use(h.tokens.OptionalAuth)
			opt.Post("/authorize", h.authorizePost)
			opt.Post("/sessions", h.authorizePost)
			opt.Post("/start", h.authorizePost)
			opt.Post("/init", h.authorizePost)
			opt.Post("/play", h.authorizePost)
			opt.Get("/authorize/{content_id}", h.authorizeGet)
			opt.Get("/stream/{content_id}", h.authorizeGet)
		})
		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Get("/sessions", h.listSessions)
			pr.Post("/heartbeat", h.heartbeat)
			pr.Post("/progress", h.heartbeat)
			pr.Post("/sessions/{session_id}/heartbeat", h.heartbeat)
			pr.Post("/stop", h.stop)
		})
	}

	mountWatch := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Get("/", h.watchHistory)
		sub.Get("/history", h.watchHistory)
		sub.Post("/history", h.heartbeat)
		sub.Delete("/history/{id}", h.removeHistory)
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
		sub.Delete("/", h.removeWatchlist)
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
	var uid *int64
	if claims, ok := auth.FromContext(r.Context()); ok {
		if parsed, err := claims.ParsedUserID(); err == nil && parsed > 0 {
			uid = &parsed
		}
	}
	var body struct {
		ContentID  int64  `json:"contentId"`
		VideoID    int64  `json:"videoId"`
		EpisodeID  *int64 `json:"episodeId"`
		ProfileID  *int64 `json:"profileId"`
		DeviceID   string `json:"deviceId"`
		DeviceType string `json:"deviceType"`
		IsTrailer  bool   `json:"isTrailer"`
		Trailer    bool   `json:"trailer"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	cid := body.ContentID
	if cid <= 0 {
		cid = body.VideoID
	}
	res, err := h.svc.AuthorizePlayback(r.Context(), AuthorizeInput{
		UserID:     uid,
		ContentID:  cid,
		EpisodeID:  body.EpisodeID,
		ProfileID:  body.ProfileID,
		DeviceID:   body.DeviceID,
		DeviceType: body.DeviceType,
		IsTrailer:  body.IsTrailer || body.Trailer,
		IPAddress:  r.RemoteAddr,
	})
	if err != nil {
		httpx.Error(w, http.StatusForbidden, err.Error(), "PLAYBACK_FORBIDDEN")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) authorizeGet(w http.ResponseWriter, r *http.Request) {
	var uid *int64
	if claims, ok := auth.FromContext(r.Context()); ok {
		if parsed, err := claims.ParsedUserID(); err == nil && parsed > 0 {
			uid = &parsed
		}
	}
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
	isTrailer := r.URL.Query().Get("isTrailer") == "true" || r.URL.Query().Get("trailer") == "true"
	res, err := h.svc.AuthorizePlayback(r.Context(), AuthorizeInput{
		UserID:     uid,
		ContentID:  cid,
		EpisodeID:  epID,
		DeviceID:   r.URL.Query().Get("deviceId"),
		DeviceType: r.URL.Query().Get("deviceType"),
		IsTrailer:  isTrailer,
		IPAddress:  r.RemoteAddr,
	})
	if err != nil {
		httpx.Error(w, http.StatusForbidden, err.Error(), "PLAYBACK_FORBIDDEN")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) listSessions(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.ListSessions(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		SessionID              string `json:"sessionId"`
		SessionToken           string `json:"sessionToken"`
		ContentID              int64  `json:"contentId"`
		EpisodeID              *int64 `json:"episodeId"`
		PositionSeconds        int32  `json:"positionSeconds"`
		CurrentPositionSeconds int32  `json:"currentPositionSeconds"`
		DurationSeconds        int32  `json:"durationSeconds"`
		TotalDurationSeconds   int32  `json:"totalDurationSeconds"`
		Completed              *bool  `json:"completed"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	sess := body.SessionToken
	if sess == "" {
		sess = body.SessionID
	}
	if sess == "" {
		sess = chi.URLParam(r, "session_id")
	}
	pos := body.PositionSeconds
	if pos <= 0 {
		pos = body.CurrentPositionSeconds
	}
	dur := body.DurationSeconds
	if dur <= 0 {
		dur = body.TotalDurationSeconds
	}
	if err := h.svc.SaveProgress(r.Context(), uid, body.ContentID, body.EpisodeID, pos, dur, sess, body.Completed); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"saved": true})
}

func (h *Handler) stop(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		SessionID              string `json:"sessionId"`
		SessionToken           string `json:"sessionToken"`
		ContentID              int64  `json:"contentId"`
		PositionSeconds        int32  `json:"positionSeconds"`
		CurrentPositionSeconds int32  `json:"currentPositionSeconds"`
		DurationSeconds        int32  `json:"durationSeconds"`
		TotalDurationSeconds   int32  `json:"totalDurationSeconds"`
		Completed              *bool  `json:"completed"`
	}
	_ = httpx.DecodeJSON(r, &body)
	sess := body.SessionToken
	if sess == "" {
		sess = body.SessionID
	}
	pos := body.PositionSeconds
	if pos <= 0 {
		pos = body.CurrentPositionSeconds
	}
	dur := body.DurationSeconds
	if dur <= 0 {
		dur = body.TotalDurationSeconds
	}
	_ = h.svc.StopSession(r.Context(), uid, body.ContentID, pos, dur, sess, body.Completed)
	httpx.OK(w, map[string]any{"stopped": true})
}

func (h *Handler) removeHistory(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid history id")
		return
	}
	if err := h.svc.RemoveWatchHistory(r.Context(), uid, id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "id": id}, "Removed from watch history")
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
	cid, _ := strconv.ParseInt(chi.URLParam(r, "content_id"), 10, 64)
	if cid <= 0 {
		cid, _ = strconv.ParseInt(r.URL.Query().Get("contentId"), 10, 64)
	}
	if cid <= 0 {
		httpx.Error(w, http.StatusBadRequest, "Invalid content_id")
		return
	}
	if err := h.svc.RemoveFromWatchlist(r.Context(), uid, cid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"inWatchlist": false, "contentId": cid}, "Removed from watchlist")
}
