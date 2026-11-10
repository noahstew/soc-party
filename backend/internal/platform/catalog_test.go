package platform

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"
	"testing"

	"example.com/soc-party/backend/internal/protocol"
)

func TestCatalogGamesMultiPackSelectionAndRefresh(t *testing.T) {
	ctx := context.Background()
	games, _ := testCatalog(ctx)
	games = append(games, protocol.Game{ID: "another_game", Title: "Another Game", Packs: []protocol.Pack{{Slug: "alternate", Title: "Alternate"}}})
	var mu sync.Mutex
	fail := false
	repo := &memoryRepo{}
	r := NewRegistry(repo, func(context.Context) ([]protocol.Game, error) {
		mu.Lock()
		defer mu.Unlock()
		if fail {
			return nil, errors.New("catalog offline")
		}
		return games, nil
	})
	t.Cleanup(r.Close)
	owner, err := r.Create(ctx, "Owner")
	if err != nil {
		t.Fatal(err)
	}
	code := owner.Lobby.Code
	_, updates, err := r.Subscribe(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, updates); len(got.Games) != 2 || len(got.Games[0].Packs) != 2 {
		t.Fatal("catalog omitted choices")
	}
	selectPack := func(game, slug string, selected bool) error {
		return r.Command(ctx, code, owner.Token, "select_pack", &protocol.PackSelection{GameID: game, PackSlug: slug, Selected: &selected})
	}
	for range 2 {
		if err := selectPack("zinger", "extended", true); err != nil {
			t.Fatal(err)
		}
	}
	if got := readLobby(t, updates); !reflect.DeepEqual(got.SelectedPackSlugs, []string{"og", "extended"}) {
		t.Fatalf("multi-selection or idempotency failed: %v", got.SelectedPackSlugs)
	}
	if err := selectPack("zinger", "og", false); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, updates); !reflect.DeepEqual(got.SelectedPackSlugs, []string{"extended"}) {
		t.Fatal("toggling OG removed Extended")
	}
	// Failed removal must not mutate the actor's original slice backing array.
	repo.mu.Lock()
	repo.fail = true
	repo.mu.Unlock()
	if err := selectPack("zinger", "extended", false); !errors.Is(err, ErrUnavailable) {
		t.Fatal("failed save was accepted")
	}
	repo.mu.Lock()
	repo.fail = false
	repo.mu.Unlock()
	if err := r.Command(ctx, code, owner.Token, "ping", &protocol.Empty{}); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, updates); !reflect.DeepEqual(got.SelectedPackSlugs, []string{"extended"}) {
		t.Fatal("failed save changed backing array")
	}
	if err := r.Command(ctx, code, owner.Token, "select_game", &protocol.GameSelection{GameID: "another_game"}); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, updates); got.GameID != "another_game" || len(got.SelectedPackSlugs) != 0 || got.CanStart {
		t.Fatal("game switch retained incompatible selections")
	}
	if err := selectPack("zinger", "extended", true); err == nil {
		t.Fatal("stale game intent accepted")
	}
	if err := selectPack("another_game", "extended", true); err == nil {
		t.Fatal("foreign pack accepted")
	}
	if err := selectPack("another_game", "alternate", true); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, updates); !reflect.DeepEqual(got.SelectedPackSlugs, []string{"alternate"}) {
		t.Fatal("other game's selection failed")
	}
	mu.Lock()
	fail = true
	mu.Unlock()
	if err := selectPack("another_game", "alternate", false); !errors.Is(err, ErrUnavailable) {
		t.Fatal("catalog error was ignored")
	}
	mu.Lock()
	fail = false
	games[1].Packs = []protocol.Pack{{Slug: "new_pack", Title: "New Pack"}}
	mu.Unlock()
	resumed, err := r.Reconnect(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	if len(resumed.Lobby.SelectedPackSlugs) != 0 || resumed.Lobby.Games[1].Packs[0].Slug != "new_pack" {
		t.Fatal("reconnect did not refresh catalog or remove unavailable selection")
	}
}

func TestCatalogValidationAndLargeCatalog(t *testing.T) {
	cases := []struct {
		name  string
		games []protocol.Game
		valid bool
	}{
		{"duplicate game", []protocol.Game{{ID: "zinger", Title: "Zinger"}, {ID: "zinger", Title: "Duplicate"}}, false},
		{"invalid game", []protocol.Game{{ID: "../game", Title: "Invalid"}}, false},
		{"empty title", []protocol.Game{{ID: "zinger", Title: " "}}, false},
		{"duplicate pack", []protocol.Game{{ID: "zinger", Title: "Zinger", Packs: []protocol.Pack{{Slug: "og", Title: "OG"}, {Slug: "og", Title: "Duplicate"}}}}, false},
		{"invalid pack", []protocol.Game{{ID: "zinger", Title: "Zinger", Packs: []protocol.Pack{{Slug: "", Title: "Invalid"}}}}, false},
		{"no packs", []protocol.Game{{ID: "zinger", Title: "Zinger"}}, true},
	}
	large := make([]protocol.Game, 100)
	for i := range large {
		large[i] = protocol.Game{ID: fmt.Sprintf("game_%d", i), Title: fmt.Sprintf("Game %d", i)}
		for j := 0; j < 100; j++ {
			large[i].Packs = append(large[i].Packs, protocol.Pack{Slug: fmt.Sprintf("pack_%d", j), Title: fmt.Sprintf("Pack %d", j)})
		}
	}
	cases = append(cases, struct {
		name  string
		games []protocol.Game
		valid bool
	}{"large catalog", large, true})
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := NewRegistry(&memoryRepo{}, func(context.Context) ([]protocol.Game, error) { return tc.games, nil })
			defer r.Close()
			owner, err := r.Create(context.Background(), "Owner")
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v err=%v", tc.valid, err)
			}
			if tc.valid && len(owner.Lobby.Games) != len(tc.games) {
				t.Fatal("catalog truncated")
			}
		})
	}
}
