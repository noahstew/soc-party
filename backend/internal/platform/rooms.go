// Package platform implements single-process room actors and guest sessions.
package platform

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	mathrand "math/rand/v2"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"example.com/soc-party/backend/internal/games"
	"example.com/soc-party/backend/internal/games/zinger"
	"example.com/soc-party/backend/internal/protocol"
)

var (
	ErrNotFound     = errors.New("room not found or expired")
	ErrUnauthorized = errors.New("session expired or revoked; join again")
	ErrConflict     = errors.New("name already in use or room full")
	ErrForbidden    = errors.New("only the room owner can do that")
	ErrUnavailable  = errors.New("rooms temporarily unavailable")
)

const Grace = time.Minute
const Lifetime = 2 * time.Hour
const Idle = 30 * time.Minute

// Records never enter JSON responses. Raw bearer tokens exist only in session replies.
type Member struct {
	ID, Name, Status string
	Hash             [32]byte
	Connected        bool
	Seen             time.Time
	DraftAt          time.Time
}
type Record struct {
	SelectedPackSlugs         []string
	Games                     []protocol.Game
	GameID                    string
	ID, Code, OwnerID, Status string
	MaxPlayers                int
	Expires, Activity         time.Time
	Members                   []Member
	GameState                 any
	GameDeadline              time.Time
}
type Repository interface {
	Save(context.Context, Record, bool) error
}
type request struct {
	run   func(*Record, map[string]chan []byte) (any, error)
	reply chan result
}
type result struct {
	value any
	err   error
}
type actor struct {
	requests chan request
	done     chan struct{}
}
type Registry struct {
	mu      sync.Mutex
	rooms   map[string]*actor
	repo    Repository
	catalog CatalogSource
	now     func() time.Time
	code    func() (string, error)
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	modules *games.Modules
	prompts PromptSource
}

type PromptSource func(context.Context, []string) ([]zinger.Prompt, error)

