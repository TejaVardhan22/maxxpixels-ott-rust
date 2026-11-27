package games

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/maxxpixels/go-api/pkg/auth"
	"gorm.io/gorm"
)

const (
	PlayForFunBaseURL = "https://playforfun.in"
)

var allowedGames = map[string]bool{
	"ludo":    true,
	"carrom":  true,
	"snooker": true,
	"chess":   true,
}

// AppError mirrors services/games/src/error.rs HTTP status & error code mapping.
type AppError struct {
	Status  int
	Code    string
	Message string
}

func (e *AppError) Error() string {
	return e.Message
}

func errNotFound(msg string) *AppError {
	return &AppError{Status: http.StatusNotFound, Code: "NOT_FOUND", Message: msg}
}
func errBadRequest(msg string) *AppError {
	return &AppError{Status: http.StatusBadRequest, Code: "BAD_REQUEST", Message: msg}
}
func errUnauthorized(msg string) *AppError {
	return &AppError{Status: http.StatusUnauthorized, Code: "UNAUTHORIZED", Message: msg}
}
func errForbidden(msg string) *AppError {
	return &AppError{Status: http.StatusForbidden, Code: "FORBIDDEN", Message: msg}
}
func errDatabase(msg string) *AppError {
	return &AppError{Status: http.StatusInternalServerError, Code: "DATABASE_ERROR", Message: msg}
}
func errInternal(msg string) *AppError {
	return &AppError{Status: http.StatusInternalServerError, Code: "INTERNAL_ERROR", Message: msg}
}

// Player mirrors a row from `players` in maxxpixels_games.
type Player struct {
	ID           string  `json:"id,omitempty"`
	GamerUID     *string `json:"gamer_uid,omitempty"`
	UserID       string  `json:"user_id"`
	ExternalID   string  `json:"external_id"`
	Name         *string `json:"name,omitempty"`
	Email        *string `json:"email,omitempty"`
	MobileNumber *string `json:"mobile_number,omitempty"`
	Age          *int64  `json:"age,omitempty"`
	DisplayName  string  `json:"display_name"`
	Coins        int64   `json:"coins"`
}

// UserDetails pulled from the main OTT API (`GET /api/v1/auth/me`).
type UserDetails struct {
	UserID      string
	Email       *string
	FullName    *string
	PhoneNumber *string
}

type Service struct {
	DB     *gorm.DB
	HTTP   *http.Client
	Config Config
	Tokens *auth.TokenManager
}

func NewService(db *gorm.DB, cfg Config) *Service {
	return &Service{
		DB: db,
		HTTP: &http.Client{
			Timeout: 8 * time.Second,
		},
		Config: cfg,
		Tokens: auth.NewTokenManager(cfg.JWTSecret, 24*time.Hour, 30*24*time.Hour),
	}
}

