package games

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

const (
	razorpayAPI  = "https://api.razorpay.com/v1"
	pffGrantPath = "/api/public/coins/grant"
)

// Request DTOs (accept both camelCase and snake_case keys)

type CoinsOrderRequest struct {
	PackID string `json:"packId"`
	Pack   string `json:"pack"`
}

func (r CoinsOrderRequest) ResolvedPackID() string {
	if strings.TrimSpace(r.PackID) != "" {
		return strings.TrimSpace(r.PackID)
	}
	return strings.TrimSpace(r.Pack)
}

type CoinsVerifyRequest struct {
	RazorpayOrderID    string `json:"razorpayOrderId"`
	RazorpayOrderID2   string `json:"razorpay_order_id"`
	RazorpayPaymentID  string `json:"razorpayPaymentId"`
	RazorpayPaymentID2 string `json:"razorpay_payment_id"`
	RazorpaySignature  string `json:"razorpaySignature"`
	RazorpaySignature2 string `json:"razorpay_signature"`
}

func (r CoinsVerifyRequest) OrderID() string {
	if r.RazorpayOrderID != "" {
		return r.RazorpayOrderID
	}
	return r.RazorpayOrderID2
}
func (r CoinsVerifyRequest) PaymentID() string {
	if r.RazorpayPaymentID != "" {
		return r.RazorpayPaymentID
	}
	return r.RazorpayPaymentID2
}
func (r CoinsVerifyRequest) Signature() string {
	if r.RazorpaySignature != "" {
		return r.RazorpaySignature
	}
	return r.RazorpaySignature2
}

type WalletOrderRequest struct {
	UserID   string `json:"userId"`
	User     string `json:"user"`
	UID      string `json:"uid"`
	GamerUID string `json:"gamerUid"`
	GamerID2 string `json:"gamer_uid"`
	PackID   string `json:"packId"`
	Pack     string `json:"pack"`
}

