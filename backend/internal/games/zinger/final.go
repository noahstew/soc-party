package zinger

import (
	"slices"
	"time"
)

type FinalVoteIntent struct {
	PlayerID  string
	AnswerIDs []string
}

func (s *State) eligibleFinal(pid string) []string {
	ids := []string{}
	for _, a := range s.FinalAnswers {
		if a.Text != "" && a.PlayerID != pid {
			ids = append(ids, a.ID)
		}
	}
	return ids
}
func (s *State) beginFinalVoting(now time.Time) {
	s.enter(FinalVoting, now, s.Config.FinalVoting)
	for _, p := range s.Players {
		if len(s.eligibleFinal(p.ID)) == 0 {
			s.FinalVotes[p.ID] = []string{}
		}
	}
	s.updateIdle(now, false)
}
func (s *State) finalVote(e FinalVoteIntent, now time.Time) error {
	if s.Phase != FinalVoting || !now.Before(s.Deadline) || (!s.IdleAt.IsZero() && !now.Before(s.IdleAt)) {
		return WrongPhase
	}
	p := s.player(e.PlayerID)
	if p == nil || !p.Connected || p.Left {
		return NotEligible
	}
	eligible := s.eligibleFinal(e.PlayerID)
	if len(e.AnswerIDs) > min(s.Config.MaxFinalPicks, len(eligible)) {
		return Code("too_many_picks")
	}
	if len(e.AnswerIDs) == 0 && len(eligible) > 0 {
		return InvalidVote
	}
	seen := map[string]bool{}
	for _, id := range e.AnswerIDs {
		for _, a := range s.FinalAnswers {
			if a.ID == id && a.PlayerID == e.PlayerID {
				return Code("cannot_pick_own_answer")
			}
		}
		if seen[id] || !slices.Contains(eligible, id) {
			return InvalidVote
		}
		seen[id] = true
	}
	s.FinalVotes[e.PlayerID] = slices.Clone(e.AnswerIDs)
	s.updateIdle(now, true)
	return nil
}
func (s *State) updateIdle(now time.Time, activity bool) {
	if s.Phase != FinalVoting {
		return
	}
	for _, p := range s.Players {
		if p.Connected && !p.Left {
			if _, done := s.FinalVotes[p.ID]; !done {
				s.IdleAt = time.Time{}
				return
			}
		}
	}
	if activity || s.IdleAt.IsZero() {
		s.IdleAt = now.Add(s.Config.FinalIdle)
	}
}
func (s *State) revealFinal(now time.Time) {
	for i := range s.FinalAnswers {
		a := &s.FinalAnswers[i]
		for _, p := range s.Players {
			if slices.Contains(s.FinalVotes[p.ID], a.ID) {
				a.Votes++
			}
		}
		a.Points = a.Votes * s.Config.BasePoints * s.Config.Multipliers[2] / 1000
		s.player(a.PlayerID).Score += a.Points
	}
	s.enter(FinalReveal, now, s.Config.FinalReveal)
}
func (s *State) end() { s.Phase = GameOver; s.Deadline = time.Time{}; s.IdleAt = time.Time{} }
func (s *State) updatePresence(now time.Time) {
	if s.Phase == GameOver {
		return
	}
	connected := 0
	for _, p := range s.Players {
		if p.Connected && !p.Left {
			connected++
		}
	}
	if connected >= 2 {
		s.LowSince = time.Time{}
	} else if s.LowSince.IsZero() {
		s.LowSince = now
	}
	if at := lowDeadline(s); !at.IsZero() && !now.Before(at) {
		s.end()
	}
}
