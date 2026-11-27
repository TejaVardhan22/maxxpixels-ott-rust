package commerce

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/maxxpixels/go-api/pkg/models"
	"golang.org/x/sync/errgroup"
	"gorm.io/gorm"
)

func (s *Service) GetPlanByID(ctx context.Context, id int64) (*models.Plan, error) {
	var p models.Plan
	if err := s.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, errors.New("plan not found")
	}
	return &p, nil
}

// --- Webhooks (Razorpay & Stripe) ---

func (s *Service) HandleRazorpayWebhook(ctx context.Context, rawBody []byte, signature string) (map[string]any, error) {
	secret := strings.TrimSpace(s.cfg.RazorpayWebhookSecret)
	if secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		mac.Write(rawBody)
		expected := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(expected), []byte(strings.TrimSpace(signature))) {
			return nil, errors.New("invalid Razorpay webhook signature")
		}
	}

	var payload map[string]any
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, errors.New("invalid webhook JSON")
	}
	event, _ := payload["event"].(string)
	pMap, _ := payload["payload"].(map[string]any)
	payWrap, _ := pMap["payment"].(map[string]any)
	entity, _ := payWrap["entity"].(map[string]any)
	orderID, _ := entity["order_id"].(string)
	payID, _ := entity["id"].(string)

	switch event {
	case "payment.captured", "order.paid":
		if orderID != "" {
			var po models.PaymentOrder
			if s.db.WithContext(ctx).Where("provider_order_id = ? OR order_id = ?", orderID, orderID).First(&po).Error == nil {
				if !strings.EqualFold(po.Status, "PAID") {
					pType := ""
					if po.OrderType != nil {
						pType = *po.OrderType
					}
					_, _ = s.VerifyPayment(ctx, po.UserId, orderID, payID, "", pType)
				}
			}
		}
	case "payment.failed":
		if orderID != "" {
			_ = s.db.WithContext(ctx).Model(&models.PaymentOrder{}).
				Where("(provider_order_id = ? OR order_id = ?) AND UPPER(COALESCE(status, '')) <> ?", orderID, orderID, "PAID").
				Update("status", "FAILED").Error
		}
	case "refund.processed", "refund.created":
		if payID != "" {
			_ = s.db.WithContext(ctx).Model(&models.Payment{}).
				Where("provider_payment_id = ? OR payment_id = ?", payID, payID).
				Update("status", "REFUNDED").Error
		}
	}

	return map[string]any{"received": true, "event": event, "orderId": orderID}, nil
}

func (s *Service) HandleStripeWebhook(ctx context.Context, rawBody []byte) (map[string]any, error) {
	var payload map[string]any
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		return nil, errors.New("invalid webhook JSON")
	}
	evtType, _ := payload["type"].(string)
	return map[string]any{"received": true, "event": evtType}, nil
}

// --- Admin Payments, Analytics, TVOD & Refunds ---

func (s *Service) AdminListTransactions(ctx context.Context, page, size int, status, search string) ([]models.Payment, int64, error) {
	if size <= 0 || size > 100 {
		size = 20
	}
	if page < 0 {
		page = 0
	}
	q := s.db.WithContext(ctx).Model(&models.Payment{})
	if st := strings.TrimSpace(status); st != "" && !strings.EqualFold(st, "ALL") {
		q = q.Where("UPPER(status) = ?", strings.ToUpper(st))
	}
	if sr := strings.ToLower(strings.TrimSpace(search)); sr != "" {
		like := "%" + sr + "%"
		q = q.Where("LOWER(transaction_id) LIKE ? OR LOWER(provider_payment_id) LIKE ? OR LOWER(provider_order_id) LIKE ?", like, like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []models.Payment
	err := q.Order("created_at DESC").Offset(page * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

func (s *Service) AdminPaymentAnalytics(ctx context.Context) (map[string]any, error) {
	var totalRev, refundedRev float64
	var successCount, failedCount, activeSubs, tvodCount int64

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Raw("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID')").Scan(&totalRev).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Raw("SELECT COALESCE(SUM(COALESCE(refunded_amount, amount)), 0) FROM payments WHERE UPPER(status) = 'REFUNDED'").Scan(&refundedRev).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.Payment{}).Where("UPPER(status) IN ('SUCCESS', 'CAPTURED', 'PAID')").Count(&successCount).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.Payment{}).Where("UPPER(status) = 'FAILED'").Count(&failedCount).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.Subscription{}).Where("status = 'ACTIVE' AND end_date > ?", time.Now().UTC()).Count(&activeSubs).Error
		return nil
	})
	g.Go(func() error {
		_ = s.db.WithContext(gctx).Model(&models.ContentPurchase{}).Count(&tvodCount).Error
		return nil
	})
	_ = g.Wait()

	return map[string]any{
		"totalRevenue":        totalRev,
		"refundedAmount":      refundedRev,
		"netRevenue":          totalRev - refundedRev,
		"successfulPayments":  successCount,
		"failedPayments":      failedCount,
		"activeSubscriptions": activeSubs,
		"tvodPurchases":       tvodCount,
	}, nil
}

