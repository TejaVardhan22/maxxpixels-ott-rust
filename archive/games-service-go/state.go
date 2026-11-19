package main

import (
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type AppState struct {
	DB     *pgxpool.Pool
	HTTP   *http.Client
	Config GamesConfig
}

func NewState(db *pgxpool.Pool, cfg GamesConfig) *AppState {
	return &AppState{
		DB: db,
		HTTP: &http.Client{
			Timeout: 8 * time.Second,
		},
		Config: cfg,
	}
}
