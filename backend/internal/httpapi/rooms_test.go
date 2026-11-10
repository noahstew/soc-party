package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"example.com/soc-party/backend/internal/platform"
	"example.com/soc-party/backend/internal/protocol"
	"github.com/coder/websocket"
)

type roomRepo struct{}

func (roomRepo) Save(context.Context, platform.Record, bool) error { return nil }
func TestRoomHTTPAndSockets(t *testing.T) {
	rooms := platform.NewRegistry(roomRepo{}, func(context.Context) ([]protocol.Game, error) {
		return []protocol.Game{{ID: "zinger", Title: "Zinger", Packs: []protocol.Pack{{Slug: "og", Title: "OG"}}}}, nil
	})
	defer rooms.Close()
	server := httptest.NewServer(New(fakeDB{}, fakePacks{}, slog.New(slog.NewTextHandler(io.Discard, nil)), RoomOptions{Registry: rooms, Origins: []string{"http://localhost:3000"}}))
	defer server.Close()
	post := func(path, body, origin string) (int, protocol.Session) {
		t.Helper()
		req, err := http.NewRequest(http.MethodPost, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Origin", origin)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = resp.Body.Close() }()
		var session protocol.Session
		if resp.StatusCode == 201 {
			if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
				t.Fatal(err)
			}
		}
		return resp.StatusCode, session
	}
	for _, tc := range []struct {
		path, body, origin string
		status             int
	}{
		{"/api/rooms", `{"name":"Owner"}`, "https://evil.example", 403},
		{"/api/rooms", `{"name":"Owner","unexpected":true}`, "http://localhost:3000", 400},
		{"/api/rooms", strings.Repeat("x", 4097), "http://localhost:3000", 413},
		{"/api/rooms/ABC123/join", `{"name":"Guest"}`, "http://localhost:3000", 404},
	} {
		if status, _ := post(tc.path, tc.body, tc.origin); status != tc.status {
			t.Fatalf("status=%d want=%d", status, tc.status)
		}
	}
	status, owner := post("/api/rooms", `{"name":"Owner"}`, "http://localhost:3000")
	if status != 201 {
		t.Fatalf("create=%d", status)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	url := strings.Replace(server.URL, "http://", "ws://", 1) + "/api/rooms/" + owner.Lobby.Code + "/ws"
	denied, resp, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{"https://evil.example"}}})
	if denied != nil {
		_ = denied.CloseNow()
	}
	if err == nil || resp.StatusCode != 403 {
		t.Fatal("cross-origin socket accepted")
	}
	connect := func(token string) *websocket.Conn {
		t.Helper()
		conn, _, err := websocket.Dial(ctx, url, &websocket.DialOptions{HTTPHeader: http.Header{"Origin": []string{"http://localhost:3000"}}})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = conn.CloseNow() })
		if err = conn.Write(ctx, websocket.MessageText, protocol.Message("session_auth", "", protocol.Auth{Token: token})); err != nil {
			t.Fatal(err)
		}
		return conn
	}
	read := func(conn *websocket.Conn) protocol.Lobby {
		t.Helper()
		_, data, err := conn.Read(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(data), "token") {
			t.Fatal("token leaked")
		}
		var env protocol.Envelope
		if err = json.Unmarshal(data, &env); err != nil {
			t.Fatal(err)
		}
		var lobby protocol.Lobby
		if err = json.Unmarshal(env.Payload, &lobby); err != nil {
			t.Fatal(err)
		}
		return lobby
	}
	ownerSocket := connect(owner.Token)
	read(ownerSocket)
	status, guest := post("/api/rooms/"+owner.Lobby.Code+"/join", `{"name":"Guest"}`, "http://localhost:3000")
	if status != 201 {
		t.Fatal("join failed")
	}
	if lobby := read(ownerSocket); len(lobby.Players) != 2 {
		t.Fatalf("players=%d", len(lobby.Players))
	}
	guestSocket := connect(guest.Token)
	if lobby := read(guestSocket); lobby.YouID != guest.Lobby.YouID || len(lobby.Players) != 2 {
		t.Fatal("wrong guest projection")
	}
	// Owner can remove a guest; its socket closes and its token cannot reconnect.
	if err = ownerSocket.Write(ctx, websocket.MessageText, protocol.Message("kick_player", "k1", protocol.Kick{PlayerID: guest.Lobby.YouID})); err != nil {
		t.Fatal(err)
	}
	for {
		lobby := read(ownerSocket)
		if len(lobby.Players) == 1 {
			break
		}
	}
	if _, _, err = guestSocket.Read(ctx); err == nil {
		t.Fatal("kicked socket still open")
	}
	status, _ = post("/api/rooms/"+owner.Lobby.Code+"/reconnect", `{"token":"`+guest.Token+`"}`, "http://localhost:3000")
	if status != 401 {
		t.Fatalf("kicked reconnect=%d", status)
	}
}
