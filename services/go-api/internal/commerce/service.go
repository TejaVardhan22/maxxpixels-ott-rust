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

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/cache"
	"github.com/maxxpixels/go-api/pkg/config"
	"github.com/maxxpixels/go-api/pkg/models"
	"gorm.io/gorm"
)

type Service struct {
	db     *gorm.DB
	cache  *cache.Store
	cfg    *config.AppConfig
	client *http.Client
}

func NewService(db *gorm.DB, cacheStore *cache.Store, cfg *config.AppConfig) *Service {
	return &Service{
		db:     db,
		cache:  cacheStore,
		cfg:    cfg,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *Service) ListPlans(ctx context.Context) ([]models.Plan, error) {
	return cache.GetOrLoadJSON(ctx, s.cache, "commerce:plans", 60*time.Second, func(c context.Context) ([]models.Plan, error) {
		var plans []models.Plan
		err := s.db.WithContext(c).
			Where("COALESCE(is_active, TRUE) = TRUE").
			Order("price ASC, id ASC").
			Find(&plans).Error
		return plans, err
	})
}

func (s *Service) GetActiveSubscription(ctx context.Context, userID int64) (*models.Subscription, *models.Plan, error) {
	var sub models.Subscription
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND end_date > ?", userID, time.Now().UTC()).
		Order("end_date DESC").
		First(&sub).Error
	if err != nil {
		return nil, nil, err
	}
	var plan models.Plan
	if s.db.WithContext(ctx).First(&plan, sub.PlanId).Error == nil {
		return &sub, &plan, nil
	}
	return &sub, nil, nil
}

func (s *Service) ValidateCoupon(ctx context.Context, code string, amount float64, planID *int64) (float64, *models.Coupon, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return 0, nil, errors.New("coupon code is required")
	}
	var c models.Coupon
	if err := s.db.WithContext(ctx).
		Where("UPPER(code) = ? AND COALESCE(is_active, TRUE) = TRUE", code).
		First(&c).Error; err != nil {
		return 0, nil, errors.New("invalid or inactive coupon code")
	}
	now := time.Now().UTC()
	if c.ValidFrom != nil && now.Before(*c.ValidFrom) {
		return 0, nil, errors.New("coupon is not yet valid")
	}
	if c.ValidUntil != nil && now.After(*c.ValidUntil) {
		return 0, nil, errors.New("coupon has expired")
	}
	if c.UsageLimit != nil && c.UsedCount != nil && *c.UsedCount >= *c.UsageLimit {
		return 0, nil, errors.New("coupon usage limit reached")
	}
	if c.ApplicablePlanId != nil && planID != nil && *planID > 0 && *c.ApplicablePlanId != *planID {
		return 0, nil, errors.New("coupon is not applicable to this plan")
	}
	minAmt := 0.0
	if c.MinOrderAmount != nil && *c.MinOrderAmount > 0 {
		minAmt = *c.MinOrderAmount
	} else if c.MinimumAmount != nil && *c.MinimumAmount > 0 {
		minAmt = *c.MinimumAmount
	}
	if amount < minAmt {
		return 0, nil, fmt.Errorf("minimum order amount is ₹%.0f", minAmt)
	}

	var discount float64
	if strings.EqualFold(c.DiscountType, "PERCENTAGE") || strings.EqualFold(c.DiscountType, "PERCENT") {
		discount = amount * (c.DiscountValue / 100.0)
		maxCap := 0.0
		if c.MaxDiscountAmount != nil && *c.MaxDiscountAmount > 0 {
			maxCap = *c.MaxDiscountAmount
		} else if c.MaximumDiscount != nil && *c.MaximumDiscount > 0 {
			maxCap = *c.MaximumDiscount
		}
		if maxCap > 0 && discount > maxCap {
			discount = maxCap
		}
	} else {
		discount = c.DiscountValue
	}
	if discount > amount {
		discount = amount
	}
	return discount, &c, nil
}

type CreateOrderReq struct {
	PlanID       *int64  `json:"planId"`
	ContentID    *int64  `json:"contentId"`
	OrderType    string  `json:"orderType"`    // SUBSCRIPTION | TVOD
	PurchaseType string  `json:"purchaseType"` // RENT | PURCHASE
	Amount       float64 `json:"amount"`
	CouponCode   string  `json:"couponCode"`
}

