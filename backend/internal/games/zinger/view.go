package zinger

import (
	"cmp"
	"slices"
	"time"
)

type PlayerView struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Connected  bool   `json:"connected"`
	Left       bool   `json:"left"`
	Score      int    `json:"score"`
	RoundDelta int    `json:"roundDelta"`
	Finished   bool   `json:"finished"`
}

type AnswerView struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	AuthorID string `json:"authorId,omitempty"`
	Author   string `json:"author,omitempty"`
	Votes    int    `json:"votes,omitempty"`
	Points   int    `json:"points,omitempty"`
	Bonus    int    `json:"bonus,omitempty"`
}

type PromptView struct {
	ID        string `json:"id"`
	Text      string `json:"text"`
	Draft     string `json:"draft,omitempty"`
	Submitted bool   `json:"submitted"`
}

type GameView struct {
	Phase              Phase        `json:"phase"`
	Round              int          `json:"round"`
	MultiplierPermille int          `json:"multiplierPermille"`
	DeadlineMs         int64        `json:"deadlineMs,omitempty"`
	ServerNowMs        int64        `json:"serverNowMs"`
	Players            []PlayerView `json:"players"`
	Prompts            []PromptView `json:"prompts,omitempty"`
	Prompt             *PromptView  `json:"prompt,omitempty"`
	MatchupID          string       `json:"matchupId,omitempty"`
	Answers            []AnswerView `json:"answers,omitempty"`
	CanVote            bool         `json:"canVote,omitempty"`
	MaxPicks           int          `json:"maxPicks,omitempty"`
	SelectedAnswerIDs  []string     `json:"selectedAnswerIds,omitempty"`
}

func (s *State) View(playerID string, now time.Time) (GameView, error) {
	if s.player(playerID) == nil {
		return GameView{}, Code("invalid_player")
	}
	v := GameView{
		Phase:              s.Phase,
		Round:              s.Round,
		MultiplierPermille: s.Config.Multipliers[s.Round-1],
		DeadlineMs:         s.NextTick().UnixMilli(),
		ServerNowMs:        now.UnixMilli(),
		Players:            make([]PlayerView, 0, len(s.Players)),
	}
	if s.NextTick().IsZero() {
		v.DeadlineMs = 0
	}
	for _, p := range s.Players {
		v.Players = append(v.Players, PlayerView{
			ID: p.ID, Name: p.Name, Connected: p.Connected, Left: p.Left,
			Score: p.Score, RoundDelta: p.Score - p.RoundStart,
			Finished: s.finished(p.ID),
		})
	}
	switch s.Phase {
	case Answering, FinalAnswering:
		s.eachAnswer(func(a *Answer) {
			if a.PlayerID == playerID {
				v.Prompts = append(v.Prompts, PromptView{ID: a.PromptID, Text: s.promptText(a.PromptID), Draft: a.Draft, Submitted: a.Submitted})
			}
		})
	case MatchupVoting:
		m := s.currentMatch()
		v.MatchupID = m.ID
		v.Prompt = &PromptView{ID: m.Prompt.ID, Text: m.Prompt.Text}
		v.CanVote = m.Answers[0].PlayerID != playerID && m.Answers[1].PlayerID != playerID
		for _, a := range m.Answers {
			v.Answers = append(v.Answers, AnswerView{ID: a.ID, Text: displayAnswer(a.Text)})
		}
	case MatchupReveal:
		m := s.currentMatch()
		v.MatchupID = m.ID
		v.Prompt = &PromptView{ID: m.Prompt.ID, Text: m.Prompt.Text}
		for _, a := range m.Answers {
			p := s.player(a.PlayerID)
			v.Answers = append(v.Answers, AnswerView{ID: a.ID, Text: displayAnswer(a.Text), AuthorID: p.ID, Author: p.Name, Votes: a.Votes, Points: a.Points, Bonus: a.Bonus})
		}
	case FinalVoting:
		v.Prompt = &PromptView{ID: s.FinalPrompt.ID, Text: s.FinalPrompt.Text}
		for _, a := range s.FinalAnswers {
			if a.Text != "" && a.PlayerID != playerID {
				v.Answers = append(v.Answers, AnswerView{ID: a.ID, Text: a.Text})
			}
		}
		v.MaxPicks = min(s.Config.MaxFinalPicks, len(v.Answers))
		v.SelectedAnswerIDs = slices.Clone(s.FinalVotes[playerID])
	case FinalReveal, GameOver:
		v.Prompt = &PromptView{ID: s.FinalPrompt.ID, Text: s.FinalPrompt.Text}
		for _, a := range s.FinalAnswers {
			if a.Text == "" {
				continue
			}
			p := s.player(a.PlayerID)
			v.Answers = append(v.Answers, AnswerView{ID: a.ID, Text: a.Text, AuthorID: p.ID, Author: p.Name, Votes: a.Votes, Points: a.Points})
		}
		slices.SortFunc(v.Answers, func(a, b AnswerView) int {
			if n := cmp.Compare(b.Votes, a.Votes); n != 0 {
				return n
			}
			return cmp.Compare(a.ID, b.ID)
		})
	}
	return v, nil
}

func (s *State) promptText(id string) string {
	if id == s.FinalPrompt.ID {
		return s.FinalPrompt.Text
	}
	for _, round := range s.Rounds {
		for _, m := range round {
			if m.Prompt.ID == id {
				return m.Prompt.Text
			}
		}
	}
	return ""
}

func (s *State) finished(playerID string) bool {
	switch s.Phase {
	case Answering, FinalAnswering:
		done := true
		s.eachAnswer(func(a *Answer) {
			if a.PlayerID == playerID && !a.Submitted {
				done = false
			}
		})
		return done
	case MatchupVoting:
		m := s.currentMatch()
		if m.Answers[0].PlayerID == playerID || m.Answers[1].PlayerID == playerID {
			return true
		}
		_, ok := m.Votes[playerID]
		return ok
	case FinalVoting:
		_, ok := s.FinalVotes[playerID]
		return ok
	default:
		return false
	}
}

func displayAnswer(text string) string {
	if text == "" {
		return "No answer submitted"
	}
	return text
}
