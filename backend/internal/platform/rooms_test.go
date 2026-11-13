package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/games/zinger"
	"example.com/soc-party/backend/internal/protocol"
)

type memoryRepo struct {
	mu      sync.Mutex
	records map[string]Record
	fail    bool
}

func readGame(t *testing.T, ch <-chan []byte) zinger.GameView {
	t.Helper()
	select {
	case data := <-ch:
		var envelope protocol.Envelope
		if err := json.Unmarshal(data, &envelope); err != nil {
			t.Fatal(err)
		}
		if envelope.Type != "game_state" {
			t.Fatalf("message type=%s", envelope.Type)
		}
		var view zinger.GameView
		if err := json.Unmarshal(envelope.Payload, &view); err != nil {
			t.Fatal(err)
		}
		return view
	case <-time.After(3 * time.Second):
		t.Fatal("no game update")
		return zinger.GameView{}
	}
}

func TestStartGameLoadsSelectedPromptsAndLocksLobby(t *testing.T) {
	r, _, owner := fixture(t)
	config := zinger.DefaultConfig()
	config.VotingIntro = 0
	config.Intro = time.Hour
	loaded := []string{}
	if err := r.RegisterGame(zinger.Module{Config: config}, func(_ context.Context, slugs []string) ([]zinger.Prompt, error) {
		loaded = append([]string(nil), slugs...)
		prompts := []zinger.Prompt{}
		for i := 0; i < 17; i++ {
			prompts = append(prompts, zinger.Prompt{ID: fmt.Sprint(i), Text: fmt.Sprintf("Prompt %d", i)})
		}
		return prompts, nil
	}); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	guests := []protocol.Session{}
	for _, name := range []string{"A", "B"} {
		guest, err := r.Join(ctx, owner.Lobby.Code, name)
		if err != nil {
			t.Fatal(err)
		}
		guests = append(guests, guest)
	}
	_, ownerCh, err := r.Subscribe(ctx, owner.Lobby.Code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	_ = readLobby(t, ownerCh)
	guestCh := make([]<-chan []byte, 0, 2)
	for _, guest := range guests {
		_, ch, err := r.Subscribe(ctx, owner.Lobby.Code, guest.Token)
		if err != nil {
			t.Fatal(err)
		}
		guestCh = append(guestCh, ch)
		_ = readLobby(t, ch)
		_ = readLobby(t, ownerCh)
	}
	if err := r.Command(ctx, owner.Lobby.Code, guests[0].Token, "start_game", &protocol.Empty{}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest start=%v", err)
	}
	if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "start_game", &protocol.Empty{}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(loaded, []string{"og"}) {
		t.Fatalf("loaded packs=%v", loaded)
	}
	if view := readGame(t, ownerCh); view.Phase != zinger.RoundIntro || view.Round != 1 {
		t.Fatalf("owner view=%+v", view)
	}
	for _, ch := range guestCh {
		if view := readGame(t, ch); view.Phase != zinger.RoundIntro {
			t.Fatal(view.Phase)
		}
	}
	if _, err := r.Join(ctx, owner.Lobby.Code, "Late"); !errors.Is(err, ErrConflict) {
		t.Fatalf("late join=%v", err)
	}
	if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "select_pack", packSelection(false)); !errors.Is(err, ErrConflict) {
		t.Fatalf("midgame setting=%v", err)
	}
	if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "return_to_lobby", &protocol.Empty{}); err != zinger.WrongPhase {
		t.Fatalf("early return=%v", err)
	}
}

