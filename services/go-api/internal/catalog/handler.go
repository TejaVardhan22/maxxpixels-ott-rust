package catalog

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
	mountCatalog := func(sub chi.Router) {
		sub.Get("/", h.browse)
		sub.Get("/content", h.browse)
		sub.Get("/movies", h.browseType("MOVIE"))
		sub.Get("/series", h.browseType("SERIES"))
		sub.Get("/shorts", h.browseType("SHORT_FILM"))
		sub.Get("/trending", h.trending)
		sub.Get("/featured", h.featured)
		sub.Get("/search", h.browse)
		sub.Get("/non-kannada", h.nonKannada)
		sub.Get("/by-language/{language}", h.byLanguage)
		sub.Get("/metadata", h.metadata)
		sub.Get("/languages", h.metadataField("languages"))
		sub.Get("/categories", h.metadataField("categories"))
		sub.Get("/genres", h.metadataField("genres"))
		sub.Get("/content-types", h.metadataField("contentTypes"))
		sub.Get("/seasons/{season_id}/episodes", h.seasonEpisodes)
		sub.Get("/slug/{id_or_slug}", h.detail)
		sub.Get("/content/id/{id}", h.detail)
		sub.Get("/content/{id_or_slug}", h.detail)
		sub.Get("/id/{id}", h.detail)
		sub.Get("/{id_or_slug}", h.detail)
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/catalog", mountCatalog)
		r.Route(pref+"/content", mountCatalog)
		r.Route(pref+"/contents", mountCatalog)

		r.Get(pref+"/languages", h.metadataField("languages"))
		r.Get(pref+"/categories", h.metadataField("categories"))
		r.Get(pref+"/genres", h.metadataField("genres"))
		r.Get(pref+"/content-types", h.metadataField("contentTypes"))
		r.Get(pref+"/search", h.browse)
		r.Get(pref+"/seasons/{season_id}/episodes", h.seasonEpisodes)
		r.Get(pref+"/cms/banners", h.banners)
		r.Get(pref+"/banners", h.banners)
		r.Get(pref+"/cms/sections", h.sections)
		r.Get(pref+"/sections", h.sections)
		r.Get(pref+"/cms/portal-banners", h.portalBanners)
		r.Get(pref+"/portal-banners", h.portalBanners)
		r.Get(pref+"/cms/intro-video/active", h.activeIntro)
		r.Get(pref+"/intro-video/active", h.activeIntro)
		r.Get(pref+"/categories/{id_or_slug}", h.browseByCategory)
		r.Get(pref+"/categories/{id_or_slug}/content", h.browseByCategory)
		r.Get(pref+"/categories/{id_or_slug}/movies", h.browseByCategory)

		// Live TV public read
		r.Get(pref+"/live/channels", h.listLiveChannels)
		r.Get(pref+"/live/events", h.listLiveEvents)
		r.Get(pref+"/live-channels", h.listLiveChannels)

		// Public Media Serving Proxy (local disk -> Bunny Edge Storage)
		r.Get(pref+"/uploads/{folder}/{file_name}", h.serveMedia(""))
		r.Get(pref+"/uploads/{file_name}", h.serveMedia(""))
		r.Get(pref+"/posters/{file_name}", h.serveMedia("posters"))
		r.Get(pref+"/banners/{file_name}", h.serveMedia("banners"))
		r.Get(pref+"/branding/{file_name}", h.serveMedia("branding"))

		// Storage uploads (authenticated)
		mountStorage := func(sub chi.Router) {
			if h.tokens != nil {
				sub.Use(h.tokens.RequireAuth)
			}
			sub.Post("/upload", h.uploadMedia)
			sub.Get("/direct-upload-token", h.directUploadToken)
			sub.Post("/direct-upload-token", h.directUploadToken)
			sub.Post("/upload-video", h.uploadVideo)
			sub.Post("/upload/video", h.uploadVideo)
			sub.Post("/upload-async", h.uploadVideo)
			sub.Get("/presigned-url", h.directUploadToken)
			sub.Post("/presigned-url", h.directUploadToken)
		}
		r.Route(pref+"/storage", mountStorage)
		r.Route(pref+"/admin/storage", mountStorage)

		// Admin Movies, Series, Seasons, Episodes, Live, Intro Video & Portal Banners CRUD
		r.Group(func(adm chi.Router) {
			if h.tokens != nil {
				adm.Use(h.tokens.RequireAuth)
				adm.Use(auth.RequireAdmin)
			}
			adm.Get(pref+"/admin/movies", h.adminListMovies)
			adm.Post(pref+"/admin/movies", h.adminCreateMovie)
			adm.Get(pref+"/admin/movies/{id}", h.detail)
			adm.Put(pref+"/admin/movies/{id}", h.adminUpdateMovie)
			adm.Delete(pref+"/admin/movies/{id}", h.adminDeleteMovie)
			adm.Patch(pref+"/admin/movies/{id}/status", h.adminUpdateMovieStatus)

			adm.Get(pref+"/admin/series", h.adminListSeries)
			adm.Post(pref+"/admin/series", h.adminCreateSeries)
			adm.Get(pref+"/admin/series/{id}", h.detail)
			adm.Put(pref+"/admin/series/{id}", h.adminUpdateMovie)
			adm.Delete(pref+"/admin/series/{id}", h.adminDeleteMovie)
			adm.Get(pref+"/admin/series/{series_id}/seasons", h.adminListSeasons)
			adm.Post(pref+"/admin/series/{series_id}/seasons", h.adminCreateSeason)
			adm.Delete(pref+"/admin/series/{series_id}/seasons/{season_id}", h.adminDeleteSeason)
			adm.Get(pref+"/admin/series/seasons/{season_id}/episodes", h.seasonEpisodes)
			adm.Post(pref+"/admin/series/seasons/{season_id}/episodes", h.adminCreateEpisode)
			adm.Get(pref+"/admin/series/{series_id}/seasons/{season_id}/episodes", h.seasonEpisodes)
			adm.Post(pref+"/admin/series/{series_id}/seasons/{season_id}/episodes", h.adminCreateEpisode)
			adm.Put(pref+"/admin/series/{series_id}/seasons/{season_id}/episodes/{episode_id}", h.adminUpdateEpisode)
			adm.Delete(pref+"/admin/series/{series_id}/seasons/{season_id}/episodes/{episode_id}", h.adminDeleteEpisode)

			adm.Get(pref+"/admin/live/channels", h.listLiveChannels)
			adm.Post(pref+"/admin/live/channels", h.createLiveChannel)
			adm.Put(pref+"/admin/live/channels/{id}", h.updateLiveChannel)
			adm.Delete(pref+"/admin/live/channels/{id}", h.deleteLiveChannel)
			adm.Get(pref+"/admin/live/events", h.listLiveEvents)
			adm.Post(pref+"/admin/live/events", h.createLiveEvent)
			adm.Put(pref+"/admin/live/events/{id}", h.updateLiveEvent)
			adm.Delete(pref+"/admin/live/events/{id}", h.deleteLiveEvent)
			adm.Get(pref+"/admin/live-channels", h.listLiveChannels)
			adm.Post(pref+"/admin/live-channels", h.createLiveChannel)
			adm.Put(pref+"/admin/live-channels/{id}", h.updateLiveChannel)
			adm.Delete(pref+"/admin/live-channels/{id}", h.deleteLiveChannel)
			adm.Get(pref+"/admin/live-events", h.listLiveEvents)
			adm.Post(pref+"/admin/live-events", h.createLiveEvent)
			adm.Put(pref+"/admin/live-events/{id}", h.updateLiveEvent)
			adm.Delete(pref+"/admin/live-events/{id}", h.deleteLiveEvent)

			for _, ivPref := range []string{"/admin/intro-video", "/admin/intro-videos"} {
				adm.Get(pref+ivPref, h.adminListIntroVideos)
				adm.Get(pref+ivPref+"/list", h.adminListIntroVideos)
				adm.Post(pref+ivPref, h.adminCreateIntroVideo)
				adm.Put(pref+ivPref+"/{id}", h.adminUpdateIntroVideo)
				adm.Delete(pref+ivPref+"/{id}", h.adminDeleteIntroVideo)
				adm.Post(pref+ivPref+"/{id}/activate", h.adminActivateIntroVideo)
			}

			adm.Get(pref+"/admin/portal-banners", h.adminListPortalBanners)
			adm.Get(pref+"/admin/portal-banners/list", h.adminListPortalBanners)
			adm.Post(pref+"/admin/portal-banners", h.adminCreatePortalBanner)
			adm.Put(pref+"/admin/portal-banners/{id}", h.adminUpdatePortalBanner)
			adm.Delete(pref+"/admin/portal-banners/{id}", h.adminDeletePortalBanner)
			adm.Post(pref+"/admin/portal-banners/{id}/toggle-status", h.adminTogglePortalBanner)
		})
	}
}

