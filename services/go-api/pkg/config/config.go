package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// AppConfig mirrors services/api/crates/core/src/config.rs 1:1 so existing .env files work unchanged.
type AppConfig struct {
	Env                string
	Host               string
	Port               int
	PublicBaseURL      string
	CORSAllowedOrigins []string

	// PostgreSQL (Primary + Optional Read Replica)
	DatabaseURL        string
	DatabaseReplicaURL string
	DBMaxConnections   int
	DBMinConnections   int
	DBConnectTimeout   time.Duration
	DBIdleTimeout      time.Duration

	// Redis
	RedisURL string

	// Kafka
	KafkaBrokers       []string
	KafkaClientID      string
	KafkaConsumerGroup string
	KafkaEnabled       bool

	// JWT & Security
	JWTSecret            string
	JWTExpiration        time.Duration
	JWTRefreshExpiration time.Duration

	// Bunny.net
	BunnyStreamLibraryID    string
	BunnyStreamAPIKey       string
	BunnyStreamCDNHostname  string
	BunnyStreamTokenAuthKey string
	BunnyStorageZoneName    string
	BunnyStorageZonePass    string
	BunnyPullZoneDomain     string

	// Razorpay
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string

	// SMS / OTP
	SMSProvider     string
	MSG91AuthKey    string
	MSG91TemplateID string

	// Rate Limiting (from .env)
	DisableRateLimit           bool
	RateLimitGeneralPerMinute  int64
	RateLimitAuthPerMinute     int64
	RateLimitPaymentPerMinute  int64

	// Microservice upstream URLs (used by api-gateway)
	IdentityServiceURL     string
	CatalogServiceURL      string
	StreamingServiceURL    string
	CommerceServiceURL     string
	MonetizationServiceURL string
	PlatformServiceURL     string
	GamesServiceURL        string
}

func Load(defaultPort int) (*AppConfig, error) {
	_ = godotenv.Load()
	_ = godotenv.Load("../api/.env")
	_ = godotenv.Load("../../.env")

	envMode := getEnv("GO_ENV", getEnv("RUST_ENV", "development"))
	host := getEnv("HOST", "0.0.0.0")
	port := getEnvInt("PORT", defaultPort)

	corsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4200,http://localhost:5173,http://localhost:8080")
	var origins []string
	for _, o := range strings.Split(corsRaw, ",") {
		if t := strings.TrimSpace(o); t != "" {
			origins = append(origins, t)
		}
	}

	dbURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))

	jwtSecret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if jwtSecret == "" && envMode != "test" {
		return nil, fmt.Errorf("JWT_SECRET environment variable is required (set it in .env)")
	}

	brokersRaw := getEnv("KAFKA_BROKERS", "kafka:9092")
	var brokers []string
	for _, b := range strings.Split(brokersRaw, ",") {
		if t := strings.TrimSpace(b); t != "" {
			brokers = append(brokers, t)
		}
	}

	return &AppConfig{
		Env:                envMode,
		Host:               host,
		Port:               port,
		PublicBaseURL:      getEnv("PUBLIC_BASE_URL", "https://api.maxxpixels.com"),
		CORSAllowedOrigins: origins,

		DatabaseURL:        dbURL,
		DatabaseReplicaURL: os.Getenv("DATABASE_REPLICA_URL"),
		DBMaxConnections:   getEnvInt("DATABASE_MAX_CONNECTIONS", 50),
		DBMinConnections:   getEnvInt("DATABASE_MIN_CONNECTIONS", 10),
		DBConnectTimeout:   time.Duration(getEnvInt("DATABASE_CONNECT_TIMEOUT_SEC", 10)) * time.Second,
		DBIdleTimeout:      time.Duration(getEnvInt("DATABASE_IDLE_TIMEOUT_SEC", 300)) * time.Second,

		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379/0"),

		KafkaBrokers:       brokers,
		KafkaClientID:      getEnv("KAFKA_CLIENT_ID", "maxxott-go-backend"),
		KafkaConsumerGroup: getEnv("KAFKA_CONSUMER_GROUP", "maxx-ott-group-go"),
		KafkaEnabled:       strings.EqualFold(getEnv("KAFKA_ENABLED", "false"), "true"),

		JWTSecret:            jwtSecret,
		JWTExpiration:        time.Duration(getEnvInt("JWT_EXPIRATION_SECONDS", 86400)) * time.Second,
		JWTRefreshExpiration: time.Duration(getEnvInt("JWT_REFRESH_EXPIRATION_SECONDS", 2592000)) * time.Second,

		BunnyStreamLibraryID:    os.Getenv("BUNNY_STREAM_LIBRARY_ID"),
		BunnyStreamAPIKey:       os.Getenv("BUNNY_STREAM_API_KEY"),
		BunnyStreamCDNHostname:  os.Getenv("BUNNY_STREAM_CDN_HOSTNAME"),
		BunnyStreamTokenAuthKey: os.Getenv("BUNNY_STREAM_TOKEN_AUTH_KEY"),
		BunnyStorageZoneName:    os.Getenv("BUNNY_STORAGE_ZONE_NAME"),
		BunnyStorageZonePass:    os.Getenv("BUNNY_STORAGE_ZONE_PASSWORD"),
		BunnyPullZoneDomain:     os.Getenv("BUNNY_PULL_ZONE_DOMAIN"),

		RazorpayKeyID:         os.Getenv("RAZORPAY_KEY_ID"),
		RazorpayKeySecret:     os.Getenv("RAZORPAY_KEY_SECRET"),
		RazorpayWebhookSecret: os.Getenv("RAZORPAY_WEBHOOK_SECRET"),

		SMSProvider:     getEnv("SMS_PROVIDER", "MSG91"),
		MSG91AuthKey:    os.Getenv("MSG91_AUTH_KEY"),
		MSG91TemplateID: os.Getenv("MSG91_TEMPLATE_ID"),

		DisableRateLimit:          strings.EqualFold(getEnv("DISABLE_RATE_LIMIT", "false"), "true"),
		RateLimitGeneralPerMinute: int64(getEnvInt("RATE_LIMIT_GENERAL_PER_MINUTE", 600)),
		RateLimitAuthPerMinute:    int64(getEnvInt("RATE_LIMIT_AUTH_PER_MINUTE", 30)),
		RateLimitPaymentPerMinute: int64(getEnvInt("RATE_LIMIT_PAYMENT_PER_MINUTE", 30)),

		IdentityServiceURL:     getEnv("IDENTITY_SERVICE_URL", "http://localhost:8081"),
		CatalogServiceURL:      getEnv("CATALOG_SERVICE_URL", "http://localhost:8082"),
		StreamingServiceURL:    getEnv("STREAMING_SERVICE_URL", "http://localhost:8083"),
		CommerceServiceURL:     getEnv("COMMERCE_SERVICE_URL", "http://localhost:8084"),
		MonetizationServiceURL: getEnv("MONETIZATION_SERVICE_URL", "http://localhost:8085"),
		PlatformServiceURL:     getEnv("PLATFORM_SERVICE_URL", "http://localhost:8086"),
		GamesServiceURL:        getEnv("GAMES_SERVICE_URL", "http://localhost:8090"),
	}, nil
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
