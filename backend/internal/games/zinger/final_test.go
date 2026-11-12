package zinger

import (
	"example.com/soc-party/backend/internal/games"
	"fmt"
	"reflect"
	"testing"
	"time"
)

func finalVoting(t *testing.T, n int) *State {
	s := mustNew(t, n)
	s.Round = 3
	s.enter(FinalIntro, input().Now, s.Config.Intro)
	s = apply(t, s, Tick{}, s.Deadline)
	for _, p := range s.Players {
		s = apply(t, s, AnswerIntent{p.ID, s.FinalPrompt.ID, "final " + p.ID, true}, s.Deadline.Add(-time.Second))
	}
	return s
}
func TestFinalRulesIdleAndScoring(t *testing.T) {
	s := finalVoting(t, 5)
	now := s.Deadline.Add(-20 * time.Second)
	own := ""
	for _, a := range s.FinalAnswers {
		if a.PlayerID == "p0" {
			own = a.ID
		}
	}
	eligible := s.eligibleFinal("p0")
	for _, tc := range []struct {
		ids  []string
		code Code
	}{
		{[]string{own}, Code("cannot_pick_own_answer")},
		{eligible, Code("too_many_picks")},
		{eligible[:2], InvalidVote},
		{[]string{"missing"}, InvalidVote},
		{nil, InvalidVote},
	} {
		if _, err := Apply(s, FinalVoteIntent{"p0", tc.ids}, games.Input{Now: now}); err != tc.code {
			t.Fatalf("%v want %v", err, tc.code)
		}
	}
	s = apply(t, s, FinalVoteIntent{"p0", []string{eligible[0], eligible[0], eligible[0]}}, now)
	if _, err := Apply(s, FinalVoteIntent{"p0", eligible[:3]}, games.Input{Now: now}); err != Code("vote_locked") {
		t.Fatal("submitted ballot must lock", err)
	}
	for _, p := range s.Players[1:] {
		ids := s.eligibleFinal(p.ID)
		s = apply(t, s, FinalVoteIntent{p.ID, []string{ids[0], ids[0], ids[1]}}, now)
	}
	if s.IdleAt != now.Add(5*time.Second) {
		t.Fatal("idle window not armed")
	}
	s = apply(t, s, Tick{}, s.IdleAt)
	if s.Phase != FinalReveal {
		t.Fatal(s.Phase)
	}
	wantVotes := map[string]int{}
	for _, ids := range s.FinalVotes {
		for _, id := range ids {
			wantVotes[id]++
		}
	}
	for _, a := range s.FinalAnswers {
		if a.Votes != wantVotes[a.ID] {
			t.Fatal("stacked votes not counted", a)
		}
	}

	sum := 0
	for _, a := range s.FinalAnswers {
		if a.Points != a.Votes*200 || a.Bonus != 0 {
			t.Fatal("final points")
		}
		sum += a.Points
	}
	if sum != 15*200 {
		t.Fatal("all three votes counted", sum)
	}
	s = apply(t, s, Tick{}, s.Deadline)
	if s.Phase != GameOver || !s.NextTick().IsZero() {
		t.Fatal("game did not end")
	}
}
func TestFinalEmptyAndReconnectIdle(t *testing.T) {
	s := mustNew(t, 3)
	s.Round = 3
	s.enter(FinalAnswering, input().Now, s.Config.FinalAnswering)
	s = apply(t, s, Tick{}, s.Deadline)
	if len(s.FinalVotes) != 3 || s.IdleAt.IsZero() {
		t.Fatal("empty final stalled")
	}
	s = apply(t, s, Tick{}, s.IdleAt)
	for _, p := range s.Players {
		if p.Score != 0 {
			t.Fatal("empty final scored")
		}
	}
	s = finalVoting(t, 3)
	now := s.Deadline.Add(-time.Second * 20)
	s = apply(t, s, Presence{PlayerID: "p2"}, now)
	for _, pid := range []string{"p0", "p1"} {
		s = apply(t, s, FinalVoteIntent{pid, []string{s.eligibleFinal(pid)[0], s.eligibleFinal(pid)[0], s.eligibleFinal(pid)[0]}}, now)
	}
	if s.IdleAt.IsZero() {
		t.Fatal("not armed")
	}
	s = apply(t, s, Presence{PlayerID: "p2", Connected: true}, now.Add(time.Second))
	if !s.IdleAt.IsZero() {
		t.Fatal("unfinished reconnect did not cancel idle")
	}
	s = apply(t, s, Tick{}, s.Deadline)
	if s.Phase != FinalReveal {
		t.Fatal("absolute deadline")
	}
}
func TestInsufficientPlayersGraceAndLeave(t *testing.T) {
	s := answering(t, 3)
	now := input().Now
	for _, pid := range []string{"p1", "p2"} {
		s = apply(t, s, Presence{PlayerID: pid}, now)
	}
	s = apply(t, s, Tick{}, now.Add(s.Config.Grace-time.Nanosecond))
	if s.Phase == GameOver {
		t.Fatal("early termination")
	}
	s = apply(t, s, Presence{PlayerID: "p1", Connected: true}, now.Add(time.Second))
	if !s.LowSince.IsZero() {
		t.Fatal("reconnect did not reset grace")
	}
	s = apply(t, s, Presence{PlayerID: "p1", Left: true}, now.Add(2*time.Second))
	if _, e := Apply(s, Presence{PlayerID: "p1", Connected: true}, input()); e != Code("invalid_player") {
		t.Fatal("left player rejoined")
	}
	s = apply(t, s, Tick{}, s.LowSince.Add(s.Config.Grace))
	if s.Phase != GameOver {
		t.Fatal("grace did not end")
	}
}
func TestFullGameSimulation(t *testing.T) {
	for n := 3; n <= 8; n++ {
		t.Run(fmt.Sprint(n), func(t *testing.T) {
			run := func() *State {
				s := mustNew(t, n)
				seen := map[Phase]bool{}
				for step := 0; step < 2000 && s.Phase != GameOver; step++ {
					seen[s.Phase] = true
					now := s.Deadline.Add(-time.Millisecond)
					switch s.Phase {
					case Answering, FinalAnswering:
						for _, p := range s.Players {
							for _, a := range assigned(s, p.ID) {
								if !a.Submitted && (s.Phase == Answering || s.Phase == FinalAnswering) {
									s = apply(t, s, AnswerIntent{p.ID, a.PromptID, "bot " + p.ID, true}, now)
								}
							}
						}
					case MatchupVoting:
						m := *s.currentMatch()
						for i, p := range s.Players {
							if s.Phase == MatchupVoting && p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
								s = apply(t, s, VoteIntent{p.ID, m.ID, m.Answers[i%2].ID}, now)
							}
						}
					case FinalVoting:
						for _, p := range s.Players {
							ids := s.eligibleFinal(p.ID)
							s = apply(t, s, FinalVoteIntent{p.ID, []string{ids[0], ids[0], ids[len(ids)-1]}}, now)
						}
						s = apply(t, s, Tick{}, s.NextTick())
					default:
						s = apply(t, s, Tick{}, s.NextTick())
					}
				}
				if s.Phase != GameOver {
					t.Fatal("simulation stuck")
				}
				for _, phase := range []Phase{RoundIntro, Answering, MatchupVoting, MatchupReveal, RoundScoreboard, FinalIntro, FinalAnswering, FinalVoting, FinalReveal} {
					if !seen[phase] {
						t.Fatal("missing phase", phase)
					}
				}
				for _, p := range s.Players {
					awarded := 0
					for _, round := range s.Rounds {
						for _, m := range round {
							for _, a := range m.Answers {
								if a.PlayerID == p.ID {
									awarded += a.Points
								}
							}
						}
					}
					for _, a := range s.FinalAnswers {
						if a.PlayerID == p.ID {
							awarded += a.Points
						}
					}
					if p.Score != awarded {
						t.Fatal("score mismatch")
					}
				}
				return s
			}
			if !reflect.DeepEqual(run(), run()) {
				t.Fatal("replay differs")
			}
		})
	}
}
