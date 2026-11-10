package games

import (
	"testing"
	"time"
)

type testModule struct{ id string }

func (m testModule) ID() string                                          { return m.id }
func (testModule) Transition(state, _ any, _ Input) (any, []any, error)  { return state, nil, nil }
func (testModule) Project(state any, _ string, _ time.Time) (any, error) { return state, nil }

func TestModules(t *testing.T) {
	r := NewModules()
	if err := r.Register(testModule{id: "zinger"}); err != nil {
		t.Fatal(err)
	}
	if _, ok := r.Lookup("zinger"); !ok {
		t.Fatal("registered module missing")
	}
	if err := r.Register(testModule{id: "zinger"}); err == nil {
		t.Fatal("duplicate accepted")
	}
}
