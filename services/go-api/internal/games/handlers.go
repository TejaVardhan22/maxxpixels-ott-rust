package games

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

// Router constructs the HTTP router with 100% route parity with legacy services/games.
func (s *Service) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(httpx.RequestID)
	r.Use(httpx.CORSMiddleware(s.Config.CORSAllowedOrigins))
	r.Use(httpx.AccessLogger("games-service"))

	// Launch (auth required)
	for _, p := range []string{
		"/api/v1/games/playforfun/launch",
		"/api/games/playforfun/launch",
		"/games/playforfun/launch",
		"/api/v1/games/play-for-fun/launch",
		"/api/v1/games/launch",
	} {
		r.Get(p, s.handleLaunch)
	}

	// Gamer record (auth required)
	for _, p := range []string{
		"/api/v1/games/playforfun/me",
		"/api/games/playforfun/me",
		"/games/playforfun/me",
	} {
		r.Get(p, s.handleMe)
	}

	// PlayforFun Webhook (HMAC-verified)
	for _, p := range []string{
		"/api/v1/games/playforfun/webhook",
		"/api/games/playforfun/webhook",
		"/games/playforfun/webhook",
		"/api/v1/games/play-for-fun/webhook",
	} {
		r.Post(p, s.handleWebhook)
	}

	// Razorpay coin recharges
	for _, p := range []string{"/api/v1/games/coins/packs", "/api/games/coins/packs", "/games/coins/packs"} {
		r.Get(p, s.handleCoinPacks)
	}
	for _, p := range []string{"/api/v1/games/coins/order", "/api/games/coins/order", "/games/coins/order"} {
		r.Post(p, s.handleCoinOrder)
	}
	for _, p := range []string{"/api/v1/games/coins/verify", "/api/games/coins/verify", "/games/coins/verify"} {
		r.Post(p, s.handleCoinVerify)
	}
	for _, p := range []string{"/api/v1/games/coins/webhook", "/api/games/coins/webhook", "/games/coins/webhook"} {
		r.Post(p, s.handleCoinWebhook)
	}
	for _, p := range []string{"/api/v1/games/coins/subscription-grant", "/api/games/coins/subscription-grant", "/games/coins/subscription-grant"} {
		r.Post(p, s.handleSubscriptionGrant)
	}

	// Provider wallet API (server-to-server: x-pff-tenant / x-pff-secret)
	for _, p := range []string{"/api/v1/games/wallet", "/api/games/wallet", "/games/wallet"} {
		r.Get(p, s.handleWallet)
	}
	for _, p := range []string{"/api/v1/games/wallet/order", "/api/games/wallet/order", "/games/wallet/order"} {
		r.Post(p, s.handleWalletOrder)
	}
	for _, p := range []string{"/api/v1/games/wallet/verify", "/api/games/wallet/verify", "/games/wallet/verify"} {
		r.Post(p, s.handleWalletVerify)
	}

	// Health
	r.Get("/healthz", s.handleHealth)
	r.Get("/health", s.handleHealth)
	r.Get("/api/v1/games/health", s.handleHealth)

	return r
}

func writeErr(w http.ResponseWriter, err error) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		httpx.Error(w, appErr.Status, appErr.Message, appErr.Code)
		return
	}
	httpx.Error(w, http.StatusInternalServerError, err.Error(), "INTERNAL_ERROR")
}

func (s *Service) requireBearer(r *http.Request) (string, error) {
	authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
	if authHeader == "" {
		return "", errUnauthorized("Missing Authorization header")
	}
	token := authHeader
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		return "", errUnauthorized("Empty bearer token")
	}
	claims, err := s.Tokens.Parse(token)
	if err != nil {
		return "", errUnauthorized("Invalid or expired token: " + err.Error())
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return "", errUnauthorized("Authenticated login user is required")
	}
	return token, nil
}

func (s *Service) handleLaunch(w http.ResponseWriter, r *http.Request) {
	bearer, err := s.requireBearer(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	player, err := s.ResolvePlayer(r.Context(), bearer)
	if err != nil {
		writeErr(w, err)
		return
	}
	res, err := s.BuildLaunchURL(player, r.URL.Query().Get("game"))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Games launch URL generated")
}

func (s *Service) handleMe(w http.ResponseWriter, r *http.Request) {
	bearer, err := s.requireBearer(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	player, err := s.ResolvePlayer(r.Context(), bearer)
	if err != nil {
		writeErr(w, err)
		return
	}
	res, err := s.PlayerSnapshot(r.Context(), player)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Gamer record loaded")
}

func (s *Service) handleWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		writeErr(w, errBadRequest("Failed reading request body"))
		return
	}
	res, err := s.HandleWebhook(r.Context(), string(raw), r.Header.Get("x-playforfun-signature"))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Webhook processed")
}