// ComputeHMACSHA256 computes a lowercase hex HMAC-SHA256 digest.
func ComputeHMACSHA256(secret, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

func constantTimeEqual(a, b string) bool {
	return hmac.Equal([]byte(a), []byte(b))
}

// ---------------------------------------------------------------------------
// Small JSON helpers (PlayforFun payloads mix camelCase / snake_case)
// ---------------------------------------------------------------------------

func probeStr(obj map[string]any, keys ...string) string {
	if obj == nil {
		return ""
	}
	for _, k := range keys {
		if v, ok := obj[k]; ok && v != nil {
			if s, ok := v.(string); ok {
				s = strings.TrimSpace(s)
				if s != "" {
					return s
				}
			}
		}
	}
	return ""
}

func probeStrPtr(obj map[string]any, keys ...string) *string {
	s := probeStr(obj, keys...)
	if s == "" {
		return nil
	}
	return &s
}

func probeInt64(obj map[string]any, keys ...string) (int64, bool) {
	if obj == nil {
		return 0, false
	}
	for _, k := range keys {
		v, ok := obj[k]
		if !ok || v == nil {
			continue
		}
		switch t := v.(type) {
		case float64:
			return int64(t), true
		case int64:
			return t, true
		case int:
			return int64(t), true
		case json.Number:
			if i, err := t.Int64(); err == nil {
				return i, true
			}
			if f, err := t.Float64(); err == nil {
				return int64(f), true
			}
		case string:
			if i, err := strconv.ParseInt(strings.TrimSpace(t), 10, 64); err == nil {
				return i, true
			}
		}
	}
	return 0, false
}

func idFromValue(v any) string {
	switch t := v.(type) {
	case string:
		return strings.TrimSpace(t)
	case float64:
		return strconv.FormatInt(int64(t), 10)
	case int64:
		return strconv.FormatInt(t, 10)
	case json.Number:
		return t.String()
	case map[string]any:
		return probeStr(t, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id", "name", "displayName")
	default:
		return ""
	}
}

func normalizeResult(raw string) string {
	r := strings.ToLower(raw)
	switch {
	case strings.Contains(r, "won") || strings.Contains(r, "win") || strings.Contains(r, "1st") || r == "1":
		return "WON"
	case strings.Contains(r, "lost") || strings.Contains(r, "lose") || strings.Contains(r, "2nd") || r == "2":
		return "LOST"
	case strings.Contains(r, "draw") || strings.Contains(r, "tie"):
		return "DRAW"
	case strings.Contains(r, "exit") || strings.Contains(r, "quit") || strings.Contains(r, "left"):
		return "EXITED"
	default:
		return "PLAYED"
	}
}

type participant struct {
	ID       string
	Result   string
	CoinsWon int64
	EntryFee int64
	Score    *int64
	Rank     *int64
}

func extractParticipants(payload map[string]any) []participant {
	var out []participant

	for _, container := range []string{"players", "participants", "results"} {
		if items, ok := payload[container].([]any); ok {
			for _, item := range items {
				switch t := item.(type) {
				case string:
					if s := strings.TrimSpace(t); s != "" {
						out = append(out, participant{ID: s})
					}
				case map[string]any:
					if id := idFromValue(t); id != "" {
						p := participant{ID: id}
						if res := probeStr(t, "result", "status", "outcome"); res != "" {
							p.Result = normalizeResult(res)
						}
						if cw, ok := probeInt64(t, "coins_won", "coinsWon", "won", "reward", "prize", "coins"); ok {
							p.CoinsWon = cw
						}
						if ef, ok := probeInt64(t, "entry_fee", "entryFee", "fee"); ok {
							p.EntryFee = ef
						}
						if sc, ok := probeInt64(t, "score", "points"); ok {
							v := sc
							p.Score = &v
						}
						if rk, ok := probeInt64(t, "rank", "position"); ok {
							v := rk
							p.Rank = &v
						}
						out = append(out, p)
					}
				}
			}
			if len(out) > 0 {
				break
			}
		}
	}

	// Top-level winner (+ optional loser)
	if winnerID := idFromValue(payload["winner"]); winnerID != "" {
		found := false
		for i := range out {
			if out[i].ID == winnerID {
				if out[i].Result == "" {
					out[i].Result = "WON"
				}
				found = true
				break
			}
		}
		if !found {
			out = append(out, participant{ID: winnerID, Result: "WON"})
		}
	}
	if loserID := idFromValue(payload["loser"]); loserID != "" {
		found := false
		for i := range out {
			if out[i].ID == loserID {
				if out[i].Result == "" {
					out[i].Result = "LOST"
				}
				found = true
				break
			}
		}
		if !found {
			out = append(out, participant{ID: loserID, Result: "LOST"})
		}
	}

	prize, _ := probeInt64(payload, "prize", "coins_won", "coinsWon", "reward", "coins")
	fee, _ := probeInt64(payload, "entry_fee", "entryFee", "fee")
	for i := range out {
		if out[i].Result == "WON" && out[i].CoinsWon == 0 {
			out[i].CoinsWon = prize
		}
		if out[i].EntryFee == 0 {
			out[i].EntryFee = fee
		}
	}

	hasExplicit := false
	for _, p := range out {
		if p.Result != "" {
			hasExplicit = true
			break
		}
	}
	if !hasExplicit && len(out) > 1 {
		for i := range out {
			if i == 0 {
				out[i].Result = "WON"
			} else {
				out[i].Result = "LOST"
			}
		}
	}

	return out
}

// ---------------------------------------------------------------------------
// DB JSON helpers
// ---------------------------------------------------------------------------

func queryRowJSON(ctx context.Context, db *gorm.DB, query string, args ...any) (map[string]any, error) {
	var raw sql.NullString
	err := db.WithContext(ctx).Raw(query, args...).Row().Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, errDatabase(err.Error())
	}
	if !raw.Valid || raw.String == "" {
		return nil, nil
	}
	var out map[string]any
	if err := json.Unmarshal([]byte(raw.String), &out); err != nil {
		return nil, errInternal("invalid json row: " + err.Error())
	}
	return out, nil
}

func queryRawJSON(ctx context.Context, db *gorm.DB, query string, args ...any) (any, error) {
	var raw sql.NullString
	err := db.WithContext(ctx).Raw(query, args...).Row().Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, errDatabase(err.Error())
	}
	if !raw.Valid || raw.String == "" {
		return nil, nil
	}
	var out any
	if err := json.Unmarshal([]byte(raw.String), &out); err != nil {
		return nil, errInternal("invalid json value: " + err.Error())
	}
	return out, nil
}

func queryJSONRows(ctx context.Context, db *gorm.DB, query string, args ...any) ([]map[string]any, error) {
	rows, err := db.WithContext(ctx).Raw(query, args...).Rows()
	if err != nil {
		return nil, errDatabase(err.Error())
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var raw sql.NullString
		if err := rows.Scan(&raw); err != nil {
			continue
		}
		if raw.Valid && raw.String != "" {
			var m map[string]any
			if json.Unmarshal([]byte(raw.String), &m) == nil {
				out = append(out, m)
			}
		}
	}
	return out, nil
}

func mustJSON(v any) string {
	if v == nil {
		return "{}"
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "{}"
	}
	return string(b)
}

func firstID(obj map[string]any) string {
	for _, k := range []string{"id", "userId", "user_id"} {
		if v, ok := obj[k]; ok && v != nil {
			switch t := v.(type) {
			case string:
				return strings.Trim(strings.TrimSpace(t), `"`)
			case float64:
				return strconv.FormatInt(int64(t), 10)
			case int64:
				return strconv.FormatInt(t, 10)
			case json.Number:
				return t.String()
			}
		}
	}
	return ""
}

// ---------------------------------------------------------------------------
// Player resolution & sync from Main API
// ---------------------------------------------------------------------------

