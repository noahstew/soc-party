// Command server runs the HTTP and WebSocket API with structured logs and graceful shutdown.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"example.com/soc-party/backend/internal/config"
	"example.com/soc-party/backend/internal/gamestore"
	"example.com/soc-party/backend/internal/httpapi"
	"example.com/soc-party/backend/internal/platform"
	"example.com/soc-party/backend/internal/protocol"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(log)
	healthcheck := flag.Bool("healthcheck", false, "probe the local health endpoint and exit")
	flag.Parse()
	if *healthcheck {
		if err := probe(); err != nil {
			log.Error("unhealthy", "error", err)
			os.Exit(1)
		}
		return
	}
	if err := run(log); err != nil {
		log.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func probe() error {
	addr := os.Getenv("HTTP_ADDR")
	if addr == "" {
		addr = ":8080"
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return err
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("health returned %d", resp.StatusCode)
	}
	return nil
}

func run(log *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	gamePool, err := pgxpool.New(ctx, cfg.GameDatabaseURL)
	if err != nil {
		return err
	}
	defer gamePool.Close()
	repo := platform.PostgresRepository{Pool: pool}
	resetCtx, resetCancel := context.WithTimeout(ctx, 5*time.Second)
	err = repo.Reset(resetCtx)
	resetCancel()
	if err != nil {
		return err
	}
	rooms := platform.NewRegistry(repo, func(ctx context.Context) ([]protocol.Game, error) {
		// Register each future game with its own content source here. Lobby UI and
		// room selection use this catalog rather than branching on game IDs.
		rows, err := gamestore.New(gamePool).ListOfficialPacks(ctx)
		if err != nil {
			return nil, err
		}
		packs := make([]protocol.Pack, 0, len(rows))
		for _, row := range rows {
			packs = append(packs, protocol.Pack{Slug: row.Slug, Title: row.Title})
		}
		return []protocol.Game{{ID: "zinger", Title: "Zinger", Packs: packs}}, nil
	})
	defer rooms.Close()
	srv := &http.Server{Addr: cfg.HTTPAddr, Handler: httpapi.New(databaseHealth{pool, gamePool}, gamestore.New(gamePool), log, httpapi.RoomOptions{Registry: rooms, Origins: cfg.AllowedOrigins}), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
	errCh := make(chan error, 1)
	go func() { log.Info("HTTP server starting", "addr", cfg.HTTPAddr); errCh <- srv.ListenAndServe() }()
	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		log.Info("HTTP server shutting down")
		shutdown, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil {
			_ = srv.Close()
			return err
		}
		err := <-errCh
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

type databaseHealth struct{ platform, game *pgxpool.Pool }

func (h databaseHealth) Ping(ctx context.Context) error {
	if err := h.platform.Ping(ctx); err != nil {
		return err
	}
	return h.game.Ping(ctx)
}
