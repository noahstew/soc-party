package zinger

import "time"

type VoteIntent struct{ PlayerID, MatchupID, AnswerID string }
type VoteDraftIntent struct{ PlayerID, MatchupID, AnswerID string }

func (s *State) currentMatch() *Matchup { return &s.Rounds[s.Round-1][s.MatchIndex] }
func (s *State) beginMatchup(now time.Time) {
	m := s.currentMatch()
	if m.Answers[0].Text == "" || m.Answers[1].Text == "" {
		s.revealMatchup(now, true)
		return
	}
	s.enter(MatchupVoting, now, s.Config.Voting+s.Config.VotingIntro)
	s.finishVoting(now)
}
func (s *State) vote(e VoteIntent, now time.Time) error {
	return s.selectVote(e, now, true)
}
func (s *State) selectVote(e VoteIntent, now time.Time, submit bool) error {
	if s.Phase != MatchupVoting || !now.Before(s.Deadline) || now.Before(s.Deadline.Add(-s.Config.Voting)) {
		return WrongPhase
	}
	p := s.player(e.PlayerID)
	m := s.currentMatch()
	if p == nil || !p.Connected || p.Left {
		return NotEligible
	}
	if m.ID != e.MatchupID {
		return InvalidVote
	}
	valid := false
	for _, a := range m.Answers {
		if a.PlayerID == e.PlayerID {
			return NotEligible
		}
		if a.ID == e.AnswerID {
			valid = true
		}
	}
	if !valid {
		return InvalidVote
	}
	if _, exists := m.Votes[e.PlayerID]; exists {
		return Code("vote_locked")
	}
	if !submit {
		if m.DraftVotes == nil {
			m.DraftVotes = map[string]string{}
		}
		m.DraftVotes[e.PlayerID] = e.AnswerID
		return nil
	}
	m.Votes[e.PlayerID] = e.AnswerID
	s.finishVoting(now)
	return nil
}
func (s *State) finishVoting(now time.Time) {
	if s.Phase != MatchupVoting {
		return
	}
	m := s.currentMatch()
	for _, p := range s.Players {
		if !p.Connected || p.Left || p.ID == m.Answers[0].PlayerID || p.ID == m.Answers[1].PlayerID {
			continue
		}
		if _, voted := m.Votes[p.ID]; !voted {
			return
		}
	}
	s.revealMatchup(now, false)
}
func (s *State) revealMatchup(now time.Time, forfeit bool) {
	m := s.currentMatch()
	if !m.Decided {
		for pid, id := range m.DraftVotes {
			if _, locked := m.Votes[pid]; !locked {
				m.Votes[pid] = id
			}
		}
		eligible := len(s.Players) - 2
		for i := range m.Answers {
			a := &m.Answers[i]
			for _, aid := range m.Votes {
				if aid == a.ID {
					a.Votes++
				}
			}
			if forfeit && a.Text != "" {
				a.Votes = eligible
			}
			if a.Votes == eligible {
				a.Bonus = s.Config.UnanimousBonus * s.Config.Multipliers[s.Round-1] / 1000
			}
			a.Points = a.Votes*s.Config.BasePoints*s.Config.Multipliers[s.Round-1]/1000 + a.Bonus
			s.player(a.PlayerID).Score += a.Points
		}
		m.Decided = true
	}
	s.enter(MatchupReveal, now, s.Config.Reveal)
}
