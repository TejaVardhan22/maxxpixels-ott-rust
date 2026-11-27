package auth

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/maxxpixels/go-api/pkg/httpx"
)

type ctxKey string

const claimsCtxKey ctxKey = "maxx_jwt_claims"

// Claims matches Rust's JWT claims structure so tokens minted by Rust or Go are 100% interchangeable.
type Claims struct {
	Sub       string   `json:"sub"`
	UserID    int64    `json:"userId,omitempty"`
	Email     string   `json:"email,omitempty"`
	Phone     string   `json:"phone,omitempty"`
	Roles     []string `json:"roles,omitempty"`
	TokenType string   `json:"tokenType,omitempty"`
	jwt.RegisteredClaims
}

func (c *Claims) ParsedUserID() (int64, error) {
	if c.UserID > 0 {
		return c.UserID, nil
	}
	return strconv.ParseInt(c.Sub, 10, 64)
}

func (c *Claims) IsAdmin() bool {
	for _, r := range c.Roles {
		up := strings.ToUpper(strings.TrimSpace(r))
		if up == "ADMIN" || up == "ROLE_ADMIN" || up == "SUPER_ADMIN" || up == "ROLE_SUPER_ADMIN" {
			return true
		}
	}
	return false
}

type TokenManager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewTokenManager(secret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		secret:     []byte(secret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (tm *TokenManager) SignAccessToken(userID int64, email, phone string, roles []string) (string, error) {
	now := time.Now().UTC()
	claims := Claims{
		Sub:       strconv.FormatInt(userID, 10),
		UserID:    userID,
		Email:     email,
		Phone:     phone,
		Roles:     roles,
		TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(tm.accessTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(tm.secret)
}

func (tm *TokenManager) SignRefreshToken(userID int64) (string, time.Time, error) {
	now := time.Now().UTC()
	exp := now.Add(tm.refreshTTL)
	claims := Claims{
		Sub:       strconv.FormatInt(userID, 10),
		UserID:    userID,
		TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.FormatInt(userID, 10),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(tm.secret)
	return tok, exp, err
}

func (tm *TokenManager) Parse(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return tm.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Sub == "" {
		claims.Sub = claims.Subject
	}
	return claims, nil
}

func FromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(claimsCtxKey).(*Claims)
	return c, ok && c != nil
}

func extractBearer(r *http.Request) string {
	authz := strings.TrimSpace(r.Header.Get("Authorization"))
	if len(authz) > 7 && strings.EqualFold(authz[:7], "Bearer ") {
		return strings.TrimSpace(authz[7:])
	}
	return ""
}

func (tm *TokenManager) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw := extractBearer(r)
		if raw == "" {
			httpx.Error(w, http.StatusUnauthorized, "Missing Authorization header", "UNAUTHORIZED")
			return
		}
		claims, err := tm.Parse(raw)
		if err != nil {
			httpx.Error(w, http.StatusUnauthorized, "Invalid or expired token", "UNAUTHORIZED")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), claimsCtxKey, claims)))
	})
}

func (tm *TokenManager) OptionalAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if raw := extractBearer(r); raw != "" {
			if claims, err := tm.Parse(raw); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), claimsCtxKey, claims))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := FromContext(r.Context())
		if !ok || !claims.IsAdmin() {
			httpx.Error(w, http.StatusForbidden, "Admin access required", "FORBIDDEN")
			return
		}
		next.ServeHTTP(w, r)
	})
}