type CreatedOrderResp struct {
	OrderID        string `json:"orderId"`
	GatewayOrderID string `json:"gatewayOrderId,omitempty"`
	KeyID          string `json:"keyId"`
	AmountPaise    int64  `json:"amountPaise"`
	Currency       string `json:"currency"`
	IsFree         bool   `json:"isFree"`
	Status         string `json:"status"`
}

func (s *Service) CreateOrder(ctx context.Context, userID int64, req CreateOrderReq) (*CreatedOrderResp, error) {
	orderType := strings.ToUpper(strings.TrimSpace(req.OrderType))
	if orderType == "" {
		if req.ContentID != nil && *req.ContentID > 0 {
			orderType = "TVOD"
		} else {
			orderType = "SUBSCRIPTION"
		}
	}

	var origAmount float64
	var validityHours *int32
	if orderType == "TVOD" {
		if req.ContentID == nil || *req.ContentID <= 0 {
			return nil, errors.New("contentId is required for TVOD order")
		}
		var prod models.TvodProduct
		pType := strings.ToUpper(strings.TrimSpace(req.PurchaseType))
		if pType == "" {
			pType = "RENT"
		}
		if s.db.WithContext(ctx).
			Where("content_id = ? AND UPPER(purchase_type) = ? AND COALESCE(is_active, TRUE) = TRUE", *req.ContentID, pType).
			First(&prod).Error == nil {
			origAmount = prod.Price
			validityHours = prod.ValidityHours
			if validityHours == nil && prod.RentalDurationHours != nil {
				validityHours = prod.RentalDurationHours
			}
		} else if req.Amount > 0 {
			origAmount = req.Amount
		} else {
			return nil, errors.New("TVOD product pricing not found")
		}
	} else {
		if req.PlanID == nil || *req.PlanID <= 0 {
			return nil, errors.New("planId is required")
		}
		var plan models.Plan
		if err := s.db.WithContext(ctx).First(&plan, *req.PlanID).Error; err != nil {
			return nil, errors.New("plan not found")
		}
		origAmount = plan.Price
		if plan.DiscountPrice != nil && *plan.DiscountPrice > 0 && *plan.DiscountPrice < plan.Price {
			origAmount = *plan.DiscountPrice
		}
	}

	var discount float64
	var appliedCoupon *string
	if strings.TrimSpace(req.CouponCode) != "" {
		d, c, err := s.ValidateCoupon(ctx, req.CouponCode, origAmount, req.PlanID)
		if err != nil {
			return nil, err
		}
		discount = d
		appliedCoupon = &c.Code
	}

	finalAmount := origAmount - discount
	if finalAmount < 0 {
		finalAmount = 0
	}
	paise := int64(finalAmount * 100)
	currency := "INR"
	localOrderID := "ord_" + strings.ReplaceAll(uuid.NewString(), "-", "")[:16]
	now := time.Now().UTC()

	// Free activation path (100% coupon or free plan)
	if paise == 0 {
		order := models.PaymentOrder{
			UserId:         userID,
			PlanId:         req.PlanID,
			ContentId:      req.ContentID,
			OrderId:        &localOrderID,
			OrderType:      &orderType,
			Provider:       "FREE",
			Status:         "PAID",
			Currency:       &currency,
			Amount:         &finalAmount,
			OriginalAmount: &origAmount,
			DiscountAmount: &discount,
			FinalAmount:    &finalAmount,
			CouponCode:     appliedCoupon,
			ValidityHours:  validityHours,
			CreatedAt:      now,
		}
		if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(&order).Error; err != nil {
				return err
			}
			return s.fulfillOrderTx(tx, &order, "FREE_"+localOrderID, req.PurchaseType)
		}); err != nil {
			return nil, err
		}
		return &CreatedOrderResp{
			OrderID:     localOrderID,
			AmountPaise: 0,
			Currency:    currency,
			IsFree:      true,
			Status:      "PAID",
		}, nil
	}

	// Create Razorpay gateway order when credentials are configured
	gatewayOrderID := ""
	if s.cfg.RazorpayKeyID != "" && s.cfg.RazorpayKeySecret != "" {
		rzpID, err := s.createRazorpayOrder(ctx, paise, currency, localOrderID)
		if err != nil {
			return nil, err
		}
		gatewayOrderID = rzpID
	}

	var gwPtr *string
	if gatewayOrderID != "" {
		gwPtr = &gatewayOrderID
	}
	order := models.PaymentOrder{
		UserId:          userID,
		PlanId:          req.PlanID,
		ContentId:       req.ContentID,
		OrderId:         &localOrderID,
		ProviderOrderId: gwPtr,
		OrderType:       &orderType,
		Provider:        "RAZORPAY",
		Status:          "CREATED",
		Currency:        &currency,
		Amount:          &finalAmount,
		OriginalAmount:  &origAmount,
		DiscountAmount:  &discount,
		FinalAmount:     &finalAmount,
		CouponCode:      appliedCoupon,
		ValidityHours:   validityHours,
		CreatedAt:       now,
	}
	if err := s.db.WithContext(ctx).Create(&order).Error; err != nil {
		return nil, err
	}

	return &CreatedOrderResp{
		OrderID:        localOrderID,
		GatewayOrderID: gatewayOrderID,
		KeyID:          s.cfg.RazorpayKeyID,
		AmountPaise:    paise,
		Currency:       currency,
		IsFree:         false,
		Status:         "CREATED",
	}, nil
}