func (s *Service) fetchUserFromMainAPI(ctx context.Context, bearer string) (*UserDetails, error) {
	reqURL := s.Config.MainAPIURL + "/api/v1/auth/me"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, errInternal("failed building main API request: " + err.Error())
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	req.Header.Set("Accept", "application/json")

	resp, err := s.HTTP.Do(req)
	if err != nil {
		return nil, errInternal("Failed reaching main API for user details: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, errUnauthorized(fmt.Sprintf("Main API rejected the session for user details (HTTP %d)", resp.StatusCode))
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, errInternal("Invalid user details payload: " + err.Error())
	}

	profile := body
	if d, ok := body["data"].(map[string]any); ok {
		profile = d
	} else if r, ok := body["result"].(map[string]any); ok {
		profile = r
	}

	userID := firstID(profile)
	if userID == "" {
		return nil, errInternal("User details from main API did not include an id")
	}

	return &UserDetails{
		UserID:      userID,
		Email:       probeStrPtr(profile, "email"),
		FullName:    probeStrPtr(profile, "fullName", "full_name", "name", "userName"),
		PhoneNumber: probeStrPtr(profile, "phoneNumber", "phone_number", "mobileNumber", "mobile_number", "phone", "mobile"),
	}, nil
}

func newGamerUID() string {
	raw := strings.ReplaceAll(uuid.NewString(), "-", "")
	return "MPXG" + strings.ToUpper(raw[:10])
}

func normalizeDisplayName(gamerUID string) string {
	s := strings.TrimSpace(strings.ReplaceAll("maxpx_"+gamerUID, ":", " "))
	runes := []rune(s)
	if len(runes) > 30 {
		return string(runes[:30])
	}
	return s
}

func mapToPlayer(row map[string]any) (*Player, error) {
	b, err := json.Marshal(row)
	if err != nil {
		return nil, errInternal("failed encoding player row: " + err.Error())
	}
	var p Player
	if err := json.Unmarshal(b, &p); err != nil {
		return nil, errInternal("Stored player row invalid: " + err.Error())
	}
	if p.DisplayName == "" {
		p.DisplayName = "maxpx_player"
	}
	return &p, nil
}

func (s *Service) upsertPlayer(ctx context.Context, details *UserDetails) (*Player, error) {
	externalID := "mpx_" + details.UserID
	gamerUID := newGamerUID()
	displayName := normalizeDisplayName(gamerUID)
	playerUUID := uuid.NewString()

	const q = `
		INSERT INTO players (id, gamer_uid, user_id, external_id, name, email,
		                     mobile_number, display_name, last_synced_at, created_at, updated_at)
		VALUES (?::uuid, ?, ?, ?, ?, ?, ?, ?, now(), now(), now())
		ON CONFLICT (user_id) DO UPDATE
		   SET name           = COALESCE(EXCLUDED.name, players.name),
		       email          = COALESCE(EXCLUDED.email, players.email),
		       mobile_number  = COALESCE(EXCLUDED.mobile_number, players.mobile_number),
		       display_name   = 'maxpx_' || players.gamer_uid,
		       last_synced_at = now(),
		       updated_at     = now()
		RETURNING row_to_json(players) AS row
	`
	row, err := queryRowJSON(ctx, s.DB, q,
		playerUUID, gamerUID, details.UserID, externalID,
		details.FullName, details.Email, details.PhoneNumber, displayName,
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, errInternal("Player upsert returned no row")
	}
	return mapToPlayer(row)
}

// ResolvePlayer checks games DB cache first, then refreshes from Main API when stale/missing.
func (s *Service) ResolvePlayer(ctx context.Context, bearer string) (*Player, error) {
	claims, err := s.Tokens.Parse(bearer)
	if err != nil {
		return nil, errUnauthorized("Invalid or expired token: " + err.Error())
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return nil, errUnauthorized("Authenticated login user is required")
	}

	const q = `
		SELECT row_to_json(p) AS row FROM players p
		WHERE p.user_id = ?
		  AND p.last_synced_at > now() - make_interval(secs => ?::double precision)
	`
	row, err := queryRowJSON(ctx, s.DB, q, claims.Sub, float64(s.Config.PlayerTTLSeconds))
	if err != nil {
		return nil, err
	}
	if row != nil {
		if p, err := mapToPlayer(row); err == nil {
			return p, nil
		}
	}

	details, err := s.fetchUserFromMainAPI(ctx, bearer)
	if err != nil {
		return nil, err
	}
	player, err := s.upsertPlayer(ctx, details)
	if err != nil {
		return nil, err
	}
	player.UserID = claims.Sub
	return player, nil
}

// ---------------------------------------------------------------------------
// Signed PlayforFun launch URL
// ---------------------------------------------------------------------------

func (s *Service) BuildLaunchURL(player *Player, game string) (map[string]any, error) {
	if s.Config.PFFSecret == "" {
		return nil, errBadRequest("PlayforFun gaming is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service.")
	}

	exp := time.Now().UTC().Unix() + 600
	nonce := strings.ReplaceAll(uuid.NewString(), "-", "")[:16]

	gamerID := player.UserID
	if player.GamerUID != nil && strings.TrimSpace(*player.GamerUID) != "" {
		gamerID = strings.TrimSpace(*player.GamerUID)
	}

	displayName := player.DisplayName
	if player.Name != nil {
		cleaned := strings.TrimSpace(strings.ReplaceAll(*player.Name, ":", " "))
		if cleaned != "" {
			displayName = cleaned
		}
	}

	payload := fmt.Sprintf("%s:%s:%s:%d:%s", s.Config.PFFTenant, gamerID, displayName, exp, nonce)
	sig := ComputeHMACSHA256(s.Config.PFFSecret, payload)

	selectedGame := strings.ToLower(strings.TrimSpace(game))
	path := "/arena"
	if allowedGames[selectedGame] {
		path = "/play/" + selectedGame
	} else {
		selectedGame = ""
	}

	query := formURLEncoded([][2]string{
		{"tenant", s.Config.PFFTenant},
		{"user", gamerID},
		{"name", displayName},
		{"exp", strconv.FormatInt(exp, 10)},
		{"nonce", nonce},
		{"sig", sig},
	})

	launchURL := PlayForFunBaseURL + path + "?" + query
	expiresAt := time.Unix(exp, 0).UTC().Format(time.RFC3339)

	result := map[string]any{
		"launchUrl":   launchURL,
		"expiresAt":   expiresAt,
		"tenant":      s.Config.PFFTenant,
		"userId":      gamerID,
		"externalId":  player.ExternalID,
		"gamerUid":    player.GamerUID,
		"displayName": displayName,
	}
	if selectedGame != "" {
		result["game"] = selectedGame
	}
	return result, nil
}

func formURLEncoded(pairs [][2]string) string {
	parts := make([]string, 0, len(pairs))
	for _, p := range pairs {
		parts = append(parts, encodeComponent(p[0])+"="+encodeComponent(p[1]))
	}
	return strings.Join(parts, "&")
}

func encodeComponent(input string) string {
	var b strings.Builder
	for i := 0; i < len(input); i++ {
		c := input[i]
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~' {
			b.WriteByte(c)
		} else {
			fmt.Fprintf(&b, "%%%02X", c)
		}
	}
	return b.String()
}

