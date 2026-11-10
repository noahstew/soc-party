// Package zinger implements deterministic, I/O-free answer-and-vote rules.
package zinger

import (
	"fmt"
	"slices"
	"strings"
	"time"

	"example.com/soc-party/backend/internal/games"
)

type Code string

func (c Code) Error() string { return string(c) }

const (
	WrongPhase       Code = "wrong_phase"
	InvalidAnswer    Code = "invalid_answer"
	NotEligible      Code = "not_eligible_to_vote"
	InvalidVote      Code = "invalid_vote"
	NotEnoughPrompts Code = "not_enough_prompts"
)

type Config struct {
	MinPlayers, MaxPlayers, MinAnswerLength, MaxAnswerLength   int
	BasePoints, UnanimousBonus, MaxFinalPicks                  int
	Multipliers                                                [3]int
	Intro, Answering, Voting, Reveal, Scoreboard               time.Duration
	FinalAnswering, FinalVoting, FinalReveal, FinalIdle, Grace time.Duration
}

func DefaultConfig() Config {
	return Config{MinPlayers: 3, MaxPlayers: 8, MinAnswerLength: 1, MaxAnswerLength: 100,
		BasePoints: 100, UnanimousBonus: 100, MaxFinalPicks: 3, Multipliers: [3]int{1000, 1500, 2000},
		Intro: 4 * time.Second, Answering: 90 * time.Second, Voting: 20 * time.Second,
		Reveal: 7 * time.Second, Scoreboard: 8 * time.Second, FinalAnswering: 60 * time.Second,
		FinalVoting: 30 * time.Second, FinalReveal: 12 * time.Second, FinalIdle: 5 * time.Second, Grace: time.Minute}
}
func (c Config) Validate() error {
	if c.MinPlayers < 3 || c.MaxPlayers > 8 || c.MaxPlayers < c.MinPlayers || c.MinAnswerLength < 1 || c.MaxAnswerLength < c.MinAnswerLength || c.MaxAnswerLength > 100 || c.BasePoints < 1 || c.BasePoints > 10000 || c.UnanimousBonus < 0 || c.UnanimousBonus > 10000 || c.MaxFinalPicks < 1 || c.MaxFinalPicks > 3 {
		return Code("invalid_config")
	}
	for _, m := range c.Multipliers {
		if m < 1 || m > 10000 {
			return Code("invalid_config")
		}
	}
	for _, d := range []time.Duration{c.Intro, c.Answering, c.Voting, c.Reveal, c.Scoreboard, c.FinalAnswering, c.FinalVoting, c.FinalReveal, c.FinalIdle, c.Grace} {
		if d <= 0 {
			return Code("invalid_config")
		}
	}
	return nil
}

type Phase string

const (
	RoundIntro      Phase = "round_intro"
	Answering       Phase = "answering"
	MatchupVoting   Phase = "matchup_voting"
	MatchupReveal   Phase = "matchup_reveal"
	RoundScoreboard Phase = "round_scoreboard"
	FinalIntro      Phase = "final_intro"
	FinalAnswering  Phase = "final_answering"
	FinalVoting     Phase = "final_voting"
	FinalReveal     Phase = "final_reveal"
	GameOver        Phase = "game_over"
)

type Prompt struct{ ID, Text string }
type Player struct {
	ID, Name          string
	Connected, Left   bool
	Score, RoundStart int
}
type Answer struct {
	ID, PlayerID, PromptID, Draft, Text string
	Submitted                           bool
	Votes, Points, Bonus                int
}
type Matchup struct {
	ID      string
	Prompt  Prompt
	Answers [2]Answer
	Votes   map[string]string
	Decided bool
}
type State struct {
	Config                     Config
	Phase                      Phase
	Round, MatchIndex          int
	Deadline, LowSince, IdleAt time.Time
	Players                    []Player
	Rounds                     [2][]Matchup
	FinalPrompt                Prompt
	FinalAnswers               []Answer
	FinalVotes                 map[string][]string
}
type Start struct {
	Config  Config
	Players []Player
	Prompts []Prompt
}
type Tick struct{}
type Schedule struct{ At time.Time }

