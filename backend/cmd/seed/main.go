// Command seed transactionally upserts the original starter pack through sqlc.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"example.com/soc-party/backend/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

type pack struct {
	Slug    string   `json:"slug"`
	Title   string   `json:"title"`
	Prompts []string `json:"prompts"`
}

func main() {
	if err := run(); err != nil {
		slog.Error("seed failed", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer pool.Close()
	return seed(ctx, pool, "data/official_pack.json")
}

func readPack(path string) (pack, error) {
	var p pack
	f, err := os.Open(path)
	if err != nil {
		return p, err
	}
	defer func() { _ = f.Close() }()
	dec := json.NewDecoder(io.LimitReader(f, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&p); err != nil {
		return p, fmt.Errorf("decode pack: %w", err)
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return p, fmt.Errorf("pack must contain exactly one JSON value")
	}
	if strings.TrimSpace(p.Slug) == "" || utf8.RuneCountInString(p.Slug) > 80 || strings.TrimSpace(p.Title) == "" || utf8.RuneCountInString(p.Title) > 120 || len(p.Prompts) < 1 || len(p.Prompts) > 1000 {
		return p, fmt.Errorf("invalid pack metadata or prompt count")
	}
	for i, text := range p.Prompts {
		if strings.TrimSpace(text) == "" || utf8.RuneCountInString(text) > 500 {
			return p, fmt.Errorf("invalid prompt at position %d", i)
		}
	}
	return p, nil
}

func seed(ctx context.Context, pool *pgxpool.Pool, path string) error {
	p, err := readPack(path)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	q := store.New(tx)
	id, err := q.CreatePack(ctx, store.CreatePackParams{Slug: p.Slug, Title: p.Title, IsOfficial: true, Status: "published"})
	if err != nil {
		return fmt.Errorf("create pack: %w", err)
	}
	for i, text := range p.Prompts {
		if _, err := q.CreatePrompt(ctx, store.CreatePromptParams{PackID: id, Position: int32(i), Text: text, Status: "approved"}); err != nil {
			return fmt.Errorf("create prompt %d: %w", i, err)
		}
	}
	return tx.Commit(ctx)
}
