//go:build integration

package main

import (
	"context"

	"github.com/jackc/pgx/v5/pgtype"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/database"
	"example.com/soc-party/backend/internal/gamestore"
	"github.com/jackc/pgx/v5/pgxpool"
)

// This test targets a disposable development/CI database. It never drops data.
func TestMigrationsQueriesAndIdempotentSeed(t *testing.T) {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Fatal("DATABASE_URL is required for integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	if err := database.Migrate(ctx, url, "../../migrations", "../../game_migrations"); err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(ctx, url, "../../migrations", "../../game_migrations"); err != nil {
		t.Fatal(err)
	}
	url, err := database.GameURL(url)
	if err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	directory := "../../data"
	if err := seedPacks(ctx, pool, directory); err != nil {
		t.Fatal(err)
	}
	q := gamestore.New(pool)
	before, err := q.CountPacks(ctx)
	if err != nil {
		t.Fatal(err)
	}
	beforePrompts := make(map[string][]gamestore.ListApprovedPromptsRow)
	for _, slug := range []string{"og", "extended"} {
		prompts, err := q.ListApprovedPrompts(ctx, slug)
		if err != nil {
			t.Fatal(err)
		}
		beforePrompts[slug] = prompts
	}
	if err := seedPacks(ctx, pool, directory); err != nil {
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
	expected := map[string]pack{}
	for _, name := range []string{"og_pack.json", "extended_pack.json"} {
		content, err := readPack(directory + "/" + name)
		if err != nil {
			t.Fatal(err)
		}
		expected[content.Slug] = content
	}
	found := make(map[string]bool)
	for _, p := range packs {
		content, ok := expected[p.Slug]
		if !ok {
			continue
		}
		found[p.Slug] = true
		if p.Title != content.Title {
			t.Fatalf("wrong title for %s: %s", p.Slug, p.Title)
		}
		count, err := q.CountPrompts(ctx, p.ID)
		if err != nil {
			t.Fatal(err)
		}
		if count != int64(len(content.Prompts)) {
			t.Fatalf("%s prompt count=%d, want %d", p.Slug, count, len(content.Prompts))
		}
		prompts, err := q.ListApprovedPrompts(ctx, p.Slug)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(beforePrompts[p.Slug], prompts) {
			t.Fatalf("repeated seed changed %s prompt IDs/content", p.Slug)
		}
		if len(prompts) != len(content.Prompts) {
			t.Fatalf("approved prompts missing from %s", p.Slug)
		}
		for i, prompt := range prompts {
			if prompt.Position != int32(i) || prompt.Text != content.Prompts[i] {
				t.Fatalf("wrong %s prompt at position %d", p.Slug, i)
			}
		}
	}
	if len(found) != len(expected) {
		t.Fatalf("official seed packs absent: found %v", found)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	tq := gamestore.New(tx)
	draft, err := tq.CreatePack(ctx, gamestore.CreatePackParams{Slug: "integration-draft", Title: "Hidden draft", IsOfficial: true, Status: "draft"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tq.CreatePrompt(ctx, gamestore.CreatePromptParams{PackID: draft, Position: 0, Text: "A test-only original prompt.", Status: "pending"}); err != nil {
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
	if _, err := tq.CreatePrompt(ctx, gamestore.CreatePromptParams{PackID: draft, Position: 1, Text: "", Status: "pending"}); err == nil {
		t.Fatal("empty prompt accepted")
	}
}

func TestGameRecordsAndCrossMatchupConstraints(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	url, err := database.GameURL(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	// Each scenario uses a rollback transaction, including the deliberately invalid write.
	for _, violation := range []string{"valid", "duplicate vote", "cross matchup vote", "duplicate answer slot", "foreign participant", "duplicate active game"} {
		t.Run(violation, func(t *testing.T) {
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer func() { _ = tx.Rollback(ctx) }()
			q := gamestore.New(tx)
			pack, err := q.CreatePack(ctx, gamestore.CreatePackParams{Slug: "records-test", Title: "Test", Status: "draft"})
			if err != nil {
				t.Fatal(err)
			}
			prompt, err := q.CreatePrompt(ctx, gamestore.CreatePromptParams{PackID: pack, Text: "Original test prompt", Status: "approved"})
			if err != nil {
				t.Fatal(err)
			}
			sid := strings.Repeat("a", 32)
			roomID := strings.Repeat("b", 32)
			p1 := strings.Repeat("c", 32)
			p2 := strings.Repeat("d", 32)
			p3 := strings.Repeat("e", 32)
			if _, err = q.InsertGameSession(ctx, gamestore.InsertGameSessionParams{ID: sid, RoomID: roomID, PackID: pack}); err != nil {
				t.Fatal(err)
			}
			for _, id := range []string{p1, p2, p3} {
				if _, err = q.InsertGamePlayer(ctx, gamestore.InsertGamePlayerParams{SessionID: sid, PlayerID: id, DisplayName: "Test"}); err != nil {
					t.Fatal(err)
				}
			}
			round, err := q.InsertRound(ctx, gamestore.InsertRoundParams{SessionID: sid, Number: 1, Deadline: pgtype.Timestamptz{Time: time.Now().Add(time.Minute), Valid: true}})
			if err != nil {
				t.Fatal(err)
			}
			match, err := q.InsertMatchup(ctx, gamestore.InsertMatchupParams{SessionID: sid, RoundID: round.ID, PromptID: prompt, PromptText: "Original snapshot"})
			if err != nil {
				t.Fatal(err)
			}
			answer, err := q.AssignAnswer(ctx, gamestore.AssignAnswerParams{SessionID: sid, MatchupID: match.ID, PlayerID: p1, Slot: 1})
			if err != nil {
				t.Fatal(err)
			}
			if _, err = q.SubmitAnswer(ctx, gamestore.SubmitAnswerParams{SessionID: sid, MatchupID: match.ID, PlayerID: p1, Text: pgtype.Text{String: "A witty answer", Valid: true}}); err != nil {
				t.Fatal(err)
			}
			vote := gamestore.InsertVoteParams{SessionID: sid, MatchupID: match.ID, PlayerID: p3, AnswerID: answer.ID}
			if err = q.InsertVote(ctx, vote); err != nil {
				t.Fatal(err)
			}
			switch violation {
			case "valid":
				return
			case "duplicate vote":
				err = q.InsertVote(ctx, vote)
			case "cross matchup vote":
				vote.MatchupID = match.ID + 1000
				err = q.InsertVote(ctx, vote)
			case "duplicate answer slot":
				_, err = q.AssignAnswer(ctx, gamestore.AssignAnswerParams{SessionID: sid, MatchupID: match.ID, PlayerID: p2, Slot: 1})
			case "foreign participant":
				_, err = q.AssignAnswer(ctx, gamestore.AssignAnswerParams{SessionID: sid, MatchupID: match.ID, PlayerID: strings.Repeat("f", 32), Slot: 2})
			case "duplicate active game":
				_, err = q.InsertGameSession(ctx, gamestore.InsertGameSessionParams{ID: strings.Repeat("f", 32), RoomID: roomID, PackID: pack})
			}
			if err == nil {
				t.Fatal("invalid record accepted")
			}
		})
	}
}