func (h *Handler) browse(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("size"))
	items, total, err := h.svc.Browse(r.Context(), BrowseFilter{
		Query:       firstNonEmpty(q.Get("q"), q.Get("search"), q.Get("query")),
		ContentType: firstNonEmpty(q.Get("type"), q.Get("contentType")),
		Language:    q.Get("language"),
		Category:    q.Get("category"),
		Genre:       q.Get("genre"),
		Page:        page,
		Size:        size,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(items, total, int64(page), int64(size)))
}

func (h *Handler) browseType(ct string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		page, _ := strconv.Atoi(q.Get("page"))
		size, _ := strconv.Atoi(q.Get("size"))
		items, total, err := h.svc.Browse(r.Context(), BrowseFilter{
			ContentType: ct,
			Language:    q.Get("language"),
			Page:        page,
			Size:        size,
		})
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		httpx.OK(w, httpx.NewPageResponse(items, total, int64(page), int64(size)))
	}
}

func (h *Handler) trending(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.svc.GetTrending(r.Context(), limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, items)
}

func (h *Handler) featured(w http.ResponseWriter, r *http.Request) {
	items, _, err := h.svc.Browse(r.Context(), BrowseFilter{
		Language: r.URL.Query().Get("language"),
		Featured: true,
		Size:     20,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, items)
}

func (h *Handler) nonKannada(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.svc.GetByLanguage(r.Context(), "non-kannada", limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, items)
}

func (h *Handler) byLanguage(w http.ResponseWriter, r *http.Request) {
	lang := chi.URLParam(r, "language")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	items, err := h.svc.GetByLanguage(r.Context(), lang, limit)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, items)
}

