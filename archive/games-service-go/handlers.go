package main

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

type ctxKey string

const (
	ctxClaimsKey ctxKey = "claims"
	ctxBearerKey ctxKey = "bearer"
)

func bearerToken(r *http.Request) (string, error) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return "", NewUnauthorized("Missing Authorization header")
	}
	t := strings.TrimSpace(h)
	if strings.HasPrefix(strings.ToLower(t), "bearer ") {
		t = strings.TrimSpace(t[7:])
	}
	if t == "" {
		return "", NewUnauthorized("Empty bearer token")
	}
	return t, nil
}

func requireAuth(next func(http.ResponseWriter, *http.Request)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := bearerToken(r)
		if err != nil {
			writeAppError(w, err)
			return
		}
		claims, err := ValidateJWT(token, getState(r).Config.JWTSecret)
		if err != nil {
			writeAppError(w, NewUnauthorized("Invalid or expired token: "+err.Error()))
			return
		}
		ctx := context.WithValue(r.Context(), ctxClaimsKey, claims)
		ctx = context.WithValue(ctx, ctxBearerKey, token)
		next(w, r.WithContext(ctx))
	}
}

func getClaims(r *http.Request) *Claims {
	c, _ := r.Context().Value(ctxClaimsKey).(*Claims)
	return c
}
func getBearer(r *http.Request) string {
	b, _ := r.Context().Value(ctxBearerKey).(string)
	return b
}

func stateKey() ctxKey { return "state" }

func withState(state *AppState, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := context.WithValue(r.Context(), stateKey(), state)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
func getState(r *http.Request) *AppState {
	s, _ := r.Context().Value(stateKey()).(*AppState)
	return s
}

func launchHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	claims := getClaims(r)
	bearer := getBearer(r)
	if claims == nil || strings.TrimSpace(claims.Sub) == "" {
		writeAppError(w, NewUnauthorized("Authenticated login user is required to launch games"))
		return
	}
	player, err := resolvePlayer(r.Context(), state, bearer)
	if err != nil {
		writeAppError(w, err)
		return
	}
	var gameParam *string
	if g := strings.TrimSpace(r.URL.Query().Get("game")); g != "" {
		gameParam = &g
	}
	result, err := buildLaunchURL(state, player, gameParam)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Games launch URL generated", 200)
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	claims := getClaims(r)
	bearer := getBearer(r)
	if claims == nil || strings.TrimSpace(claims.Sub) == "" {
		writeAppError(w, NewUnauthorized("Authenticated login user is required"))
		return
	}
	player, err := resolvePlayer(r.Context(), state, bearer)
	if err != nil {
		writeAppError(w, err)
		return
	}
	result, err := playerSnapshot(r.Context(), state, player)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Gamer record loaded", 200)
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	sig := r.Header.Get("x-playforfun-signature")
	var sigPtr *string
	if sig != "" {
		sigPtr = &sig
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeAppError(w, NewBadRequest("failed reading body"))
		return
	}
	result, err := handlePlayforfunWebhook(r.Context(), state, string(body), sigPtr)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Webhook processed", 200)
}

func coinPacksHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	writeSuccess(w, coinPacksPayload(state), "Coin packs loaded", 200)
}

func decodeJSONBody(r *http.Request, dst any) error {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(b))) == 0 {
		return nil
	}
	return json.Unmarshal(b, dst)
}

func decodeCoinsVerify(r *http.Request) (CoinsVerifyRequest, error) {
	b, err := io.ReadAll(r.Body)
	if err != nil {
		return CoinsVerifyRequest{}, err
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return CoinsVerifyRequest{}, err
	}
	getS := func(keys ...string) string {
		for _, k := range keys {
			if v, ok := m[k]; ok {
				if s, ok := v.(string); ok {
					return s
				}
			}
		}
		return ""
	}
	return CoinsVerifyRequest{
		RazorpayOrderID:   getS("razorpayOrderId", "razorpay_order_id"),
		RazorpayPaymentID: getS("razorpayPaymentId", "razorpay_payment_id"),
		RazorpaySignature: getS("razorpaySignature", "razorpay_signature"),
	}, nil
}

func coinOrderHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	claims := getClaims(r)
	bearer := getBearer(r)
	if claims == nil || strings.TrimSpace(claims.Sub) == "" {
		writeAppError(w, NewUnauthorized("Authenticated login user is required"))
		return
	}
	var req CoinsOrderRequest
	// flexible decode
	b, _ := io.ReadAll(r.Body)
	_ = json.Unmarshal(b, &req)
	packID := req.GetPackID()
	result, err := createCoinOrder(r.Context(), state, bearer, packID)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Coin recharge order created", 200)
}

func coinVerifyHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	claims := getClaims(r)
	bearer := getBearer(r)
	if claims == nil || strings.TrimSpace(claims.Sub) == "" {
		writeAppError(w, NewUnauthorized("Authenticated login user is required"))
		return
	}
	req, err := decodeCoinsVerify(r)
	if err != nil {
		writeAppError(w, NewBadRequest("invalid request body"))
		return
	}
	result, err := verifyCoinPayment(r.Context(), state, bearer, req)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Coin recharge processed", 200)
}

func coinWebhookHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	sig := r.Header.Get("x-razorpay-signature")
	var sigPtr *string
	if sig != "" {
		sigPtr = &sig
	}
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeAppError(w, NewBadRequest("failed reading body"))
		return
	}
	result, err := handleRazorpayWebhook(r.Context(), state, string(body), sigPtr)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Razorpay webhook processed", 200)
}

func subscriptionGrantHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	claims := getClaims(r)
	bearer := getBearer(r)
	if claims == nil || strings.TrimSpace(claims.Sub) == "" {
		writeAppError(w, NewUnauthorized("Authenticated login user is required"))
		return
	}
	b, _ := io.ReadAll(r.Body)
	var req SubscriptionGrantRequest
	_ = json.Unmarshal(b, &req)
	result, err := grantSubscription(r.Context(), state, bearer, req)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Subscription coins granted", 200)
}

func walletHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	tenant := r.Header.Get("x-pff-tenant")
	secret := r.Header.Get("x-pff-secret")
	if err := verifyWalletS2S(state, tenant, secret); err != nil {
		writeAppError(w, err)
		return
	}
	q := r.URL.Query()
	identifier := ""
	for _, k := range []string{"userId", "user", "uid", "gamer_uid", "gamerUid", "playerId", "player_id", "name"} {
		if v := strings.TrimSpace(q.Get(k)); v != "" {
			identifier = v
			break
		}
	}
	result, err := walletPayload(r.Context(), state, identifier)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Wallet loaded", 200)
}

func walletOrderHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	tenant := r.Header.Get("x-pff-tenant")
	secret := r.Header.Get("x-pff-secret")
	if err := verifyWalletS2S(state, tenant, secret); err != nil {
		writeAppError(w, err)
		return
	}
	b, _ := io.ReadAll(r.Body)
	var req WalletOrderRequest
	_ = json.Unmarshal(b, &req)
	// also support snake_case via generic map
	var m map[string]any
	_ = json.Unmarshal(b, &m)
	userID := req.GetUserID()
	if userID == "" {
		for _, k := range []string{"user_id", "player_id"} {
			if v, ok := m[k].(string); ok && strings.TrimSpace(v) != "" {
				userID = v
				break
			}
		}
	}
	packID := req.GetPackID()
	result, err := walletOrder(r.Context(), state, userID, packID)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Coin recharge order created", 200)
}

func decodeWalletVerify(r *http.Request) (string, string, string, string) {
	b, _ := io.ReadAll(r.Body)
	var req WalletVerifyRequest
	_ = json.Unmarshal(b, &req)
	var m map[string]any
	_ = json.Unmarshal(b, &m)
	userID := req.GetUserID()
	if userID == "" {
		for _, k := range []string{"user_id", "player_id"} {
			if v, ok := m[k].(string); ok {
				userID = v
			}
		}
	}
	orderID := req.RazorpayOrderID
	if orderID == "" {
		if v, ok := m["razorpay_order_id"].(string); ok {
			orderID = v
		}
	}
	paymentID := req.RazorpayPaymentID
	if paymentID == "" {
		if v, ok := m["razorpay_payment_id"].(string); ok {
			paymentID = v
		}
	}
	sig := req.RazorpaySignature
	if sig == "" {
		if v, ok := m["razorpay_signature"].(string); ok {
			sig = v
		}
	}
	return userID, orderID, paymentID, sig
}

func walletVerifyHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	tenant := r.Header.Get("x-pff-tenant")
	secret := r.Header.Get("x-pff-secret")
	if err := verifyWalletS2S(state, tenant, secret); err != nil {
		writeAppError(w, err)
		return
	}
	userID, orderID, paymentID, sig := decodeWalletVerify(r)
	result, err := walletVerify(r.Context(), state, userID, orderID, paymentID, sig)
	if err != nil {
		writeAppError(w, err)
		return
	}
	writeSuccess(w, result, "Coin recharge processed", 200)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	state := getState(r)
	dbOK := state.DB.Ping(r.Context()) == nil
	statusStr := "UP"
	httpStatus := http.StatusOK
	gamesDB := "UP"
	if !dbOK {
		statusStr = "DEGRADED"
		httpStatus = http.StatusServiceUnavailable
		gamesDB = "DOWN"
	}
	body := map[string]any{
		"status":               statusStr,
		"service":              "maxx-games-service",
		"gamesDb":              gamesDB,
		"playforfunConfigured": strings.TrimSpace(state.Config.PFFSecret) != "",
		"mainApiUrl":           state.Config.MainAPIURL,
	}
	writeJSON(w, httpStatus, body)
}