func (r WalletOrderRequest) ResolvedUserID() string {
	for _, v := range []string{r.UserID, r.User, r.UID, r.GamerUID, r.GamerID2} {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
func (r WalletOrderRequest) ResolvedPackID() string {
	if strings.TrimSpace(r.PackID) != "" {
		return strings.TrimSpace(r.PackID)
	}
	return strings.TrimSpace(r.Pack)
}

type WalletVerifyRequest struct {
	UserID             string `json:"userId"`
	User               string `json:"user"`
	UID                string `json:"uid"`
	GamerUID           string `json:"gamerUid"`
	GamerID2           string `json:"gamer_uid"`
	RazorpayOrderID    string `json:"razorpayOrderId"`
	RazorpayOrderID2   string `json:"razorpay_order_id"`
	RazorpayPaymentID  string `json:"razorpayPaymentId"`
	RazorpayPaymentID2 string `json:"razorpay_payment_id"`
	RazorpaySignature  string `json:"razorpaySignature"`
	RazorpaySignature2 string `json:"razorpay_signature"`
}

func (r WalletVerifyRequest) ResolvedUserID() string {
	for _, v := range []string{r.UserID, r.User, r.UID, r.GamerUID, r.GamerID2} {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
func (r WalletVerifyRequest) OrderID() string {
	if r.RazorpayOrderID != "" {
		return r.RazorpayOrderID
	}
	return r.RazorpayOrderID2
}
func (r WalletVerifyRequest) PaymentID() string {
	if r.RazorpayPaymentID != "" {
		return r.RazorpayPaymentID
	}
	return r.RazorpayPaymentID2
}
func (r WalletVerifyRequest) Signature() string {
	if r.RazorpaySignature != "" {
		return r.RazorpaySignature
	}
	return r.RazorpaySignature2
}

type SubscriptionGrantRequest struct {
	PaymentID         string `json:"paymentId"`
	PaymentID2        string `json:"payment_id"`
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	SubscriptionID    string `json:"subscriptionId"`
	SubscriptionID2   string `json:"subscription_id"`
	ValidUntil        string `json:"validUntil"`
	ValidUntil2       string `json:"valid_until"`
	EndDate           string `json:"endDate"`
	EndDate2          string `json:"end_date"`
	Coins             *int64 `json:"coins"`
}

func (r SubscriptionGrantRequest) ResolvedPaymentID() string {
	for _, v := range []string{r.PaymentID, r.PaymentID2, r.RazorpayPaymentID} {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
func (r SubscriptionGrantRequest) ResolvedSubscriptionID() string {
	if strings.TrimSpace(r.SubscriptionID) != "" {
		return strings.TrimSpace(r.SubscriptionID)
	}
	return strings.TrimSpace(r.SubscriptionID2)
}
func (r SubscriptionGrantRequest) ResolvedValidUntil() string {
	for _, v := range []string{r.ValidUntil, r.ValidUntil2, r.EndDate, r.EndDate2} {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func parseValidUntil(s string) (time.Time, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, false
	}
	if dt, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return dt.UTC(), true
	}
	if dt, err := time.Parse(time.RFC3339, s); err == nil {
		return dt.UTC(), true
	}
	day := s
	if len(day) >= 10 {
		day = day[:10]
	}
	if d, err := time.Parse("2006-01-02", day); err == nil {
		return time.Date(d.Year(), d.Month(), d.Day(), 23, 59, 59, 0, time.UTC), true
	}
	return time.Time{}, false
}

func (s *Service) findPack(packID string) (*CoinPack, error) {
	for i := range s.Config.CoinPacks {
		if strings.EqualFold(s.Config.CoinPacks[i].ID, packID) {
			p := s.Config.CoinPacks[i]
			return &p, nil
		}
	}
	names := make([]string, 0, len(s.Config.CoinPacks))
	for _, p := range s.Config.CoinPacks {
		names = append(names, p.ID)
	}
	return nil, errBadRequest(fmt.Sprintf("Unknown coin pack '%s'. Available: %s", packID, strings.Join(names, ", ")))
}

// Packs returns the purchasable coin pack catalog.
func (s *Service) Packs() map[string]any {
	return map[string]any{
		"currency": s.Config.RazorpayCurrency,
		"keyId":    s.Config.RazorpayKeyID,
		"packs":    s.Config.CoinPacks,
	}
}

func (s *Service) resolvePlayerRow(ctx context.Context, player *Player) (map[string]any, error) {
	gamerUID := ""
	if player.GamerUID != nil {
		gamerUID = *player.GamerUID
	}
	const q = `
		SELECT row_to_json(p) AS row FROM players p
		WHERE p.user_id = ?
		   OR (? <> '' AND p.gamer_uid = ?)
		   OR p.external_id = ?
		ORDER BY (p.user_id = ?) DESC, p.last_synced_at DESC NULLS LAST
		LIMIT 1
	`
	row, err := queryRowJSON(ctx, s.DB, q, player.UserID, gamerUID, gamerUID, player.ExternalID, player.UserID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, errInternal("Gamer record not found after sync")
	}
	return row, nil
}

// CreateOrder creates a Razorpay order for a coin pack (JWT-authed).
func (s *Service) CreateOrder(ctx context.Context, bearer, packID string) (map[string]any, error) {
	if s.Config.RazorpayKeyID == "" || s.Config.RazorpayKeySecret == "" {
		return nil, errBadRequest("Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service.")
	}
	pack, err := s.findPack(packID)
	if err != nil {
		return nil, err
	}
	player, err := s.ResolvePlayer(ctx, bearer)
	if err != nil {
		return nil, err
	}
	prow, err := s.resolvePlayerRow(ctx, player)
	if err != nil {
		return nil, err
	}
	return s.createOrderCore(ctx, prow, pack)
}

func (s *Service) createOrderCore(ctx context.Context, prow map[string]any, pack *CoinPack) (map[string]any, error) {
	if s.Config.RazorpayKeyID == "" || s.Config.RazorpayKeySecret == "" {
		return nil, errBadRequest("Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service.")
	}
	playerUserID := probeStr(prow, "user_id")
	playerID := playerIDFrom(prow)
	if playerID == "" {
		return nil, errInternal("Gamer record missing id")
	}
	gamerUID := probeStr(prow, "gamer_uid")

	amountPaise := pack.AmountPaise()
	receipt := fmt.Sprintf("coins_%s_%d", gamerUID, time.Now().UTC().Unix())

	reqBody := map[string]any{
		"amount":   amountPaise,
		"currency": s.Config.RazorpayCurrency,
		"receipt":  receipt,
		"notes": map[string]any{
			"player_user_id": playerUserID,
			"gamer_uid":      gamerUID,
			"pack_id":        pack.ID,
			"coins":          pack.Coins,
		},
	}
	rawReq, _ := json.Marshal(reqBody)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, razorpayAPI+"/orders", bytes.NewReader(rawReq))
	if err != nil {
		return nil, errInternal("Failed building Razorpay request: " + err.Error())
	}
	req.SetBasicAuth(s.Config.RazorpayKeyID, s.Config.RazorpayKeySecret)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.HTTP.Do(req)
	if err != nil {
		return nil, errInternal("Failed reaching Razorpay: " + err.Error())
	}
	defer resp.Body.Close()

	var rzp map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&rzp); err != nil {
		return nil, errInternal("Invalid Razorpay response: " + err.Error())
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Warn("Razorpay order creation failed", "status", resp.StatusCode, "body", rzp)
		return nil, errInternal(fmt.Sprintf("Razorpay rejected the order (HTTP %d)", resp.StatusCode))
	}

	rzpOrderID := probeStr(rzp, "id")
	if rzpOrderID == "" {
		return nil, errInternal("Razorpay order response missing id")
	}

	if err := s.DB.WithContext(ctx).Exec(`
		INSERT INTO coin_orders (player_id, razorpay_order_id, pack_id, coins, amount_paise,
		                         currency, status, receipt, notes, payload)
		VALUES (?::uuid, ?, ?, ?::bigint, ?::bigint, ?, 'CREATED', ?, to_jsonb(?::text), ?::jsonb)
		ON CONFLICT (razorpay_order_id) DO NOTHING
	`, playerID, rzpOrderID, pack.ID, pack.Coins, amountPaise, s.Config.RazorpayCurrency, receipt, gamerUID, mustJSON(rzp)).Error; err != nil {
		return nil, errDatabase(err.Error())
	}

	slog.Info("Coin order created", "pack", pack.ID, "coins", pack.Coins, "paise", amountPaise, "razorpay", rzpOrderID)

	return map[string]any{
		"razorpayOrderId": rzpOrderID,
		"packId":          pack.ID,
		"coins":           pack.Coins,
		"amount":          amountPaise,
		"amountInr":       pack.AmountINR,
		"currency":        s.Config.RazorpayCurrency,
		"keyId":           s.Config.RazorpayKeyID,
		"gamerUid":        gamerUID,
		"userId":          playerUserID,
	}, nil
}

// VerifyPayment verifies Razorpay checkout signature and settles coins once.
func (s *Service) VerifyPayment(ctx context.Context, bearer string, req CoinsVerifyRequest) (map[string]any, error) {
	if s.Config.RazorpayKeySecret == "" {
		return nil, errBadRequest("Razorpay is not configured")
	}
	player, err := s.ResolvePlayer(ctx, bearer)
	if err != nil {
		return nil, err
	}
	orderID := req.OrderID()
	paymentID := req.PaymentID()
	sig := req.Signature()

	orderRow, err := queryRowJSON(ctx, s.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = ?", orderID)
	if err != nil {
		return nil, err
	}
	if orderRow == nil {
		return nil, errBadRequest("Unknown Razorpay order")
	}

	prow, err := s.resolvePlayerRow(ctx, player)
	if err != nil {
		return nil, errBadRequest("Gamer record not found")
	}
	playerID := playerIDFrom(prow)
	if probeStr(orderRow, "player_id") != playerID {
		return nil, errForbidden("Order does not belong to this gamer")
	}

	expected := ComputeHMACSHA256(s.Config.RazorpayKeySecret, orderID+"|"+paymentID)
	if !constantTimeEqual(strings.TrimSpace(sig), expected) {
		slog.Warn("Rejected coin payment with invalid signature", "order", orderID)
		_ = s.DB.WithContext(ctx).Exec("UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = ? AND status = 'CREATED'", orderID).Error
		return nil, errUnauthorized("Invalid Razorpay payment signature")
	}

	return s.settleOrder(ctx, orderRow, paymentID, "checkout")
}

// HandleCoinWebhook handles Razorpay server webhooks (`payment.captured`, `order.paid`, `payment.failed`).
func (s *Service) HandleCoinWebhook(ctx context.Context, rawBody, signature string) (map[string]any, error) {
	if s.Config.RazorpayWebhookSecret == "" {
		return nil, errBadRequest("Razorpay webhook secret is not configured")
	}
	if strings.TrimSpace(signature) == "" {
		return nil, errUnauthorized("Missing x-razorpay-signature header")
	}

	expected := ComputeHMACSHA256(s.Config.RazorpayWebhookSecret, rawBody)
	if !constantTimeEqual(strings.TrimSpace(signature), expected) {
		slog.Warn("Rejected Razorpay webhook with invalid signature")
		return nil, errUnauthorized("Invalid Razorpay webhook signature")
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return nil, errBadRequest("Webhook body is not valid JSON")
	}
	event := probeStr(payload, "event")
	if event == "" {
		event = "unknown"
	}

	var entity map[string]any
	if pObj, ok := payload["payload"].(map[string]any); ok {
		switch event {
		case "payment.captured", "payment.authorized", "payment.failed":
			if pay, ok := pObj["payment"].(map[string]any); ok {
				entity, _ = pay["entity"].(map[string]any)
			}
		case "order.paid":
			if ord, ok := pObj["order"].(map[string]any); ok {
				entity, _ = ord["entity"].(map[string]any)
			}
		}
	}
	if entity == nil {
		return map[string]any{"received": true, "event": event, "processed": false}, nil
	}

	var orderID string
	if event == "order.paid" {
		orderID = probeStr(entity, "id")
	} else {
		orderID = probeStr(entity, "order_id")
	}
	if orderID == "" {
		return map[string]any{"received": true, "event": event, "processed": false}, nil
	}

	if event == "payment.failed" {
		_ = s.DB.WithContext(ctx).Exec(
			"UPDATE coin_orders SET status = 'FAILED', payment_id = ?, updated_at = now() WHERE razorpay_order_id = ? AND status = 'CREATED'",
			probeStr(entity, "id"), orderID,
		).Error
		return map[string]any{"received": true, "event": event, "processed": "marked_failed"}, nil
	}

	orderRow, err := queryRowJSON(ctx, s.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = ?", orderID)
	if err != nil {
		return nil, err
	}
	if orderRow == nil {
		slog.Warn("Razorpay webhook for unknown coin order", "orderId", orderID)
		return map[string]any{"received": true, "event": event, "processed": "unknown_order"}, nil
	}

	return s.settleOrder(ctx, orderRow, probeStr(entity, "id"), event)
}

func (s *Service) grantPFFCoins(ctx context.Context, userID string, amount int64, reason, idempotencyKey string) (any, error) {
	if s.Config.PFFTenant == "" || s.Config.PFFSecret == "" {
		return nil, errInternal("PFF coins/grant not configured: set PLAYFORFUN_TENANT_ID / PLAYFORFUN_SECRET on the games service")
	}
	body, _ := json.Marshal(map[string]any{
		"userId": userID,
		"amount": amount,
		"reason": reason,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, PlayForFunBaseURL+pffGrantPath, bytes.NewReader(body))
	if err != nil {
		return nil, errInternal("Failed building PFF coins/grant request: " + err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-pff-tenant", s.Config.PFFTenant)
	req.Header.Set("x-pff-secret", s.Config.PFFSecret)
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}

	resp, err := s.HTTP.Do(req)
	if err != nil {
		return nil, errInternal("Failed reaching PlayforFun coins/grant: " + err.Error())
	}
	defer resp.Body.Close()

	var respBody any
	_ = json.NewDecoder(resp.Body).Decode(&respBody)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		slog.Warn("PFF coins/grant failed", "status", resp.StatusCode, "userId", userID, "amount", amount, "body", respBody)
		return nil, errInternal(fmt.Sprintf("PlayforFun coins/grant rejected (HTTP %d)", resp.StatusCode))
	}
	slog.Info("PFF coins/grant OK", "userId", userID, "amount", amount, "reason", reason)
	return respBody, nil
}

func (s *Service) flushPendingPFFGrants(ctx context.Context, playerID, gamerID string) {
	rows, err := queryJSONRows(ctx, s.DB, "SELECT row_to_json(r) AS row FROM recharges r WHERE r.player_id = ?::uuid AND r.status = 'PENDING_PFF_SYNC'", playerID)
	if err != nil || len(rows) == 0 {
		return
	}
	for _, r := range rows {
		ref := probeStr(r, "reference")
		coins, _ := probeInt64(r, "coins")
		if ref == "" || coins <= 0 {
			continue
		}
		pff, err := s.grantPFFCoins(ctx, gamerID, coins, "purchase_"+ref, ref)
		if err != nil {
			slog.Warn("PFF pending grant retry failed", "ref", ref, "err", err)
			return
		}
		_ = s.DB.WithContext(ctx).Exec(
			"UPDATE recharges SET status = 'SYNCED', payload = payload || ?::jsonb WHERE reference = ?",
			mustJSON(map[string]any{"pffGrant": pff, "pffGrantRetried": true}), ref,
		).Error
		slog.Info("PFF pending grant retried OK", "ref", ref, "coins", coins)
	}
}

func (s *Service) recordPFFGrantOutcome(ctx context.Context, reference string, pff any, err error) {
	if err == nil {
		_ = s.DB.WithContext(ctx).Exec(
			"UPDATE recharges SET status = 'SYNCED', payload = payload || ?::jsonb WHERE reference = ?",
			mustJSON(map[string]any{"pffGrant": pff}), reference,
		).Error
		return
	}
	slog.Warn("PFF wallet grant failed — flagged PENDING_PFF_SYNC", "ref", reference, "err", err)
	_ = s.DB.WithContext(ctx).Exec(
		"UPDATE recharges SET status = 'PENDING_PFF_SYNC', payload = payload || ?::jsonb WHERE reference = ?",
		mustJSON(map[string]any{"pffGrantError": err.Error()}), reference,
	).Error
}

func (s *Service) settleOrder(ctx context.Context, orderRow map[string]any, paymentID, via string) (map[string]any, error) {
	orderID := probeStr(orderRow, "razorpay_order_id")
	playerID := probeStr(orderRow, "player_id")
	coins, _ := probeInt64(orderRow, "coins")
	amountPaise, _ := probeInt64(orderRow, "amount_paise")

	if playerID == "" {
		return nil, errInternal("Coin order has invalid player reference")
	}
	if coins <= 0 {
		return nil, errInternal("Coin order has no coins attached")
	}
	if paymentID == "" {
		return nil, errInternal("Payment id missing for settlement")
	}

	tx := s.DB.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, errDatabase("Failed opening settlement transaction: " + tx.Error.Error())
	}

	res := tx.Exec(`
		UPDATE coin_orders SET status = 'PAID', payment_id = ?, signature_verified = TRUE, updated_at = now()
		WHERE razorpay_order_id = ? AND status <> 'PAID'
	`, paymentID, orderID)
	if res.Error != nil {
		tx.Rollback()
		return nil, errDatabase(res.Error.Error())
	}

	var out map[string]any
	if res.RowsAffected > 0 {
		ref := paymentID
		balance, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &ref, orderRow)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Exec(`
			INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
			VALUES (?::uuid, ?::bigint, ?::double precision, 'RAZORPAY', 'CREDITED', ?, ?::jsonb)
			ON CONFLICT (reference) DO NOTHING
		`, playerID, coins, float64(amountPaise)/100.0, paymentID, mustJSON(orderRow)).Error; err != nil {
			tx.Rollback()
			return nil, errDatabase(err.Error())
		}
		creditedCoins := int64(0)
		if balance != nil {
			creditedCoins = coins
		}
		slog.Info("Coin recharge settled", "via", via, "order", orderID, "payment", paymentID, "coins", coins)
		out = map[string]any{
			"credited": balance != nil,
			"coins":    creditedCoins,
			"balance":  balance,
		}
	} else {
		slog.Info("Coin order already settled — replay ignored", "order", orderID)
		out = map[string]any{"credited": false, "alreadyProcessed": true}
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errDatabase("Settlement commit failed: " + err.Error())
	}

	if res.RowsAffected > 0 {
		if prow, err := queryRowJSON(ctx, s.DB, "SELECT row_to_json(p) AS row FROM players p WHERE p.id = ?::uuid", playerID); err == nil && prow != nil {
			gamerID := probeStr(prow, "gamer_uid")
			if gamerID != "" {
				s.flushPendingPFFGrants(ctx, playerID, gamerID)
				pff, pffErr := s.grantPFFCoins(ctx, gamerID, coins, "purchase_"+paymentID, paymentID)
				s.recordPFFGrantOutcome(ctx, paymentID, pff, pffErr)
			}
		}
	}

	out["received"] = true
	out["orderId"] = orderID
	out["via"] = via
	return out, nil
}

// GrantSubscription grants purchase (+1000) or monthly (+100) subscription coins.
func (s *Service) GrantSubscription(ctx context.Context, bearer string, req SubscriptionGrantRequest) (map[string]any, error) {
	if s.Config.RazorpayKeySecret == "" {
		return nil, errBadRequest("Razorpay is not configured on the games service")
	}
	player, err := s.ResolvePlayer(ctx, bearer)
	if err != nil {
		return nil, err
	}
	prow, err := findPlayerAny(ctx, s.DB, player.UserID)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, errInternal("Player row missing after resolution")
	}
	playerID := playerIDFrom(prow)
	if playerID == "" {
		return nil, errInternal("Player row has no id")
	}

	paymentID := req.ResolvedPaymentID()
	if paymentID != "" {
		reference := "sub_" + paymentID
		coins := s.Config.SubscriptionGrantCoins
		if req.Coins != nil && *req.Coins > 0 {
			coins = *req.Coins
		}

		// Verify Razorpay payment status == captured
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, razorpayAPI+"/payments/"+paymentID, nil)
		if err != nil {
			return nil, errInternal("Failed building Razorpay payment check: " + err.Error())
		}
		httpReq.SetBasicAuth(s.Config.RazorpayKeyID, s.Config.RazorpayKeySecret)
		httpReq.Header.Set("Accept", "application/json")
		resp, err := s.HTTP.Do(httpReq)
		if err != nil {
			return nil, errInternal("Failed reaching Razorpay: " + err.Error())
		}
		defer resp.Body.Close()

		var pay map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&pay); err != nil {
			return nil, errInternal("Invalid Razorpay response: " + err.Error())
		}
		status := probeStr(pay, "status")
		if !strings.EqualFold(status, "captured") {
			return nil, errBadRequest(fmt.Sprintf("Payment %s is not captured (status: %s)", paymentID, status))
		}

		tx := s.DB.WithContext(ctx).Begin()
		if tx.Error != nil {
			return nil, errDatabase("Failed opening grant transaction: " + tx.Error.Error())
		}
		balance, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &reference, map[string]any{
			"source": "SUBSCRIPTION", "userId": player.UserID,
		})
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Exec(`
			INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
			VALUES (?::uuid, ?::bigint, 0, 'SUBSCRIPTION', 'CREDITED', ?, ?::jsonb)
			ON CONFLICT (reference) DO NOTHING
		`, playerID, coins, reference, mustJSON(map[string]any{
			"userId":         player.UserID,
			"paymentId":      paymentID,
			"subscriptionId": req.ResolvedSubscriptionID(),
			"validUntil":     req.ResolvedValidUntil(),
		})).Error; err != nil {
			tx.Rollback()
			return nil, errDatabase(err.Error())
		}
		if err := tx.Commit().Error; err != nil {
			return nil, errDatabase("Grant commit failed: " + err.Error())
		}

		s.mirrorSubscriptionGrantToPFF(ctx, prow, coins, reference)

		creditedCoins := int64(0)
		if balance != nil {
			creditedCoins = coins
		}
		return map[string]any{
			"credited":         balance != nil,
			"alreadyProcessed": balance == nil,
			"coins":            creditedCoins,
			"balance":          balance,
			"reference":        reference,
		}, nil
	}

	// Monthly claim (+100 once per calendar month while plan is valid)
	rows, err := queryJSONRows(ctx, s.DB, `
		SELECT row_to_json(q) AS row FROM (
			SELECT payload->>'validUntil' AS valid_until
			FROM recharges
			WHERE player_id = ?::uuid
			  AND source = 'SUBSCRIPTION'
			  AND payload->>'validUntil' IS NOT NULL
			  AND payload->>'validUntil' <> ''
			ORDER BY created_at DESC
			LIMIT 1
		) q
	`, playerID)
	if err != nil {
		return nil, err
	}
	validUntil := ""
	if len(rows) > 0 {
		validUntil = probeStr(rows[0], "valid_until")
	}
	if validUntil == "" {
		return nil, errBadRequest("No subscription benefit recorded — purchase a paid subscription first")
	}
	expiry, ok := parseValidUntil(validUntil)
	if !ok {
		return nil, errInternal("Stored plan expiry is invalid")
	}
	if !expiry.After(time.Now().UTC()) {
		return nil, errBadRequest("Subscription plan has expired — renew to keep receiving monthly coins")
	}

	monthKey := time.Now().UTC().Format("2006-01")
	simpleID := strings.ReplaceAll(playerID, "-", "")
	reference := fmt.Sprintf("subm_%s_%s", simpleID, monthKey)
	coins := s.Config.SubscriptionMonthlyCoins

	tx := s.DB.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, errDatabase("Failed opening grant transaction: " + tx.Error.Error())
	}
	balance, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &reference, map[string]any{
		"source": "SUBSCRIPTION", "userId": player.UserID,
	})
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	if err := tx.Exec(`
		INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
		VALUES (?::uuid, ?::bigint, 0, 'SUBSCRIPTION', 'CREDITED', ?, ?::jsonb)
		ON CONFLICT (reference) DO NOTHING
	`, playerID, coins, reference, mustJSON(map[string]any{
		"userId":  player.UserID,
		"monthly": true,
		"month":   monthKey,
	})).Error; err != nil {
		tx.Rollback()
		return nil, errDatabase(err.Error())
	}
	if err := tx.Commit().Error; err != nil {
		return nil, errDatabase("Grant commit failed: " + err.Error())
	}

	s.mirrorSubscriptionGrantToPFF(ctx, prow, coins, reference)

	creditedCoins := int64(0)
	if balance != nil {
		creditedCoins = coins
	}
	return map[string]any{
		"credited":         balance != nil,
		"alreadyProcessed": balance == nil,
		"coins":            creditedCoins,
		"balance":          balance,
		"reference":        reference,
	}, nil
}

