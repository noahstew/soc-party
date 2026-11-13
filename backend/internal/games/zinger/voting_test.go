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

func TestVotingScenePreservesVotingWindow(t *testing.T) {
	s := voting(t, 4)
	s.Config.VotingIntro = 4 * time.Second
	now := input().Now
	s.beginMatchup(now)
	opens := now.Add(s.Config.VotingIntro)
	if !s.Deadline.Equal(opens.Add(s.Config.Voting)) {
		t.Fatal("presentation consumed voting time")
	}
	v, err := s.View("p2", now)
	if err != nil || v.VotingOpensAtMs != opens.UnixMilli() {
		t.Fatalf("missing scene timing: %+v, %v", v, err)
	}
	m := s.currentMatch()
	var voter string
	for _, p := range s.Players {
		if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
			voter = p.ID
			break
		}
	}
	intent := VoteDraftIntent{voter, m.ID, m.Answers[0].ID}
	if err := s.selectVote(VoteIntent(intent), opens.Add(-time.Millisecond), false); err != WrongPhase {
		t.Fatalf("accepted vote during presentation: %v", err)
	}
	if err := s.selectVote(VoteIntent(intent), opens, false); err != nil {
		t.Fatalf("rejected vote at opening: %v", err)
	}
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

func TestVoteSelectionsPromoteAtDeadlineAndStayPrivate(t *testing.T) {
	s := voting(t, 4)
	m := s.currentMatch()
	now := s.Deadline.Add(-time.Second)
	var voters []string
	for _, p := range s.Players {
		if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
			voters = append(voters, p.ID)
		}
	}
	original := s
	s = apply(t, s, VoteDraftIntent{voters[0], m.ID, m.Answers[0].ID}, now)
	s = apply(t, s, VoteDraftIntent{voters[0], m.ID, m.Answers[1].ID}, now)
	if len(original.currentMatch().DraftVotes) != 0 {
		t.Fatal("draft mutated prior state")
	}
	s = apply(t, s, VoteDraftIntent{voters[1], m.ID, m.Answers[0].ID}, now)
	if s.Phase != MatchupVoting || s.finished(voters[0]) {
		t.Fatal("draft prematurely finished voting")
	}
	own, _ := s.View(voters[0], now)
	other, _ := s.View(m.Answers[0].PlayerID, now)
	if len(own.SelectedAnswerIDs) != 1 || own.SelectedAnswerIDs[0] != m.Answers[1].ID || own.VoteSubmitted || len(other.SelectedAnswerIDs) != 0 {
		t.Fatal("draft projection/privacy")
	}
	s = apply(t, s, Presence{PlayerID: voters[0]}, now)
	s = apply(t, s, Presence{PlayerID: voters[0], Connected: true}, now)
	own, _ = s.View(voters[0], now)
	if len(own.SelectedAnswerIDs) != 1 {
		t.Fatal("reconnect lost draft")
	}
	s = apply(t, s, VoteIntent{voters[1], m.ID, m.Answers[1].ID}, now)
	if _, err := Apply(s, VoteDraftIntent{voters[1], m.ID, m.Answers[0].ID}, games.Input{Now: now}); err != Code("vote_locked") {
		t.Fatal("locked vote changed", err)
	}
	if s.Phase != MatchupVoting {
		t.Fatal("unsubmitted draft ended phase")
	}
	if _, err := Apply(s, VoteDraftIntent{voters[0], m.ID, m.Answers[0].ID}, games.Input{Now: s.Deadline}); err != WrongPhase {
		t.Fatal("late selection accepted", err)
	}
	s = apply(t, s, Tick{}, s.Deadline)
	if s.Phase != MatchupReveal || s.currentMatch().Answers[1].Votes != 2 {
		t.Fatal("latest draft or submitted vote not counted")
	}
}
