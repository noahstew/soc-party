package protocol

import (
	"encoding/json"
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
		{"pack selection", `{"type":"select_pack","payload":{"gameId":"zinger","packSlug":"og","selected":true}}`, true},
		{"pack deselection", `{"type":"select_pack","payload":{"gameId":"zinger","packSlug":"og","selected":false}}`, true},
		{"bad pack state", `{"type":"select_pack","payload":{"gameId":"zinger","packSlug":"og","selected":"yes"}}`, false},
		{"bad pack fields", `{"type":"select_pack","payload":{"gameId":"zinger","packSlug":"og","selected":true,"unexpected":1}}`, false},
		{"settings", `{"type":"update_settings","payload":{"maxPlayers":4}}`, true},
		{"start", `{"type":"start_game","payload":{}}`, true},
		{"draft", `{"type":"update_draft","payload":{"promptId":"p1","text":"draft"}}`, true},
		{"answer", `{"type":"submit_answer","payload":{"promptId":"p1","text":"answer"}}`, true},
		{"vote selection", `{"type":"update_vote","payload":{"matchupId":"m1","answerId":"a1"}}`, true},
		{"invalid vote selection", `{"type":"update_vote","payload":{"matchupId":"m1","answerId":""}}`, false},
		{"vote", `{"type":"cast_vote","payload":{"matchupId":"m1","answerId":"a1"}}`, true},
		{"final votes", `{"type":"submit_final_votes","payload":{"answerIds":["a1","a2"]}}`, true},
		{"empty final votes", `{"type":"submit_final_votes","payload":{"answerIds":[]}}`, true},
		{"stacked final votes", `{"type":"submit_final_votes","payload":{"answerIds":["a1","a1","a1"]}}`, true},
		{"too many final votes", `{"type":"submit_final_votes","payload":{"answerIds":["a1","a2","a3","a4"]}}`, false},
		{"missing draft prompt", `{"type":"update_draft","payload":{"promptId":"","text":"draft"}}`, false},
		{"oversized draft", `{"type":"update_draft","payload":{"promptId":"p1","text":"` + strings.Repeat("x", 401) + `"}}`, false},
		{"return", `{"type":"return_to_lobby","payload":{}}`, true},
		{"unknown", `{"type":"unknown","payload":{}}`, false},
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

func TestAvatarSelection(t *testing.T) {
	for _, payload := range []string{`{"avatarId":0}`, `{"avatarId":9}`, `{"avatarId":1.5}`, `{}`, `{"avatarId":2,"playerId":"someone"}`} {
		if _, _, err := Decode(Message("select_avatar", "", json.RawMessage(payload))); err == nil {
			t.Fatalf("accepted %s", payload)
		}
	}
	if _, _, err := Decode(Message("select_avatar", "", AvatarSelection{AvatarID: 8})); err != nil {
		t.Fatal(err)
	}
}