func (h *Handler) detail(w http.ResponseWriter, r *http.Request) {
	key := firstNonEmpty(chi.URLParam(r, "id_or_slug"), chi.URLParam(r, "id"))
	data, err := h.svc.GetDetail(r.Context(), key)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "Content not found", "NOT_FOUND")
		return
	}
	httpx.OK(w, data)
}

func (h *Handler) seasonEpisodes(w http.ResponseWriter, r *http.Request) {
	sid, err := strconv.ParseInt(chi.URLParam(r, "season_id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid season id")
		return
	}
	eps, err := h.svc.ListSeasonEpisodes(r.Context(), sid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, eps)
}

func (h *Handler) banners(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListBanners(r.Context(), r.URL.Query().Get("placement"), r.URL.Query().Get("language"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) sections(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListSections(r.Context(), r.URL.Query().Get("language"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) metadata(w http.ResponseWriter, r *http.Request) {
	data, err := h.svc.GetMetadata(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, data)
}

func (h *Handler) metadataField(field string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := h.svc.GetMetadata(r.Context())
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, err.Error())
			return
		}
		httpx.OK(w, data[field])
	}
}

func (h *Handler) portalBanners(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListPortalBanners(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) activeIntro(w http.ResponseWriter, r *http.Request) {
	row, err := h.svc.GetActiveIntroVideo(r.Context())
	if err != nil {
		httpx.OK(w, nil)
		return
	}
	httpx.OK(w, row)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