func (s *Service) AdminListTvodPurchases(ctx context.Context, page, size int) ([]models.ContentPurchase, int64, error) {
	if size <= 0 || size > 100 {
		size = 20
	}
	if page < 0 {
		page = 0
	}
	var total int64
	_ = s.db.WithContext(ctx).Model(&models.ContentPurchase{}).Count(&total).Error
	var rows []models.ContentPurchase
	err := s.db.WithContext(ctx).Order("id DESC").Offset(page * size).Limit(size).Find(&rows).Error
	return rows, total, err
}

func (s *Service) AdminRefundPayment(ctx context.Context, id int64, amount float64, reason string) (map[string]any, error) {
	var p models.Payment
	if err := s.db.WithContext(ctx).First(&p, id).Error; err != nil {
		return nil, errors.New("payment not found")
	}
	refundAmt := amount
	if refundAmt <= 0 {
		refundAmt = p.Amount
	}

	// Call Razorpay Refund API if live keys & provider payment ID exist
	if p.ProviderPaymentId != nil && *p.ProviderPaymentId != "" && s.cfg.RazorpayKeyID != "" && s.cfg.RazorpayKeySecret != "" {
		bodyMap := map[string]any{"amount": int64(refundAmt * 100)}
		if strings.TrimSpace(reason) != "" {
			bodyMap["notes"] = map[string]string{"reason": strings.TrimSpace(reason)}
		}
		raw, _ := json.Marshal(bodyMap)
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("https://api.razorpay.com/v1/payments/%s/refund", *p.ProviderPaymentId), bytes.NewReader(raw))
		req.SetBasicAuth(s.cfg.RazorpayKeyID, s.cfg.RazorpayKeySecret)
		req.Header.Set("Content-Type", "application/json")
		resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
		if err != nil {
			return nil, fmt.Errorf("razorpay refund call failed: %w", err)
		}
		resp.Body.Close()
		if resp.StatusCode >= 300 {
			return nil, fmt.Errorf("razorpay refund returned HTTP %d", resp.StatusCode)
		}
	}

	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&p).Updates(map[string]any{
			"status":          "REFUNDED",
			"refunded_amount": refundAmt,
		}).Error; err != nil {
			return err
		}
		if p.PaymentOrderId > 0 {
			_ = tx.Model(&models.PaymentOrder{}).Where("id = ?", p.PaymentOrderId).Update("status", "REFUNDED").Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return map[string]any{"refunded": true, "paymentId": id, "refundedAmount": refundAmt, "status": "REFUNDED"}, nil
}

// --- Admin Plans CRUD ---

