//go:build integration

package main

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

// This test targets a disposable development/CI database. It never drops data.
func TestMigrationsQueriesAndIdempotentSeed(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL is required for integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	db, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	provider, err := goose.NewProvider(goose.DialectPostgres, db, os.DirFS("../../migrations"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.Up(ctx); err != nil {
		t.Fatal(err)
	}
	if results, err := provider.Up(ctx); err != nil || len(results) != 0 {
		t.Fatalf("second migration: %v %v", results, err)
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	path := "../../data/official_pack.json"
	if err := seed(ctx, pool, path); err != nil {
		t.Fatal(err)
	}
	q := store.New(pool)
	before, err := q.CountPacks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err := seed(ctx, pool, path); err != nil {
		t.Fatal(err)
	}
	after, err := q.CountPacks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("seed duplicated packs: %d -> %d", before, after)
	}
	packs, err := q.ListOfficialPacks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, p := range packs {
		if p.Slug == "small-talk-big-nonsense" {
			found = true
			count, err := q.CountPrompts(ctx, p.ID)
			if err != nil {
				t.Fatal(err)
			}
			if count != 24 {
				t.Fatalf("seed prompt count=%d, want 24", count)
			}
		}
	}
	if !found {
		t.Fatal("official seed pack absent")
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tq := store.New(tx)
	draft, err := tq.CreatePack(ctx, store.CreatePackParams{Slug: "integration-draft", Title: "Hidden draft", IsOfficial: true, Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tq.CreatePrompt(ctx, store.CreatePromptParams{PackID: draft, Position: 0, Text: "A test-only original prompt.", Status: "pending"}); err != nil {
		t.Fatal(err)
	}
	visible, err := tq.ListOfficialPacks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range visible {
		if p.ID == draft {
			t.Fatal("draft leaked into official list")
		}
	}
	count, err := tq.CountPrompts(ctx, draft)
	if err != nil || count != 1 {
		t.Fatalf("create/count prompt: %d %v", count, err)
	}
	// Violating a real DB constraint must fail. The transaction is rolled back above.
	if _, err := tq.CreatePrompt(ctx, store.CreatePromptParams{PackID: draft, Position: 1, Text: "", Status: "pending"}); err == nil {
		t.Fatal("empty prompt accepted")
	}
}
