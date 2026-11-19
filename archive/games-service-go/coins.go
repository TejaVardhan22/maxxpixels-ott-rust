package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	razorpayAPI  = "https://api.razorpay.com/v1"
	pffGrantPath = "/api/public/coins/grant"
)

type CoinsOrderRequest struct {
	PackID string `json:"packId"`
	Pack   string `json:"pack"`
}

func (r CoinsOrderRequest) GetPackID() string {
	if strings.TrimSpace(r.PackID) != "" {
		return r.PackID
	}
	return r.Pack
}

type CoinsVerifyRequest struct {
	RazorpayOrderID   string `json:"razorpayOrderId"`
	RazorpayPaymentID string `json:"razorpayPaymentId"`
	RazorpaySignature string `json:"razorpaySignature"`
	// snake_case variants handled manually when decoding if needed
}

type WalletOrderRequest struct {
	UserID string `json:"userId"`
	PackID string `json:"packId"`
	User   string `json:"user"`
	UID    string `json:"uid"`
	Gamer  string `json:"gamerUid"`
	Gamer2 string `json:"gamer_uid"`
	Pack   string `json:"pack"`
}

func (r WalletOrderRequest) GetUserID() string {
	for _, v := range []string{r.UserID, r.User, r.UID, r.Gamer, r.Gamer2} {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
func (r WalletOrderRequest) GetPackID() string {
	if strings.TrimSpace(r.PackID) != "" {
		return r.PackID
	}
	return r.Pack
}

type WalletVerifyRequest struct {
	UserID            string `json:"userId"`
	RazorpayOrderID   string `json:"razorpayOrderId"`
	RazorpayPaymentID string `json:"razorpayPaymentId"`
	RazorpaySignature string `json:"razorpaySignature"`
	User              string `json:"user"`
	UID               string `json:"uid"`
	Gamer             string `json:"gamerUid"`
	Gamer2            string `json:"gamer_uid"`
}

func (r WalletVerifyRequest) GetUserID() string {
	for _, v := range []string{r.UserID, r.User, r.UID, r.Gamer, r.Gamer2} {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

type SubscriptionGrantRequest struct {
	PaymentID      *string `json:"paymentId"`
	PaymentID2     *string `json:"payment_id"`
	RzpPaymentID   *string `json:"razorpay_payment_id"`
	SubscriptionID *string `json:"subscriptionId"`
	Subscription2  *string `json:"subscription_id"`
	ValidUntil     *string `json:"validUntil"`
	ValidUntil2    *string `json:"valid_until"`
	EndDate        *string `json:"endDate"`
	EndDate2       *string `json:"end_date"`
	Coins          *int64  `json:"coins"`
}

func firstNonEmptyStr(ptrs ...*string) *string {
	for _, p := range ptrs {
		if p != nil && strings.TrimSpace(*p) != "" {
			s := strings.TrimSpace(*p)
			return &s
		}
	}
	return nil
}

func (r SubscriptionGrantRequest) GetPaymentID() *string {
	return firstNonEmptyStr(r.PaymentID, r.PaymentID2, r.RzpPaymentID)
}
func (r SubscriptionGrantRequest) GetSubscriptionID() *string {
	return firstNonEmptyStr(r.SubscriptionID, r.Subscription2)
}
func (r SubscriptionGrantRequest) GetValidUntil() *string {
	return firstNonEmptyStr(r.ValidUntil, r.ValidUntil2, r.EndDate, r.EndDate2)
}

func parseValidUntil(s string) (*time.Time, bool) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		u := t.UTC()
		return &u, true
	}
	day := s
	if len(s) >= 10 {
		day = s[:10]
	}
	if t, err := time.Parse("2006-01-02", day); err == nil {
		u := time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, time.UTC)
		return &u, true
	}
	return nil, false
}

func findPack(cfg GamesConfig, packID string) (CoinPack, error) {
	for _, p := range cfg.CoinPacks {
		if strings.EqualFold(p.ID, packID) {
			return p, nil
		}
	}
	ids := make([]string, 0, len(cfg.CoinPacks))
	for _, p := range cfg.CoinPacks {
		ids = append(ids, p.ID)
	}
	return CoinPack{}, NewBadRequest(fmt.Sprintf("Unknown coin pack '%s'. Available: %s", packID, strings.Join(ids, ", ")))
}

func coinPacksPayload(state *AppState) map[string]any {
	return map[string]any{
		"currency": state.Config.RazorpayCurrency,
		"keyId":    state.Config.RazorpayKeyID,
		"packs":    state.Config.CoinPacks,
	}
}

func createCoinOrder(ctx context.Context, state *AppState, bearer string, packID string) (map[string]any, error) {
	if state.Config.RazorpayKeyID == "" || state.Config.RazorpayKeySecret == "" {
		return nil, NewBadRequest("Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service.")
	}
	pack, err := findPack(state.Config, packID)
	if err != nil {
		return nil, err
	}
	player, err := resolvePlayer(ctx, state, bearer)
	if err != nil {
		return nil, err
	}
	gamerUID := ""
	if player.GamerUID != nil {
		gamerUID = *player.GamerUID
	}
	prow, err := queryPlayerJSON(ctx, state.DB, `
SELECT row_to_json(p) AS row FROM players p
WHERE p.user_id = $1
   OR ($2 <> '' AND p.gamer_uid = $2)
   OR p.external_id = $3
ORDER BY (p.user_id = $1) DESC, p.last_synced_at DESC NULLS LAST
LIMIT 1`, player.UserID, gamerUID, player.ExternalID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if prow == nil {
		return nil, NewInternal("Gamer record not found after sync")
	}
	return createOrderCore(ctx, state, prow, pack)
}

func createOrderCore(ctx context.Context, state *AppState, prow map[string]any, pack CoinPack) (map[string]any, error) {
	if state.Config.RazorpayKeyID == "" || state.Config.RazorpayKeySecret == "" {
		return nil, NewBadRequest("Coin recharges are not configured. Set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET on the games service.")
	}
	playerUserID, _ := prow["user_id"].(string)
	playerIDStr, _ := prow["id"].(string)
	playerUUID, err := uuid.Parse(playerIDStr)
	if err != nil {
		return nil, NewInternal("Gamer record missing id")
	}
	gamerUID, _ := prow["gamer_uid"].(string)
	amountPaise := pack.AmountPaise()
	receipt := fmt.Sprintf("coins_%s_%d", gamerUID, time.Now().Unix())

	body := map[string]any{
		"amount":   amountPaise,
		"currency": state.Config.RazorpayCurrency,
		"receipt":  receipt,
		"notes": map[string]any{
			"player_user_id": playerUserID,
			"gamer_uid":      gamerUID,
			"pack_id":        pack.ID,
			"coins":          pack.Coins,
		},
	}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, razorpayAPI+"/orders", bytes.NewReader(b))
	if err != nil {
		return nil, NewInternal(err.Error())
	}
	req.SetBasicAuth(state.Config.RazorpayKeyID, state.Config.RazorpayKeySecret)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := state.HTTP.Do(req)
	if err != nil {
		return nil, NewInternal("Failed reaching Razorpay: " + err.Error())
	}
	defer resp.Body.Close()
	respBytes, _ := io.ReadAll(resp.Body)
	var rzp map[string]any
	_ = json.Unmarshal(respBytes, &rzp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, NewInternal(fmt.Sprintf("Razorpay rejected the order (HTTP %d)", resp.StatusCode))
	}
	rzpOrderID, _ := rzp["id"].(string)
	if rzpOrderID == "" {
		return nil, NewInternal("Razorpay order response missing id")
	}
	rzpJSON, _ := json.Marshal(rzp)
	notesJSON, _ := json.Marshal(gamerUID) // in Rust they stored to_jsonb($8::text) with gamer_uid string; store as JSON string is fine
	_, err = execRows(ctx, state.DB, `
INSERT INTO coin_orders (player_id, razorpay_order_id, pack_id, coins, amount_paise,
                         currency, status, receipt, notes, payload)
VALUES ($1::uuid, $2, $3, $4::bigint, $5::bigint, $6, 'CREATED', $7, $8::jsonb, $9::jsonb)
ON CONFLICT (razorpay_order_id) DO NOTHING`,
		playerUUID.String(), rzpOrderID, pack.ID, pack.Coins, amountPaise, state.Config.RazorpayCurrency, receipt, string(notesJSON), string(rzpJSON))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	return map[string]any{
		"razorpayOrderId": rzpOrderID,
		"packId":          pack.ID,
		"coins":           pack.Coins,
		"amount":          amountPaise,
		"amountInr":       pack.AmountINR,
		"currency":        state.Config.RazorpayCurrency,
		"keyId":           state.Config.RazorpayKeyID,
		"gamerUid":        gamerUID,
		"userId":          playerUserID,
	}, nil
}

func verifyCoinPayment(ctx context.Context, state *AppState, bearer string, req CoinsVerifyRequest) (map[string]any, error) {
	if state.Config.RazorpayKeySecret == "" {
		return nil, NewBadRequest("Razorpay is not configured")
	}
	player, err := resolvePlayer(ctx, state, bearer)
	if err != nil {
		return nil, err
	}
	orderRow, err := queryPlayerJSON(ctx, state.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1", req.RazorpayOrderID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if orderRow == nil {
		return nil, NewBadRequest("Unknown Razorpay order")
	}
	orderPlayer, _ := orderRow["player_id"].(string)
	gamerUID := ""
	if player.GamerUID != nil {
		gamerUID = *player.GamerUID
	}
	prow, err := queryPlayerJSON(ctx, state.DB, `
SELECT row_to_json(p) AS row FROM players p
WHERE p.user_id = $1
   OR ($2 <> '' AND p.gamer_uid = $2)
   OR p.external_id = $3
ORDER BY (p.user_id = $1) DESC, p.last_synced_at DESC NULLS LAST
LIMIT 1`, player.UserID, gamerUID, player.ExternalID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if prow == nil {
		return nil, NewBadRequest("Gamer record not found")
	}
	playerIDStr, _ := prow["id"].(string)
	playerUUID, err := uuid.Parse(playerIDStr)
	if err != nil {
		return nil, NewInternal("Gamer record missing id")
	}
	if orderPlayer != playerUUID.String() {
		return nil, NewForbidden("Order does not belong to this gamer")
	}
	payload := fmt.Sprintf("%s|%s", req.RazorpayOrderID, req.RazorpayPaymentID)
	expected, err := ComputeHMACSHA256(state.Config.RazorpayKeySecret, payload)
	if err != nil {
		return nil, NewInternal("HMAC failure: " + err.Error())
	}
	if !ConstantTimeEq([]byte(strings.TrimSpace(req.RazorpaySignature)), []byte(expected)) {
		_, _ = execRows(ctx, state.DB, "UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'", req.RazorpayOrderID)
		return nil, NewUnauthorized("Invalid Razorpay payment signature")
	}
	return settleOrder(ctx, state, orderRow, req.RazorpayPaymentID, "checkout")
}

func handleRazorpayWebhook(ctx context.Context, state *AppState, rawBody string, signature *string) (map[string]any, error) {
	if state.Config.RazorpayWebhookSecret == "" {
		return nil, NewBadRequest("Razorpay webhook secret is not configured")
	}
	if signature == nil {
		return nil, NewUnauthorized("Missing x-razorpay-signature header")
	}
	expected, err := ComputeHMACSHA256(state.Config.RazorpayWebhookSecret, rawBody)
	if err != nil {
		return nil, NewInternal("HMAC failure: " + err.Error())
	}
	if !ConstantTimeEq([]byte(strings.TrimSpace(*signature)), []byte(expected)) {
		return nil, NewUnauthorized("Invalid Razorpay webhook signature")
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return nil, NewBadRequest("Webhook body is not valid JSON")
	}
	event, _ := payload["event"].(string)
	if event == "" {
		event = "unknown"
	}
	var entity map[string]any
	switch event {
	case "payment.captured", "payment.authorized", "payment.failed":
		if p, ok := digMap(payload, "payload", "payment", "entity"); ok {
			entity = p
		}
	case "order.paid":
		if p, ok := digMap(payload, "payload", "order", "entity"); ok {
			entity = p
		}
	}
	if entity == nil {
		return map[string]any{"received": true, "event": event, "processed": false}, nil
	}
	orderID := ""
	if event == "order.paid" {
		if v, ok := entity["id"].(string); ok {
			orderID = v
		}
	} else {
		if v, ok := entity["order_id"].(string); ok {
			orderID = v
		}
	}
	if orderID == "" {
		return map[string]any{"received": true, "event": event, "processed": false}, nil
	}
	if event == "payment.failed" {
		pid, _ := entity["id"].(string)
		_, _ = execRows(ctx, state.DB, "UPDATE coin_orders SET status = 'FAILED', payment_id = $2, updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'", orderID, pid)
		return map[string]any{"received": true, "event": event, "processed": "marked_failed"}, nil
	}
	orderRow, err := queryPlayerJSON(ctx, state.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1", orderID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if orderRow == nil {
		return map[string]any{"received": true, "event": event, "processed": "unknown_order"}, nil
	}
	paymentID, _ := entity["id"].(string)
	return settleOrder(ctx, state, orderRow, paymentID, event)
}

func digMap(m map[string]any, keys ...string) (map[string]any, bool) {
	var cur any = m
	for _, k := range keys {
		mm, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		cur, ok = mm[k]
		if !ok {
			return nil, false
		}
	}
	out, ok := cur.(map[string]any)
	return out, ok
}

func grantPFFCoins(ctx context.Context, state *AppState, userID string, amount int64, reason string, idempotencyKey *string) (map[string]any, error) {
	if state.Config.PFFTenant == "" || state.Config.PFFSecret == "" {
		return nil, NewInternal("PFF coins/grant not configured: set PLAYFORFUN_TENANT_ID / PLAYFORFUN_SECRET on the games service")
	}
	body := map[string]any{"userId": userID, "amount": amount, "reason": reason}
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, pffBaseURL+pffGrantPath, bytes.NewReader(b))
	if err != nil {
		return nil, NewInternal(err.Error())
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-pff-tenant", state.Config.PFFTenant)
	req.Header.Set("x-pff-secret", state.Config.PFFSecret)
	if idempotencyKey != nil {
		req.Header.Set("Idempotency-Key", *idempotencyKey)
	}
	resp, err := state.HTTP.Do(req)
	if err != nil {
		return nil, NewInternal("Failed reaching PlayforFun coins/grant: " + err.Error())
	}
	defer resp.Body.Close()
	respBytes, _ := io.ReadAll(resp.Body)
	var out map[string]any
	_ = json.Unmarshal(respBytes, &out)
	if out == nil {
		out = map[string]any{}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, NewInternal(fmt.Sprintf("PlayforFun coins/grant rejected (HTTP %d)", resp.StatusCode))
	}
	return out, nil
}

func flushPendingPFFGrants(ctx context.Context, state *AppState, playerID uuid.UUID, gamerID string) {
	rows, err := queryJSONRows(ctx, state.DB, `SELECT row_to_json(r) AS row FROM recharges r WHERE r.player_id = $1::uuid AND r.status = 'PENDING_PFF_SYNC'`, playerID.String())
	if err != nil || len(rows) == 0 {
		return
	}
	for _, r := range rows {
		reference, _ := r["reference"].(string)
		var coins int64
		switch v := r["coins"].(type) {
		case float64:
			coins = int64(v)
		case int64:
			coins = v
		}
		if reference == "" || coins <= 0 {
			continue
		}
		reason := "purchase_" + reference
		pff, err := grantPFFCoins(ctx, state, gamerID, coins, reason, &reference)
		if err != nil {
			break
		}
		patch, _ := json.Marshal(map[string]any{"pffGrant": pff, "pffGrantRetried": true})
		_, _ = execRows(ctx, state.DB, "UPDATE recharges SET status = 'SYNCED', payload = payload || $2::jsonb WHERE reference = $1", reference, string(patch))
	}
}

func recordPFFGrantOutcome(ctx context.Context, state *AppState, reference string, outcome map[string]any, err error) {
	if err == nil {
		patch, _ := json.Marshal(map[string]any{"pffGrant": outcome})
		_, _ = execRows(ctx, state.DB, "UPDATE recharges SET status = 'SYNCED', payload = payload || $2::jsonb WHERE reference = $1", reference, string(patch))
		return
	}
	patch, _ := json.Marshal(map[string]any{"pffGrantError": err.Error()})
	_, _ = execRows(ctx, state.DB, "UPDATE recharges SET status = 'PENDING_PFF_SYNC', payload = payload || $2::jsonb WHERE reference = $1", reference, string(patch))
}

func settleOrder(ctx context.Context, state *AppState, orderRow map[string]any, paymentID string, via string) (map[string]any, error) {
	orderID, _ := orderRow["razorpay_order_id"].(string)
	playerIDStr, _ := orderRow["player_id"].(string)
	playerID, err := uuid.Parse(playerIDStr)
	if err != nil {
		return nil, NewInternal("Coin order has invalid player reference")
	}
	var coins, amountPaise int64
	switch v := orderRow["coins"].(type) {
	case float64:
		coins = int64(v)
	case int64:
		coins = v
	}
	switch v := orderRow["amount_paise"].(type) {
	case float64:
		amountPaise = int64(v)
	case int64:
		amountPaise = v
	}
	if coins <= 0 {
		return nil, NewInternal("Coin order has no coins attached")
	}
	if strings.TrimSpace(paymentID) == "" {
		return nil, NewInternal("Payment id missing for settlement")
	}

	tx, err := state.DB.Begin(ctx)
	if err != nil {
		return nil, NewDatabase("Failed opening settlement transaction: " + err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	appliedRows, err := execRows(ctx, tx, `
UPDATE coin_orders SET status = 'PAID', payment_id = $2, signature_verified = TRUE, updated_at = now()
WHERE razorpay_order_id = $1 AND status <> 'PAID'`, orderID, paymentID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	var result map[string]any
	if appliedRows > 0 {
		ref := paymentID
		balance, applied, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &ref, orderRow)
		if err != nil {
			return nil, err
		}
		orderJSON, _ := json.Marshal(orderRow)
		_, err = execRows(ctx, tx, `
INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
VALUES ($1::uuid, $2::bigint, $3::double precision, 'RAZORPAY', 'CREDITED', $4, $5::jsonb)
ON CONFLICT (reference) DO NOTHING`,
			playerID.String(), coins, float64(amountPaise)/100.0, paymentID, string(orderJSON))
		if err != nil {
			return nil, NewDatabase(err.Error())
		}
		coinsOut := int64(0)
		if applied {
			coinsOut = coins
		}
		result = map[string]any{"credited": applied, "coins": coinsOut, "balance": balance}
	} else {
		result = map[string]any{"credited": false, "alreadyProcessed": true}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, NewDatabase("Settlement commit failed: " + err.Error())
	}

	if appliedRows > 0 {
		prow, _ := queryPlayerJSON(ctx, state.DB, "SELECT row_to_json(p) AS row FROM players p WHERE p.id = $1::uuid", playerID.String())
		gamerID, _ := prow["gamer_uid"].(string)
		if gamerID != "" {
			flushPendingPFFGrants(ctx, state, playerID, gamerID)
			reason := "purchase_" + paymentID
			outcome, perr := grantPFFCoins(ctx, state, gamerID, coins, reason, &paymentID)
			recordPFFGrantOutcome(ctx, state, paymentID, outcome, perr)
		}
	}
	result["received"] = true
	result["orderId"] = orderID
	result["via"] = via
	return result, nil
}
