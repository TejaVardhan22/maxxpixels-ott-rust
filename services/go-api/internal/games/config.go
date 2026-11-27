package games

import (
	"encoding/json"
	"log/slog"
	"math"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// CoinPack represents a purchasable coin pack (default list or COIN_PACKS env override).
type CoinPack struct {
	ID        string  `json:"id"`
	Coins     int64   `json:"coins"`
	AmountINR float64 `json:"amountInr"`
	Label     string  `json:"label"`
}

func (p *CoinPack) UnmarshalJSON(data []byte) error {
	var raw struct {
		ID         string   `json:"id"`
		Coins      int64    `json:"coins"`
		AmountINR  *float64 `json:"amountInr"`
		AmountINR2 *float64 `json:"amount_inr"`
		Label      string   `json:"label"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	p.ID = raw.ID
	p.Coins = raw.Coins
	p.Label = raw.Label
	if raw.AmountINR != nil {
		p.AmountINR = *raw.AmountINR
	} else if raw.AmountINR2 != nil {
		p.AmountINR = *raw.AmountINR2
	}
	return nil
}

func (p CoinPack) AmountPaise() int64 {
	return int64(math.Round(p.AmountINR * 100.0))
}

func DefaultCoinPacks() []CoinPack {
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
		return DefaultCoinPacks()
	}
	var packs []CoinPack
	if err := json.Unmarshal([]byte(raw), &packs); err != nil || len(packs) == 0 {
		slog.Warn("COIN_PACKS env is invalid JSON — falling back to defaults", "err", err)
		return DefaultCoinPacks()
	}
	return packs
}

// Config mirrors services/games/src/config.rs 1:1.
type Config struct {
	GamesDatabaseURL         string
	MainAPIURL               string
	JWTSecret                string
	PFFTenant                string
	PFFSecret                string
	Host                     string
	Port                     int
	PlayerTTLSeconds         int64
	CORSAllowedOrigins       []string
	RazorpayKeyID            string
	RazorpayKeySecret        string
	RazorpayWebhookSecret    string
	RazorpayCurrency         string
	CoinPacks                []CoinPack
	SubscriptionGrantCoins   int64
	SubscriptionMonthlyCoins int64
	Env                      string
}

func LoadConfig() Config {
	_ = godotenv.Load()

	port := getEnvInt("GAMES_SERVICE_PORT", getEnvInt("PORT", 8090))

	pffSecret := strings.TrimSpace(os.Getenv("PLAYFORFUN_SECRET"))
	if pffSecret == "" {
		pffSecret = strings.TrimSpace(os.Getenv("PFF_SECRET"))
	}

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))

	dbURL := strings.TrimSpace(os.Getenv("GAMES_DATABASE_URL"))
	if dbURL == "" {
		dbURL = strings.TrimSpace(os.Getenv("DATABASE_URL"))
	}

	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:4200")
	var origins []string
	for _, o := range strings.Split(corsRaw, ",") {
		if t := strings.TrimSpace(o); t != "" {
			origins = append(origins, t)
		}
	}

	return Config{
		GamesDatabaseURL:         dbURL,
		MainAPIURL:               strings.TrimRight(getEnv("MAIN_API_URL", "https://api.maxxpixels.com"), "/"),
		JWTSecret:                jwtSecret,
		PFFTenant:                strings.TrimSpace(getEnv("PLAYFORFUN_TENANT_ID", "maxxpixels")),
		PFFSecret:                pffSecret,
		Host:                     getEnv("HOST", "0.0.0.0"),
		Port:                     port,
		PlayerTTLSeconds:         int64(getEnvInt("PLAYER_TTL_SECONDS", 86400)),
		CORSAllowedOrigins:       origins,
		RazorpayKeyID:            strings.TrimSpace(os.Getenv("RAZORPAY_KEY_ID")),
		RazorpayKeySecret:        strings.TrimSpace(os.Getenv("RAZORPAY_KEY_SECRET")),
		RazorpayWebhookSecret:    strings.TrimSpace(os.Getenv("RAZORPAY_WEBHOOK_SECRET")),
		RazorpayCurrency:         strings.ToUpper(strings.TrimSpace(getEnv("RAZORPAY_CURRENCY", "INR"))),
		CoinPacks:                loadCoinPacks(),
		SubscriptionGrantCoins:   int64(getEnvInt("SUBSCRIPTION_GRANT_COINS", 1000)),
		SubscriptionMonthlyCoins: int64(getEnvInt("SUBSCRIPTION_MONTHLY_COINS", 100)),
		Env:                      getEnv("GO_ENV", getEnv("NODE_ENV", "production")),
	}
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil {
			return parsed
		}
	}
	return fallback
}
