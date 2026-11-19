package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

func grantSubscription(ctx context.Context, state *AppState, bearer string, req SubscriptionGrantRequest) (map[string]any, error) {
	if state.Config.RazorpayKeySecret == "" {
		return nil, NewBadRequest("Razorpay is not configured on the games service")
	}
	player, err := resolvePlayer(ctx, state, bearer)
	if err != nil {
		return nil, err
	}
	prow, err := findPlayerAny(ctx, state.DB, player.UserID)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, NewInternal("Player row missing after resolution")
	}
	playerID, ok := playerIDFrom(prow)
	if !ok {
		return nil, NewInternal("Player row has no id")
	}

	if paymentIDPtr := req.GetPaymentID(); paymentIDPtr != nil {
		paymentID := strings.TrimSpace(*paymentIDPtr)
		if paymentID == "" {
			return nil, NewBadRequest("paymentId is required")
		}
		reference := "sub_" + paymentID
		coins := state.Config.SubscriptionGrantCoins
		if req.Coins != nil && *req.Coins > 0 {
			coins = *req.Coins
		}
		// Verify payment with Razorpay
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, razorpayAPI+"/payments/"+paymentID, nil)
		if err != nil {
			return nil, NewInternal(err.Error())
		}
		httpReq.SetBasicAuth(state.Config.RazorpayKeyID, state.Config.RazorpayKeySecret)
		httpReq.Header.Set("Accept", "application/json")
		resp, err := state.HTTP.Do(httpReq)
		if err != nil {
			return nil, NewInternal("Failed reaching Razorpay: " + err.Error())
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		var pay map[string]any
		_ = json.Unmarshal(body, &pay)
		status, _ := pay["status"].(string)
		if !strings.EqualFold(status, "captured") {
			return nil, NewBadRequest(fmt.Sprintf("Payment %s is not captured (status: %s)", paymentID, status))
		}

		tx, err := state.DB.Begin(ctx)
		if err != nil {
			return nil, NewDatabase("Failed opening grant transaction: " + err.Error())
		}
		defer func() { _ = tx.Rollback(ctx) }()

		meta := map[string]any{"source": "SUBSCRIPTION", "userId": player.UserID}
		balance, applied, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &reference, meta)
		if err != nil {
			return nil, err
		}
		validUntil := ""
		if vu := req.GetValidUntil(); vu != nil {
			validUntil = *vu
		}
		rPayload, _ := json.Marshal(map[string]any{
			"userId":         player.UserID,
			"paymentId":      paymentID,
			"subscriptionId": req.GetSubscriptionID(),
			"validUntil":     validUntil,
		})
		_, err = execRows(ctx, tx, `
INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
VALUES ($1::uuid, $2::bigint, 0, 'SUBSCRIPTION', 'CREDITED', $3, $4::jsonb)
ON CONFLICT (reference) DO NOTHING`,
			playerID.String(), coins, reference, string(rPayload))
		if err != nil {
			return nil, NewDatabase(err.Error())
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, NewDatabase("Grant commit failed: " + err.Error())
		}
		already := !applied
		coinsOut := int64(0)
		if applied {
			coinsOut = coins
		}
		mirrorSubscriptionGrantToPFF(ctx, state, prow, coins, reference)
		return map[string]any{
			"credited":         applied,
			"alreadyProcessed": already,
			"coins":            coinsOut,
			"balance":          balance,
			"reference":        reference,
		}, nil
	}

	// Monthly claim
	rows, err := queryJSONRows(ctx, state.DB, `
SELECT row_to_json(q) AS row
FROM (
    SELECT payload->>'validUntil' AS valid_until
    FROM recharges
    WHERE player_id = $1::uuid
      AND source = 'SUBSCRIPTION'
      AND payload->>'validUntil' IS NOT NULL
      AND payload->>'validUntil' <> ''
    ORDER BY created_at DESC
    LIMIT 1
) q`, playerID.String())
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	validUntil := ""
	if len(rows) > 0 {
		if v, ok := rows[0]["valid_until"].(string); ok {
			validUntil = v
		}
	}
	if validUntil == "" {
		return nil, NewBadRequest("No subscription benefit recorded — purchase a paid subscription first")
	}
	expiry, ok := parseValidUntil(validUntil)
	if !ok {
		return nil, NewInternal("Stored plan expiry is invalid")
	}
	if !expiry.After(time.Now().UTC()) {
		return nil, NewBadRequest("Subscription plan has expired — renew to keep receiving monthly coins")
	}
	monthKey := time.Now().UTC().Format("2006-01")
	reference := fmt.Sprintf("subm_%s_%s", strings.ReplaceAll(playerID.String(), "-", ""), monthKey)
	coins := state.Config.SubscriptionMonthly

	tx, err := state.DB.Begin(ctx)
	if err != nil {
		return nil, NewDatabase("Failed opening grant transaction: " + err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()
	meta := map[string]any{"source": "SUBSCRIPTION", "userId": player.UserID}
	balance, applied, err := adjustCoins(ctx, tx, playerID, "RECHARGE", coins, nil, nil, &reference, meta)
	if err != nil {
		return nil, err
	}
	rPayload, _ := json.Marshal(map[string]any{"userId": player.UserID, "monthly": true, "month": monthKey})
	_, err = execRows(ctx, tx, `
INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
VALUES ($1::uuid, $2::bigint, 0, 'SUBSCRIPTION', 'CREDITED', $3, $4::jsonb)
ON CONFLICT (reference) DO NOTHING`,
		playerID.String(), coins, reference, string(rPayload))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, NewDatabase("Grant commit failed: " + err.Error())
	}
	already := !applied
	coinsOut := int64(0)
	if applied {
		coinsOut = coins
	}
	mirrorSubscriptionGrantToPFF(ctx, state, prow, coins, reference)
	return map[string]any{
		"credited":         applied,
		"alreadyProcessed": already,
		"coins":            coinsOut,
		"balance":          balance,
		"reference":        reference,
	}, nil
}

