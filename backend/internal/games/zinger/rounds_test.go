package zinger

import "testing"

func TestTwoRoundLoop(t *testing.T) {
	s := mustNew(t, 3)
	for r := 1; r <= 2; r++ {
		if s.Round != r || s.Phase != RoundIntro {
			t.Fatalf("round intro: %d %s", s.Round, s.Phase)
		}
		s = apply(t, s, Tick{}, s.Deadline)
		s.eachAnswer(func(a *Answer) { a.Draft = "draft " + a.PlayerID })
		s = apply(t, s, Tick{}, s.Deadline)
		for k := 0; k < 3; k++ {
			if s.Phase != MatchupVoting {
				t.Fatal(s.Phase)
			}
			m := s.currentMatch()
			for _, p := range s.Players {
				if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
					s = apply(t, s, VoteIntent{p.ID, m.ID, m.Answers[0].ID}, s.Deadline.Add(-1))
					break
				}
			}
			if s.Phase != MatchupReveal {
				t.Fatal(s.Phase)
			}
			want := 200
			if r == 2 {
				want = 300
			}
			if s.currentMatch().Answers[0].Points != want {
				t.Fatal("round multiplier")
			}
			s = apply(t, s, Tick{}, s.Deadline)
		}
		if s.Phase != RoundScoreboard {
			t.Fatal(s.Phase)
		}
		sum, delta := 0, 0
		for _, p := range s.Players {
			sum += p.Score
			delta += p.Score - p.RoundStart
		}
		want := 600
		if r == 2 {
			want = 900
		}
		if delta != want {
			t.Fatalf("deltas=%d want %d", delta, want)
		}
		if r == 2 && sum != 1500 {
			t.Fatal("totals", sum)
		}
		s = apply(t, s, Tick{}, s.Deadline)
	}
	if s.Phase != FinalIntro || s.Round != 3 {
		t.Fatal("final intro")
	}
}
