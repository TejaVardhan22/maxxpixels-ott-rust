package commerce

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
	mountPlans := func(sub chi.Router) {
		sub.Get("/", h.listPlans)
		sub.Post("/validate-coupon", h.validateCoupon)
		sub.Get("/validate-coupon", h.validateCoupon)
		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Get("/my", h.mySubscription)
			pr.Get("/active", h.mySubscription)
		})
		sub.Get("/{id}", h.getPlan)
	}

	mountPayments := func(sub chi.Router) {
		sub.Post("/webhook/razorpay", h.razorpayWebhook)
		sub.Post("/webhooks/razorpay", h.razorpayWebhook)
		sub.Post("/webhook/stripe", h.stripeWebhook)
		sub.Post("/webhooks/stripe", h.stripeWebhook)
		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Post("/create-order", h.createOrder)
			pr.Post("/orders", h.createOrder)
			pr.Post("/initiate", h.createOrder)
			pr.Post("/verify", h.verifyPayment)
			pr.Post("/verify-payment", h.verifyPayment)
			pr.Post("/confirm", h.verifyPayment)
			pr.Get("/my-transactions", h.myTransactions)
			pr.Get("/history", h.myTransactions)
			pr.Get("/my-subscription", h.mySubscription)
			pr.Get("/subscription", h.mySubscription)
		})
	}

	mountAdminPayments := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListPayments)
		sub.Get("/analytics", h.adminPaymentAnalytics)
		sub.Get("/summary", h.adminPaymentAnalytics)
		sub.Get("/stats", h.adminPaymentAnalytics)
		sub.Get("/tvod", h.adminListTvod)
		sub.Post("/{id}/refund", h.adminRefundPayment)
	}

	mountAdminPlans := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListPlans)
		sub.Post("/", h.adminCreatePlan)
		sub.Get("/coupons", h.adminListCoupons)
		sub.Post("/coupons", h.adminCreateCoupon)
		sub.Put("/coupons/{id}", h.adminUpdateCoupon)
		sub.Delete("/coupons/{id}", h.adminDeleteCoupon)
		sub.Get("/{id}", h.getPlan)
		sub.Put("/{id}", h.adminUpdatePlan)
		sub.Delete("/{id}", h.adminDeletePlan)
		sub.Patch("/{id}/toggle-status", h.adminTogglePlan)
	}

	mountAdminCoupons := func(sub chi.Router) {
		sub.Use(h.tokens.RequireAuth)
		sub.Use(auth.RequireAdmin)
		sub.Get("/", h.adminListCoupons)
		sub.Post("/", h.adminCreateCoupon)
		sub.Get("/{id}", h.adminGetCoupon)
		sub.Put("/{id}", h.adminUpdateCoupon)
		sub.Delete("/{id}", h.adminDeleteCoupon)
		sub.Patch("/{id}/toggle-status", h.adminToggleCoupon)
	}

	mountTvod := func(sub chi.Router) {
		sub.Get("/products", h.listTvodProducts)
		sub.Group(func(pr chi.Router) {
			pr.Use(h.tokens.RequireAuth)
			pr.Get("/purchases", h.listUserTvodPurchases)
			pr.Post("/purchase", h.createOrder)
		})
	}

	for _, pref := range []string{"/api/v1", "/api", ""} {
		r.Route(pref+"/plans", mountPlans)
		r.Route(pref+"/subscriptions", mountPlans)
		r.Route(pref+"/subscription-plans", mountPlans)
		r.Get(pref+"/coupons/validate", h.validateCoupon)
		r.Post(pref+"/coupons/validate", h.validateCoupon)
		r.Route(pref+"/payments", mountPayments)
		r.Route(pref+"/tvod", mountTvod)
		r.Route(pref+"/admin/payments", mountAdminPayments)
		r.Route(pref+"/admin/plans", mountAdminPlans)
		r.Route(pref+"/admin/coupons", mountAdminCoupons)
	}
}

func (h *Handler) listPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := h.svc.ListPlans(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, plans)
}

func (h *Handler) mySubscription(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	sub, plan, err := h.svc.GetActiveSubscription(r.Context(), uid)
	if err != nil {
		httpx.OK(w, map[string]any{"active": false, "isSubscribed": false})
		return
	}
	httpx.OK(w, map[string]any{"active": true, "isSubscribed": true, "subscription": sub, "plan": plan})
}

func (h *Handler) validateCoupon(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	amount, _ := strconv.ParseFloat(r.URL.Query().Get("amount"), 64)
	var planID *int64
	if raw := r.URL.Query().Get("planId"); raw != "" {
		if id, err := strconv.ParseInt(raw, 10, 64); err == nil {
			planID = &id
		}
	}
	if r.Method == http.MethodPost {
		var body struct {
			Code   string  `json:"code"`
			Amount float64 `json:"amount"`
			PlanID *int64  `json:"planId"`
		}
		if err := httpx.DecodeJSON(r, &body); err == nil {
			if body.Code != "" {
				code = body.Code
			}
			if body.Amount > 0 {
				amount = body.Amount
			}
			if body.PlanID != nil {
				planID = body.PlanID
			}
		}
	}
	discount, coupon, err := h.svc.ValidateCoupon(r.Context(), code, amount, planID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error(), "INVALID_COUPON")
		return
	}
	httpx.OK(w, map[string]any{"valid": true, "code": coupon.Code, "discountAmount": discount})
}

func (h *Handler) createOrder(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var req CreateOrderReq
	if err := httpx.DecodeJSON(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	res, err := h.svc.CreateOrder(r.Context(), uid, req)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error(), "ORDER_FAILED")
		return
	}
	httpx.OK(w, res)
}

func (h *Handler) verifyPayment(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	var body struct {
		OrderID          string `json:"orderId"`
		RazorpayOrderID  string `json:"razorpay_order_id"`
		PaymentID        string `json:"paymentId"`
		RazorpayPayID    string `json:"razorpay_payment_id"`
		Signature        string `json:"signature"`
		RazorpaySig      string `json:"razorpay_signature"`
		PurchaseType     string `json:"purchaseType"`
	}
	if err := httpx.DecodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "Invalid JSON payload")
		return
	}
	oid := body.OrderID
	if oid == "" {
		oid = body.RazorpayOrderID
	}
	pid := body.PaymentID
	if pid == "" {
		pid = body.RazorpayPayID
	}
	sig := body.Signature
	if sig == "" {
		sig = body.RazorpaySig
	}
	res, err := h.svc.VerifyPayment(r.Context(), uid, oid, pid, sig, body.PurchaseType)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, err.Error(), "VERIFY_FAILED")
		return
	}
	httpx.OK(w, res, "Payment verified")
}

func (h *Handler) myTransactions(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.ListUserTransactions(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) listTvodProducts(w http.ResponseWriter, r *http.Request) {
	rows, err := h.svc.ListTvodProducts(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}

func (h *Handler) listUserTvodPurchases(w http.ResponseWriter, r *http.Request) {
	claims, _ := auth.FromContext(r.Context())
	uid, _ := claims.ParsedUserID()
	rows, err := h.svc.ListUserTvodPurchases(r.Context(), uid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	httpx.OK(w, rows)
}