func mirrorSubscriptionGrantToPFF(ctx context.Context, state *AppState, prow map[string]any, coins int64, reference string) {
	gamerID, _ := prow["gamer_uid"].(string)
	if gamerID == "" {
		return
	}
	outcome, err := grantPFFCoins(ctx, state, gamerID, coins, "monthly_subscription", &reference)
	recordPFFGrantOutcome(ctx, state, reference, outcome, err)
}

func verifyWalletS2S(state *AppState, tenant, secret string) error {
	if state.Config.PFFSecret == "" {
		return NewBadRequest("Wallet API is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service.")
	}
	if secret == "" {
		return NewUnauthorized("Missing x-pff-secret header")
	}
	if !ConstantTimeEq([]byte(strings.TrimSpace(secret)), []byte(state.Config.PFFSecret)) {
		return NewUnauthorized("Invalid wallet credentials")
	}
	if strings.TrimSpace(tenant) != "" && !strings.EqualFold(strings.TrimSpace(tenant), state.Config.PFFTenant) {
		return NewUnauthorized("Unknown wallet tenant")
	}
	return nil
}

func walletPlayer(ctx context.Context, state *AppState, identifier string) (map[string]any, error) {
	ident := strings.TrimSpace(identifier)
	if ident == "" {
		return nil, NewBadRequest("userId is required")
	}
	row, err := findPlayerAny(ctx, state.DB, ident)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, NewBadRequest("Unknown gamer — no MAXX GAMES record for that userId")
	}
	return row, nil
}

func walletPayload(ctx context.Context, state *AppState, identifier string) (map[string]any, error) {
	prow, err := walletPlayer(ctx, state, identifier)
	if err != nil {
		return nil, err
	}
	gamerUID, _ := prow["gamer_uid"].(string)
	displayName := ""
	if n, ok := prow["name"].(string); ok && strings.TrimSpace(n) != "" {
		displayName = n
	} else if dn, ok := prow["display_name"].(string); ok {
		displayName = dn
	}
	var coins int64
	switch v := prow["coins"].(type) {
	case float64:
		coins = int64(v)
	case int64:
		coins = v
	}
	externalID, _ := prow["external_id"].(string)
	return map[string]any{
		"tenant":      state.Config.PFFTenant,
		"userId":      gamerUID,
		"gamerUid":    gamerUID,
		"externalId":  externalID,
		"displayName": displayName,
		"coins":       coins,
		"currency":    state.Config.RazorpayCurrency,
		"keyId":       state.Config.RazorpayKeyID,
		"packs":       state.Config.CoinPacks,
		"endpoints": map[string]any{
			"order":  "/api/v1/games/wallet/order",
			"verify": "/api/v1/games/wallet/verify",
		},
	}, nil
}

func walletOrder(ctx context.Context, state *AppState, identifier, packID string) (map[string]any, error) {
	prow, err := walletPlayer(ctx, state, identifier)
	if err != nil {
		return nil, err
	}
	pack, err := findPack(state.Config, packID)
	if err != nil {
		return nil, err
	}
	return createOrderCore(ctx, state, prow, pack)
}

func walletVerify(ctx context.Context, state *AppState, identifier, razorpayOrderID, razorpayPaymentID, razorpaySignature string) (map[string]any, error) {
	if state.Config.RazorpayKeySecret == "" {
		return nil, NewBadRequest("Razorpay is not configured")
	}
	prow, err := walletPlayer(ctx, state, identifier)
	if err != nil {
		return nil, err
	}
	playerID, ok := playerIDFrom(prow)
	if !ok {
		return nil, NewInternal("Gamer record missing id")
	}
	orderRow, err := queryPlayerJSON(ctx, state.DB, "SELECT row_to_json(o) AS row FROM coin_orders o WHERE o.razorpay_order_id = $1", razorpayOrderID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if orderRow == nil {
		return nil, NewBadRequest("Unknown Razorpay order")
	}
	orderPlayer, _ := orderRow["player_id"].(string)
	if orderPlayer != playerID.String() {
		return nil, NewForbidden("Order does not belong to this gamer")
	}
	payload := fmt.Sprintf("%s|%s", razorpayOrderID, razorpayPaymentID)
	expected, err := ComputeHMACSHA256(state.Config.RazorpayKeySecret, payload)
	if err != nil {
		return nil, NewInternal("HMAC failure: " + err.Error())
	}
	if !ConstantTimeEq([]byte(strings.TrimSpace(razorpaySignature)), []byte(expected)) {
		_, _ = execRows(ctx, state.DB, "UPDATE coin_orders SET status = 'FAILED', updated_at = now() WHERE razorpay_order_id = $1 AND status = 'CREATED'", razorpayOrderID)
		return nil, NewUnauthorized("Invalid Razorpay payment signature")
	}
	return settleOrder(ctx, state, orderRow, razorpayPaymentID, "wallet")
}
