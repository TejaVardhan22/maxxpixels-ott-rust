package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

func playerSnapshot(ctx context.Context, state *AppState, player *Player) (map[string]any, error) {
	row, err := queryPlayerJSON(ctx, state.DB, "SELECT row_to_json(p) AS row FROM players p WHERE p.user_id = $1", player.UserID)
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	if row == nil {
		return nil, NewNotFound("Gamer record not found")
	}
	idv, _ := row["id"].(string)
	playerID, err := uuid.Parse(idv)
	if err != nil {
		return nil, NewInternal("Gamer record missing id")
	}
	statsRow, _ := queryPlayerJSON(ctx, state.DB, `
SELECT COALESCE(json_agg(row_to_json(gs)), '[]'::json) AS row
FROM game_stats gs WHERE gs.player_id = $1::uuid`, playerID.String())
	stats := any([]any{})
	if statsRow != nil {
		if v, ok := statsRow["row"]; ok && v != nil {
			stats = v
		}
	}
	sessRow, _ := queryPlayerJSON(ctx, state.DB, `
SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) AS row
FROM (
    SELECT * FROM game_sessions
    WHERE player_id = $1::uuid
    ORDER BY played_at DESC
    LIMIT 20
) s`, playerID.String())
	sessions := any([]any{})
	if sessRow != nil {
		if v, ok := sessRow["row"]; ok && v != nil {
			sessions = v
		}
	}
	txRow, _ := queryPlayerJSON(ctx, state.DB, `
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) AS row
FROM (
    SELECT * FROM coin_transactions
    WHERE player_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT 15
) t`, playerID.String())
	txns := any([]any{})
	if txRow != nil {
		if v, ok := txRow["row"]; ok && v != nil {
			txns = v
		}
	}
	rchRow, _ := queryPlayerJSON(ctx, state.DB, `
SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) AS row
FROM (
    SELECT * FROM recharges
    WHERE player_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT 15
) r`, playerID.String())
	recharges := any([]any{})
	if rchRow != nil {
		if v, ok := rchRow["row"]; ok && v != nil {
			recharges = v
		}
	}
	// player object with camelCase keys as in Rust snapshot
	playerOut := map[string]any{
		"gamerUid":             row["gamer_uid"],
		"userId":               row["user_id"],
		"externalId":           row["external_id"],
		"name":                 row["name"],
		"email":                row["email"],
		"age":                  row["age"],
		"mobileNumber":         row["mobile_number"],
		"displayName":          row["display_name"],
		"coins":                row["coins"],
		"totalCoinsWon":        row["total_coins_won"],
		"totalCoinsRecharged":  row["total_coins_recharged"],
		"totalCoinsSpent":      row["total_coins_spent"],
		"matchesPlayed":        row["matches_played"],
		"matchesWon":           row["matches_won"],
		"matchesLost":          row["matches_lost"],
		"lastGame":             row["last_game"],
		"lastPlayedAt":         row["last_played_at"],
	}
	return map[string]any{
		"player":             playerOut,
		"gameStats":          stats,
		"recentSessions":     sessions,
		"recentTransactions": txns,
		"recentRecharges":    recharges,
	}, nil
}

func archiveMatch(ctx context.Context, state *AppState, event string, payload map[string]any, winner, game *string) error {
	matchID := ""
	if v := probeStr(payload, "match_id", "matchId", "id"); v != nil {
		matchID = *v
	} else {
		matchID = "evt_" + strings.ReplaceAll(uuid.New().String(), "-", "")
	}
	payloadJSON, _ := json.Marshal(payload)
	_, err := execRows(ctx, state.DB, `
INSERT INTO match_results (match_id, event, game, winner_external_id, prize, payload, signature_verified)
VALUES ($1, $2, $3, $4, 0, $5::jsonb, TRUE)
ON CONFLICT (match_id) DO UPDATE
   SET payload = EXCLUDED.payload, received_at = now()`,
		matchID, event, game, winner, string(payloadJSON))
	if err != nil {
		return NewDatabase(err.Error())
	}
	return nil
}