func (s *Service) VerifyPayment(ctx context.Context, userID int64, orderID, paymentID, signature, purchaseType string) (map[string]any, error) {
	if orderID == "" || paymentID == "" {
		return nil, errors.New("orderId and paymentId are required")
	}

	var order models.PaymentOrder
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND (order_id = ? OR provider_order_id = ?)", userID, orderID, orderID).
		First(&order).Error; err != nil {
		return nil, errors.New("payment order not found")
	}
	if strings.EqualFold(order.Status, "PAID") {
		return map[string]any{"verified": true, "status": "PAID", "orderId": orderID}, nil
	}

	// Verify Razorpay HMAC-SHA256 signature
	if s.cfg.RazorpayKeySecret != "" && signature != "" {
		expected := computeHMAC(orderID+"|"+paymentID, s.cfg.RazorpayKeySecret)
		if !hmac.Equal([]byte(expected), []byte(signature)) {
			return nil, errors.New("invalid Razorpay payment signature")
		}
	}

	now := time.Now().UTC()
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.PaymentOrder{}).Where("id = ?", order.ID).
			Updates(map[string]any{"status": "PAID", "updated_at": now}).Error; err != nil {
			return err
		}
		amt := 0.0
		if order.FinalAmount != nil {
			amt = *order.FinalAmount
		}
		prov := "RAZORPAY"
		curr := "INR"
		payRow := models.Payment{
			PaymentId:         &paymentID,
			OrderId:           order.OrderId,
			ProviderOrderId:   order.ProviderOrderId,
			ProviderPaymentId: &paymentID,
			ProviderSignature: &signature,
			PaymentOrderId:    order.ID,
			UserId:            &userID,
			Provider:          &prov,
			Amount:            amt,
			Currency:          &curr,
			Status:            "CAPTURED",
			TransactionId:     paymentID,
			PaidAt:            &now,
			CreatedAt:         now,
		}
		if err := tx.Create(&payRow).Error; err != nil {
			return err
		}
		if order.CouponCode != nil && *order.CouponCode != "" {
			_ = tx.Model(&models.Coupon{}).Where("UPPER(code) = UPPER(?)", *order.CouponCode).
				Update("used_count", gorm.Expr("COALESCE(used_count, 0) + 1")).Error
		}
		return s.fulfillOrderTx(tx, &order, paymentID, purchaseType)
	})
	if err != nil {
		return nil, err
	}

	return map[string]any{"verified": true, "status": "PAID", "orderId": orderID, "paymentId": paymentID}, nil
}