func TestMultiClientFullGameAndReturnLobby(t *testing.T) {
	r, _, owner := fixture(t)
	config := zinger.DefaultConfig()
	config.VotingIntro = 0
	config.Intro, config.Answering, config.Voting = 2*time.Millisecond, 200*time.Millisecond, 200*time.Millisecond
	config.Reveal, config.Scoreboard = 2*time.Millisecond, 2*time.Millisecond
	config.FinalAnswering, config.FinalVoting, config.FinalReveal, config.FinalIdle = 200*time.Millisecond, 200*time.Millisecond, 2*time.Millisecond, 2*time.Millisecond
	if err := r.RegisterGame(zinger.Module{Config: config}, func(_ context.Context, _ []string) ([]zinger.Prompt, error) {
		prompts := make([]zinger.Prompt, 17)
		for i := range prompts {
			prompts[i] = zinger.Prompt{ID: fmt.Sprint(i), Text: fmt.Sprintf("Prompt %d", i)}
		}
		return prompts, nil
	}); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	sessions := []protocol.Session{owner}
	for _, name := range []string{"A", "B"} {
		session, err := r.Join(ctx, owner.Lobby.Code, name)
		if err != nil {
			t.Fatal(err)
		}
		sessions = append(sessions, session)
	}
	tokens := map[string]string{}
	for _, session := range sessions {
		id, ch, err := r.Subscribe(ctx, owner.Lobby.Code, session.Token)
		if err != nil {
			t.Fatal(err)
		}
		tokens[id] = session.Token
		_ = ch
	}
	if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "start_game", &protocol.Empty{}); err != nil {
		t.Fatal(err)
	}
	state := func() *zinger.State {
		value, err := r.call(ctx, owner.Lobby.Code, func(record *Record, _ map[string]chan []byte) (any, error) { return record.GameState, nil })
		if err != nil {
			t.Fatal(err)
		}
		return value.(*zinger.State)
	}
	for steps := 0; steps < 2000; steps++ {
		current := state()
		switch current.Phase {
		case zinger.RoundIntro, zinger.MatchupReveal, zinger.RoundScoreboard, zinger.FinalIntro, zinger.FinalReveal:
			time.Sleep(time.Until(current.NextTick()) + 3*time.Millisecond)
		case zinger.Answering:
			for _, match := range current.Rounds[current.Round-1] {
				for _, answer := range match.Answers {
					if answer.Submitted {
						continue
					}
					if err := r.Command(ctx, owner.Lobby.Code, tokens[answer.PlayerID], "submit_answer", &protocol.Draft{PromptID: answer.PromptID, Text: "answer " + answer.PlayerID}); err != nil {
						t.Fatal(err)
					}
				}
			}
		case zinger.MatchupVoting:
			match := current.Rounds[current.Round-1][current.MatchIndex]
			for _, player := range current.Players {
				if player.ID == match.Answers[0].PlayerID || player.ID == match.Answers[1].PlayerID || match.Votes[player.ID] != "" {
					continue
				}
				if err := r.Command(ctx, owner.Lobby.Code, tokens[player.ID], "update_vote", &protocol.Vote{MatchupID: match.ID, AnswerID: match.Answers[1].ID}); err != nil {
					t.Fatal(err)
				}
				if err := r.Command(ctx, owner.Lobby.Code, tokens[player.ID], "cast_vote", &protocol.Vote{MatchupID: match.ID, AnswerID: match.Answers[0].ID}); err != nil {
					t.Fatal(err)
				}
			}
		case zinger.FinalAnswering:
			for _, answer := range current.FinalAnswers {
				if answer.Submitted {
					continue
				}
				if err := r.Command(ctx, owner.Lobby.Code, tokens[answer.PlayerID], "submit_answer", &protocol.Draft{PromptID: answer.PromptID, Text: "final " + answer.PlayerID}); err != nil {
					t.Fatal(err)
				}
			}
		case zinger.FinalVoting:
			for _, player := range current.Players {
				if _, done := current.FinalVotes[player.ID]; done {
					continue
				}
				ids := []string{}
				for _, answer := range current.FinalAnswers {
					if answer.PlayerID != player.ID && answer.Text != "" {
						ids = append(ids, answer.ID, answer.ID, answer.ID)
						break
					}
				}
				if err := r.Command(ctx, owner.Lobby.Code, tokens[player.ID], "submit_final_votes", &protocol.FinalVotes{AnswerIDs: ids}); err != nil {
					t.Fatal(err)
				}
			}
			time.Sleep(config.FinalIdle + 3*time.Millisecond)
		case zinger.GameOver:
			if err := r.Command(ctx, owner.Lobby.Code, owner.Token, "return_to_lobby", &protocol.Empty{}); err != nil {
				t.Fatal(err)
			}
			value, err := r.call(ctx, owner.Lobby.Code, func(record *Record, _ map[string]chan []byte) (any, error) { return record.Status, nil })
			if err != nil || value != "lobby" {
				t.Fatalf("return status=%v err=%v", value, err)
			}
			return
		}
	}
	t.Fatal("full game did not terminate")
}

func (m *memoryRepo) Save(_ context.Context, s Record, _ bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.fail {
		return errors.New("database down")
	}
	if m.records == nil {
		m.records = make(map[string]Record)
	}
	s.Members = append([]Member(nil), s.Members...)
	s.SelectedPackSlugs = append([]string{}, s.SelectedPackSlugs...)
	m.records[s.Code] = s
	return nil
}
func testCatalog(context.Context) ([]protocol.Game, error) {
	return []protocol.Game{{ID: "zinger", Title: "Zinger", Packs: []protocol.Pack{{Slug: "og", Title: "OG"}, {Slug: "extended", Title: "Extended"}}}}, nil
}

