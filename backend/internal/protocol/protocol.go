// Package protocol is the authority for the lobby wire format.
package protocol

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
)

const MaxMessageBytes = 4096

type Envelope struct {
	Type    string          `json:"type"`
	ID      string          `json:"id,omitempty"`
	Payload json.RawMessage `json:"payload"`
}
type Auth struct {
	Token string `json:"token"`
}
type Kick struct {
	PlayerID string `json:"playerId"`
}
type Settings struct {
	MaxPlayers int `json:"maxPlayers"`
}
type GameSelection struct {
	GameID string `json:"gameId"`
}
type PackSelection struct {
	GameID   string `json:"gameId"`
	PackSlug string `json:"packSlug"`
	Selected *bool  `json:"selected"`
}
type Empty struct{}
type Player struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Connected bool   `json:"connected"`
}
type Pack struct {
	Slug  string `json:"slug"`
	Title string `json:"title"`
}
type Game struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Packs []Pack `json:"packs"`
}
type Lobby struct {
	Code              string   `json:"code"`
	OwnerID           string   `json:"ownerId"`
	YouID             string   `json:"youId"`
	GameID            string   `json:"gameId"`
	Games             []Game   `json:"games"`
	SelectedPackSlugs []string `json:"selectedPackSlugs"`
	MaxPlayers        int      `json:"maxPlayers"`
	CanStart          bool     `json:"canStart"`
	ExpiresAt         string   `json:"expiresAt"`
	Players           []Player `json:"players"`
}
type Session struct {
	Token string `json:"token"`
	Lobby Lobby  `json:"lobby"`
}
type Error struct {
	Message string `json:"message"`
}

func Strict(data []byte, target any) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return err
	}
	if err := dec.Decode(new(any)); err != io.EOF {
		return fmt.Errorf("expected one JSON value")
	}
	return nil
}

func Decode(data []byte) (Envelope, any, error) {
	var e Envelope
	if len(data) > MaxMessageBytes {
		return e, nil, fmt.Errorf("message too large")
	}
	if err := Strict(data, &e); err != nil {
		return e, nil, err
	}
	if len(e.ID) > 64 || len(e.Payload) == 0 || bytes.Equal(bytes.TrimSpace(e.Payload), []byte("null")) {
		return e, nil, fmt.Errorf("invalid envelope")
	}
	var payload any
	switch e.Type {
	case "session_auth":
		payload = &Auth{}
	case "kick_player":
		payload = &Kick{}
	case "update_settings":
		payload = &Settings{}
	case "select_game":
		payload = &GameSelection{}
	case "select_pack":
		payload = &PackSelection{}
	case "ping", "leave_room":
		payload = &Empty{}
	default:
		return e, nil, fmt.Errorf("unknown message type")
	}
	if err := Strict(e.Payload, payload); err != nil {
		return e, nil, err
	}
	return e, payload, nil
}

func Message(kind, id string, payload any) []byte {
	data, _ := json.Marshal(payload)
	message, _ := json.Marshal(Envelope{Type: kind, ID: id, Payload: data})
	return message
}