// ---------------------------------------------------------------------------
// Player lookup by any identifier
// ---------------------------------------------------------------------------

func findPlayerAny(ctx context.Context, db *gorm.DB, identifier string) (map[string]any, error) {
	if identifier == "" {
		return nil, nil
	}
	uidCandidate := strings.TrimPrefix(identifier, "maxpx_")
	uidExtra := ""
	if uidCandidate != identifier {
		uidExtra = uidCandidate
	}
	const q = `
		SELECT row_to_json(p) AS row FROM players p
		WHERE p.external_id = ? OR p.user_id = ? OR p.gamer_uid = ?
		   OR p.display_name = ?
		   OR (? <> '' AND p.name = ?)
		   OR (? <> '' AND p.gamer_uid = ?)
		LIMIT 1
	`
	trimmed := strings.TrimSpace(identifier)
	return queryRowJSON(ctx, db, q, identifier, identifier, identifier, identifier, trimmed, trimmed, uidExtra, uidExtra)
}

func playerIDFrom(row map[string]any) string {
	if row == nil {
		return ""
	}
	s := probeStr(row, "id")
	if _, err := uuid.Parse(s); err != nil {
		return ""
	}
	return s
}

// ---------------------------------------------------------------------------
// Coin ledger — every movement goes through adjustCoins
// ---------------------------------------------------------------------------

func adjustCoins(
	ctx context.Context,
	tx *gorm.DB,
	playerID string,
	txnType string,
	amount int64,
	game *string,
	matchID *string,
	reference *string,
	payload any,
) (*int64, error) {
	if amount == 0 {
		return nil, nil
	}

	if reference != nil && *reference != "" {
		var existingID int64
		err := tx.WithContext(ctx).Raw("SELECT id FROM coin_transactions WHERE reference = ? LIMIT 1", *reference).Row().Scan(&existingID)
		if err == nil && existingID > 0 {
			slog.Info("Skipped coin txn: reference already in ledger", "txnType", txnType, "reference", *reference)
			return nil, nil
		}
	}

	row, err := queryRowJSON(ctx, tx, "SELECT row_to_json(p) AS row FROM players p WHERE p.id = ?::uuid FOR UPDATE", playerID)
	if err != nil {
		return nil, err
	}
	current, _ := probeInt64(row, "coins")

	if amount < 0 && current < -amount {
		slog.Warn("Skipped coin debit: insufficient balance", "txnType", txnType, "amount", amount, "playerId", playerID, "current", current)
		return nil, nil
	}

	var balanceAfter int64
	const updateQ = `
		UPDATE players SET
			coins                 = coins + ?::bigint,
			total_coins_won       = total_coins_won       + CASE WHEN ? = 'WIN'       THEN ?::bigint ELSE 0 END,
			total_coins_recharged = total_coins_recharged + CASE WHEN ? = 'RECHARGE'  THEN ?::bigint ELSE 0 END,
			total_coins_spent     = total_coins_spent     + CASE WHEN ? = 'ENTRY_FEE' THEN -(?::bigint) ELSE 0 END,
			updated_at            = now()
		WHERE id = ?::uuid
		RETURNING coins AS balance
	`
	if err := tx.WithContext(ctx).Raw(updateQ, amount, txnType, amount, txnType, amount, txnType, amount, playerID).Row().Scan(&balanceAfter); err != nil {
		return nil, errDatabase("Coin update returned no row: " + err.Error())
	}

	const insertQ = `
		INSERT INTO coin_transactions (player_id, txn_type, amount, balance_after,
		                               game, match_id, reference, payload)
		VALUES (?::uuid, ?, ?::bigint, ?::bigint, ?, ?, ?, ?::jsonb)
		ON CONFLICT (reference) DO NOTHING
	`
	if err := tx.WithContext(ctx).Exec(insertQ, playerID, txnType, amount, balanceAfter, game, matchID, reference, mustJSON(payload)).Error; err != nil {
		return nil, errDatabase(err.Error())
	}

	slog.Info("Coins adjusted", "txnType", txnType, "amount", amount, "playerId", playerID, "balanceAfter", balanceAfter)
	return &balanceAfter, nil
}