func fixture(t *testing.T) (*Registry, *memoryRepo, protocol.Session) {
	t.Helper()
	repo := &memoryRepo{}
	r := NewRegistry(repo, testCatalog)
	t.Cleanup(r.Close)
	owner, err := r.Create(context.Background(), "Owner")
	if err != nil {
		t.Fatal(err)
	}
	return r, repo, owner
}
func readLobby(t *testing.T, ch <-chan []byte) protocol.Lobby {
	t.Helper()
	select {
	case data, ok := <-ch:
		if !ok {
			t.Fatal("closed")
		}
		var e protocol.Envelope
		if err := json.Unmarshal(data, &e); err != nil {
			t.Fatal(err)
		}
		var lobby protocol.Lobby
		if err := json.Unmarshal(e.Payload, &lobby); err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), "token") || strings.Contains(string(data), "Hash") {
			t.Fatal("private token data leaked")
		}
		return lobby
	case <-time.After(3 * time.Second):
		t.Fatal("no room update")
		return protocol.Lobby{}
	}
}
func TestLobbyAuthorizationReconnectAndRevocation(t *testing.T) {
	r, _, owner := fixture(t)
	ctx := context.Background()
	code := owner.Lobby.Code
	_, ownerCh, err := r.Subscribe(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); got.YouID != owner.Lobby.YouID {
		t.Fatal("wrong owner projection")
	}
	guest, err := r.Join(ctx, code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); len(got.Players) != 2 {
		t.Fatal("join did not broadcast")
	}
	guestID, guestCh, err := r.Subscribe(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, guestCh); got.YouID != guestID || got.YouID == owner.Lobby.YouID {
		t.Fatal("wrong player projection")
	}
	if err := r.Command(ctx, code, guest.Token, "kick_player", &protocol.Kick{PlayerID: owner.Lobby.YouID}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unauthorized kick: %v", err)
	}
	if err := r.Command(ctx, code, guest.Token, "update_settings", &protocol.Settings{MaxPlayers: 4}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("unauthorized settings: %v", err)
	}
	if err := r.Command(ctx, code, owner.Token, "update_settings", &protocol.Settings{MaxPlayers: 3}); err != nil {
		t.Fatal(err)
	}
	r.Disconnect(code, guestID, guestCh)
	resumed, err := r.Reconnect(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	if resumed.Token == guest.Token || resumed.Lobby.YouID != guestID {
		t.Fatal("rotation lost identity")
	}
	if _, err := r.Reconnect(ctx, code, guest.Token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("old token reusable: %v", err)
	}
	if _, _, err := r.Subscribe(ctx, code, resumed.Token); err != nil {
		t.Fatal(err)
	}
	if err := r.Command(ctx, code, owner.Token, "kick_player", &protocol.Kick{PlayerID: guestID}); err != nil {
		t.Fatal(err)
	}
	if _, err := r.Reconnect(ctx, code, resumed.Token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("kicked token reusable: %v", err)
	}
}
func TestLimitsConcurrentJoinsAndPersistenceFailure(t *testing.T) {
	r, repo, owner := fixture(t)
	ctx := context.Background()
	code := owner.Lobby.Code
	if _, err := r.Join(ctx, code, "owner"); !errors.Is(err, ErrConflict) {
		t.Fatal("duplicate name accepted")
	}
	for _, name := range []string{"", strings.Repeat("x", 25), "line\nbreak"} {
		if _, err := r.Join(ctx, code, name); err == nil {
			t.Fatalf("accepted %q", name)
		}
	}
	repo.mu.Lock()
	repo.fail = true
	repo.mu.Unlock()
	if _, err := r.Join(ctx, code, "Rollback"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("DB failure not returned")
	}
	repo.mu.Lock()
	repo.fail = false
	repo.mu.Unlock()
	var wg sync.WaitGroup
	for _, name := range []string{"A", "B", "C", "D", "E", "F", "G", "H", "I", "J"} {
		wg.Go(func() { _, _ = r.Join(ctx, code, name) })
	}
	wg.Wait()
	_, ch, err := r.Subscribe(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	lobby := readLobby(t, ch)
	if len(lobby.Players) != 8 {
		t.Fatalf("capacity=%d", len(lobby.Players))
	}
	for _, p := range lobby.Players {
		if p.Name == "Rollback" {
			t.Fatal("failed write changed state")
		}
	}
}
func TestCodesCollisionAndExpiryPolicies(t *testing.T) {
	for range 100 {
		code, err := NewCode()
		if err != nil || !ValidCode(code) {
			t.Fatalf("code=%q err=%v", code, err)
		}
	}
	r, _, owner := fixture(t)
	// Code generator is only read under the registry mutex during Create.
	r.mu.Lock()
	r.code = func() (string, error) { return owner.Lobby.Code, nil }
	r.mu.Unlock()
	if _, err := r.Create(context.Background(), "Other"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("code collision overwrote room")
	}
	now := time.Now()
	s := Record{OwnerID: "a", Status: "lobby", Activity: now, Expires: now.Add(Lifetime), Members: []Member{
		{ID: "a", Status: "active", Seen: now.Add(-Grace)}, {ID: "b", Status: "active", Connected: true, Seen: now},
	}}
	// Exercise cleanup with a clock fixed before any actor is created.
	clockRegistry := &Registry{now: func() time.Time { return now }}
	clockRegistry.cleanup(&s)
	if s.OwnerID != "b" || s.Members[0].Status != "left" {
		t.Fatal("disconnect grace/owner transfer failed")
	}
	s.Activity = now.Add(-Idle)
	clockRegistry.cleanup(&s)
	if s.Status != "closed" {
		t.Fatal("idle room survived")
	}
	s.Status = "lobby"
	s.Activity = now
	s.Expires = now
	clockRegistry.cleanup(&s)
	if s.Status != "closed" {
		t.Fatal("expired room survived")
	}
}
func TestReconnectRejectsGraceExpired(t *testing.T) {
	r, _, owner := fixture(t)
	_, err := r.call(context.Background(), owner.Lobby.Code, func(s *Record, _ map[string]chan []byte) (any, error) {
		s.Members[0].Seen = time.Now().Add(-Grace)
		return nil, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := r.Reconnect(context.Background(), owner.Lobby.Code, owner.Token); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expired identity restored: %v", err)
	}
}

func TestGameSelectionAuthorizationAndProjection(t *testing.T) {
	r, repo, owner := fixture(t)
	ctx := context.Background()
	code := owner.Lobby.Code
	guest, err := r.Join(ctx, code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	_, ch, err := r.Subscribe(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ch); got.GameID != "zinger" {
		t.Fatal("wrong default game")
	}
	if err = r.Command(ctx, code, guest.Token, "select_game", &protocol.GameSelection{GameID: "zinger"}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest selected game: %v", err)
	}
	for _, id := range []string{"", "coming_soon", "wit_parade", "unknown"} {
		if err = r.Command(ctx, code, owner.Token, "select_game", &protocol.GameSelection{GameID: id}); err == nil {
			t.Fatalf("unavailable game accepted: %q", id)
		}
	}
	if err = r.Command(ctx, code, owner.Token, "select_game", &protocol.GameSelection{GameID: "zinger"}); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ch); got.GameID != "zinger" {
		t.Fatal("game selection not broadcast")
	}
	repo.mu.Lock()
	defer repo.mu.Unlock()
	if repo.records[code].GameID != "zinger" {
		t.Fatal("selected game not persisted")
	}
}

func packSelection(selected bool) *protocol.PackSelection {
	return &protocol.PackSelection{GameID: "zinger", PackSlug: "og", Selected: &selected}
}

func TestPackSelectionAuthorizationEligibilityAndRollback(t *testing.T) {
	r, repo, owner := fixture(t)
	ctx := context.Background()
	code := owner.Lobby.Code
	_, ownerCh, err := r.Subscribe(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	if len(readLobby(t, ownerCh).SelectedPackSlugs) == 0 {
		t.Fatal("OG must start selected")
	}
	guest, err := r.Join(ctx, code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	_, guestCh, err := r.Subscribe(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	third, err := r.Join(ctx, code, "Third")
	if err != nil {
		t.Fatal(err)
	}
	thirdID, thirdCh, err := r.Subscribe(ctx, code, third.Token)
	if err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); !got.CanStart {
		t.Fatal("three connected players with OG should be eligible")
	}
	if err := r.Command(ctx, code, guest.Token, "select_pack", packSelection(false)); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest changed packs: %v", err)
	}
	for _, selection := range []*protocol.PackSelection{{GameID: "zinger", PackSlug: "og"}, {GameID: "zinger", PackSlug: "coming_soon", Selected: packSelection(true).Selected}, {GameID: "zinger", Selected: packSelection(false).Selected}} {
		if err := r.Command(ctx, code, owner.Token, "select_pack", selection); err == nil {
			t.Fatal("invalid pack selection accepted")
		}
	}
	repo.mu.Lock()
	repo.fail = true
	repo.mu.Unlock()
	if err := r.Command(ctx, code, owner.Token, "select_pack", packSelection(false)); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("failed save accepted: %v", err)
	}
	repo.mu.Lock()
	repo.fail = false
	repo.mu.Unlock()
	if err := r.Command(ctx, code, owner.Token, "ping", &protocol.Empty{}); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); len(got.SelectedPackSlugs) == 0 || !got.CanStart {
		t.Fatal("failed save changed selection or eligibility")
	}
	if err := r.Command(ctx, code, owner.Token, "select_pack", packSelection(false)); err != nil {
		t.Fatal(err)
	}
	for _, ch := range []<-chan []byte{ownerCh, guestCh, thirdCh} {
		if got := readLobby(t, ch); len(got.SelectedPackSlugs) != 0 || got.CanStart {
			t.Fatal("empty selection must be shared and ineligible")
		}
	}
	repo.mu.Lock()
	selected := len(repo.records[code].SelectedPackSlugs) != 0
	repo.mu.Unlock()
	if selected {
		t.Fatal("deselection not persisted")
	}
	resumed, err := r.Reconnect(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	if len(resumed.Lobby.SelectedPackSlugs) != 0 || resumed.Lobby.CanStart {
		t.Fatal("reconnect lost empty selection")
	}
	if err := r.Command(ctx, code, resumed.Token, "select_game", &protocol.GameSelection{GameID: "zinger"}); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); len(got.SelectedPackSlugs) != 0 || got.CanStart {
		t.Fatal("reselecting game bypassed pack requirement")
	}
	if err := r.Command(ctx, code, resumed.Token, "select_pack", packSelection(true)); err != nil {
		t.Fatal(err)
	}
	if got := readLobby(t, ownerCh); len(got.SelectedPackSlugs) == 0 || !got.CanStart {
		t.Fatal("selecting OG did not restore eligibility")
	}
	r.Disconnect(code, thirdID, thirdCh)
	if got := readLobby(t, ownerCh); len(got.SelectedPackSlugs) == 0 || got.CanStart {
		t.Fatal("pack selection bypassed player requirement")
	}
}

func TestAvatarsAreSharedAndPreservedOnReconnect(t *testing.T) {
	r, repo, owner := fixture(t)
	ctx := context.Background()
	code := owner.Lobby.Code
	guest, err := r.Join(ctx, code, "Guest")
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range guest.Lobby.Players {
		if p.AvatarID < 1 || p.AvatarID > protocol.AvatarCount {
			t.Fatalf("invalid random avatar: %d", p.AvatarID)
		}
	}
	_, ownerCh, err := r.Subscribe(ctx, code, owner.Token)
	if err != nil {
		t.Fatal(err)
	}
	readLobby(t, ownerCh)
	_, guestCh, err := r.Subscribe(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	readLobby(t, ownerCh)
	readLobby(t, guestCh)
	if err := r.Command(ctx, code, guest.Token, "select_avatar", &protocol.AvatarSelection{AvatarID: 8}); err != nil {
		t.Fatal(err)
	}
	for _, ch := range []<-chan []byte{ownerCh, guestCh} {
		lobby := readLobby(t, ch)
		for _, p := range lobby.Players {
			if p.ID == guest.Lobby.YouID && p.AvatarID != 8 {
				t.Fatal("avatar not broadcast")
			}
			if p.ID == owner.Lobby.YouID && p.AvatarID != owner.Lobby.Players[0].AvatarID {
				t.Fatal("another player's avatar changed")
			}
		}
	}
	for _, id := range []int{0, 9, -1} {
		if err := r.Command(ctx, code, guest.Token, "select_avatar", &protocol.AvatarSelection{AvatarID: id}); err == nil {
			t.Fatal("invalid avatar accepted")
		}
	}
	repo.mu.Lock()
	repo.fail = true
	repo.mu.Unlock()
	if err := r.Command(ctx, code, guest.Token, "select_avatar", &protocol.AvatarSelection{AvatarID: 2}); err == nil {
		t.Fatal("save failure ignored")
	}
	repo.mu.Lock()
	repo.fail = false
	repo.mu.Unlock()
	recovered, err := r.Reconnect(ctx, code, guest.Token)
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range recovered.Lobby.Players {
		if p.ID == guest.Lobby.YouID && p.AvatarID != 8 {
			t.Fatal("reconnect lost avatar or failed save leaked")
		}
	}
}
