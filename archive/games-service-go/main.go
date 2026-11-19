package main

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if i := strings.Index(line, "="); i >= 0 {
			k := strings.TrimSpace(line[:i])
			v := strings.TrimSpace(line[i+1:])
			v = strings.Trim(v, "\"'")
			if k != "" && os.Getenv(k) == "" {
				_ = os.Setenv(k, v)
			}
		}
	}
}

func corsMiddleware(allowed []string, next http.Handler) http.Handler {
	allowAll := false
	set := map[string]bool{}
	for _, o := range allowed {
		if o == "*" {
			allowAll = true
		}
		set[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (allowAll || set[origin]) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With, x-pff-tenant, x-pff-secret, x-playforfun-signature, x-razorpay-signature")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func register(mux *http.ServeMux, method, path string, h http.HandlerFunc) {
	mux.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != method {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		h(w, r)
	})
}

func main() {
	loadDotEnv(".env")
	cfg := ConfigFromEnv()
	if strings.TrimSpace(cfg.GamesDatabaseURL) == "" {
		log.Fatal("GAMES_DATABASE_URL (or DATABASE_URL) is required")
	}
	ctx := context.Background()
	db, err := ConnectDB(ctx, cfg.GamesDatabaseURL, cfg.Env)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()
	if err := RunMigrations(ctx, db); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	log.Println("Games database schema ensured (players, ledger, recharges, sessions, stats, coin_orders)")

	state := NewState(db, cfg)
	mux := http.NewServeMux()

	// Launch (auth required)
	for _, p := range []string{
		"/api/v1/games/playforfun/launch",
		"/api/games/playforfun/launch",
		"/games/playforfun/launch",
		"/api/v1/games/play-for-fun/launch",
		"/api/v1/games/launch",
	} {
		register(mux, http.MethodGet, p, requireAuth(launchHandler))
	}
	// Me (auth required)
	for _, p := range []string{
		"/api/v1/games/playforfun/me",
		"/api/games/playforfun/me",
		"/games/playforfun/me",
	} {
		register(mux, http.MethodGet, p, requireAuth(meHandler))
	}
	// PlayforFun webhook
	for _, p := range []string{
		"/api/v1/games/playforfun/webhook",
		"/api/games/playforfun/webhook",
		"/games/playforfun/webhook",
		"/api/v1/games/play-for-fun/webhook",
	} {
		register(mux, http.MethodPost, p, webhookHandler)
	}
	// Coin packs (auth)
	for _, p := range []string{
		"/api/v1/games/coins/packs",
		"/api/games/coins/packs",
		"/games/coins/packs",
	} {
		register(mux, http.MethodGet, p, requireAuth(coinPacksHandler))
	}
	// Coin order (auth)
	for _, p := range []string{
		"/api/v1/games/coins/order",
		"/api/games/coins/order",
		"/games/coins/order",
	} {
		register(mux, http.MethodPost, p, requireAuth(coinOrderHandler))
	}
	// Coin verify (auth)
	for _, p := range []string{
		"/api/v1/games/coins/verify",
		"/api/games/coins/verify",
		"/games/coins/verify",
	} {
		register(mux, http.MethodPost, p, requireAuth(coinVerifyHandler))
	}
	// Coin webhook
	for _, p := range []string{
		"/api/v1/games/coins/webhook",
		"/api/games/coins/webhook",
		"/games/coins/webhook",
	} {
		register(mux, http.MethodPost, p, coinWebhookHandler)
	}
	// Subscription grant (auth)
	for _, p := range []string{
		"/api/v1/games/coins/subscription-grant",
		"/api/games/coins/subscription-grant",
		"/games/coins/subscription-grant",
	} {
		register(mux, http.MethodPost, p, requireAuth(subscriptionGrantHandler))
	}
	// Wallet S2S
	for _, p := range []string{"/api/v1/games/wallet", "/api/games/wallet", "/games/wallet"} {
		register(mux, http.MethodGet, p, walletHandler)
	}
	for _, p := range []string{"/api/v1/games/wallet/order", "/api/games/wallet/order", "/games/wallet/order"} {
		register(mux, http.MethodPost, p, walletOrderHandler)
	}
	for _, p := range []string{"/api/v1/games/wallet/verify", "/api/games/wallet/verify", "/games/wallet/verify"} {
		register(mux, http.MethodPost, p, walletVerifyHandler)
	}
	// Health
	register(mux, http.MethodGet, "/healthz", healthHandler)
	register(mux, http.MethodGet, "/health", healthHandler)

	handler := corsMiddleware(cfg.AllowlistOrigins(), withState(state, mux))
	addr := fmt.Sprintf("0.0.0.0:%d", cfg.Port)
	srv := &http.Server{Addr: addr, Handler: handler}

	go func() {
		log.Printf("maxx-games-service (go) listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctxShutdown)
}