func (s *Service) mirrorSubscriptionGrantToPFF(ctx context.Context, prow map[string]any, coins int64, reference string) {
	gamerID := probeStr(prow, "gamer_uid")
	if gamerID == "" {
		return
	}
	pff, err := s.grantPFFCoins(ctx, gamerID, coins, "monthly_subscription", reference)
	s.recordPFFGrantOutcome(ctx, reference, pff, err)
}

// ---------------------------------------------------------------------------
// Provider Wallet API (server-to-server: x-pff-tenant / x-pff-secret)
// ---------------------------------------------------------------------------

func (s *Service) VerifyWalletS2S(tenant, secret string) error {
	if s.Config.PFFSecret == "" {
		return errBadRequest("Wallet API is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service.")
	}
	if strings.TrimSpace(secret) == "" {
		return errUnauthorized("Missing x-pff-secret header")
	}
	if !constantTimeEqual(strings.TrimSpace(secret), s.Config.PFFSecret) {
		slog.Warn("Rejected wallet request with invalid x-pff-secret")
		return errUnauthorized("Invalid wallet credentials")
	}
	if t := strings.TrimSpace(tenant); t != "" && !strings.EqualFold(t, s.Config.PFFTenant) {
		return errUnauthorized("Unknown wallet tenant")
	}
	return nil
}