// ---------------------------------------------------------------------------
// Match sessions + per-game stats
// ---------------------------------------------------------------------------

func recordSession(
	ctx context.Context,
	tx *gorm.DB,
	playerID, matchID, game, result string,
	coinsWon, entryFee int64,
	score, rank, balanceAfter *int64,
	playedAt string,
	payload any,
) error {
	const sessQ = `
		INSERT INTO game_sessions (player_id, match_id, game, result, coins_won, entry_fee,
		                           score, rank, coins_balance_after, played_at, payload)
		VALUES (?::uuid, ?, ?, ?, ?::bigint, ?::bigint, ?::bigint, ?::bigint, ?::bigint,
		        COALESCE(NULLIF(?, '')::timestamptz, now()), ?::jsonb)
		ON CONFLICT (match_id, player_id) DO UPDATE
		   SET result              = EXCLUDED.result,
		       coins_won           = EXCLUDED.coins_won,
		       entry_fee           = EXCLUDED.entry_fee,
		       score               = EXCLUDED.score,
		       rank                = EXCLUDED.rank,
		       coins_balance_after = EXCLUDED.coins_balance_after,
		       payload             = EXCLUDED.payload,
		       played_at           = EXCLUDED.played_at
	`
	if err := tx.WithContext(ctx).Exec(sessQ, playerID, matchID, game, result, coinsWon, entryFee, score, rank, balanceAfter, playedAt, mustJSON(payload)).Error; err != nil {
		return errDatabase(err.Error())
	}

	var dWon, dLost, dDraw int64
	switch result {
	case "WON":
		dWon = 1
	case "LOST":
		dLost = 1
	case "DRAW":
		dDraw = 1
	}
	dSpent := int64(0)
	if entryFee > 0 {
		dSpent = entryFee
	}

	const statsQ = `
		INSERT INTO game_stats (player_id, game, matches_played, wins, losses, draws,
		                        coins_won, coins_spent, best_coins_won, last_played_at)
		VALUES (?::uuid, ?, 1, ?::bigint, ?::bigint, ?::bigint, ?::bigint, ?::bigint, ?::bigint,
		        COALESCE(NULLIF(?, '')::timestamptz, now()))
		ON CONFLICT (player_id, game) DO UPDATE
		   SET matches_played = game_stats.matches_played + 1,
		       wins           = game_stats.wins   + EXCLUDED.wins,
		       losses         = game_stats.losses + EXCLUDED.losses,
		       draws          = game_stats.draws  + EXCLUDED.draws,
		       coins_won      = game_stats.coins_won  + EXCLUDED.coins_won,
		       coins_spent    = game_stats.coins_spent + EXCLUDED.coins_spent,
		       best_coins_won = GREATEST(game_stats.best_coins_won, EXCLUDED.best_coins_won),
		       last_played_at = EXCLUDED.last_played_at,
		       updated_at     = now()
	`
	if err := tx.WithContext(ctx).Exec(statsQ, playerID, game, dWon, dLost, dDraw, coinsWon, dSpent, coinsWon, playedAt).Error; err != nil {
		return errDatabase(err.Error())
	}

	const playerQ = `
		UPDATE players SET
			matches_played = matches_played + 1,
			matches_won    = matches_won    + ?::bigint,
			matches_lost   = matches_lost   + ?::bigint,
			last_game      = ?,
			last_played_at = COALESCE(NULLIF(?, '')::timestamptz, now()),
			updated_at     = now()
		WHERE id = ?::uuid
	`
	if err := tx.WithContext(ctx).Exec(playerQ, dWon, dLost, game, playedAt, playerID).Error; err != nil {
		return errDatabase(err.Error())
	}
	return nil
}

// ---------------------------------------------------------------------------
// PlayforFun Webhook
// ---------------------------------------------------------------------------