func (s *Service) fulfillOrderTx(tx *gorm.DB, order *models.PaymentOrder, paymentID, purchaseType string) error {
	now := time.Now().UTC()
	if order.OrderType != nil && strings.EqualFold(*order.OrderType, "TVOD") && order.ContentId != nil {
		pType := strings.ToUpper(strings.TrimSpace(purchaseType))
		if pType == "" {
			pType = "RENT"
		}
		var expiresAt *time.Time
		if pType == "RENT" {
			hrs := 48
			if order.ValidityHours != nil && *order.ValidityHours > 0 {
				hrs = int(*order.ValidityHours)
			}
			exp := now.Add(time.Duration(hrs) * time.Hour)
			expiresAt = &exp
		}
		amt := 0.0
		if order.FinalAmount != nil {
			amt = *order.FinalAmount
		}
		curr := "INR"
		st := "ACTIVE"
		return tx.Create(&models.ContentPurchase{
			UserId:       order.UserId,
			ContentId:    *order.ContentId,
			Price:        amt,
			AmountPaid:   &amt,
			Currency:     &curr,
			PurchaseType: pType,
			PaymentId:    &paymentID,
			Status:       &st,
			PurchasedAt:  now,
			ValidUntil:   expiresAt,
			ExpiresAt:    expiresAt,
		}).Error
	}

	if order.PlanId != nil && *order.PlanId > 0 {
		var plan models.Plan
		days := 30
		if tx.First(&plan, *order.PlanId).Error == nil && plan.DurationDays != nil && *plan.DurationDays > 0 {
			days = int(*plan.DurationDays)
		}
		_ = tx.Model(&models.Subscription{}).
			Where("user_id = ? AND status = 'ACTIVE'", order.UserId).
			Update("status", "EXPIRED").Error
		return tx.Create(&models.Subscription{
			UserId:    order.UserId,
			PlanId:    *order.PlanId,
			Status:    "ACTIVE",
			Amount:    order.FinalAmount,
			StartDate: now,
			EndDate:   now.Add(time.Duration(days) * 24 * time.Hour),
			PaymentId: &paymentID,
			CreatedAt: now,
			UpdatedAt: now,
		}).Error
	}
	return nil
}

func (s *Service) ListTvodProducts(ctx context.Context) ([]models.TvodProduct, error) {
	var rows []models.TvodProduct
	err := s.db.WithContext(ctx).Where("COALESCE(is_active, TRUE) = TRUE").Order("id DESC").Find(&rows).Error
	return rows, err
}

func (s *Service) ListUserTvodPurchases(ctx context.Context, userID int64) ([]map[string]any, error) {
	var purchases []models.ContentPurchase
	if err := s.db.WithContext(ctx).
		Where("user_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > ?)", userID, time.Now().UTC()).
		Order("purchased_at DESC").
		Find(&purchases).Error; err != nil {
		return nil, err
	}
	if len(purchases) == 0 {
		return []map[string]any{}, nil
	}
	ids := make([]int64, 0, len(purchases))
	for _, p := range purchases {
		ids = append(ids, p.ContentId)
	}
	var contents []models.Content
	_ = s.db.WithContext(ctx).Where("id IN ?", ids).Find(&contents).Error
	byID := make(map[int64]models.Content, len(contents))
	for _, c := range contents {
		byID[c.ID] = c
	}

	out := make([]map[string]any, 0, len(purchases))
	for _, p := range purchases {
		c, ok := byID[p.ContentId]
		if !ok {
			continue
		}
		out = append(out, map[string]any{
			"id":           c.ID,
			"contentId":    c.ID,
			"title":        c.Title,
			"posterUrl":    c.PosterUrl,
			"landscapeUrl": c.LandscapeImageUrl,
			"purchaseType": p.PurchaseType,
			"isPurchased":  true,
			"expiresAt":    p.ExpiresAt,
		})
	}
	return out, nil
}

func (s *Service) ListUserTransactions(ctx context.Context, userID int64) ([]models.Payment, error) {
	var rows []models.Payment
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).Order("created_at DESC").Limit(50).Find(&rows).Error
	return rows, err
}

func (s *Service) createRazorpayOrder(ctx context.Context, paise int64, currency, receipt string) (string, error) {
	payload, _ := json.Marshal(map[string]any{
		"amount":   paise,
		"currency": currency,
		"receipt":  receipt,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.razorpay.com/v1/orders", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(s.cfg.RazorpayKeyID, s.cfg.RazorpayKeySecret)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("razorpay order creation failed (HTTP %d)", resp.StatusCode)
	}
	var res struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil || res.ID == "" {
		return "", errors.New("invalid Razorpay order response")
	}
	return res.ID, nil
}

func computeHMAC(data, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}