func (s *Service) walletPlayer(ctx context.Context, identifier string) (map[string]any, error) {
	ident := strings.TrimSpace(identifier)
	if ident == "" {
		return nil, errBadRequest("userId is required")
	}
	prow, err := findPlayerAny(ctx, s.DB, ident)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, errBadRequest("Unknown gamer — no MAXX GAMES record for that userId")
	}
	return prow, nil
}

func (s *Service) Wallet(ctx context.Context, identifier string) (map[string]any, error) {
	prow, err := s.walletPlayer(ctx, identifier)
	if err != nil {
		return nil, err
	}
	gamerUID := probeStr(prow, "gamer_uid")
	displayName := probeStr(prow, "name")
	if displayName == "" {
		displayName = probeStr(prow, "display_name")
	}
	coins, _ := probeInt64(prow, "coins")

	return map[string]any{
		"tenant":      s.Config.PFFTenant,
		"userId":      gamerUID,
		"gamerUid":    gamerUID,
		"externalId":  probeStr(prow, "external_id"),
		"displayName": displayName,
		"coins":       coins,
		"currency":    s.Config.RazorpayCurrency,
		"keyId":       s.Config.RazorpayKeyID,
		"packs":       s.Config.CoinPacks,
		"endpoints": map[string]string{
			"order":  "/api/v1/games/wallet/order",
			"verify": "/api/v1/games/wallet/verify",
		},
	}, nil
}

