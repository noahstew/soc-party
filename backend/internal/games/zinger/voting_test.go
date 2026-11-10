package zinger

import (
	"example.com/soc-party/backend/internal/games"
	"testing"
	"time"
)

func voting(t *testing.T, n int) *State {
	s := answering(t, n)
	now := s.Deadline.Add(-time.Second)
	for _, p := range s.Players {
		for _, a := range assigned(s, p.ID) {
			s = apply(t, s, AnswerIntent{p.ID, a.PromptID, "answer " + p.ID, true}, now)
		}
	}
	return s
}
func TestVoteScoring(t *testing.T) {
	for _, round := range []int{1, 2} {
		for _, scenario := range []string{"unanimous", "tie", "missing"} {
			t.Run(scenario+string(rune('0'+round)), func(t *testing.T) {
				s := voting(t, 4)
				s.Round = round
				s.MatchIndex = 0
				s.Phase = MatchupVoting
				// Round 2 assignment is separately populated for the scoring fixture.
				m := s.currentMatch()
				for i := range m.Answers {
					m.Answers[i].Text = "answer"
				}
				now := s.Deadline.Add(-time.Second)
				votes := 0
				for _, p := range s.Players {
					if p.ID == m.Answers[0].PlayerID || p.ID == m.Answers[1].PlayerID {
						continue
					}
					if scenario == "missing" && votes == 1 {
						break
					}
					idx := 0
					if scenario == "tie" {
						idx = votes
					}
					s = apply(t, s, VoteIntent{p.ID, m.ID, m.Answers[idx].ID}, now)
					m = s.currentMatch()
					votes++
				}
				if scenario == "missing" {
					s = apply(t, s, Tick{}, s.Deadline)
				}
				m = s.currentMatch()
				unit := 100 * round // overwritten for round 2 multiplier
				if round == 2 {
					unit = 150
				}
				want := 3 * unit
				if scenario == "tie" {
					want = unit
				}
				if scenario == "missing" {
					want = unit
				}
				if s.Phase != MatchupReveal || m.Answers[0].Points != want {
					t.Fatalf("got %+v want %d", m.Answers, want)
				}
				if scenario != "unanimous" && m.Answers[0].Bonus != 0 {
					t.Fatal("invalid bonus")
				}
				before := s.Players[0].Score
				s = apply(t, s, Tick{}, now)
				if s.Players[0].Score != before {
					t.Fatal("double scoring")
				}
			})
		}
	}
}
func TestVoteEligibilityAndForfeits(t *testing.T) {
	s := voting(t, 4)
	m := s.currentMatch()
	now := s.Deadline.Add(-time.Second)
	if _, e := Apply(s, VoteIntent{m.Answers[0].PlayerID, m.ID, m.Answers[1].ID}, games.Input{Now: now}); e != NotEligible {
		t.Fatal(e)
	}
	for _, p := range s.Players {
		if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
			s = apply(t, s, VoteIntent{p.ID, m.ID, m.Answers[0].ID}, now)
			if _, e := Apply(s, VoteIntent{p.ID, m.ID, m.Answers[1].ID}, games.Input{Now: now}); e != Code("vote_locked") {
				t.Fatal(e)
			}
			break
		}
	}
	for _, empty := range []int{1, 2} {
		s = answering(t, 4)
		m = s.currentMatch()
		if empty == 1 {
			m.Answers[0].Draft = "unsubmitted draft"
		}
		s = apply(t, s, Tick{}, s.Deadline)
		m = s.currentMatch()
		if s.Phase != MatchupReveal {
			t.Fatal("forfeit must skip voting")
		}
		want := 0
		if empty == 1 {
			want = 300
		}
		if m.Answers[0].Points != want || m.Answers[1].Points != 0 {
			t.Fatalf("forfeit: %+v", m.Answers)
		}
	}
}
