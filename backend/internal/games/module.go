// Package games defines the boundary for future deterministic game modules.
package games

import "time"

// Random is supplied by the room runtime for repeatable game transitions.
type Random interface { IntN(int) int }

// Input supplies time and randomness; game logic must not read clocks or perform I/O.
type Input struct { Now time.Time; Random Random }

// Module owns pure rules and per-player visibility. Concrete types arrive in M2.
type Module interface {
 ID() string
 Transition(state, event any, input Input) (next any, effects []any, err error)
 Project(state any, playerID string) (view any, err error)
}

// Registry is only a contract stub; registration and lookup arrive with game wiring.
type Registry interface {
 Register(Module) error
 Lookup(id string) (Module, bool)
}
