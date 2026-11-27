package games

import (
	"fmt"

	"gorm.io/gorm"
)

const migration001Init = `
CREATE TABLE IF NOT EXISTS players (
    id                    UUID          PRIMARY KEY,
    gamer_uid             VARCHAR(24)   NOT NULL UNIQUE,
    user_id               VARCHAR(64)   NOT NULL UNIQUE,
    external_id           VARCHAR(64)   NOT NULL UNIQUE,
    name                  VARCHAR(120),
    email                 VARCHAR(255),
    age                   SMALLINT,
    mobile_number         VARCHAR(32),
    display_name          VARCHAR(64),

    coins                 BIGINT        NOT NULL DEFAULT 0,
    total_coins_won       BIGINT        NOT NULL DEFAULT 0,
    total_coins_recharged BIGINT        NOT NULL DEFAULT 0,
    total_coins_spent     BIGINT        NOT NULL DEFAULT 0,

    matches_played        INTEGER       NOT NULL DEFAULT 0,
    matches_won           INTEGER       NOT NULL DEFAULT 0,
    matches_lost          INTEGER       NOT NULL DEFAULT 0,
    last_game             VARCHAR(32),
    last_played_at        TIMESTAMPTZ,

    status                VARCHAR(32)   NOT NULL DEFAULT 'ACTIVE',
    last_synced_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_players_display_name ON players (display_name);
CREATE INDEX IF NOT EXISTS idx_players_mobile       ON players (mobile_number);

CREATE TABLE IF NOT EXISTS coin_transactions (
    id             BIGSERIAL    PRIMARY KEY,
    player_id      UUID         NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    txn_type       VARCHAR(16)  NOT NULL,
    amount         BIGINT       NOT NULL,
    balance_after  BIGINT       NOT NULL,
    game           VARCHAR(32),
    match_id       VARCHAR(64),
    reference      VARCHAR(128) UNIQUE,
    payload        JSONB,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_player   ON coin_transactions (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_tx_type     ON coin_transactions (txn_type);
CREATE INDEX IF NOT EXISTS idx_coin_tx_match    ON coin_transactions (match_id);

CREATE TABLE IF NOT EXISTS recharges (
    id          BIGSERIAL    PRIMARY KEY,
    player_id   UUID         NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    coins       BIGINT       NOT NULL,
    money_inr   NUMERIC(10, 2),
    source      VARCHAR(32)  NOT NULL DEFAULT 'PLAYFORFUN',
    status      VARCHAR(16)  NOT NULL DEFAULT 'CREDITED',
    reference   VARCHAR(128) UNIQUE,
    payload     JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recharges_player ON recharges (player_id, created_at DESC);

CREATE TABLE IF NOT EXISTS game_sessions (
    id                   BIGSERIAL   PRIMARY KEY,
    player_id            UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    match_id             VARCHAR(64) NOT NULL,
    game                 VARCHAR(32) NOT NULL,
    result               VARCHAR(16) NOT NULL DEFAULT 'PLAYED',
    coins_won            BIGINT      NOT NULL DEFAULT 0,
    entry_fee            BIGINT      NOT NULL DEFAULT 0,
    score                INTEGER,
    rank                 INTEGER,
    coins_balance_after  BIGINT,
    played_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    payload              JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_player  ON game_sessions (player_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_game    ON game_sessions (game, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_match   ON game_sessions (match_id);

CREATE TABLE IF NOT EXISTS game_stats (
    id              BIGSERIAL   PRIMARY KEY,
    player_id       UUID        NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    game            VARCHAR(32) NOT NULL,
    matches_played  INTEGER     NOT NULL DEFAULT 0,
    wins            INTEGER     NOT NULL DEFAULT 0,
    losses          INTEGER     NOT NULL DEFAULT 0,
    draws           INTEGER     NOT NULL DEFAULT 0,
    coins_won       BIGINT      NOT NULL DEFAULT 0,
    coins_spent     BIGINT      NOT NULL DEFAULT 0,
    best_coins_won  BIGINT      NOT NULL DEFAULT 0,
    last_played_at  TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (player_id, game)
);

CREATE INDEX IF NOT EXISTS idx_game_stats_game ON game_stats (game);

CREATE TABLE IF NOT EXISTS match_results (
    id                 BIGSERIAL    PRIMARY KEY,
    match_id           VARCHAR(64)  NOT NULL UNIQUE,
    event              VARCHAR(32)  NOT NULL DEFAULT 'unknown',
    game               VARCHAR(32)  NOT NULL,
    winner_external_id VARCHAR(64),
    winner_user_id     VARCHAR(64),
    prize              NUMERIC(12, 2) DEFAULT 0,
    entry_fee          BIGINT       DEFAULT 0,
    played_at          TIMESTAMPTZ,
    payload            JSONB,
    signature_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    received_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_results_winner ON match_results (winner_user_id);
CREATE INDEX IF NOT EXISTS idx_match_results_game   ON match_results (game);
`

const migration002CoinOrders = `
CREATE TABLE IF NOT EXISTS coin_orders (
    id                 BIGSERIAL    PRIMARY KEY,
    player_id          UUID         NOT NULL REFERENCES players (id) ON DELETE CASCADE,
    razorpay_order_id  VARCHAR(64)  NOT NULL UNIQUE,
    pack_id            VARCHAR(32)  NOT NULL,
    coins              BIGINT       NOT NULL,
    amount_paise       BIGINT       NOT NULL,
    currency           VARCHAR(8)   NOT NULL DEFAULT 'INR',
    status             VARCHAR(16)  NOT NULL DEFAULT 'CREATED',
    payment_id         VARCHAR(64),
    signature_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    receipt            VARCHAR(64),
    notes              JSONB,
    payload            JSONB,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coin_orders_player  ON coin_orders (player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coin_orders_status  ON coin_orders (status);
`

// RunMigrations applies the idempotent games DB schema (players, ledger, recharges, sessions, stats, coin_orders).
func RunMigrations(db *gorm.DB) error {
	if err := db.Exec(migration001Init).Error; err != nil {
		return fmt.Errorf("games migration 001_init failed: %w", err)
	}
	if err := db.Exec(migration002CoinOrders).Error; err != nil {
		return fmt.Errorf("games migration 002_coin_orders failed: %w", err)
	}
	return nil
}