func (s *Service) WalletOrder(ctx context.Context, identifier, packID string) (map[string]any, error) {
	prow, err := s.walletPlayer(ctx, identifier)
	if err != nil {
		return nil, err
	}
	pack, err := s.findPack(packID)
	if err != nil {
		return nil, err
	}
	return s.createOrderCore(ctx, prow, pack)
}

func (s *Service) WalletVerify(ctx context.Context, identifier, orderID, paymentID, sig string) (map[string]any, error) {
	if s.Config.RazorpayKeySecret == "" {
		return nil, errBadRequest("Razorpay is not configured")
	}
	prow, err := s.walletPlayer(ctx, identifier)
	if err != nil {
		return nil, err
	}
	playerID := playerIDFrom(prow)
	if playerID == "" {
		return nil, errInternal("Gamer record missing id")
	}
	orderRow, err := queryRowJSON(ctx, s.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = ?", orderID)
	if err != nil {
		return nil, err
	}
	if orderRow == nil {
		return nil, errBadRequest("Unknown Razorpay order")
	}
	if probeStr(orderRow, "player_id") != playerID {
		return nil, errForbidden("Order does not belong to this gamer")
	}
	expected := ComputeHMACSHA256(s.Config.RazorpayKeySecret, orderID+"|"+paymentID)
	if !constantTimeEqual(strings.TrimSpace(sig), expected) {
		slog.Warn("Rejected wallet payment with invalid signature", "order", orderID)
		_ = s.DB.WithContext(ctx).Exec("UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = ? AND status = 'CREATED'", orderID).Error
		return nil, errUnauthorized("Invalid Razorpay payment signature")
	}
	return s.settleOrder(ctx, orderRow, paymentID, "wallet")
}
