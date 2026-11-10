package zinger

import (
	"example.com/soc-party/backend/internal/games"
	"fmt"
	"math/rand/v2"
	"reflect"
	"testing"
	"time"
)

func fixture(n int) Start {
	x := Start{Config: DefaultConfig()}
	for i := range n {
		x.Players = append(x.Players, Player{ID: fmt.Sprintf("p%d", i), Name: fmt.Sprintf("Name %d", i), Connected: true})
	}
	for i := range 2*n + 1 {
		x.Prompts = append(x.Prompts, Prompt{ID: fmt.Sprint(i), Text: fmt.Sprintf("Prompt %d", i)})
	}
	return x
}
func input() games.Input {
	return games.Input{Now: time.Unix(1000, 0), Random: rand.New(rand.NewPCG(1, 2))}
}
func mustNew(t *testing.T, n int) *State {
	t.Helper()
	s, e := New(fixture(n), input())
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func TestAssignments(t *testing.T) {
	for n := 3; n <= 8; n++ {
		t.Run(fmt.Sprint(n), func(t *testing.T) {
			s := mustNew(t, n)
			seen := map[string]bool{}
			for _, round := range s.Rounds {
				counts, pairs := map[string]int{}, map[string]bool{}
				for _, m := range round {
					if seen[m.Prompt.ID] {
						t.Fatal("repeated prompt")
					}
					seen[m.Prompt.ID] = true
					a, b := m.Answers[0].PlayerID, m.Answers[1].PlayerID
					if a == b {
						t.Fatal("same author")
					}
					if b < a {
						a, b = b, a
					}
					pair := a + ":" + b
					if pairs[pair] {
						t.Fatal("repeated pair")
					}
					pairs[pair] = true
					counts[a]++
					counts[b]++
				}
				for _, p := range s.Players {
					if counts[p.ID] != 2 {
						t.Fatalf("assignment: %v", counts)
					}
				}
			}
			if seen[s.FinalPrompt.ID] || len(seen) != 2*n {
				t.Fatal("final prompt repeated")
			}
			if !reflect.DeepEqual(s, mustNew(t, n)) {
				t.Fatal("seeded start differs")
			}
			copy := s.Clone()
			copy.Rounds[0][0].Votes["p"] = "a"
			copy.Players[0].Score = 9
			if len(s.Rounds[0][0].Votes) != 0 || s.Players[0].Score != 0 {
				t.Fatal("clone aliases state")
			}
		})
	}
}
func TestPromptDeduplication(t *testing.T) {
	prompts := []Prompt{{"1", " Hello   WORLD "}, {"2", "hello world"}, {"1", "Other"}, {"3", "Distinct"}}
	got, err := SelectPrompts(prompts, 2, input().Random)
	if err != nil || len(got) != 2 {
		t.Fatalf("%v %v", got, err)
	}
	if _, err = SelectPrompts(prompts, 3, input().Random); err != NotEnoughPrompts {
		t.Fatal(err)
	}
}
func TestInvalidStarts(t *testing.T) {
	for _, n := range []int{0, 2, 9} {
		if _, e := New(fixture(n), input()); e == nil {
			t.Fatal("bad size")
		}
	}
	x := fixture(3)
	x.Players[1].ID = x.Players[0].ID
	if _, e := New(x, input()); e == nil {
		t.Fatal("duplicate player")
	}
	x = fixture(3)
	x.Config.FinalIdle = 0
	if _, e := New(x, input()); e == nil {
		t.Fatal("invalid config")
	}
}
