// Package games defines the boundary for future deterministic game modules.
package games

import (
	"fmt"
	"time"
)

// Random is supplied by the room runtime for repeatable game transitions.
type Random interface{ IntN(int) int }

// Input supplies time and randomness; game logic must not read clocks or perform I/O.
type Input struct {
	Now    time.Time
	Random Random
}

// Module owns pure rules and per-player visibility. Concrete types arrive in M2.
type Module interface {
	ID() string
	Transition(state, event any, input Input) (next any, effects []any, err error)
	Project(state any, playerID string, now time.Time) (view any, err error)
}

type Modules struct{ byID map[string]Module }

func NewModules() *Modules { return &Modules{byID: make(map[string]Module)} }

func (r *Modules) Register(module Module) error {
	if module == nil || module.ID() == "" || r.byID[module.ID()] != nil {
		return fmt.Errorf("invalid or duplicate game module")
	}
	r.byID[module.ID()] = module
	return nil
}

func (r *Modules) Lookup(id string) (Module, bool) {
	module, ok := r.byID[id]
	return module, ok
}