func (s *Service) HandleWebhook(ctx context.Context, rawBody, signature string) (map[string]any, error) {
	if s.Config.PFFSecret == "" {
		return nil, errBadRequest("PlayforFun webhook secret is not configured")
	}
	if strings.TrimSpace(signature) == "" {
		return nil, errUnauthorized("Missing x-playforfun-signature header")
	}

	expected := ComputeHMACSHA256(s.Config.PFFSecret, rawBody)
	if !constantTimeEqual(strings.TrimSpace(signature), expected) {
		slog.Warn("Rejected PlayforFun webhook with invalid signature")
		return nil, errUnauthorized("Invalid PlayforFun webhook signature")
	}

	var payload map[string]any
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return nil, errBadRequest("Webhook body is not valid JSON")
	}

	event := probeStr(payload, "event", "type", "action")
	if event == "" {
		event = "unknown"
	}
	eventLC := strings.ToLower(event)

	var (
		outcome map[string]any
		err     error
	)
	switch {
	case strings.Contains(eventLC, "recharge") || strings.Contains(eventLC, "deposit") || strings.Contains(eventLC, "topup"):
		outcome, err = s.processRecharge(ctx, event, payload)
	case strings.Contains(eventLC, "coin") || strings.Contains(eventLC, "wallet") || strings.Contains(eventLC, "transaction"):
		outcome, err = s.processCoinEvent(ctx, event, payload)
	case strings.Contains(eventLC, "register") && strings.Contains(eventLC, "player"):
		outcome, err = s.processPlayerRegistered(ctx, event, payload)
	case strings.Contains(eventLC, "match") || strings.Contains(eventLC, "game") || strings.Contains(eventLC, "result") ||
		strings.Contains(eventLC, "round") || payload["match_id"] != nil || payload["matchId"] != nil:
		outcome, err = s.processMatchEvent(ctx, event, payload)
	default:
		if err = s.archiveMatch(ctx, event, payload, nil, nil); err == nil {
			outcome = map[string]any{"received": true, "event": event, "processed": "archived"}
		}
	}
	if err != nil {
		return nil, err
	}
	slog.Info("PlayforFun webhook accepted", "event", event)
	return outcome, nil
}