func (s *Service) AdminListPlans(ctx context.Context) ([]models.Plan, error) {
	var rows []models.Plan
	err := s.db.WithContext(ctx).Order("price ASC, id ASC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminUpsertPlan(ctx context.Context, id int64, body map[string]any) (*models.Plan, error) {
	name := strMapVal(body, "name")
	if id == 0 && name == "" {
		return nil, errors.New("plan name is required")
	}
	price := floatMapVal(body, "price")
	code := strMapVal(body, "code")
	if code == "" && name != "" {
		code = strings.ToUpper(strings.ReplaceAll(name, " ", "_"))
	}
	bp := strMapVal(body, "billingPeriod", "billing_period", "billingCycle")
	if bp == "" {
		bp = "MONTHLY"
	}
	dur := int32MapVal(body, "durationDays", "duration_days")
	if dur <= 0 {
		dur = 30
	}
	curr := strMapVal(body, "currency")
	if curr == "" {
		curr = "INR"
	}
	maxDev := int32MapVal(body, "maxDevices", "max_devices")
	if maxDev <= 0 {
		maxDev = 2
	}
	maxStreams := int32MapVal(body, "maxConcurrentStreams", "max_concurrent_streams")
	if maxStreams <= 0 {
		maxStreams = 1
	}
	maxProf := int32MapVal(body, "maxProfiles", "max_profiles")
	if maxProf <= 0 {
		maxProf = 4
	}

	if id == 0 {
		active := true
		ads := boolMapVal(body, "adsEnabled", "hasAds")
		dl := boolMapVal(body, "downloadsEnabled", "allowDownloads")
		pop := boolMapVal(body, "isPopular", "is_popular")
		p := models.Plan{
			Code:                 code,
			Name:                 name,
			Description:          ptrMapStr(strMapVal(body, "description")),
			BillingPeriod:        bp,
			BillingCycle:         &bp,
			DurationDays:         &dur,
			Price:                price,
			Currency:             &curr,
			MaxConcurrentStreams: &maxStreams,
			MaxDevices:           &maxDev,
			MaxProfiles:          &maxProf,
			MaxResolution:        ptrMapStr(strMapVal(body, "maxResolution", "maxVideoQuality")),
			AdsEnabled:           &ads,
			HasAds:               &ads,
			DownloadsEnabled:     &dl,
			AllowDownloads:       &dl,
			IsActive:             &active,
			IsPopular:            &pop,
		}
		if err := s.db.WithContext(ctx).Create(&p).Error; err != nil {
			return nil, err
		}
		_ = s.cache.Del(ctx, "commerce:plans:active")
		return &p, nil
	}

	upd := map[string]any{}
	if name != "" {
		upd["name"] = name
	}
	if _, ok := body["price"]; ok {
		upd["price"] = price
	}
	if v := strMapVal(body, "description"); v != "" {
		upd["description"] = v
	}
	if v := strMapVal(body, "billingPeriod", "billingCycle"); v != "" {
		upd["billing_period"] = v
		upd["billing_cycle"] = v
	}
	if _, ok := body["durationDays"]; ok {
		upd["duration_days"] = dur
	}
	if _, ok := body["maxDevices"]; ok {
		upd["max_devices"] = maxDev
	}
	if _, ok := body["maxConcurrentStreams"]; ok {
		upd["max_concurrent_streams"] = maxStreams
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = boolMapVal(body, "isActive")
	}
	if _, ok := body["isPopular"]; ok {
		upd["is_popular"] = boolMapVal(body, "isPopular")
	}
	if _, ok := body["downloadsEnabled"]; ok {
		v := boolMapVal(body, "downloadsEnabled")
		upd["downloads_enabled"] = v
		upd["allow_downloads"] = v
	}
	if err := s.db.WithContext(ctx).Model(&models.Plan{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	_ = s.cache.Del(ctx, "commerce:plans:active")
	return s.GetPlanByID(ctx, id)
}

func (s *Service) AdminTogglePlanStatus(ctx context.Context, id int64) (*models.Plan, error) {
	p, err := s.GetPlanByID(ctx, id)
	if err != nil {
		return nil, err
	}
	next := !(p.IsActive == nil || *p.IsActive)
	_ = s.db.WithContext(ctx).Model(p).Update("is_active", next).Error
	_ = s.cache.Del(ctx, "commerce:plans:active")
	p.IsActive = &next
	return p, nil
}

func (s *Service) AdminDeletePlan(ctx context.Context, id int64) error {
	_ = s.cache.Del(ctx, "commerce:plans:active")
	return s.db.WithContext(ctx).Delete(&models.Plan{}, id).Error
}

// --- Admin Coupons CRUD ---

func (s *Service) AdminListCoupons(ctx context.Context) ([]models.Coupon, error) {
	var rows []models.Coupon
	err := s.db.WithContext(ctx).Order("id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) AdminGetCoupon(ctx context.Context, id int64) (*models.Coupon, error) {
	var c models.Coupon
	if err := s.db.WithContext(ctx).First(&c, id).Error; err != nil {
		return nil, errors.New("coupon not found")
	}
	return &c, nil
}

func (s *Service) AdminUpsertCoupon(ctx context.Context, id int64, body map[string]any) (*models.Coupon, error) {
	code := strings.ToUpper(strMapVal(body, "code"))
	if id == 0 && code == "" {
		return nil, errors.New("coupon code is required")
	}
	dt := strings.ToUpper(strMapVal(body, "discountType", "discount_type"))
	if dt == "" {
		dt = "PERCENTAGE"
	}
	val := floatMapVal(body, "discountValue", "discount_value")

	if id == 0 {
		active := true
		now := time.Now().UTC()
		c := models.Coupon{
			Code:          code,
			Description:   ptrMapStr(strMapVal(body, "description")),
			DiscountType:  dt,
			DiscountValue: val,
			IsActive:      &active,
			CreatedAt:     &now,
		}
		if ul := int32MapVal(body, "usageLimit", "usage_limit"); ul > 0 {
			c.UsageLimit = &ul
		}
		if md := floatMapVal(body, "maximumDiscount", "maxDiscountAmount"); md > 0 {
			c.MaximumDiscount = &md
			c.MaxDiscountAmount = &md
		}
		if ma := floatMapVal(body, "minimumAmount", "minOrderAmount"); ma > 0 {
			c.MinimumAmount = &ma
			c.MinOrderAmount = &ma
		}
		if err := s.db.WithContext(ctx).Create(&c).Error; err != nil {
			return nil, err
		}
		return &c, nil
	}

	upd := map[string]any{}
	if code != "" {
		upd["code"] = code
	}
	if _, ok := body["discountType"]; ok {
		upd["discount_type"] = dt
	}
	if _, ok := body["discountValue"]; ok {
		upd["discount_value"] = val
	}
	if v := strMapVal(body, "description"); v != "" {
		upd["description"] = v
	}
	if _, ok := body["isActive"]; ok {
		upd["is_active"] = boolMapVal(body, "isActive")
	}
	if err := s.db.WithContext(ctx).Model(&models.Coupon{}).Where("id = ?", id).Updates(upd).Error; err != nil {
		return nil, err
	}
	return s.AdminGetCoupon(ctx, id)
}

func (s *Service) AdminToggleCouponStatus(ctx context.Context, id int64) (*models.Coupon, error) {
	c, err := s.AdminGetCoupon(ctx, id)
	if err != nil {
		return nil, err
	}
	next := !(c.IsActive == nil || *c.IsActive)
	_ = s.db.WithContext(ctx).Model(c).Update("is_active", next).Error
	c.IsActive = &next
	return c, nil
}

func (s *Service) AdminDeleteCoupon(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&models.Coupon{}, id).Error
}

func strMapVal(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
				return strings.TrimSpace(s)
			}
		}
	}
	return ""
}

func floatMapVal(m map[string]any, keys ...string) float64 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return f
			}
		}
	}
	return 0
}

func int32MapVal(m map[string]any, keys ...string) int32 {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if f, ok := v.(float64); ok {
				return int32(f)
			}
		}
	}
	return 0
}

func boolMapVal(m map[string]any, keys ...string) bool {
	for _, k := range keys {
		if v, ok := m[k]; ok && v != nil {
			if b, ok := v.(bool); ok {
				return b
			}
		}
	}
	return false
}

func ptrMapStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