func NewRegistry(repo Repository, catalog CatalogSource) *Registry {
	ctx, cancel := context.WithCancel(context.Background())
	return &Registry{rooms: make(map[string]*actor), repo: repo, catalog: catalog, now: time.Now, code: NewCode, ctx: ctx, cancel: cancel, modules: games.NewModules()}
}
func (r *Registry) RegisterGame(module games.Module, prompts PromptSource) error {
	if prompts == nil {
		return fmt.Errorf("prompt source is required")
	}
	if err := r.modules.Register(module); err != nil {
		return err
	}
	r.prompts = prompts
	return nil
}
func (r *Registry) Close() { r.cancel(); r.wg.Wait() }
func randomHex(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
func NewCode() (string, error) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 6)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		b[i] = alphabet[n.Int64()]
	}
	return string(b), nil
}
func ValidCode(code string) bool {
	if len(code) != 6 {
		return false
	}
	for _, c := range code {
		if !strings.ContainsRune("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", c) {
			return false
		}
	}
	return true
}
func validName(name string) bool {
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 24 {
		return false
	}
	for _, c := range name {
		if unicode.IsControl(c) {
			return false
		}
	}
	return true
}
func newMember(name string, now time.Time) (Member, string, error) {
	name = strings.TrimSpace(name)
	if !validName(name) {
		return Member{}, "", fmt.Errorf("name must contain 1–24 characters without control characters")
	}
	id, err := randomHex(16)
	if err != nil {
		return Member{}, "", err
	}
	token, err := randomHex(32)
	return Member{ID: id, Name: name, Status: "active", Hash: sha256.Sum256([]byte(token)), Seen: now}, token, err
}
func (r *Registry) Create(ctx context.Context, name string) (protocol.Session, error) {
	games, err := r.loadCatalog(ctx)
	if err != nil || len(games) == 0 {
		return protocol.Session{}, ErrUnavailable
	}
	selected := []string{}
	if len(games[0].Packs) > 0 {
		selected = append(selected, games[0].Packs[0].Slug)
	}

	p, token, err := newMember(name, r.now())
	if err != nil {
		return protocol.Session{}, err
	}
	id, err := randomHex(16)
	if err != nil {
		return protocol.Session{}, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.ctx.Err() != nil || len(r.rooms) >= 256 {
		return protocol.Session{}, ErrUnavailable
	}
	for range 10 {
		code, err := r.code()
		if err != nil {
			return protocol.Session{}, err
		}
		if _, ok := r.rooms[code]; ok {
			continue
		}
		s := Record{GameID: games[0].ID, Games: games, SelectedPackSlugs: selected, ID: id, Code: code, OwnerID: p.ID, Status: "lobby", MaxPlayers: 8, Expires: r.now().Add(Lifetime), Activity: r.now(), Members: []Member{p}}
		// PostgreSQL also rejects historical code collisions. Retry without overwriting history.
		if err := r.repo.Save(ctx, s, true); err != nil {
			if errors.Is(err, ErrConflict) {
				continue
			}
			return protocol.Session{}, ErrUnavailable
		}
		a := &actor{requests: make(chan request, 32), done: make(chan struct{})}
		r.rooms[code] = a
		r.wg.Add(1)
		go r.run(a, s)
		return protocol.Session{Token: token, Lobby: project(s, p.ID)}, nil
	}
	return protocol.Session{}, ErrUnavailable
}
func (r *Registry) call(ctx context.Context, code string, run func(*Record, map[string]chan []byte) (any, error)) (any, error) {
	r.mu.Lock()
	a := r.rooms[code]
	r.mu.Unlock()
	if a == nil {
		return nil, ErrNotFound
	}
	req := request{run: run, reply: make(chan result, 1)}
	select {
	case a.requests <- req:
	case <-a.done:
		return nil, ErrNotFound
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	select {
	case res := <-req.reply:
		return res.value, res.err
	case <-a.done:
		return nil, ErrNotFound
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}
func (r *Registry) persist(s Record) error {
	ctx, cancel := context.WithTimeout(r.ctx, 3*time.Second)
	defer cancel()
	if err := r.repo.Save(ctx, s, false); err != nil {
		return ErrUnavailable
	}
	return nil
}
func authenticate(s *Record, token string) (*Member, error) {
	if len(token) != 64 {
		return nil, ErrUnauthorized
	}
	hash := sha256.Sum256([]byte(token))
	for i := range s.Members {
		p := &s.Members[i]
		if p.Status == "active" && subtle.ConstantTimeCompare(p.Hash[:], hash[:]) == 1 {
			return p, nil
		}
	}
	return nil, ErrUnauthorized
}
func project(s Record, you string) protocol.Lobby {
	p := protocol.Lobby{Code: s.Code, OwnerID: s.OwnerID, YouID: you, GameID: s.GameID, Games: s.Games, SelectedPackSlugs: append([]string{}, s.SelectedPackSlugs...), MaxPlayers: s.MaxPlayers, ExpiresAt: s.Expires.UTC().Format(time.RFC3339), Players: []protocol.Player{}}
	connected := 0
	for _, m := range s.Members {
		if m.Status != "active" {
			continue
		}
		p.Players = append(p.Players, protocol.Player{ID: m.ID, Name: m.Name, Connected: m.Connected})
		if m.Connected {
			connected++
		}
	}
	p.CanStart = s.Status == "lobby" && connected >= 3 && packsReady(s)
	return p
}
func count(s Record) int {
	n := 0
	for _, p := range s.Members {
		if p.Status == "active" {
			n++
		}
	}
	return n
}
func repairOwner(s *Record) {
	for _, p := range s.Members {
		if p.ID == s.OwnerID && p.Status == "active" {
			return
		}
	}
	for _, p := range s.Members {
		if p.Status == "active" {
			s.OwnerID = p.ID
			return
		}
	}
	s.Status = "closed"
}
func (r *Registry) Join(ctx context.Context, code, name string) (protocol.Session, error) {
	p, token, err := newMember(name, r.now())
	if err != nil {
		return protocol.Session{}, err
	}
	value, err := r.call(ctx, code, func(s *Record, _ map[string]chan []byte) (any, error) {
		if s.Status != "lobby" {
			return nil, ErrConflict
		}
		if count(*s) >= s.MaxPlayers || len(s.Members) >= 128 {
			return nil, ErrConflict
		}
		for _, m := range s.Members {
			if m.Status == "active" && strings.EqualFold(m.Name, p.Name) {
				return nil, ErrConflict
			}
		}
		s.Members = append(s.Members, p)
		s.Activity = r.now()
		return protocol.Session{Token: token, Lobby: project(*s, p.ID)}, nil
	})
	if err != nil {
		return protocol.Session{}, err
	}
	return value.(protocol.Session), nil
}
func (r *Registry) Reconnect(ctx context.Context, code, token string) (protocol.Session, error) {
	games, err := r.loadCatalog(ctx)
	if err != nil {
		return protocol.Session{}, err
	}
	next, err := randomHex(32)
	if err != nil {
		return protocol.Session{}, err
	}
	value, err := r.call(ctx, code, func(s *Record, _ map[string]chan []byte) (any, error) {
		p, err := authenticate(s, token)
		if err != nil {
			return nil, err
		}
		if !p.Connected && r.now().Sub(p.Seen) >= Grace {
			return nil, ErrUnauthorized
		}
		applyCatalog(s, games)
		p.Hash = sha256.Sum256([]byte(next))
		p.Seen = r.now()
		s.Activity = r.now()
		return protocol.Session{Token: next, Lobby: project(*s, p.ID)}, nil
	})
	if err != nil {
		return protocol.Session{}, err
	}
	return value.(protocol.Session), nil
}

type subscription struct {
	id string
	ch chan []byte
}
type unsubscription struct{ id string }

func (r *Registry) Subscribe(ctx context.Context, code, token string) (string, <-chan []byte, error) {
	games, err := r.loadCatalog(ctx)
	if err != nil {
		return "", nil, err
	}
	value, err := r.call(ctx, code, func(s *Record, _ map[string]chan []byte) (any, error) {
		p, err := authenticate(s, token)
		if err != nil {
			return nil, err
		}
		if !p.Connected && r.now().Sub(p.Seen) >= Grace {
			return nil, ErrUnauthorized
		}
		applyCatalog(s, games)
		p.Connected = true
		p.Seen = r.now()
		if s.Status == "game" {
			if err := r.applyGame(s, zinger.Presence{PlayerID: p.ID, Connected: true}); err != nil {
				return nil, err
			}
		}
		s.Activity = r.now()
		return subscription{id: p.ID, ch: make(chan []byte, 1)}, nil
	})
	if err != nil {
		return "", nil, err
	}
	v := value.(subscription)
	return v.id, v.ch, nil
}
func (r *Registry) Disconnect(code, id string, ch <-chan []byte) {
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	_, _ = r.call(ctx, code, func(s *Record, subs map[string]chan []byte) (any, error) {
		if subs[id] != ch {
			return nil, nil
		}
		for i := range s.Members {
			if s.Members[i].ID == id {
				s.Members[i].Connected = false
				s.Members[i].Seen = r.now()
				if s.Status == "game" {
					_ = r.applyGame(s, zinger.Presence{PlayerID: id})
				}
			}
		}
		return unsubscription{id: id}, nil
	})
}
func (r *Registry) Command(ctx context.Context, code, token, kind string, payload any) error {
	var catalogGames []protocol.Game
	if kind == "select_game" || kind == "select_pack" {
		var err error
		catalogGames, err = r.loadCatalog(ctx)
		if err != nil {
			return err
		}
	}

	var loaded []zinger.Prompt
	if kind == "start_game" {
		value, err := r.call(ctx, code, func(s *Record, _ map[string]chan []byte) (any, error) {
			p, err := authenticate(s, token)
			if err != nil {
				return nil, err
			}
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			if !project(*s, p.ID).CanStart {
				return nil, ErrConflict
			}
			return append([]string(nil), s.SelectedPackSlugs...), nil
		})
		if err != nil {
			return err
		}
		if r.prompts == nil {
			return ErrUnavailable
		}
		loadCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
		loaded, err = r.prompts(loadCtx, value.([]string))
		cancel()
		if err != nil {
			return ErrUnavailable
		}
	}

	_, err := r.call(ctx, code, func(s *Record, _ map[string]chan []byte) (any, error) {
		p, err := authenticate(s, token)
		if err != nil {
			return nil, err
		}
		p.Seen = r.now()
		s.Activity = r.now()
		switch kind {
		case "ping":
			return nil, nil
		case "leave_room":
			if s.Status == "game" {
				if err := r.applyGame(s, zinger.Presence{PlayerID: p.ID, Left: true}); err != nil {
					return nil, err
				}
			}
			p.Status = "left"
			p.Connected = false
			repairOwner(s)
		case "kick_player":
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			id := payload.(*protocol.Kick).PlayerID
			if id == p.ID {
				return nil, fmt.Errorf("owner must leave rather than kick themselves")
			}
			found := false
			for i := range s.Members {
				if s.Members[i].ID == id && s.Members[i].Status == "active" {
					if s.Status == "game" {
						if err := r.applyGame(s, zinger.Presence{PlayerID: id, Left: true}); err != nil {
							return nil, err
						}
					}
					s.Members[i].Status = "kicked"
					s.Members[i].Connected = false
					found = true
				}
			}
			if !found {
				return nil, ErrNotFound
			}
		case "select_game":
			if s.Status != "lobby" {
				return nil, ErrConflict
			}
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			gameID := payload.(*protocol.GameSelection).GameID
			applyCatalog(s, catalogGames)
			if _, ok := findGame(catalogGames, gameID); !ok {
				return nil, fmt.Errorf("game is not available")
			}
			if s.GameID != gameID {
				s.SelectedPackSlugs = []string{}
			}
			s.GameID = gameID
		case "select_pack":
			if s.Status != "lobby" {
				return nil, ErrConflict
			}
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			selection := payload.(*protocol.PackSelection)
			applyCatalog(s, catalogGames)
			game, ok := findGame(catalogGames, s.GameID)
			if !ok || selection.GameID != s.GameID || !hasPack(game, selection.PackSlug) || selection.Selected == nil {
				return nil, fmt.Errorf("choose an available pack for the current game and provide its selected state")
			}
			if *selection.Selected && !slices.Contains(s.SelectedPackSlugs, selection.PackSlug) {
				s.SelectedPackSlugs = append(s.SelectedPackSlugs, selection.PackSlug)
			} else if !*selection.Selected {
				s.SelectedPackSlugs = slices.DeleteFunc(s.SelectedPackSlugs, func(slug string) bool { return slug == selection.PackSlug })
			}
		case "update_settings":
			if s.Status != "lobby" {
				return nil, ErrConflict
			}
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			n := payload.(*protocol.Settings).MaxPlayers
			if n < 3 || n > 8 || n < count(*s) {
				return nil, fmt.Errorf("capacity must be 3–8 and fit current players")
			}
			s.MaxPlayers = n
		case "start_game":
			if s.Status != "lobby" || s.OwnerID != p.ID || !project(*s, p.ID).CanStart {
				return nil, ErrForbidden
			}
			module, ok := r.modules.Lookup(s.GameID)
			if !ok {
				return nil, ErrUnavailable
			}
			players := []zinger.Player{}
			for _, member := range s.Members {
				if member.Status == "active" && member.Connected {
					players = append(players, zinger.Player{ID: member.ID, Name: member.Name, Connected: true})
				}
			}
			var seed [16]byte
			if _, err := rand.Read(seed[:]); err != nil {
				return nil, ErrUnavailable
			}
			rng := mathrand.New(mathrand.NewPCG(binary.LittleEndian.Uint64(seed[:8]), binary.LittleEndian.Uint64(seed[8:])))
			next, effects, err := module.Transition(nil, zinger.Start{Players: players, Prompts: loaded}, games.Input{Now: r.now(), Random: rng})
			if err != nil {
				return nil, err
			}
			s.GameState = next
			s.Status = "game"
			s.GameDeadline = deadline(effects)
		case "update_draft", "submit_answer":
			if s.Status != "game" {
				return nil, zinger.WrongPhase
			}
			if kind == "update_draft" && r.now().Sub(p.DraftAt) < 100*time.Millisecond {
				return nil, zinger.Code("rate_limited")
			}
			d := payload.(*protocol.Draft)
			if err := r.applyGame(s, zinger.AnswerIntent{PlayerID: p.ID, PromptID: d.PromptID, Text: d.Text, Submit: kind == "submit_answer"}); err != nil {
				return nil, err
			}
			p.DraftAt = r.now()
		case "cast_vote":
			v := payload.(*protocol.Vote)
			if err := r.applyGame(s, zinger.VoteIntent{PlayerID: p.ID, MatchupID: v.MatchupID, AnswerID: v.AnswerID}); err != nil {
				return nil, err
			}
		case "submit_final_votes":
			v := payload.(*protocol.FinalVotes)
			if err := r.applyGame(s, zinger.FinalVoteIntent{PlayerID: p.ID, AnswerIDs: v.AnswerIDs}); err != nil {
				return nil, err
			}
		case "return_to_lobby":
			state, ok := s.GameState.(*zinger.State)
			if !ok || state.Phase != zinger.GameOver {
				return nil, zinger.WrongPhase
			}
			if s.OwnerID != p.ID {
				return nil, ErrForbidden
			}
			s.Status = "lobby"
			s.GameState = nil
			s.GameDeadline = time.Time{}
		default:
			return nil, fmt.Errorf("unknown command")
		}
		return nil, nil
	})
	return err
}

func deadline(effects []any) time.Time {
	for _, effect := range effects {
		if scheduled, ok := effect.(zinger.Schedule); ok {
			return scheduled.At
		}
	}
	return time.Time{}
}
func (r *Registry) applyGame(s *Record, event any) error {
	module, ok := r.modules.Lookup(s.GameID)
	if !ok {
		return ErrUnavailable
	}
	next, effects, err := module.Transition(s.GameState, event, games.Input{Now: r.now()})
	if err != nil {
		return err
	}
	s.GameState = next
	s.GameDeadline = deadline(effects)
	return nil
}
func (r *Registry) cleanup(s *Record) {
	now := r.now()
	for i := range s.Members {
		p := &s.Members[i]
		if p.Status == "active" && !p.Connected && now.Sub(p.Seen) >= Grace {
			if s.Status == "game" {
				_ = r.applyGame(s, zinger.Presence{PlayerID: p.ID, Left: true})
			}
			p.Status = "left"
		}
	}
	repairOwner(s)
	if !now.Before(s.Expires) || now.Sub(s.Activity) >= Idle {
		s.Status = "closed"
	}
}
func (r *Registry) run(a *actor, s Record) {
	defer r.wg.Done()
	subs := make(map[string]chan []byte)
	defer func() {
		for _, ch := range subs {
			close(ch)
		}
		r.mu.Lock()
		if r.rooms[s.Code] == a {
			delete(r.rooms, s.Code)
		}
		r.mu.Unlock()
		close(a.done)
	}()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	gameTimer := time.NewTimer(time.Hour)
	if !gameTimer.Stop() {
		<-gameTimer.C
	}
	defer gameTimer.Stop()
	var gameTimerC <-chan time.Time
	resetGameTimer := func() {
		if !gameTimer.Stop() && gameTimerC != nil {
			select {
			case <-gameTimer.C:
			default:
			}
		}
		gameTimerC = nil
		if !s.GameDeadline.IsZero() {
			delay := s.GameDeadline.Sub(r.now())
			if delay < 0 {
				delay = 0
			}
			gameTimer.Reset(delay)
			gameTimerC = gameTimer.C
		}
	}
	resetGameTimer()
	for {
		select {
		case <-r.ctx.Done():
			s.Status = "closed"
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			_ = r.repo.Save(ctx, s, false)
			cancel()
			return
		case <-ticker.C:
			next := s
			next.Members = append([]Member(nil), s.Members...)
			next.SelectedPackSlugs = append([]string{}, s.SelectedPackSlugs...)
			r.cleanup(&next)
			if next.Status == "closed" {
				_ = r.persist(next)
				return
			}
			changed := false
			for i := range s.Members {
				if s.Members[i].Status != next.Members[i].Status {
					changed = true
				}
			}
			if changed && r.persist(next) == nil {
				s = next
				resetGameTimer()
				r.broadcast(s, subs)
			}
		case <-gameTimerC:
			gameTimerC = nil
			next := s
			if err := r.applyGame(&next, zinger.Tick{}); err == nil {
				s = next
				resetGameTimer()
				r.broadcast(s, subs)
			}
		case req := <-a.requests:
			if !r.now().Before(s.Expires) || r.now().Sub(s.Activity) >= Idle {
				req.reply <- result{err: ErrNotFound}
				s.Status = "closed"
				_ = r.persist(s)
				return
			}
			next := s
			next.Members = append([]Member(nil), s.Members...)
			next.SelectedPackSlugs = append([]string{}, s.SelectedPackSlugs...)
			value, err := req.run(&next, subs)
			if err == nil {
				err = r.persist(next)
			}
			if err == nil {
				s = next
				resetGameTimer()
				switch effect := value.(type) {
				case subscription:
					if old := subs[effect.id]; old != nil {
						close(old)
					}
					subs[effect.id] = effect.ch
				case unsubscription:
					if old := subs[effect.id]; old != nil {
						close(old)
						delete(subs, effect.id)
					}
				}
				r.broadcast(s, subs)
			}
			req.reply <- result{value: value, err: err}
			if s.Status == "closed" {
				return
			}
		}
	}
}
func (r *Registry) broadcast(s Record, subs map[string]chan []byte) {
	active := make(map[string]bool)
	for _, p := range s.Members {
		if p.Status == "active" {
			active[p.ID] = true
		}
	}
	for id, ch := range subs {
		if !active[id] {
			close(ch)
			delete(subs, id)
			continue
		}
		// Keep only the newest projection; slow network writers have their own deadline.
		select {
		case <-ch:
		default:
		}
		if s.Status == "game" && s.GameState != nil {
			if module, ok := r.modules.Lookup(s.GameID); ok {
				moduleView, err := module.Project(s.GameState, id, r.now())
				if err == nil {
					ch <- protocol.Message("game_state", "", moduleView)
					continue
				}
			}
		}
		ch <- protocol.Message("lobby_state", "", project(s, id))
	}
}