func processPlayerRegistered(ctx context.Context, state *AppState, event string, payload map[string]any) (map[string]any, error) {
	who := probeStr(payload, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user", "id")
	name := probeStr(payload, "name", "full_name", "fullName", "display_name", "displayName")
	email := probeStr(payload, "email")
	mobile := probeStr(payload, "mobile", "mobile_number", "mobileNumber", "phone", "phone_number", "phoneNumber")
	var age *int16
	if a := probeI64(payload, "age"); a != nil {
		v := int16(*a)
		age = &v
	}
	if who == nil {
		return nil, NewBadRequest("player_registered event missing identifier")
	}
	prow, err := findPlayerAny(ctx, state.DB, *who)
	if err != nil {
		return nil, err
	}
	if prow != nil {
		pid, ok := playerIDFrom(prow)
		if !ok {
			return nil, NewInternal("Player row missing id")
		}
		_, err = execRows(ctx, state.DB, `
UPDATE players SET
    name          = COALESCE($2, name),
    email         = COALESCE($3, email),
    mobile_number = COALESCE($4, mobile_number),
    age           = COALESCE($5::smallint, age),
    updated_at    = now()
WHERE id = $1::uuid`, pid.String(), name, email, mobile, age)
		if err != nil {
			return nil, NewDatabase(err.Error())
		}
		return map[string]any{"received": true, "event": event, "updated": true}, nil
	}
	uid := probeStr(payload, "user_id", "userId")
	if uid == nil {
		return nil, NewBadRequest("player_registered event references an unknown gamer")
	}
	details := &UserDetails{UserID: *uid, Email: email, FullName: name, PhoneNumber: mobile}
	player, err := upsertPlayer(ctx, state, details)
	if err != nil {
		return nil, err
	}
	if age != nil {
		_, _ = execRows(ctx, state.DB, "UPDATE players SET age = $2::smallint, updated_at = now() WHERE user_id = $1", player.UserID, *age)
	}
	return map[string]any{"received": true, "event": event, "created": true, "gamerUid": player.GamerUID}, nil
}

func processRecharge(ctx context.Context, state *AppState, event string, payload map[string]any) (map[string]any, error) {
	source := payload
	if r, ok := payload["recharge"].(map[string]any); ok {
		source = r
	}
	who := idFromValue(source)
	if who == nil {
		who = probeStr(source, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user")
	}
	if who == nil {
		return nil, NewBadRequest("Recharge event missing player identifier")
	}
	coinsPtr := probeI64(source, "coins", "amount", "coins_amount", "coinsAmount", "value", "credits")
	if coinsPtr == nil {
		return nil, NewBadRequest("Recharge event missing coin amount")
	}
	coins := *coinsPtr
	if coins <= 0 {
		return nil, NewBadRequest("Recharge coin amount must be positive")
	}
	reference := probeStr(source, "reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "order_id", "orderId", "id")
	var moneyINR *float64
	if m := probeI64(source, "money", "amount_inr", "amountInr", "inr"); m != nil {
		v := float64(*m) / 100.0
		moneyINR = &v
	}
	rechargeSource := "PLAYFORFUN"
	if s := probeStr(source, "source", "channel"); s != nil {
		rechargeSource = *s
	}
	prow, err := findPlayerAny(ctx, state.DB, *who)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, NewBadRequest("Unknown player for recharge: " + *who)
	}
	playerID, ok := playerIDFrom(prow)
	if !ok {
		return nil, NewInternal("Player row missing id")
	}
	payloadJSON, _ := json.Marshal(payload)
	inserted, err := execRows(ctx, state.DB, `
INSERT INTO recharges (player_id, coins, money_inr, source, status, reference, payload)
VALUES ($1::uuid, $2::bigint, $3::double precision, $4, 'CREDITED', $5, $6::jsonb)
ON CONFLICT (reference) DO NOTHING`,
		playerID.String(), coins, moneyINR, rechargeSource, reference, string(payloadJSON))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}
	credited := false
	if inserted > 0 {
		_, applied, err := adjustCoins(ctx, state.DB, playerID, "RECHARGE", coins, nil, nil, reference, payload)
		if err != nil {
			return nil, err
		}
		credited = applied
	}
	outCoins := int64(0)
	if credited {
		outCoins = coins
	}
	return map[string]any{"received": true, "event": event, "credited": credited, "coins": outCoins}, nil
}

func processCoinEvent(ctx context.Context, state *AppState, event string, payload map[string]any) (map[string]any, error) {
	who := idFromValue(payload)
	if who == nil {
		who = probeStr(payload, "external_id", "externalId", "user_id", "userId", "player_id", "playerId", "gamer_uid", "gamerUid", "user")
	}
	if who == nil {
		return nil, NewBadRequest("Coin event missing player identifier")
	}
	rawType := "ADJUSTMENT"
	if rt := probeStr(payload, "txn_type", "txnType", "transaction_type", "transactionType", "coin_type", "coinType", "movement"); rt != nil {
		rawType = *rt
	}
	txnType := "ADJUSTMENT"
	switch strings.ToUpper(rawType) {
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
	amountPtr := probeI64(payload, "amount", "coins", "delta", "value")
	if amountPtr == nil {
		return nil, NewBadRequest("Coin event missing amount")
	}
	amount := *amountPtr
	if txnType == "ENTRY_FEE" {
		if amount < 0 {
			amount = -amount
		}
		amount = -amount
	}
	reference := probeStr(payload, "reference", "ref", "txn_id", "txnId", "transaction_id", "transactionId", "id")
	var game, matchID *string
	if g := probeStr(payload, "game"); g != nil {
		gl := strings.ToLower(*g)
		game = &gl
	}
	matchID = probeStr(payload, "match_id", "matchId")
	prow, err := findPlayerAny(ctx, state.DB, *who)
	if err != nil {
		return nil, err
	}
	if prow == nil {
		return nil, NewBadRequest("Unknown player for coin event: " + *who)
	}
	playerID, ok := playerIDFrom(prow)
	if !ok {
		return nil, NewInternal("Player row missing id")
	}
	balance, applied, err := adjustCoins(ctx, state.DB, playerID, txnType, amount, game, matchID, reference, payload)
	if err != nil {
		return nil, err
	}
	return map[string]any{"received": true, "event": event, "applied": applied, "balance": balance}, nil
}

func processMatchEvent(ctx context.Context, state *AppState, event string, payload map[string]any) (map[string]any, error) {
	matchID := ""
	if v := probeStr(payload, "match_id", "matchId", "game_id", "gameId", "round_id", "roundId"); v != nil {
		matchID = *v
	} else {
		matchID = "pff_" + strings.ReplaceAll(uuid.New().String(), "-", "")
	}
	game := ""
	if g := probeStr(payload, "game", "game_name", "gameName", "game_type", "gameType"); g != nil {
		game = strings.ToLower(*g)
	}
	phaseStarted := strings.Contains(strings.ToLower(event), "start")
	playedAt := ""
	if v := probeStr(payload, "at", "played_at", "playedAt", "timestamp", "time", "ended_at"); v != nil {
		playedAt = *v
	}
	participants := extractParticipants(payload)
	var winnerRef *string
	if w := idFromValue(payload["winner"]); w != nil {
		winnerRef = w
	} else {
		for _, p := range participants {
			if p.Result != nil && *p.Result == "WON" {
				id := p.ID
				winnerRef = &id
				break
			}
		}
	}
	var winnerExternal, winnerUser *string
	if winnerRef != nil {
		winnerExternal = winnerRef
		if prow, err := findPlayerAny(ctx, state.DB, *winnerRef); err == nil && prow != nil {
			if v, ok := prow["user_id"].(string); ok {
				winnerUser = &v
			}
			if v, ok := prow["external_id"].(string); ok {
				winnerExternal = &v
			} else {
				winnerExternal = winnerRef
			}
		}
	}
	prize := int64(0)
	if p := probeI64(payload, "prize", "coins_won", "coinsWon", "reward"); p != nil {
		prize = *p
	}
	entryFeeTotal := int64(0)
	for _, p := range participants {
		entryFeeTotal += p.EntryFee
	}

	tx, err := state.DB.Begin(ctx)
	if err != nil {
		return nil, NewDatabase("Failed opening webhook transaction: " + err.Error())
	}
	defer func() { _ = tx.Rollback(ctx) }()

	payloadJSON, _ := json.Marshal(payload)
	_, err = tx.Exec(ctx, `
INSERT INTO match_results (match_id, event, game, winner_external_id, winner_user_id,
                           prize, entry_fee, played_at, payload, signature_verified, received_at)
VALUES ($1, $2, $3, $4, $5, $6::bigint, $7::bigint, COALESCE(NULLIF($8, '')::timestamptz, now()), $9::jsonb, TRUE, now())
ON CONFLICT (match_id) DO UPDATE
   SET event              = EXCLUDED.event,
       winner_external_id = EXCLUDED.winner_external_id,
       winner_user_id     = EXCLUDED.winner_user_id,
       prize              = EXCLUDED.prize,
       entry_fee          = EXCLUDED.entry_fee,
       payload            = EXCLUDED.payload,
       received_at        = now()`,
		matchID, event, game, winnerExternal, winnerUser, prize, entryFeeTotal, playedAt, string(payloadJSON))
	if err != nil {
		return nil, NewDatabase(err.Error())
	}

	creditedWins := int64(0)
	processed := 0
	for _, p := range participants {
		prow, err := findPlayerAny(ctx, tx, p.ID)
		if err != nil {
			return nil, err
		}
		pid, ok := playerIDFrom(prow)
		if !ok {
			continue
		}
		externalID := p.ID
		if prow != nil {
			if v, ok := prow["external_id"].(string); ok && v != "" {
				externalID = v
			}
		}
		result := "PLAYED"
		if phaseStarted {
			if p.Result != nil {
				result = *p.Result
			} else {
				result = "PLAYED"
			}
		} else if p.Result != nil {
			result = *p.Result
		} else if len(participants) > 1 {
			if winnerRef != nil && p.ID == *winnerRef {
				result = "WON"
			} else {
				result = "LOST"
			}
		}
		var balance *int64
		if p.EntryFee > 0 {
			ref := fmt.Sprintf("%s:%s:FEE", matchID, externalID)
			bal, _, err := adjustCoins(ctx, tx, pid, "ENTRY_FEE", -p.EntryFee, strPtrOrNil(game), &matchID, &ref, payload)
			if err != nil {
				return nil, err
			}
			if bal != nil {
				balance = bal
			}
		}
		if !phaseStarted && result == "WON" && p.CoinsWon > 0 {
			ref := fmt.Sprintf("%s:%s:WIN", matchID, externalID)
			bal, applied, err := adjustCoins(ctx, tx, pid, "WIN", p.CoinsWon, strPtrOrNil(game), &matchID, &ref, payload)
			if err != nil {
				return nil, err
			}
			if bal != nil {
				balance = bal
			}
			if applied {
				creditedWins += p.CoinsWon
			}
		}
		gameName := game
		if gameName == "" {
			gameName = "unknown"
		}
		coinsWonForSession := int64(0)
		if result == "WON" {
			coinsWonForSession = p.CoinsWon
		}
		if err := recordSession(ctx, tx, pid, matchID, gameName, result, coinsWonForSession, p.EntryFee, p.Score, p.Rank, balance, playedAt, payload); err != nil {
			return nil, err
		}
		processed++
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, NewDatabase("Webhook transaction commit failed: " + err.Error())
	}
	return map[string]any{
		"received":              true,
		"event":                 event,
		"matchId":               matchID,
		"participantsProcessed": processed,
		"coinsCredited":         creditedWins,
	}, nil
}

func strPtrOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func handlePlayforfunWebhook(ctx context.Context, state *AppState, rawBody string, signature *string) (map[string]any, error) {
	if strings.TrimSpace(state.Config.PFFSecret) == "" {
		return nil, NewBadRequest("PlayforFun webhook secret is not configured")
	}
	if signature == nil {
		return nil, NewUnauthorized("Missing x-playforfun-signature header")
	}
	expected, err := ComputeHMACSHA256(state.Config.PFFSecret, rawBody)
	if err != nil {
		return nil, NewInternal("HMAC failure: " + err.Error())
	}
	if !ConstantTimeEq([]byte(strings.TrimSpace(*signature)), []byte(expected)) {
		return nil, NewUnauthorized("Invalid PlayforFun webhook signature")
	}
	var payload map[string]any
	if err := json.Unmarshal([]byte(rawBody), &payload); err != nil {
		return nil, NewBadRequest("Webhook body is not valid JSON")
	}
	event := "unknown"
	if v := probeStr(payload, "event", "type", "action"); v != nil {
		event = *v
	}
	eventLC := strings.ToLower(event)
	switch {
	case strings.Contains(eventLC, "recharge") || strings.Contains(eventLC, "deposit") || strings.Contains(eventLC, "topup"):
		return processRecharge(ctx, state, event, payload)
	case strings.Contains(eventLC, "coin") || strings.Contains(eventLC, "wallet") || strings.Contains(eventLC, "transaction"):
		return processCoinEvent(ctx, state, event, payload)
	case strings.Contains(eventLC, "register") && strings.Contains(eventLC, "player"):
		return processPlayerRegistered(ctx, state, event, payload)
	case strings.Contains(eventLC, "match") || strings.Contains(eventLC, "game") || strings.Contains(eventLC, "result") || strings.Contains(eventLC, "round") || payload["match_id"] != nil || payload["matchId"] != nil:
		return processMatchEvent(ctx, state, event, payload)
	default:
		if err := archiveMatch(ctx, state, event, payload, nil, nil); err != nil {
			return nil, err
		}
		return map[string]any{"received": true, "event": event, "processed": "archived"}, nil
	}
}
