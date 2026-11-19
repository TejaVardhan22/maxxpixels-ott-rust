package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const pffBaseURL = "https://playforfun.in"

var allowedGames = map[string]bool{"ludo": true, "carrom": true, "snooker": true, "chess": true}

type UserDetails struct {
	UserID      string  `json:"user_id"`
	Email       *string `json:"email,omitempty"`
	FullName    *string `json:"full_name,omitempty"`
	PhoneNumber *string `json:"phone_number,omitempty"`
}

type Player struct {
	GamerUID     *string `json:"gamer_uid"`
	UserID       string  `json:"user_id"`
	ExternalID   string  `json:"external_id"`
	Name         *string `json:"name"`
	Email        *string `json:"email"`
	MobileNumber *string `json:"mobile_number"`
	Age          *int64  `json:"age"`
	DisplayName  string  `json:"display_name"`
	Coins        int64   `json:"coins"`
}

type Participant struct {
	ID       string
	Result   *string
	CoinsWon int64
	EntryFee int64
	Score    *int64
	Rank     *int64
}

func probeStr(obj map[string]any, keys ...string) *string {
	for _, k := range keys {
		v, ok := obj[k]
		if !ok || v == nil {
			continue
		}
		switch s := v.(type) {
		case string:
			t := strings.TrimSpace(s)
			if t != "" {
				return &t
			}
		}
	}
	return nil
}

func probeAny(obj any, keys ...string) any {
	m, ok := obj.(map[string]any)
	if !ok {
		return nil
	}
	for _, k := range keys {
		if v, ok := m[k]; ok {
			return v
		}
	}
	return nil
}

func probeI64(obj map[string]any, keys ...string) *int64 {
	for _, k := range keys {
		v, ok := obj[k]
		if !ok || v == nil {
			continue
		}
		switch n := v.(type) {
		case float64:
			i := int64(n)
			return &i
		case int64:
			return &n
		case int:
			i := int64(n)
			return &i
		case json.Number:
			if i, err := n.Int64(); err == nil {
				return &i
			}
			if f, err := n.Float64(); err == nil {
				i := int64(f)
				return &i
			}
		case string:
			t := strings.TrimSpace(n)
			if t == "" {
				continue
			}
			var i int64
			if _, err := fmt.Sscan(t, &i); err == nil {
				return &i
			}
		}
	}
	return nil
}

