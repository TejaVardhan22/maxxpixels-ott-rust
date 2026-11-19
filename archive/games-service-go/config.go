package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type CoinPack struct {
	ID        string  `json:"id"`
	Coins     int64   `json:"coins"`
	AmountINR float64 `json:"amountInr"`
	Label     string  `json:"label"`
}

func (p CoinPack) AmountPaise() int64 {
	return int64(p.AmountINR*100.0 + 0.5)
}

func defaultCoinPacks() []CoinPack {
	return []CoinPack{
		{ID: "starter", Coins: 100, AmountINR: 49.0, Label: "Starter Pack"},
		{ID: "bronze", Coins: 500, AmountINR: 199.0, Label: "Bronze Pack"},
		{ID: "silver", Coins: 1200, AmountINR: 399.0, Label: "Silver Pack"},
		{ID: "gold", Coins: 3000, AmountINR: 899.0, Label: "Gold Pack"},
		{ID: "vip", Coins: 7500, AmountINR: 1999.0, Label: "VIP Pack"},
	}
}

func loadCoinPacks() []CoinPack {
	raw := strings.TrimSpace(os.Getenv("COIN_PACKS"))
	if raw == "" {
		return defaultCoinPacks()
	}
	var packs []CoinPack
	if err := json.Unmarshal([]byte(raw), &packs); err != nil {
		fmt.Fprintf(os.Stderr, "COIN_PACKS env is invalid JSON (%v) — falling back to defaults\n", err)
		return defaultCoinPacks()
	}
	return packs
}

type GamesConfig struct {
	GamesDatabaseURL       string
	MainAPIURL             string
	JWTSecret              string
	PFFTenant              string
	PFFSecret              string
	Port                   int
	PlayerTTLSeconds       int64
	CORSAllowedOrigins     string
	RazorpayKeyID          string
	RazorpayKeySecret      string
	RazorpayWebhookSecret  string
	RazorpayCurrency       string
	CoinPacks              []CoinPack
	SubscriptionGrantCoins int64
	SubscriptionMonthly    int64
	Env                    string
}

func ConfigFromEnv() GamesConfig {
	port := 8090
	if v := strings.TrimSpace(os.Getenv("GAMES_SERVICE_PORT")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			port = n
		}
	}
	pffSecret := strings.TrimSpace(os.Getenv("PLAYFORFUN_SECRET"))
	if pffSecret == "" {
		pffSecret = strings.TrimSpace(os.Getenv("PFF_SECRET"))
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "maxxpixels_secret_key_change_in_production"
	}
	dbURL := os.Getenv("GAMES_DATABASE_URL")
	if dbURL == "" {
		dbURL = os.Getenv("DATABASE_URL")
	}
	mainAPI := strings.TrimSpace(os.Getenv("MAIN_API_URL"))
	if mainAPI == "" {
		mainAPI = "https://api.maxxpixels.com"
	}
	mainAPI = strings.TrimRight(mainAPI, "/")
	tenant := strings.TrimSpace(os.Getenv("PLAYFORFUN_TENANT_ID"))
	if tenant == "" {
		tenant = "maxxpixels"
	}
	ttl := int64(86400)
	if v := strings.TrimSpace(os.Getenv("PLAYER_TTL_SECONDS")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			ttl = n
		}
	}
	cors := os.Getenv("CORS_ALLOWED_ORIGINS")
	if cors == "" {
		cors = "http://localhost:3000"
	}
	currency := strings.ToUpper(strings.TrimSpace(os.Getenv("RAZORPAY_CURRENCY")))
	if currency == "" {
		currency = "INR"
	}
	subGrant := int64(1000)
	if v := strings.TrimSpace(os.Getenv("SUBSCRIPTION_GRANT_COINS")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			subGrant = n
		}
	}
	subMonthly := int64(100)
	if v := strings.TrimSpace(os.Getenv("SUBSCRIPTION_MONTHLY_COINS")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			subMonthly = n
		}
	}
	env := os.Getenv("NODE_ENV")
	if env == "" {
		env = "production"
	}
	return GamesConfig{
		GamesDatabaseURL:       dbURL,
		MainAPIURL:             mainAPI,
		JWTSecret:              jwtSecret,
		PFFTenant:              tenant,
		PFFSecret:              pffSecret,
		Port:                   port,
		PlayerTTLSeconds:       ttl,
		CORSAllowedOrigins:     cors,
		RazorpayKeyID:          strings.TrimSpace(os.Getenv("RAZORPAY_KEY_ID")),
		RazorpayKeySecret:      strings.TrimSpace(os.Getenv("RAZORPAY_KEY_SECRET")),
		RazorpayWebhookSecret:  strings.TrimSpace(os.Getenv("RAZORPAY_WEBHOOK_SECRET")),
		RazorpayCurrency:       currency,
		CoinPacks:              loadCoinPacks(),
		SubscriptionGrantCoins: subGrant,
		SubscriptionMonthly:    subMonthly,
		Env:                    env,
	}
}

func (c GamesConfig) AllowlistOrigins() []string {
	parts := strings.Split(c.CORSAllowedOrigins, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