func (s *Service) processMatchEvent(ctx context.Context, event string, payload map[string]any) (map[string]any, error) {
	matchID := probeStr(payload, "match_id", "matchId", "game_id", "gameId", "round_id", "roundId")
	if matchID == "" {
		matchID = "pff_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	}
	game := strings.ToLower(probeStr(payload, "game", "game_name", "gameName", "game_type", "gameType"))
	phaseStarted := strings.Contains(strings.ToLower(event), "start")
	playedAt := probeStr(payload, "at", "played_at", "playedAt", "timestamp", "time", "ended_at")

	participants := extractParticipants(payload)
	winnerRef := idFromValue(payload["winner"])
	if winnerRef == "" {
		for _, p := range participants {
			if p.Result == "WON" {
				winnerRef = p.ID
				break
			}
		}
	}

	var winnerExternal, winnerUser *string
	if winnerRef != "" {
		w := winnerRef
		winnerExternal = &w
		if prow, err := findPlayerAny(ctx, s.DB, winnerRef); err == nil && prow != nil {
			if u := probeStr(prow, "user_id"); u != "" {
				winnerUser = &u
			}
			if ext := probeStr(prow, "external_id"); ext != "" {
				winnerExternal = &ext
			}
		}
	}

	prize, _ := probeInt64(payload, "prize", "coins_won", "coinsWon", "reward")
	var entryFeeTotal int64
	for _, p := range participants {
		entryFeeTotal += p.EntryFee
	}

	tx := s.DB.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, errDatabase("Failed opening webhook transaction: " + tx.Error.Error())
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	const archiveQ = `
		INSERT INTO match_results (match_id, event, game, winner_external_id, winner_user_id,
		                           prize, entry_fee, played_at, payload, signature_verified, received_at)
		VALUES (?, ?, ?, ?, ?, ?::bigint, ?::bigint, COALESCE(NULLIF(?, '')::timestamptz, now()), ?::jsonb, TRUE, now())
		ON CONFLICT (match_id) DO UPDATE
		   SET event              = EXCLUDED.event,
		       winner_external_id = EXCLUDED.winner_external_id,
		       winner_user_id     = EXCLUDED.winner_user_id,
		       prize              = EXCLUDED.prize,
		       entry_fee          = EXCLUDED.entry_fee,
		       payload            = EXCLUDED.payload,
		       received_at        = now()
	`
	if err := tx.Exec(archiveQ, matchID, event, game, winnerExternal, winnerUser, prize, entryFeeTotal, playedAt, mustJSON(payload)).Error; err != nil {
		tx.Rollback()
		return nil, errDatabase(err.Error())
	}

	var creditedWins int64
	processed := 0
	for _, p := range participants {
		prow, err := findPlayerAny(ctx, tx, p.ID)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		playerID := playerIDFrom(prow)
		if playerID == "" {
			slog.Warn("Webhook unknown participant skipped", "matchId", matchID, "participantId", p.ID)
			continue
		}
		externalID := probeStr(prow, "external_id")
		if externalID == "" {
			externalID = p.ID
		}

		res := p.Result
		if phaseStarted {
			if res == "" {
				res = "PLAYED"
			}
		} else if res == "" {
			if len(participants) > 1 {
				if p.ID == winnerRef {
					res = "WON"
				} else {
					res = "LOST"
				}
			} else {
				res = "PLAYED"
			}
		}

		var balance *int64
		gamePtr := &game
		matchPtr := &matchID
		if p.EntryFee > 0 {
			ref := fmt.Sprintf("%s:%s:FEE", matchID, externalID)
			balance, err = adjustCoins(ctx, tx, playerID, "ENTRY_FEE", -p.EntryFee, gamePtr, matchPtr, &ref, payload)
			if err != nil {
				tx.Rollback()
				return nil, err
			}
		}
		if !phaseStarted && res == "WON" && p.CoinsWon > 0 {
			ref := fmt.Sprintf("%s:%s:WIN", matchID, externalID)
			balance, err = adjustCoins(ctx, tx, playerID, "WIN", p.CoinsWon, gamePtr, matchPtr, &ref, payload)
			if err != nil {
				tx.Rollback()
				return nil, err
			}
			if balance != nil {
				creditedWins += p.CoinsWon
			}
		}

		gameName := game
		if gameName == "" {
			gameName = "unknown"
		}
		coinsWon := int64(0)
		if res == "WON" {
			coinsWon = p.CoinsWon
		}
		if err := recordSession(ctx, tx, playerID, matchID, gameName, res, coinsWon, p.EntryFee, p.Score, p.Rank, balance, playedAt, payload); err != nil {
			tx.Rollback()
			return nil, err
		}
		processed++
	}

	if err := tx.Commit().Error; err != nil {
		return nil, errDatabase("Webhook transaction commit failed: " + err.Error())
	}

	return map[string]any{
		"received":              true,
		"event":                 event,
		"matchId":               matchID,
		"participantsProcessed": processed,
		"coinsCredited":         creditedWins,
	}, nil
}

func (s *Service) processRecharge(ctx context.Context, event string, payload map[string]any) (map[string]any, error) {
	source := payload
	if nested, ok := payload["recharge"].(map[string]any); ok {
		source = nested
	}

	who := idFromValue(source)
	if who == "" {
		who = probeStr(source, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user")
	}
	if who == "" {
		return nil, errBadRequest("Recharge event missing player identifier")
	}

	coins, ok := probeInt64(source, "coins", "amount", "coins_amount", "coinsAmount", "value", "credits")
	if !ok {
		return nil, errBadRequest("Recharge event missing coin amount")
	}
	if coins <= 0 {
		return nil, errBadRequest("Recharge coin amount must be positive")
	}

	ref := probeStrPtr(source, "reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "order_id", "orderId", "id")
	var moneyINR *float64
	if m, ok := probeInt64(source, "money", "amount_inr", "amountInr", "inr"); ok {
		v := float64(m) / 100.0
		moneyINR = &v
	}
	rechargeSource := probeStr(source, "source", "channel")
	if rechargeSource == "" {
		rechargeSource = "PLAYFORFUN"
	}

	prow, err := findPlayerAny(ctx, s.DB, who)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, errBadRequest("Unknown player for recharge: " + who)
	}
	playerID := playerIDFrom(prow)
	if playerID == "" {
		return nil, errInternal("Player row missing id")
	}

	res := s.DB.WithContext(ctx).Exec(`
		INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
		VALUES (?::uuid, ?::bigint, ?::double precision, ?, 'CREDITED', ?, ?::jsonb)
		ON CONFLICT (reference) DO NOTHING
	`, playerID, coins, moneyINR, rechargeSource, ref, mustJSON(payload))
	if res.Error != nil {
		return nil, errDatabase(res.Error.Error())
	}

	credited := false
	if res.RowsAffected > 0 {
		bal, err := adjustCoins(ctx, s.DB, playerID, "RECHARGE", coins, nil, nil, ref, payload)
		if err != nil {
			return nil, err
		}
		credited = bal != nil
	}

	creditedCoins := int64(0)
	if credited {
		creditedCoins = coins
	}
	return map[string]any{
		"received": true,
		"event":    event,
		"credited": credited,
		"coins":    creditedCoins,
	}, nil
}

func (s *Service) processCoinEvent(ctx context.Context, event string, payload map[string]any) (map[string]any, error) {
	who := idFromValue(payload)
	if who == "" {
		who = probeStr(payload, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user")
	}
	if who == "" {
		return nil, errBadRequest("Coin event missing player identifier")
	}

	rawType := strings.ToUpper(probeStr(payload, "txn_type", "txnType", "transaction_type", "transactionType", "coin_type", "coinType", "movement"))
	txnType := "ADJUSTMENT"
	switch rawType {
	case "WIN", "WINNING", "WINNINGS":
		txnType = "WIN"
	case "RECHARGE", "DEPOSIT", "TOPUP", "TOP_UP":
		txnType = "RECHARGE"
	case "ENTRY_FEE", "FEE", "DEBIT":
		txnType = "ENTRY_FEE"
	case "REFUND":
		txnType = "REFUND"
	case "BONUS", "REWARD":
		txnType = "BONUS"
	}

	amount, ok := probeInt64(payload, "amount", "coins", "delta", "value")
	if !ok {
		return nil, errBadRequest("Coin event missing amount")
	}
	if txnType == "ENTRY_FEE" && amount > 0 {
		amount = -amount
	}

	ref := probeStrPtr(payload, "reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "id")
	var game *string
	if g := strings.ToLower(probeStr(payload, "game")); g != "" {
		game = &g
	}
	matchID := probeStrPtr(payload, "match_id", "matchId")

	prow, err := findPlayerAny(ctx, s.DB, who)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, errBadRequest("Unknown player for coin event: " + who)
	}
	playerID := playerIDFrom(prow)
	if playerID == "" {
		return nil, errInternal("Player row missing id")
	}

	balance, err := adjustCoins(ctx, s.DB, playerID, txnType, amount, game, matchID, ref, payload)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"received": true,
		"event":    event,
		"applied":  balance != nil,
		"balance":  balance,
	}, nil
}

func (s *Service) processPlayerRegistered(ctx context.Context, event string, payload map[string]any) (map[string]any, error) {
	who := probeStr(payload, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id")
	if who == "" {
		return nil, errBadRequest("player_registered event missing identifier")
	}
	name := probeStrPtr(payload, "name", "full_name", "fullName", "display_name", "displayName")
	email := probeStrPtr(payload, "email")
	mobile := probeStrPtr(payload, "mobile", "mobile_number", "mobileNumber", "phone", "phone_number", "phoneNumber")
	var age *int16
	if a, ok := probeInt64(payload, "age"); ok {
		v := int16(a)
		age = &v
	}

	prow, err := findPlayerAny(ctx, s.DB, who)
	if err != nil {
		return nil, err
	}
	if prow != nil {
		playerID := playerIDFrom(prow)
		if playerID == "" {
			return nil, errInternal("Player row missing id")
		}
		if err := s.DB.WithContext(ctx).Exec(`
			UPDATE players SET
				name          = COALESCE(?, name),
				email         = COALESCE(?, email),
				mobile_number = COALESCE(?, mobile_number),
				age           = COALESCE(?::smallint, age),
				updated_at    = now()
			WHERE id = ?::uuid
		`, name, email, mobile, age, playerID).Error; err != nil {
			return nil, errDatabase(err.Error())
		}
		return map[string]any{"received": true, "event": event, "updated": true}, nil
	}

	if uid := probeStr(payload, "user_id", "userId"); uid != "" {
		player, err := s.upsertPlayer(ctx, &UserDetails{
			UserID:      uid,
			Email:       email,
			FullName:    name,
			PhoneNumber: mobile,
		})
		if err != nil {
			return nil, err
		}
		if age != nil {
			_ = s.DB.WithContext(ctx).Exec("UPDATE players SET age = ?::smallint, updated_at = now() WHERE user_id = ?", *age, player.UserID).Error
		}
		return map[string]any{"received": true, "event": event, "created": true, "gamerUid": player.GamerUID}, nil
	}

	return nil, errBadRequest("player_registered event references an unknown gamer")
}

func (s *Service) archiveMatch(ctx context.Context, event string, payload map[string]any, winner, game *string) error {
	matchID := probeStr(payload, "match_id", "matchId", "id")
	if matchID == "" {
		matchID = "evt_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	}
	if err := s.DB.WithContext(ctx).Exec(`
		INSERT INTO match_results (match_id, event, game, winner_external_id, prize, payload, signature_verified)
		VALUES (?, ?, COALESCE(?, ''), ?, 0, ?::jsonb, TRUE)
		ON CONFLICT (match_id) DO UPDATE
		   SET payload = EXCLUDED.payload, received_at = now()
	`, matchID, event, game, winner, mustJSON(payload)).Error; err != nil {
		return errDatabase(err.Error())
	}
	return nil
}

// ---------------------------------------------------------------------------
// Player Snapshot
// ---------------------------------------------------------------------------

func (s *Service) PlayerSnapshot(ctx context.Context, player *Player) (map[string]any, error) {
	row, err := queryRowJSON(ctx, s.DB, "SELECT row_to_json(p) AS row FROM players p WHERE p.user_id = ?", player.UserID)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, errNotFound("Gamer record not found")
	}
	playerID := playerIDFrom(row)
	if playerID == "" {
		return nil, errInternal("Gamer record missing id")
	}

	stats, err := queryRawJSON(ctx, s.DB, `SELECT COALESCE(json_agg(row_to_json(gs)), '[]'::json) AS row FROM game_stats gs WHERE gs.player_id = ?::uuid`, playerID)
	if err != nil {
		return nil, err
	}
	if stats == nil {
		stats = []any{}
	}

	sessions, err := queryRawJSON(ctx, s.DB, `SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) AS row FROM (SELECT * FROM game_sessions WHERE player_id = ?::uuid ORDER BY played_at DESC LIMIT 20) s`, playerID)
	if err != nil {
		return nil, err
	}
	if sessions == nil {
		sessions = []any{}
	}

	txns, err := queryRawJSON(ctx, s.DB, `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS row FROM (SELECT * FROM coin_transactions WHERE player_id = ?::uuid ORDER BY created_at DESC LIMIT 15) t`, playerID)
	if err != nil {
		return nil, err
	}
	if txns == nil {
		txns = []any{}
	}

	recharges, err := queryRawJSON(ctx, s.DB, `SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) AS row FROM (SELECT * FROM recharges WHERE player_id = ?::uuid ORDER BY created_at DESC LIMIT 15) r`, playerID)
	if err != nil {
		return nil, err
	}
	if recharges == nil {
		recharges = []any{}
	}

	return map[string]any{
		"player": map[string]any{
			"gamerUid":            row["gamer_uid"],
			"userId":              row["user_id"],
			"externalId":          row["external_id"],
			"name":                row["name"],
			"email":               row["email"],
			"age":                 row["age"],
			"mobileNumber":        row["mobile_number"],
			"displayName":         row["display_name"],
			"coins":               row["coins"],
			"totalCoinsWon":       row["total_coins_won"],
			"totalCoinsRecharged": row["total_coins_recharged"],
			"totalCoinsSpent":     row["total_coins_spent"],
			"matchesPlayed":       row["matches_played"],
			"matchesWon":          row["matches_won"],
			"matchesLost":         row["matches_lost"],
			"lastGame":            row["last_game"],
			"lastPlayedAt":        row["last_played_at"],
		},
		"gameStats":          stats,
		"recentSessions":     sessions,
		"recentTransactions": txns,
		"recentRecharges":    recharges,
	}, nil
}
