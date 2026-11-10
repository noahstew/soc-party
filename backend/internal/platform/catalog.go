package platform

import (
	"context"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"example.com/soc-party/backend/internal/protocol"
)

// CatalogSource supplies registered games and their published packs. It performs
// I/O outside room actors; each actor receives an immutable validated snapshot.
type CatalogSource func(context.Context) ([]protocol.Game, error)

func validCatalogID(id string) bool {
	if len(id) == 0 || len(id) > 80 || id[0] < 'a' || id[0] > 'z' {
		return false
	}
	for _, c := range id {
		if !strings.ContainsRune("abcdefghijklmnopqrstuvwxyz0123456789_-", c) {
			return false
		}
	}
	return true
}

func (r *Registry) loadCatalog(ctx context.Context) ([]protocol.Game, error) {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	games, err := r.catalog(ctx)
	if err != nil {
		return nil, ErrUnavailable
	}
	result := make([]protocol.Game, 0, len(games))
	seenGames := map[string]bool{}
	for _, game := range games {
		if !validCatalogID(game.ID) || seenGames[game.ID] || strings.TrimSpace(game.Title) == "" || utf8.RuneCountInString(game.Title) > 120 {
			return nil, ErrUnavailable
		}
		seenGames[game.ID] = true
		packs := make([]protocol.Pack, 0, len(game.Packs))
		seenPacks := map[string]bool{}
		for _, pack := range game.Packs {
			if !validCatalogID(pack.Slug) || seenPacks[pack.Slug] || strings.TrimSpace(pack.Title) == "" || utf8.RuneCountInString(pack.Title) > 120 {
				return nil, ErrUnavailable
			}
			seenPacks[pack.Slug] = true
			packs = append(packs, pack)
		}
		result = append(result, protocol.Game{ID: game.ID, Title: game.Title, Packs: packs})
	}
	return result, nil
}

func findGame(games []protocol.Game, id string) (protocol.Game, bool) {
	for _, game := range games {
		if game.ID == id {
			return game, true
		}
	}
	return protocol.Game{}, false
}

func hasPack(game protocol.Game, slug string) bool {
	return slices.ContainsFunc(game.Packs, func(pack protocol.Pack) bool { return pack.Slug == slug })
}

func applyCatalog(s *Record, games []protocol.Game) {
	s.Games = games
	game, _ := findGame(games, s.GameID)
	s.SelectedPackSlugs = slices.DeleteFunc(s.SelectedPackSlugs, func(slug string) bool { return !hasPack(game, slug) })
}

func packsReady(s Record) bool {
	game, ok := findGame(s.Games, s.GameID)
	if !ok || len(s.SelectedPackSlugs) == 0 {
		return false
	}
	for _, slug := range s.SelectedPackSlugs {
		if !hasPack(game, slug) {
			return false
		}
	}
	return true
}
