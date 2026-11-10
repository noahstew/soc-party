package zinger

import (
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"example.com/soc-party/backend/internal/games"
)

type AnswerIntent struct {
	PlayerID, PromptID, Text string
	Submit                   bool
}
type Presence struct {
	PlayerID        string
	Connected, Left bool
}

// Apply returns an independent state; failed actions never alter the input state.
func Apply(state *State, event any, input games.Input) (*State, error) {
	if state == nil {
		return nil, WrongPhase
	}
	s := state.Clone()
	switch e := event.(type) {
	case Tick:
		s.tick(input.Now)
	case AnswerIntent:
		if err := s.answer(e, input.Now); err != nil {
			return nil, err
		}
	case Presence:
		p := s.player(e.PlayerID)
		if p == nil || p.Left {
			return nil, Code("invalid_player")
		}
		p.Connected = e.Connected && !e.Left
		p.Left = e.Left
		s.finishAnswering(input.Now)
	default:
		return nil, Code("unknown_event")
	}
	return s, nil
}
func (s *State) player(id string) *Player {
	for i := range s.Players {
		if s.Players[i].ID == id {
			return &s.Players[i]
		}
	}
	return nil
}
func cleanAnswer(text string) (string, error) {
	if !utf8.ValidString(text) {
		return "", InvalidAnswer
	}
	return strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, text)), nil
}
func (s *State) eachAnswer(fn func(*Answer)) {
	if s.Round == 3 {
		for i := range s.FinalAnswers {
			fn(&s.FinalAnswers[i])
		}
		return
	}
	for i := range s.Rounds[s.Round-1] {
		for j := range s.Rounds[s.Round-1][i].Answers {
			fn(&s.Rounds[s.Round-1][i].Answers[j])
		}
	}
}
func (s *State) answer(e AnswerIntent, now time.Time) error {
	if (s.Phase != Answering && s.Phase != FinalAnswering) || !now.Before(s.Deadline) {
		return WrongPhase
	}
	p := s.player(e.PlayerID)
	if p == nil || !p.Connected || p.Left {
		return Code("invalid_player")
	}
	text, err := cleanAnswer(e.Text)
	if err != nil {
		return err
	}
	length := utf8.RuneCountInString(text)
	if length > s.Config.MaxAnswerLength || (e.Submit && length < s.Config.MinAnswerLength) {
		return InvalidAnswer
	}
	var target *Answer
	s.eachAnswer(func(a *Answer) {
		if a.PlayerID == e.PlayerID && a.PromptID == e.PromptID {
			target = a
		}
	})
	if target == nil {
		return Code("unassigned_prompt")
	}
	if target.Submitted {
		return Code("answer_locked")
	}
	target.Draft = text
	if e.Submit {
		target.Text = text
		target.Submitted = true
	}
	s.finishAnswering(now)
	return nil
}
func (s *State) enter(phase Phase, now time.Time, duration time.Duration) {
	s.Phase = phase
	s.Deadline = now.Add(duration)
	s.IdleAt = time.Time{}
}
func (s *State) tick(now time.Time) {
	if now.Before(s.Deadline) || s.Phase == GameOver {
		return
	}
	switch s.Phase {
	case RoundIntro:
		s.enter(Answering, now, s.Config.Answering)
	case Answering:
		s.promote()
		s.enter(MatchupVoting, now, s.Config.Voting)
	}
}
func (s *State) promote() {
	s.eachAnswer(func(a *Answer) {
		if !a.Submitted {
			a.Text = a.Draft
			a.Submitted = true
		}
	})
}
func (s *State) finishAnswering(now time.Time) {
	if s.Phase != Answering && s.Phase != FinalAnswering {
		return
	}
	done := true
	s.eachAnswer(func(a *Answer) {
		p := s.player(a.PlayerID)
		if p.Connected && !p.Left && !a.Submitted {
			done = false
		}
	})
	if done {
		s.promote()
		s.enter(MatchupVoting, now, s.Config.Voting)
	}
}
