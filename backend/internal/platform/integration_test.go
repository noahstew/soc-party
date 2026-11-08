//go:build integration

package platform

import (
	"context"
	"os"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresRoomMembershipAndRollback(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	url := os.Getenv("DATABASE_URL")
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	repo := PostgresRepository{Pool: tx}
	r := NewRegistry(repo)
	defer r.Close()
	owner, err := r.Create(ctx, "Owner")
	if err != nil {
		t.Fatal(err)
	}
	guest, err := r.Join(ctx, owner.Lobby.Code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	q := store.New(tx)
	record, err := q.GetRoom(ctx, owner.Lobby.Code)
	if err != nil {
		t.Fatal(err)
	}
	players, err := q.ListRoomPlayers(ctx, record.ID)
	if err != nil {
		t.Fatal(err)
	}
	if record.GameID != "zinger" || record.OwnerID != owner.Lobby.YouID || len(players) != 2 {
		t.Fatal("membership/owner not persisted")
	}
	for _, p := range players {
		if len(p.TokenHash) != 32 || string(p.TokenHash) == guest.Token {
			t.Fatal("raw or missing token")
		}
	}
	if err = repo.Reset(ctx); err != nil {
		t.Fatal(err)
	}
	record, err = q.GetRoom(ctx, owner.Lobby.Code)
	if err != nil || record.Status != "closed" {
		t.Fatal("stale room remained active")
	}
}
