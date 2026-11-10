package zinger

import (
	"time"

	"example.com/soc-party/backend/internal/games"
)

type Module struct{ Config Config }

func (Module) ID() string { return "zinger" }

func (m Module) Transition(state, event any, input games.Input) (any, []any, error) {
	var next *State
	var err error
	if start, ok := event.(Start); ok {
		if start.Config == (Config{}) {
			start.Config = m.Config
		}
		next, err = New(start, input)
	} else {
		current, ok := state.(*State)
		if !ok {
			return nil, nil, Code("invalid_state")
		}
		next, err = Apply(current, event, input)
	}
	if err != nil {
		return nil, nil, err
	}
	effects := []any{}
	if at := next.NextTick(); !at.IsZero() {
		effects = append(effects, Schedule{At: at})
	}
	return next, effects, nil
}

func (Module) Project(state any, playerID string, now time.Time) (any, error) {
	current, ok := state.(*State)
	if !ok {
		return nil, Code("invalid_state")
	}
	return current.View(playerID, now)
}
