package zinger

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/games"
)

func apply(t *testing.T, s *State, e any, now time.Time) *State {
	t.Helper()
	v, err := Apply(s, e, games.Input{Now: now, Random: input().Random})
	if err != nil {
		t.Fatal(err)
	}
	return v
}
func answering(t *testing.T, n int) *State {
	s := mustNew(t, n)
	return apply(t, s, Tick{}, s.Deadline)
}
func assigned(s *State, p string) []Answer {
	a := []Answer{}
	s.eachAnswer(func(x *Answer) {
		if x.PlayerID == p {
			a = append(a, *x)
		}
	})
	return a
}
func TestAnswerValidationAndLocking(t *testing.T) {
	s := answering(t, 3)
	a := assigned(s, "p0")[0]
	now := s.Deadline.Add(-time.Second)
	for _, tc := range []struct {
		event AnswerIntent
		code  Code
	}{
		{AnswerIntent{"p0", a.PromptID, " ", true}, InvalidAnswer},
		{AnswerIntent{"p0", a.PromptID, strings.Repeat("é", 101), true}, InvalidAnswer},
		{AnswerIntent{"p0", "unknown", "answer", true}, Code("unassigned_prompt")},
		{AnswerIntent{"outsider", a.PromptID, "answer", true}, Code("invalid_player")},
	} {
		original := s.Clone()
		if _, e := Apply(s, tc.event, games.Input{Now: now}); e != tc.code {
			t.Fatalf("%v want %v", e, tc.code)
		}
		if !reflect.DeepEqual(s, original) {
			t.Fatal("error mutated input")
		}
	}
	s = apply(t, s, AnswerIntent{"p0", a.PromptID, "  hello\x00 world  ", true}, now)
	if assigned(s, "p0")[0].Text != "hello world" {
		t.Fatal("sanitation")
	}
	if _, e := Apply(s, AnswerIntent{"p0", a.PromptID, "edited", true}, games.Input{Now: now}); e != Code("answer_locked") {
		t.Fatal(e)
	}
	if _, e := Apply(s, AnswerIntent{"p0", a.PromptID, "late", true}, games.Input{Now: s.Deadline}); e != WrongPhase {
		t.Fatal(e)
	}
}
func TestDraftReconnectAndDeadline(t *testing.T) {
	s := answering(t, 3)
	a := assigned(s, "p0")[0]
	now := s.Deadline.Add(-10 * time.Second)
	s = apply(t, s, AnswerIntent{"p0", a.PromptID, "draft", false}, now)
	s = apply(t, s, Presence{PlayerID: "p0"}, now)
	if assigned(s, "p0")[0].Submitted {
		t.Fatal("disconnect locked draft")
	}
	s = apply(t, s, Presence{PlayerID: "p0", Connected: true}, now)
	s = apply(t, s, AnswerIntent{"p0", a.PromptID, "reconnected draft", false}, now)
	s = apply(t, s, Tick{}, s.Deadline)
	if s.Phase != MatchupVoting || assigned(s, "p0")[0].Text != "reconnected draft" {
		t.Fatal("draft not promoted")
	}
}
func TestAnswerEarlyCompletionIgnoresDisconnected(t *testing.T) {
	s := answering(t, 3)
	now := s.Deadline.Add(-time.Second)
	s = apply(t, s, Presence{PlayerID: "p2"}, now)
	for _, pid := range []string{"p0", "p1"} {
		for _, a := range assigned(s, pid) {
			s = apply(t, s, AnswerIntent{pid, a.PromptID, "answer", true}, now)
		}
	}
	if s.Phase != MatchupVoting {
		t.Fatal("waited for disconnected player")
	}
}
