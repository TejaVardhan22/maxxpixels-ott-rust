package catalog

import (
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

func (h *Handler) browseByCategory(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	items, total, err := h.svc.BrowseByCategory(r.Context(), chi.URLParam(r, "id_or_slug"), page, size)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(items, total, int64(page), int64(size)))
}

// --- Admin Movies ---

func (h *Handler) adminListMovies(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("size"))
	items, total, err := h.svc.AdminListMovies(r.Context(), page, size, firstNonEmpty(q.Get("search"), q.Get("q")), q.Get("status"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(items, total, int64(page), int64(size)))
}

func (h *Handler) adminCreateMovie(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.AdminCreateMovie(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, res, "Movie created")
}

func (h *Handler) adminUpdateMovie(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid id")
		return
	}
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.AdminUpdateMovie(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "Movie updated")
}

func (h *Handler) adminUpdateMovieStatus(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Status string `json:"status"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.AdminUpdateMovieStatus(r.Context(), id, body.Status)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "Movie status updated")
}

func (h *Handler) adminDeleteMovie(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.AdminDeleteMovie(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "id": id}, "Movie deleted")
}

// --- Admin Series / Seasons / Episodes ---

func (h *Handler) adminListSeries(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.AdminListSeries(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminCreateSeries(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.AdminCreateSeries(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, res, "Series created")
}

func (h *Handler) adminListSeasons(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "series_id"), 10, 64)
	rows, err := h.svc.AdminListSeasons(r.Context(), sid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminCreateSeason(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "series_id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminCreateSeason(r.Context(), sid, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Season created")
}

func (h *Handler) adminDeleteSeason(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "season_id"), 10, 64)
	if err := h.svc.AdminDeleteSeason(r.Context(), sid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "id": sid})
}

func (h *Handler) adminCreateEpisode(w http.ResponseWriter, r *http.Request) {
	sid, _ := strconv.ParseInt(chi.URLParam(r, "season_id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminCreateEpisode(r.Context(), sid, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Episode created")
}

func (h *Handler) adminUpdateEpisode(w http.ResponseWriter, r *http.Request) {
	eid, _ := strconv.ParseInt(chi.URLParam(r, "episode_id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpdateEpisode(r.Context(), eid, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Episode updated")
}

func (h *Handler) adminDeleteEpisode(w http.ResponseWriter, r *http.Request) {
	eid, _ := strconv.ParseInt(chi.URLParam(r, "episode_id"), 10, 64)
	if err := h.svc.AdminDeleteEpisode(r.Context(), eid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, map[string]any{"deleted": true, "id": eid})
}

// --- Live Channels & Events ---

func (h *Handler) listLiveChannels(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListLiveChannels(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) createLiveChannel(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.CreateLiveChannel(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Live channel created")
}

func (h *Handler) deleteLiveChannel(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.DeleteLiveChannel(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) listLiveEvents(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListLiveEvents(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) createLiveEvent(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.CreateLiveEvent(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Live event created")
}

func (h *Handler) deleteLiveEvent(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.DeleteLiveEvent(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

// --- Admin Intro Videos & Portal Banners ---

func (h *Handler) adminListIntroVideos(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.AdminListIntroVideos(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminCreateIntroVideo(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminCreateIntroVideo(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row)
}

func (h *Handler) adminUpdateIntroVideo(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpdateIntroVideo(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminActivateIntroVideo(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminActivateIntroVideo(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Intro video activated")
}

func (h *Handler) adminDeleteIntroVideo(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteIntroVideo(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminListPortalBanners(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.AdminListPortalBanners(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminCreatePortalBanner(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminCreatePortalBanner(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row)
}

func (h *Handler) adminUpdatePortalBanner(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpdatePortalBanner(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminTogglePortalBanner(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminTogglePortalBanner(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeletePortalBanner(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeletePortalBanner(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

// --- Storage, Bunny Uploads & Media Proxy ---

func (h *Handler) uploadMedia(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(64 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Multipart form expected")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "file field is required")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	folder := firstNonEmpty(r.FormValue("folder"), r.URL.Query().Get("folder"), "media")
	res, err := h.svc.UploadMedia(r.Context(), folder, header.Filename, data, header.Header.Get("Content-Type"))
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.OK(w, res, "Uploaded successfully")
}

func (h *Handler) directUploadToken(w http.ResponseWriter, r *http.Request) {
	title := r.URL.Query().Get("title")
	if title == "" {
		var body struct {
			Title string `json:"title"`
		}
		_ = httpx.DecodeJSON(r, &body)
		title = body.Title
	}
	res, err := h.svc.DirectUploadToken(r.Context(), title)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) uploadVideo(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Multipart form expected")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		file, header, err = r.FormFile("video")
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "file or video field is required")
			return
		}
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	title := firstNonEmpty(r.FormValue("title"), header.Filename)
	res, err := h.svc.UploadVideo(r.Context(), title, data)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, err.Error())
		return
	}
	httpx.OK(w, res, "Video uploaded to Bunny Stream")
}

func (h *Handler) serveMedia(defaultFolder string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		folder := chi.URLParam(r, "folder")
		if folder == "" {
			folder = defaultFolder
		}
		fileName := chi.URLParam(r, "file_name")
		data, mime, ok := h.svc.ServeMedia(r.Context(), folder, fileName)
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", mime)
		w.Header().Set("Cache-Control", "public, max-age=86400")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	}
}
