// Package httpapi exposes the Phase 0 read-only HTTP surface.
package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"example.com/soc-party/backend/internal/store"
)

type Pinger interface{ Ping(context.Context) error }
type PackStore interface {
	ListOfficialPacks(context.Context) ([]store.ListOfficialPacksRow, error)
}

type api struct {
	db    Pinger
	packs PackStore
	log   *slog.Logger
}

func New(db Pinger, packs PackStore, log *slog.Logger) http.Handler {
	a := api{db: db, packs: packs, log: log}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.health)
	mux.HandleFunc("GET /api/packs", a.listPacks)
	return mux
}

func (a api) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := a.db.Ping(ctx); err != nil {
		a.log.Error("database health check failed", "error", err)
		respond(w, http.StatusServiceUnavailable, map[string]string{"status": "error", "database": "unavailable"})
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok", "database": "ok"})
}

func (a api) listPacks(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()
	packs, err := a.packs.ListOfficialPacks(ctx)
	if err != nil {
		a.log.Error("list official packs failed", "error", err)
		respond(w, http.StatusServiceUnavailable, map[string]string{"error": "packs unavailable"})
		return
	}
	if packs == nil {
		packs = []store.ListOfficialPacksRow{}
	}
	respond(w, http.StatusOK, packs)
}

func respond(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	// Only fixed, JSON-serializable response types enter this helper. A write failure means
	// the connection is gone; a second HTTP response cannot be sent.
	_ = json.NewEncoder(w).Encode(body)
}
