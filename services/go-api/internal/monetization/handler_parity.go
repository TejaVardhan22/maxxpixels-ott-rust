package monetization

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/auth"
	"github.com/maxxpixels/go-api/pkg/httpx"
	"github.com/maxxpixels/go-api/pkg/models"
)

func (h *Handler) adsTxt(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(h.svc.GetAdsTxt(r.Context())))
}

func (h *Handler) adConfig(w http.ResponseWriter, r *http.Request) {
	cid, _ := strconv.ParseInt(chi.URLParam(r, "contentId"), 10, 64)
	res, _ := h.svc.GetAdConfig(r.Context(), cid)
	httpx.OK(w, res)
}

func (h *Handler) createAdSession(w http.ResponseWriter, r *http.Request) {
	var body struct {
		ContentID int64 `json:"contentId"`
	}
	_ = httpx.DecodeJSON(r, &body)
	var uid *int64
	if claims, ok := auth.FromContext(r.Context()); ok {
		if id, err := claims.ParsedUserID(); err == nil && id > 0 {
			uid = &id
		}
	}
	httpx.OK(w, h.svc.CreateAdSession(r.Context(), body.ContentID, uid))
}

func (h *Handler) adRevenue(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.GetAdRevenue(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) producerRevenue(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.GetProducerRevenue(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

// --- Admin Ads Handlers ---

func (h *Handler) adminListProviders(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListProviders(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertProvider(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertProvider(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminListPlacements(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListPlacements(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminUpsertPlacement(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertPlacement(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminGetCampaign(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminGetCampaign(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminUpsertCampaign(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminUpsertCampaign(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminToggleCampaign(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminToggleCampaign(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteCampaign(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteCampaign(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

// --- Producer Portal Handlers ---

func (h *Handler) producerRegister(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.ProducerRegister(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Producer registered")
}

func (h *Handler) publicProducerSubmit(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	var pid *int64
	if claims, ok := auth.FromContext(r.Context()); ok {
		if uid, err := claims.ParsedUserID(); err == nil {
			if p, err := h.svc.GetProducerByUser(r.Context(), uid); err == nil {
				pid = &p.ID
			}
		}
	}
	row, err := h.svc.ProducerSubmitContent(r.Context(), pid, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Content submitted for review")
}

func (h *Handler) collectSendOTP(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.CollectSendOTP(r.Context(), sVal(body, "phone", "phoneNumber", "email", "contact"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) collectVerifyOTP(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.CollectVerifyOTP(r.Context(), sVal(body, "phone", "phoneNumber", "email", "contact"), sVal(body, "otp", "code"))
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) collectStatus(w http.ResponseWriter, r *http.Request) {
	tok := chi.URLParam(r, "token")
	contact, ok := h.svc.cache.Get(r.Context(), "producer:kyc:tok:"+tok)
	httpx.OK(w, map[string]any{"valid": ok, "contact": contact})
}

func (h *Handler) collectSubmitKYC(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	var id int64
	if v, ok := body["producerId"].(float64); ok {
		id = int64(v)
	}
	if id <= 0 {
		httpx.OK(w, map[string]any{"submitted": true})
		return
	}
	row, err := h.svc.UpdateProducerKYC(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) producerProfile(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	p, err := h.svc.GetProducerByUser(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, p)
}

func (h *Handler) producerUpdateKYC(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	p, err := h.svc.GetProducerByUser(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.UpdateProducerKYC(r.Context(), p.ID, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "KYC updated")
}

func (h *Handler) producerAnalytics(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	p, err := h.svc.GetProducerByUser(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	res, _ := h.svc.ProducerAnalytics(r.Context(), p.ID)
	httpx.OK(w, res)
}

func (h *Handler) producerMySubmissions(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	p, err := h.svc.GetProducerByUser(r.Context(), uid)
	if err != nil {
		httpx.OK(w, []any{})
		return
	}
	var rows []models.Content
	_ = h.svc.db.WithContext(r.Context()).Where("producer_id = ?", p.ID).Order("created_at DESC").Find(&rows).Error
	httpx.OK(w, rows)
}

// --- Admin Producer & Marketing Handlers ---

func (h *Handler) adminGetProducer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var p models.ProducerProfile
	if err := h.svc.db.WithContext(r.Context()).First(&p, id).Error; err != nil {
		httpx.Error(w, http.StatusNotFound, "Producer not found")
		return
	}
	httpx.OK(w, p)
}

func (h *Handler) adminUpdateProducer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.UpdateProducerKYC(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminDeleteProducer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.db.WithContext(r.Context()).Delete(&models.ProducerProfile{}, id).Error
	httpx.OK(w, map[string]any{"deleted": true, "id": id})
}

func (h *Handler) adminReviewProducer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Status          string `json:"status"`
		Decision        string `json:"decision"`
		RejectionReason string `json:"rejectionReason"`
		Reason          string `json:"reason"`
	}
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminReviewProducer(r.Context(), id, firstStr(body.Status, body.Decision), firstStr(body.RejectionReason, body.Reason))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Producer reviewed")
}

func (h *Handler) adminToggleProducer(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminToggleProducer(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminListSubmissions(w http.ResponseWriter, r *http.Request) {
	rows, _ := h.svc.AdminListSubmissions(r.Context())
	httpx.OK(w, rows)
}

func (h *Handler) adminReviewSubmission(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body struct {
		Status   string `json:"status"`
		Decision string `json:"decision"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.AdminReviewSubmission(r.Context(), id, firstStr(body.Decision, body.Status))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) adminCreateAgent(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	_ = httpx.DecodeJSON(r, &body)
	row, err := h.svc.AdminCreateAgent(r.Context(), body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row)
}

func (h *Handler) adminGetAgent(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminGetAgent(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminToggleAgent(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminToggleAgent(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminListAgentMembers(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	rows, _ := h.svc.AdminListAgentMembers(r.Context(), id)
	httpx.OK(w, rows)
}
