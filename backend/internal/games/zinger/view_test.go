package zinger

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestAnsweringProjectionDoesNotLeak(t *testing.T) {
	s := answering(t, 3)
	now := s.Deadline.Add(-time.Second)
	for _, p := range s.Players {
		for _, a := range assigned(s, p.ID) {
			s = apply(t, s, AnswerIntent{PlayerID: p.ID, PromptID: a.PromptID, Text: "secret-" + p.ID, Submit: false}, now)
		}
	}
	v, err := s.View("p0", now)
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(v)
	if strings.Contains(string(data), "secret-p1") || strings.Contains(string(data), "secret-p2") {
		t.Fatalf("other draft leaked: %s", data)
	}
	if len(v.Prompts) != 2 || v.Prompts[0].Draft == "" || v.Players[1].Finished {
		t.Fatalf("wrong private projection: %+v", v)
	}
}

func TestVotingProjectionHidesAuthorsAndVotes(t *testing.T) {
	s := voting(t, 4)
	m := s.currentMatch()
	voter := ""
	for _, p := range s.Players {
		if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
			voter = p.ID
			break
		}
	}
	v, err := s.View(voter, s.Deadline.Add(-time.Second))
	if err != nil {
		t.Fatal(err)
	}
	data, _ := json.Marshal(v.Answers)
	for _, a := range v.Answers {
		if a.AuthorID != "" || a.Author != "" || a.Votes != 0 || a.Points != 0 || a.Bonus != 0 {
			t.Fatalf("voting metadata leaked: %s", data)
		}
	}
	if !v.CanVote || len(v.Answers) != 2 {
		t.Fatalf("wrong voting projection: %+v", v)
	}
	authorView, _ := s.View(m.Answers[0].PlayerID, input().Now)
	if authorView.CanVote {
		t.Fatal("author marked eligible")
	}
}

func TestRevealAndFinalViews(t *testing.T) {
	s := voting(t, 3)
	m := s.currentMatch()
	for _, p := range s.Players {
		if p.ID != m.Answers[0].PlayerID && p.ID != m.Answers[1].PlayerID {
			s = apply(t, s, VoteIntent{PlayerID: p.ID, MatchupID: m.ID, AnswerID: m.Answers[0].ID}, s.Deadline.Add(-time.Second))
		}
	}
	v, _ := s.View("p0", input().Now)
	if v.Phase != MatchupReveal || v.Answers[0].Author == "" || v.Answers[0].Points == 0 {
		t.Fatalf("incomplete reveal: %+v", v)
	}

	s = finalVoting(t, 3)
	v, _ = s.View("p0", input().Now)
	for _, a := range v.Answers {
		if a.AuthorID != "" || a.Votes != 0 {
			t.Fatalf("final voting leaked metadata: %+v", a)
		}
	}
	if v.MaxPicks != 3 || len(v.Answers) != 2 {
		t.Fatalf("wrong final choices: %+v", v)
	}
}
