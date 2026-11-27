package games

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBuildLaunchURLAndHMAC(t *testing.T) {
	cfg := Config{
		PFFTenant: "maxxpixels",
		PFFSecret: "super-secret-key",
		JWTSecret: "jwt-secret",
		CoinPacks: DefaultCoinPacks(),
	}
	svc := NewService(nil, cfg)

	uid := "MPXG1234567890"
	name := "Alice:Wonder"
	player := &Player{
		GamerUID:    &uid,
		UserID:      "42",
		ExternalID:  "mpx_42",
		Name:        &name,
		DisplayName: "maxpx_MPXG1234567890",
	}

	res, err := svc.BuildLaunchURL(player, "LUDO")
	if err != nil {
		t.Fatalf("BuildLaunchURL error: %v", err)
	}
	launchURL, _ := res["launchUrl"].(string)
	if !strings.HasPrefix(launchURL, "https://playforfun.in/play/ludo?") {
		t.Fatalf("unexpected launchUrl: %s", launchURL)
	}
	if res["displayName"] != "Alice Wonder" {
		t.Fatalf("expected colon stripped from displayName, got %v", res["displayName"])
	}
	if res["game"] != "ludo" {
		t.Fatalf("expected game=ludo, got %v", res["game"])
	}

	arenaRes, err := svc.BuildLaunchURL(player, "unknown-game")
	if err != nil {
		t.Fatalf("BuildLaunchURL arena error: %v", err)
	}
	if !strings.HasPrefix(arenaRes["launchUrl"].(string), "https://playforfun.in/arena?") {
		t.Fatalf("expected /arena fallback, got %v", arenaRes["launchUrl"])
	}
}

func TestExtractParticipants(t *testing.T) {
	payload := map[string]any{
		"matchId": "m_1",
		"game":    "carrom",
		"prize":   float64(200),
		"fee":     float64(50),
		"winner":  "MPXGAAAA",
		"loser":   "MPXGBBBB",
	}
	parts := extractParticipants(payload)
	if len(parts) != 2 {
		t.Fatalf("expected 2 participants, got %d", len(parts))
	}
	if parts[0].ID != "MPXGAAAA" || parts[0].Result != "WON" || parts[0].CoinsWon != 200 || parts[0].EntryFee != 50 {
		t.Fatalf("unexpected winner participant: %+v", parts[0])
	}
	if parts[1].ID != "MPXGBBBB" || parts[1].Result != "LOST" || parts[1].EntryFee != 50 {
		t.Fatalf("unexpected loser participant: %+v", parts[1])
	}
}

func TestWalletS2SAndPacksEndpoint(t *testing.T) {
	cfg := Config{
		PFFTenant:        "maxxpixels",
		PFFSecret:        "s2s-secret",
		JWTSecret:        "test-jwt-secret",
		RazorpayCurrency: "INR",
		RazorpayKeyID:    "rzp_test_123",
		CoinPacks:        DefaultCoinPacks(),
	}
	svc := NewService(nil, cfg)

	if err := svc.VerifyWalletS2S("maxxpixels", "s2s-secret"); err != nil {
		t.Fatalf("expected valid S2S credentials, got %v", err)
	}
	if err := svc.VerifyWalletS2S("maxxpixels", "wrong"); err == nil {
		t.Fatalf("expected error on wrong secret")
	}

	token, err := svc.Tokens.SignAccessToken(7, "gamer@test.com", "", []string{"ROLE_USER"})
	if err != nil {
		t.Fatalf("SignAccessToken: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/games/coins/packs", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	svc.Router().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var env map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &env); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if env["success"] != true {
		t.Fatalf("expected success=true, got %v", env)
	}
}

func TestParseValidUntil(t *testing.T) {
	if _, ok := parseValidUntil("2026-12-31T18:30:00.000Z"); !ok {
		t.Fatal("expected RFC3339Nano to parse")
	}
	if _, ok := parseValidUntil("2026-12-31"); !ok {
		t.Fatal("expected YYYY-MM-DD to parse")
	}
	if _, ok := parseValidUntil("not-a-date"); ok {
		t.Fatal("expected invalid date to fail")
	}
}