func shuffle[T any](values []T, rng games.Random) {
	for i := len(values) - 1; i > 0; i-- {
		j := rng.IntN(i + 1)
		values[i], values[j] = values[j], values[i]
	}
}
func SelectPrompts(prompts []Prompt, n int, rng games.Random) ([]Prompt, error) {
	if n < 1 || rng == nil {
		return nil, Code("invalid_start")
	}
	ids, texts := map[string]bool{}, map[string]bool{}
	unique := []Prompt{}
	for _, p := range prompts {
		norm := strings.ToLower(strings.Join(strings.Fields(p.Text), " "))
		if p.ID == "" || norm == "" || ids[p.ID] || texts[norm] {
			continue
		}
		ids[p.ID], texts[norm] = true, true
		unique = append(unique, p)
	}
	if len(unique) < n {
		return nil, NotEnoughPrompts
	}
	shuffle(unique, rng)
	return unique[:n], nil
}
func assign(players []Player, prompts []Prompt, round int, rng games.Random) []Matchup {
	order := slices.Clone(players)
	shuffle(order, rng)
	matches := make([]Matchup, len(players))
	for k, p := range prompts {
		id := fmt.Sprintf("r%d-m%d", round, k)
		matches[k] = Matchup{ID: id, Prompt: p, Votes: map[string]string{}}
		for slot, pid := range []string{order[k].ID, order[(k+1)%len(order)].ID} {
			matches[k].Answers[slot] = Answer{ID: fmt.Sprintf("%s-a%d", id, slot), PlayerID: pid, PromptID: p.ID}
		}
		shuffle(matches[k].Answers[:], rng)
	}
	shuffle(matches, rng)
	// Prefer a disjoint successor when possible; N<4 necessarily shares authors.
	for i := 1; i < len(matches); i++ {
		for j := i; j < len(matches); j++ {
			if !overlap(matches[i-1], matches[j]) {
				matches[i], matches[j] = matches[j], matches[i]
				break
			}
		}
	}
	return matches
}
func overlap(a, b Matchup) bool {
	for _, x := range a.Answers {
		for _, y := range b.Answers {
			if x.PlayerID == y.PlayerID {
				return true
			}
		}
	}
	return false
}
func New(start Start, input games.Input) (*State, error) {
	c := start.Config
	if err := c.Validate(); err != nil {
		return nil, err
	}
	if len(start.Players) < c.MinPlayers || len(start.Players) > c.MaxPlayers || input.Random == nil {
		return nil, Code("invalid_start")
	}
	seen := map[string]bool{}
	for _, p := range start.Players {
		if p.ID == "" || seen[p.ID] || !p.Connected || p.Left {
			return nil, Code("invalid_start")
		}
		seen[p.ID] = true
	}
	prompts, err := SelectPrompts(start.Prompts, 2*len(start.Players)+1, input.Random)
	if err != nil {
		return nil, err
	}
	s := &State{Config: c, Phase: RoundIntro, Round: 1, Deadline: input.Now.Add(c.Intro), Players: slices.Clone(start.Players), FinalPrompt: prompts[len(prompts)-1], FinalVotes: map[string][]string{}}
	for i := range s.Players {
		s.Players[i].Score = 0
		s.Players[i].RoundStart = 0
	}
	n := len(s.Players)
	for r := range 2 {
		s.Rounds[r] = assign(s.Players, prompts[r*n:(r+1)*n], r+1, input.Random)
	}
	return s, nil
}
func (s *State) Clone() *State {
	next := *s
	next.Players = slices.Clone(s.Players)
	for r := range s.Rounds {
		next.Rounds[r] = slices.Clone(s.Rounds[r])
		for i, m := range s.Rounds[r] {
			next.Rounds[r][i].Votes = map[string]string{}
			for k, v := range m.Votes {
				next.Rounds[r][i].Votes[k] = v
			}
		}
	}
	next.FinalAnswers = slices.Clone(s.FinalAnswers)
	next.FinalVotes = map[string][]string{}
	for k, v := range s.FinalVotes {
		next.FinalVotes[k] = slices.Clone(v)
	}
	return &next
}
func (s *State) NextTick() time.Time {
	at := s.Deadline
	if s.Phase == GameOver {
		return time.Time{}
	}
	for _, t := range []time.Time{s.IdleAt, lowDeadline(s)} {
		if !t.IsZero() && (at.IsZero() || t.Before(at)) {
			at = t
		}
	}
	return at
}
func lowDeadline(s *State) time.Time {
	if s.LowSince.IsZero() {
		return time.Time{}
	}
	return s.LowSince.Add(s.Config.Grace)
}
