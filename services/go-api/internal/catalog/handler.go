package catalog

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
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
