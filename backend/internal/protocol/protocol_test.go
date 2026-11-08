package protocol

import (
	"strings"
	"testing"
)

func TestDecode(t *testing.T) {
	for _, tc := range []struct {
		name, data string
		valid      bool
	}{
		{"auth", `{"type":"session_auth","payload":{"token":"secret"}}`, true},
		{"ping", `{"type":"ping","id":"1","payload":{}}`, true},
		{"kick", `{"type":"kick_player","payload":{"playerId":"id"}}`, true},
		{"game selection", `{"type":"select_game","payload":{"gameId":"zinger"}}`, true},
		{"bad game payload", `{"type":"select_game","payload":{"gameId":4}}`, false},
		{"settings", `{"type":"update_settings","payload":{"maxPlayers":4}}`, true},
		{"unknown", `{"type":"start_game","payload":{}}`, false},
		{"missing payload", `{"type":"ping"}`, false},
		{"null", `{"type":"ping","payload":null}`, false},
		{"extra field", `{"type":"ping","payload":{"secret":1}}`, false},
		{"wrong type", `{"type":"update_settings","payload":{"maxPlayers":"4"}}`, false},
		{"trailing", `{"type":"ping","payload":{}} {}`, false},
		{"oversized", strings.Repeat(" ", MaxMessageBytes+1), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := Decode([]byte(tc.data))
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v err=%v", tc.valid, err)
			}
		})
	}
}
