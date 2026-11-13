//go:build integration

package platform

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/games/zinger"
	"example.com/soc-party/backend/internal/protocol"
	"example.com/soc-party/backend/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresStartPersistsPlayingStatus(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	r := NewRegistry(PostgresRepository{Pool: tx}, testCatalog)
	defer r.Close()
	if err := r.RegisterGame(zinger.Module{Config: zinger.DefaultConfig()}, func(context.Context, []string) ([]zinger.Prompt, error) {
		prompts := make([]zinger.Prompt, 7)
		for i := range prompts {
			prompts[i] = zinger.Prompt{ID: fmt.Sprint(i), Text: fmt.Sprintf("Prompt %d", i)}
		}
		return prompts, nil
	}); err != nil {
		t.Fatal(err)
	}
	owner, err := r.Create(ctx, "Owner")
	if err != nil {
		t.Fatal(err)
	}
	sessions := []protocol.Session{owner}
	for _, name := range []string{"A", "B"} {
		session, err := r.Join(ctx, owner.Lobby.Code, name)
		if err != nil {
			t.Fatal(err)
		}
		sessions = append(sessions, session)
	}
	for _, session := range sessions {
		if _, _, err := r.Subscribe(ctx, owner.Lobby.Code, session.Token); err != nil {
			t.Fatal(err)
		}
	}
	if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "start_game", &protocol.Empty{}); err != nil {
		t.Fatal(err)
	}
	record, err := store.New(tx).GetRoom(ctx, owner.Lobby.Code)
	if err != nil || record.Status != "playing" {
		t.Fatalf("status=%q err=%v", record.Status, err)
	}
}

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
	r := NewRegistry(repo, func(ctx context.Context) ([]protocol.Game, error) {
		games, err := testCatalog(ctx)
		return append(games, protocol.Game{ID: "future_game", Title: "Future Game", Packs: []protocol.Pack{{Slug: "alternate", Title: "Alternate"}}}), err
	})
	defer r.Close()
	owner, err := r.Create(ctx, "Owner")
	if err != nil {
		t.Fatal(err)
	}
	guest, err := r.Join(ctx, owner.Lobby.Code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Command(ctx, owner.Lobby.Code, owner.Token, "select_game", &protocol.GameSelection{GameID: "zinger"}); err != nil {
		t.Fatal(err)
	}
	if err := r.Command(ctx, owner.Lobby.Code, guest.Token, "select_avatar", &protocol.AvatarSelection{AvatarID: 7}); err != nil {
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
		if p.AvatarID < 1 || p.AvatarID > protocol.AvatarCount {
			t.Fatal("invalid persisted avatar")
		}
		if p.ID == guest.Lobby.YouID && p.AvatarID != 7 {
			t.Fatal("avatar selection not persisted")
		}
		if len(p.TokenHash) != 32 || string(p.TokenHash) == guest.Token {
			t.Fatal("raw or missing token")
		}
	}
	if len(record.SelectedPackSlugs) != 1 || record.SelectedPackSlugs[0] != "og" {
		t.Fatal("default pack not persisted")
	}
	for _, selected := range []bool{false, true} {
		if err = r.Command(ctx, owner.Lobby.Code, owner.Token, "select_pack", packSelection(selected)); err != nil {
			t.Fatal(err)
		}
		record, err = q.GetRoom(ctx, owner.Lobby.Code)
		if err != nil || (len(record.SelectedPackSlugs) > 0) != selected {
			t.Fatalf("pack selection not persisted: selected=%v err=%v", selected, err)
		}
	}
	selected := true
	if err = r.Command(ctx, owner.Lobby.Code, owner.Token, "select_pack", &protocol.PackSelection{GameID: "zinger", PackSlug: "extended", Selected: &selected}); err != nil {
		t.Fatal(err)
	}
	record, err = q.GetRoom(ctx, owner.Lobby.Code)
	if err != nil || !reflect.DeepEqual(record.SelectedPackSlugs, []string{"og", "extended"}) {
		t.Fatalf("multiple packs not persisted: %v %v", record.SelectedPackSlugs, err)
	}
	if err = r.Command(ctx, owner.Lobby.Code, owner.Token, "select_game", &protocol.GameSelection{GameID: "future_game"}); err != nil {
		t.Fatal(err)
	}
	if err = r.Command(ctx, owner.Lobby.Code, owner.Token, "select_pack", &protocol.PackSelection{GameID: "future_game", PackSlug: "alternate", Selected: &selected}); err != nil {
		t.Fatal(err)
	}
	record, err = q.GetRoom(ctx, owner.Lobby.Code)
	if err != nil || record.GameID != "future_game" || !reflect.DeepEqual(record.SelectedPackSlugs, []string{"alternate"}) {
		t.Fatalf("registered game/pack not persisted: %+v %v", record, err)
	}
	if err = repo.Reset(ctx); err != nil {
		t.Fatal(err)
	}
	record, err = q.GetRoom(ctx, owner.Lobby.Code)
	if err != nil || record.Status != "closed" {
		t.Fatal("stale room remained active")
	}
}