func (s *Service) handleCoinPacks(w http.ResponseWriter, r *http.Request) {
	if _, err := s.requireBearer(r); err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, s.Packs(), "Coin packs loaded")
}

func (s *Service) handleCoinOrder(w http.ResponseWriter, r *http.Request) {
	bearer, err := s.requireBearer(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var req CoinsOrderRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		writeErr(w, errBadRequest("Invalid JSON body"))
		return
	}
	res, err := s.CreateOrder(r.Context(), bearer, req.ResolvedPackID())
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Coin recharge order created")
}

func (s *Service) handleCoinVerify(w http.ResponseWriter, r *http.Request) {
	bearer, err := s.requireBearer(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var req CoinsVerifyRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		writeErr(w, errBadRequest("Invalid JSON body"))
		return
	}
	res, err := s.VerifyPayment(r.Context(), bearer, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Coin recharge processed")
}

func (s *Service) handleCoinWebhook(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		writeErr(w, errBadRequest("Failed reading request body"))
		return
	}
	res, err := s.HandleCoinWebhook(r.Context(), string(raw), r.Header.Get("x-razorpay-signature"))
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Razorpay webhook processed")
}

func (s *Service) handleSubscriptionGrant(w http.ResponseWriter, r *http.Request) {
	bearer, err := s.requireBearer(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var req SubscriptionGrantRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		// Allow empty body for monthly claim
		req = SubscriptionGrantRequest{}
	}
	res, err := s.GrantSubscription(r.Context(), bearer, req)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Subscription coins granted")
}

func (s *Service) handleWallet(w http.ResponseWriter, r *http.Request) {
	if err := s.VerifyWalletS2S(r.Header.Get("x-pff-tenant"), r.Header.Get("x-pff-secret")); err != nil {
		writeErr(w, err)
		return
	}
	q := r.URL.Query()
	ident := ""
	for _, k := range []string{"userId", "user", "uid", "gamer_uid", "gamerUid", "playerId", "player_id", "name"} {
		if v := strings.TrimSpace(q.Get(k)); v != "" {
			ident = v
			break
		}
	}
	res, err := s.Wallet(r.Context(), ident)
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Wallet loaded")
}

func (s *Service) handleWalletOrder(w http.ResponseWriter, r *http.Request) {
	if err := s.VerifyWalletS2S(r.Header.Get("x-pff-tenant"), r.Header.Get("x-pff-secret")); err != nil {
		writeErr(w, err)
		return
	}
	var req WalletOrderRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		writeErr(w, errBadRequest("Invalid JSON body"))
		return
	}
	res, err := s.WalletOrder(r.Context(), req.ResolvedUserID(), req.ResolvedPackID())
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Coin recharge order created")
}

func (s *Service) handleWalletVerify(w http.ResponseWriter, r *http.Request) {
	if err := s.VerifyWalletS2S(r.Header.Get("x-pff-tenant"), r.Header.Get("x-pff-secret")); err != nil {
		writeErr(w, err)
		return
	}
	var req WalletVerifyRequest
	if err := httpx.DecodeJSON(r, &req); err != nil {
		writeErr(w, errBadRequest("Invalid JSON body"))
		return
	}
	res, err := s.WalletVerify(r.Context(), req.ResolvedUserID(), req.OrderID(), req.PaymentID(), req.Signature())
	if err != nil {
		writeErr(w, err)
		return
	}
	httpx.OK(w, res, "Coin recharge processed")
}

func (s *Service) handleHealth(w http.ResponseWriter, r *http.Request) {
	dbOK := false
	if s.DB != nil {
		var one int
		if err := s.DB.WithContext(r.Context()).Raw("SELECT 1").Scan(&one).Error; err == nil && one == 1 {
			dbOK = true
		}
	}
	status := http.StatusOK
	statusStr := "UP"
	dbStr := "UP"
	if !dbOK {
		status = http.StatusServiceUnavailable
		statusStr = "DEGRADED"
		dbStr = "DOWN"
	}
	httpx.WriteJSON(w, status, map[string]any{
		"status":               statusStr,
		"service":              "maxx-games-service",
		"engine":               "go-microservices",
		"gamesDb":              dbStr,
		"playforfunConfigured": s.Config.PFFSecret != "",
		"mainApiUrl":           s.Config.MainAPIURL,
	})
}
