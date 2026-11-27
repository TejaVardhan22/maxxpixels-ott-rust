package commerce

import (
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

func (h *Handler) getPlan(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid plan id")
		return
	}
	p, err := h.svc.GetPlanByID(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, p)
}

func (h *Handler) razorpayWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Failed to read webhook body")
		return
	}
	res, err := h.svc.HandleRazorpayWebhook(r.Context(), raw, r.Header.Get("X-Razorpay-Signature"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error(), "WEBHOOK_INVALID")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) stripeWebhook(w http.ResponseWriter, r *http.Request) {
	raw, _ := io.ReadAll(r.Body)
	res, err := h.svc.HandleStripeWebhook(r.Context(), raw)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res)
}

// --- Admin Payments ---

func (h *Handler) adminListPayments(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	size, _ := strconv.Atoi(q.Get("size"))
	rows, total, err := h.svc.AdminListTransactions(r.Context(), page, size, q.Get("status"), q.Get("search"))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(rows, total, int64(page), int64(size)))
}

func (h *Handler) adminPaymentAnalytics(w http.ResponseWriter, r *http.Request) {
	res, err := h.svc.AdminPaymentAnalytics(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) adminListTvod(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	size, _ := strconv.Atoi(r.URL.Query().Get("size"))
	rows, total, err := h.svc.AdminListTvodPurchases(r.Context(), page, size)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, httpx.NewPageResponse(rows, total, int64(page), int64(size)))
}

func (h *Handler) adminRefundPayment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid payment id")
		return
	}
	var body struct {
		Amount float64 `json:"amount"`
		Reason string  `json:"reason"`
	}
	_ = httpx.DecodeJSON(r, &body)
	res, err := h.svc.AdminRefundPayment(r.Context(), id, body.Amount, body.Reason)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, res, "Payment refunded")
}

// --- Admin Plans ---

func (h *Handler) adminListPlans(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.AdminListPlans(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminCreatePlan(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.AdminUpsertPlan(r.Context(), 0, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Plan created")
}

func (h *Handler) adminUpdatePlan(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.AdminUpsertPlan(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Plan updated")
}

func (h *Handler) adminTogglePlan(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminTogglePlanStatus(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Plan status toggled")
}

func (h *Handler) adminDeletePlan(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeletePlan(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id}, "Plan deleted")
}

// --- Admin Coupons ---

func (h *Handler) adminListCoupons(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.AdminListCoupons(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) adminGetCoupon(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminGetCoupon(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, err.Error())
		return
	}
	httpx.OK(w, row)
}

func (h *Handler) adminCreateCoupon(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.AdminUpsertCoupon(r.Context(), 0, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.Created(w, row, "Coupon created")
}

func (h *Handler) adminUpdateCoupon(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var body map[string]any
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	row, err := h.svc.AdminUpsertCoupon(r.Context(), id, body)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Coupon updated")
}

func (h *Handler) adminToggleCoupon(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	row, err := h.svc.AdminToggleCouponStatus(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	httpx.OK(w, row, "Coupon status toggled")
}

func (h *Handler) adminDeleteCoupon(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	_ = h.svc.AdminDeleteCoupon(r.Context(), id)
	httpx.OK(w, map[string]any{"deleted": true, "id": id}, "Coupon deleted")
}