func idFromValue(v any) *string {
	switch x := v.(type) {
	case string:
		s := strings.TrimSpace(x)
		if s == "" {
			return nil
		}
		return &s
	case float64:
		s := fmt.Sprintf("%.0f", x)
		if strings.Contains(fmt.Sprintf("%v", x), "e") || strings.Contains(fmt.Sprintf("%v", x), "E") {
			s = strings.TrimSpace(fmt.Sprintf("%v", x))
		}
		// better: preserve integer form
		if x == math.Trunc(x) {
			s = fmt.Sprintf("%d", int64(x))
		} else {
			s = strings.TrimSpace(fmt.Sprintf("%v", x))
		}
		if s == "" {
			return nil
		}
		return &s
	case json.Number:
		s := x.String()
		s = strings.TrimSpace(s)
		if s == "" {
			return nil
		}
		return &s
	case map[string]any:
		return probeStr(x, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id", "name", "displayName")
	default:
		return nil
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

func extractParticipants(payload map[string]any) []Participant {
	out := []Participant{}
	for _, container := range []string{"players", "participants", "results"} {
		v, ok := payload[container]
		if !ok {
			continue
		}
		items, ok := v.([]any)
		if !ok {
			continue
		}
		for _, item := range items {
			switch it := item.(type) {
			case string:
				s := strings.TrimSpace(it)
				if s != "" {
					out = append(out, Participant{ID: s})
				}
			case map[string]any:
				if id := idFromValue(it); id != nil {
					p := Participant{ID: *id}
					if rs := probeStr(it, "result", "status", "outcome"); rs != nil {
						nr := normalizeResult(*rs)
						p.Result = &nr
					}
					if cw := probeI64(it, "coins_won", "coinsWon", "won", "reward", "prize", "coins"); cw != nil {
						p.CoinsWon = *cw
					}
					if ef := probeI64(it, "entry_fee", "entryFee", "fee"); ef != nil {
						p.EntryFee = *ef
					}
					p.Score = probeI64(it, "score", "points")
					p.Rank = probeI64(it, "rank", "position")
					out = append(out, p)
				}
			}
		}
		if len(out) > 0 {
			break
		}
	}
	// winner
	if wid := idFromValue(payload["winner"]); wid != nil {
		found := false
		for i := range out {
			if out[i].ID == *wid {
				if out[i].Result == nil {
					w := "WON"
					out[i].Result = &w
				}
				found = true
				break
			}
		}
		if !found {
			w := "WON"
			out = append(out, Participant{ID: *wid, Result: &w})
		}
	}
	// loser
	if lid := idFromValue(payload["loser"]); lid != nil {
		found := false
		for i := range out {
			if out[i].ID == *lid {
				if out[i].Result == nil {
					l := "LOST"
					out[i].Result = &l
				}
				found = true
				break
			}
		}
		if !found {
			l := "LOST"
			out = append(out, Participant{ID: *lid, Result: &l})
		}
	}
	prize := probeI64(payload, "prize", "coins_won", "coinsWon", "reward", "coins")
	fee := probeI64(payload, "entry_fee", "entryFee", "fee")
	for i := range out {
		if out[i].Result != nil && *out[i].Result == "WON" && out[i].CoinsWon == 0 && prize != nil {
			out[i].CoinsWon = *prize
		}
		if out[i].EntryFee == 0 && fee != nil {
			out[i].EntryFee = *fee
		}
	}
	hasExplicit := false
	for _, p := range out {
		if p.Result != nil {
			hasExplicit = true
			break
		}
	}
	if !hasExplicit && len(out) > 1 {
		for i := range out {
			if i == 0 {
				w := "WON"
				out[i].Result = &w
			} else {
				l := "LOST"
				out[i].Result = &l
			}
		}
	}
	return out
}

func firstID(jsonv map[string]any) string {
	for _, k := range []string{"id", "userId", "user_id"} {
		if v, ok := jsonv[k]; ok && v != nil {
			switch x := v.(type) {
			case string:
				return strings.Trim(strings.TrimSpace(x), "\"")
			case float64:
				if x == math.Trunc(x) {
					return fmt.Sprintf("%d", int64(x))
				}
				return fmt.Sprintf("%v", x)
			case json.Number:
				return x.String()
			}
		}
	}
	return ""
}

func fetchUserFromNest(ctx context.Context, state *AppState, bearer string) (*UserDetails, error) {
	url := fmt.Sprintf("%s/api/v1/auth/me", strings.TrimRight(state.Config.MainAPIURL, "/"))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, NewInternal(err.Error())
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	req.Header.Set("Accept", "application/json")
	resp, err := state.HTTP.Do(req)
	if err != nil {
		return nil, NewInternal("Failed reaching main API for user details: " + err.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, NewUnauthorized(fmt.Sprintf("Main API rejected the session for user details (HTTP %d)", resp.StatusCode))
	}
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, NewInternal("Invalid user details payload: " + err.Error())
	}
	var body map[string]any
	if err := json.Unmarshal(bodyBytes, &body); err != nil {
		return nil, NewInternal("Invalid user details payload: " + err.Error())
	}
	var profile map[string]any
	if d, ok := body["data"].(map[string]any); ok {
		profile = d
	} else if r, ok := body["result"].(map[string]any); ok {
		profile = r
	} else {
		profile = body
	}
	userID := firstID(profile)
	if strings.TrimSpace(userID) == "" {
		return nil, NewInternal("User details from main API did not include an id")
	}
	email := probeStr(profile, "email")
	fullName := probeStr(profile, "fullName", "full_name", "name", "userName")
	phone := probeStr(profile, "phoneNumber", "phone_number", "mobileNumber", "mobile_number", "phone", "mobile")
	return &UserDetails{UserID: userID, Email: email, FullName: fullName, PhoneNumber: phone}, nil
}

func normalizeDisplayName(gamerUID string) string {
	s := "maxpx_" + gamerUID
	s = strings.ReplaceAll(s, ":", " ")
	s = strings.TrimSpace(s)
	r := []rune(s)
	if len(r) > 30 {
		r = r[:30]
	}
	return string(r)
}

func newGamerUID() string {
	u := uuid.New()
	h := strings.ToUpper(hex.EncodeToString(u[:]))
	if len(h) > 10 {
		h = h[:10]
	}
	return "MPXG" + h
}

func upsertPlayer(ctx context.Context, state *AppState, details *UserDetails) (*Player, error) {
	externalID := "mpx_" + details.UserID
	gamerUID := newGamerUID()
	displayName := normalizeDisplayName(gamerUID)
	playerUUID := uuid.New()
	sql := `
INSERT INTO players (id, gamer_uid, user_id, external_id, name, email,
                     mobile_number, display_name, last_synced_at, created_at, updated_at)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, now(), now(), now())
ON CONFLICT (user_id) DO UPDATE
   SET name           = COALESCE(EXCLUDED.name, players.name),
       email          = COALESCE(EXCLUDED.email, players.email),
       mobile_number  = COALESCE(EXCLUDED.mobile_number, players.mobile_number),
       display_name   = 'maxpx_' || players.gamer_uid,
       last_synced_at = now(),
       updated_at     = now()
RETURNING row_to_json(players) AS row`
	var name, email, mobile any
	if details.FullName != nil {
		name = *details.FullName
	}
	if details.Email != nil {
		email = *details.Email
	}
	if details.PhoneNumber != nil {
		mobile = *details.PhoneNumber
	}
	row, err := queryPlayerJSON(ctx, state.DB, sql,
		playerUUID.String(), gamerUID, details.UserID, externalID, name, email, mobile, displayName,
	)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if row == nil {
		return nil, NewInternal("Player upsert returned no row")
	}
	return playerFromRow(row), nil
}

func playerFromRow(row map[string]any) *Player {
	p := &Player{DisplayName: "maxpx_player"}
	if v, ok := row["gamer_uid"].(string); ok {
		p.GamerUID = &v
	}
	if v, ok := row["user_id"].(string); ok {
		p.UserID = v
	}
	if v, ok := row["external_id"].(string); ok {
		p.ExternalID = v
	}
	if v, ok := row["name"].(string); ok {
		p.Name = &v
	}
	if v, ok := row["email"].(string); ok {
		p.Email = &v
	}
	if v, ok := row["mobile_number"].(string); ok {
		p.MobileNumber = &v
	}
	if v, ok := row["age"]; ok && v != nil {
		switch n := v.(type) {
		case float64:
			i := int64(n)
			p.Age = &i
		case int64:
			p.Age = &n
		}
	}
	if v, ok := row["display_name"].(string); ok && v != "" {
		p.DisplayName = v
	}
	if v, ok := row["coins"]; ok {
		switch n := v.(type) {
		case float64:
			p.Coins = int64(n)
		case int64:
			p.Coins = n
		}
	}
	return p
}

func resolvePlayer(ctx context.Context, state *AppState, bearer string) (*Player, error) {
	claims, err := ValidateJWT(bearer, state.Config.JWTSecret)
	if err != nil {
		return nil, NewUnauthorized("Invalid or expired token: " + err.Error())
	}
	sql := `
SELECT row_to_json(p) AS row FROM players p
WHERE p.user_id = $1
  AND p.last_synced_at > now() - make_interval(secs => $2::double precision)`
	row, err := queryPlayerJSON(ctx, state.DB, sql, claims.Sub, float64(state.Config.PlayerTTLSeconds))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if row != nil {
		p := playerFromRow(row)
		return p, nil
	}
	details, err := fetchUserFromNest(ctx, state, bearer)
	if err != nil {
		return nil, err
	}
	p, err := upsertPlayer(ctx, state, details)
	if err != nil {
		return nil, err
	}
	p.UserID = claims.Sub
	return p, nil
}

func buildLaunchURL(state *AppState, player *Player, game *string) (map[string]any, error) {
	if strings.TrimSpace(state.Config.PFFSecret) == "" {
		return nil, NewBadRequest("PlayforFun gaming is not configured. Set PLAYFORFUN_SECRET (PFF_SECRET) on the games service.")
	}
	exp := time.Now().Unix() + 600
	nonceBytes := make([]byte, 8)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, NewInternal("failed generating nonce: " + err.Error())
	}
	nonce := hex.EncodeToString(nonceBytes) // 16 chars

	gamerID := player.UserID
	if player.GamerUID != nil && strings.TrimSpace(*player.GamerUID) != "" {
		gamerID = *player.GamerUID
	}
	displayName := player.DisplayName
	if player.Name != nil {
		dn := strings.TrimSpace(strings.ReplaceAll(*player.Name, ":", " "))
		if dn != "" {
			displayName = dn
		}
	}
	payload := fmt.Sprintf("%s:%s:%s:%d:%s", state.Config.PFFTenant, gamerID, displayName, exp, nonce)
	sig, err := ComputeHMACSHA256(state.Config.PFFSecret, payload)
	if err != nil {
		return nil, NewInternal("Failed signing launch URL: " + err.Error())
	}
	var selectedGame *string
	if game != nil {
		g := strings.ToLower(strings.TrimSpace(*game))
		if allowedGames[g] {
			selectedGame = &g
		}
	}
	path := "/arena"
	if selectedGame != nil {
		path = "/play/" + *selectedGame
	}
	q := url.Values{}
	q.Set("tenant", state.Config.PFFTenant)
	q.Set("user", gamerID)
	q.Set("name", displayName)
	q.Set("exp", fmt.Sprintf("%d", exp))
	q.Set("nonce", nonce)
	q.Set("sig", sig)
	launchURL := pffBaseURL + path + "?" + q.Encode()
	expiresAt := time.Unix(exp, 0).UTC().Format(time.RFC3339)
	result := map[string]any{
		"launchUrl":   launchURL,
		"expiresAt":   expiresAt,
		"tenant":      state.Config.PFFTenant,
		"userId":      gamerID,
		"externalId":  player.ExternalID,
		"gamerUid":    player.GamerUID,
		"displayName": displayName,
	}
	if selectedGame != nil {
		result["game"] = *selectedGame
	}
	return result, nil
}

func findPlayerAny(ctx context.Context, db DBTX, identifier string) (map[string]any, error) {
	if strings.TrimSpace(identifier) == "" {
		return nil, nil
	}
	uidCandidate := strings.TrimPrefix(identifier, "maxpx_")
	uidExtra := ""
	if uidCandidate != identifier {
		uidExtra = uidCandidate
	}
	sql := `
SELECT row_to_json(p) AS row FROM players p
WHERE p.external_id = $1 OR p.user_id = $1 OR p.gamer_uid = $1
   OR p.display_name = $1
   OR ($3 <> '' AND p.name = $3)
   OR ($2 <> '' AND p.gamer_uid = $2)
LIMIT 1`
	row, err := queryPlayerJSON(ctx, db, sql, identifier, uidExtra, strings.TrimSpace(identifier))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	return row, nil
}

func playerIDFrom(row map[string]any) (uuid.UUID, bool) {
	if row == nil {
		return uuid.Nil, false
	}
	s, _ := row["id"].(string)
	if s == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// adjustCoins applies signed coin movement inside db (pool or tx). Returns (balance, applied, error).
func adjustCoins(ctx context.Context, db DBTX, playerID uuid.UUID, txnType string, amount int64, game, matchID, reference *string, payload any) (*int64, bool, error) {
	if amount == 0 {
		return nil, false, nil
	}
	if reference != nil && *reference != "" {
		r := db.QueryRow(ctx, "SELECT id FROM coin_transactions WHERE reference = $1 LIMIT 1", *reference)
		var idv any
		err := r.Scan(&idv)
		if err == nil {
			// exists
			return nil, false, nil
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, false, NewDatabase(err.Error())
		}
	}
	prow, err := queryPlayerJSON(ctx, db, "SELECT row_to_json(p) AS row FROM players p WHERE p.id = $1::uuid FOR UPDATE", playerID.String())
	if err != nil {
		return nil, false, err
	}
	current := int64(0)
	if prow != nil {
		if v, ok := prow["coins"]; ok {
			switch n := v.(type) {
			case float64:
				current = int64(n)
			case int64:
				current = n
			}
		}
	}
	if amount < 0 && current < -amount {
		return nil, false, nil
	}
	var balanceAfter int64
	err = db.QueryRow(ctx, `
UPDATE players SET
    coins                 = coins + $2::bigint,
    total_coins_won       = total_coins_won       + CASE WHEN $3 = 'WIN'       THEN $2::bigint ELSE 0 END,
    total_coins_recharged = total_coins_recharged + CASE WHEN $3 = 'RECHARGE'  THEN $2::bigint ELSE 0 END,
    total_coins_spent     = total_coins_spent     + CASE WHEN $3 = 'ENTRY_FEE' THEN -($2::bigint) ELSE 0 END,
    updated_at            = now()
WHERE id = $1::uuid
RETURNING coins AS balance`, playerID.String(), amount, txnType).Scan(&balanceAfter)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, NewInternal("Coin update returned no row")
		}
		return nil, false, NewDatabase(err.Error())
	}
	payloadJSON, _ := json.Marshal(payload)
	_, err = execRows(ctx, db, `
INSERT INTO coin_transactions (player_id, txn_type, amount, balance_after,
                               game, match_id, reference, payload)
VALUES ($1::uuid, $2, $3::bigint, $4::bigint, $5, $6, $7, $8::jsonb)
ON CONFLICT (reference) DO NOTHING`,
		playerID.String(), txnType, amount, balanceAfter, game, matchID, reference, string(payloadJSON))
	if err != nil {
		return nil, false, NewDatabase(err.Error())
	}
	return &balanceAfter, true, nil
}

func recordSession(ctx context.Context, tx pgx.Tx, playerID uuid.UUID, matchID, game, result string, coinsWon, entryFee int64, score, rank, balanceAfter *int64, playedAt string, payload any) error {
	payloadJSON, _ := json.Marshal(payload)
	_, err := tx.Exec(ctx, `
INSERT INTO game_sessions (player_id, match_id, game, result, coins_won, entry_fee,
                           score, rank, coins_balance_after, played_at, payload)
VALUES ($1::uuid, $2, $3, $4, $5::bigint, $6::bigint, $7::bigint, $8::bigint, $9::bigint,
        COALESCE(NULLIF($10, '')::timestamptz, now()), $11::jsonb)
ON CONFLICT (match_id, player_id) DO UPDATE
   SET result              = EXCLUDED.result,
       coins_won           = EXCLUDED.coins_won,
       entry_fee           = EXCLUDED.entry_fee,
       score               = EXCLUDED.score,
       rank                = EXCLUDED.rank,
       coins_balance_after = EXCLUDED.coins_balance_after,
       payload             = EXCLUDED.payload,
       played_at           = EXCLUDED.played_at`,
		playerID.String(), matchID, game, result, coinsWon, entryFee, score, rank, balanceAfter, playedAt, string(payloadJSON))
	if err != nil {
		return NewDatabase(err.Error())
	}
	dWon, dLost, dDraw := int64(0), int64(0), int64(0)
	if result == "WON" {
		dWon = 1
	} else if result == "LOST" {
		dLost = 1
	} else if result == "DRAW" {
		dDraw = 1
	}
	dCoinsSpent := int64(0)
	if entryFee > 0 {
		dCoinsSpent = entryFee
	}
	_, err = tx.Exec(ctx, `
INSERT INTO game_stats (player_id, game, matches_played, wins, losses, draws,
                        coins_won, coins_spent, best_coins_won, last_played_at)
VALUES ($1::uuid, $2, 1, $3::bigint, $4::bigint, $5::bigint, $6::bigint, $7::bigint, $6::bigint,
        COALESCE(NULLIF($8, '')::timestamptz, now()))
ON CONFLICT (player_id, game) DO UPDATE
   SET matches_played = game_stats.matches_played + 1,
       wins           = game_stats.wins   + $3,
       losses         = game_stats.losses + $4,
       draws          = game_stats.draws  + $5,
       coins_won      = game_stats.coins_won  + $6,
       coins_spent    = game_stats.coins_spent + $7,
       best_coins_won = GREATEST(game_stats.best_coins_won, $6),
       last_played_at = COALESCE(NULLIF($8, '')::timestamptz, now()),
       updated_at     = now()`,
		playerID.String(), game, dWon, dLost, dDraw, coinsWon, dCoinsSpent, playedAt)
	if err != nil {
		return NewDatabase(err.Error())
	}
	_, err = tx.Exec(ctx, `
UPDATE players SET
    matches_played = matches_played + 1,
    matches_won    = matches_won    + $2::bigint,
    matches_lost   = matches_lost   + $3::bigint,
    last_game      = $4,
    last_played_at = COALESCE(NULLIF($5, '')::timestamptz, now()),
    updated_at     = now()
WHERE id = $1::uuid`,
		playerID.String(), dWon, dLost, game, playedAt)
	if err != nil {
		return NewDatabase(err.Error())
	}
	return nil
}

// Player snapshot and webhook/processing methods are added below in service logic extensions.
// (kept in this file for parity)
