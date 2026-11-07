package httpapi

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"example.com/soc-party/backend/internal/platform"
	"example.com/soc-party/backend/internal/protocol"
	"github.com/coder/websocket"
)

type RoomOptions struct {
	Registry *platform.Registry
	Origins  []string
}

func (a api) origin(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	allowed := false
	for _, o := range a.rooms.Origins {
		if origin == o {
			allowed = true
		}
	}
	if !allowed {
		respond(w, http.StatusForbidden, map[string]string{"error": "origin not allowed"})
		return false
	}
	w.Header().Set("Access-Control-Allow-Origin", origin)
	w.Header().Set("Vary", "Origin")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
	return true
}
func (a api) roomError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	switch {
	case errors.Is(err, platform.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, platform.ErrUnauthorized):
		status = http.StatusUnauthorized
	case errors.Is(err, platform.ErrForbidden):
		status = http.StatusForbidden
	case errors.Is(err, platform.ErrConflict):
		status = http.StatusConflict
	case errors.Is(err, platform.ErrUnavailable), errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		status = http.StatusServiceUnavailable
	}
	respond(w, status, map[string]string{"error": err.Error()})
}
func (a api) roomIntent(w http.ResponseWriter, r *http.Request) {
	if !a.origin(w, r) {
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, protocol.MaxMessageBytes)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		respond(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request too large"})
		return
	}
	var input struct {
		Name  string `json:"name"`
		Token string `json:"token"`
	}
	if err = protocol.Strict(data, &input); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	var session protocol.Session
	code := strings.ToUpper(strings.TrimSpace(r.PathValue("code")))
	if code != "" && !platform.ValidCode(code) {
		a.roomError(w, platform.ErrNotFound)
		return
	}
	switch {
	case r.URL.Path == "/api/rooms":
		session, err = a.rooms.Registry.Create(ctx, input.Name)
	case strings.HasSuffix(r.URL.Path, "/reconnect"):
		session, err = a.rooms.Registry.Reconnect(ctx, code, input.Token)
	default:
		session, err = a.rooms.Registry.Join(ctx, code, input.Name)
	}
	if err != nil {
		a.roomError(w, err)
		return
	}
	respond(w, http.StatusCreated, session)
}
func (a api) socket(w http.ResponseWriter, r *http.Request) {
	if !a.origin(w, r) {
		return
	}
	code := strings.ToUpper(r.PathValue("code"))
	if !platform.ValidCode(code) {
		a.roomError(w, platform.ErrNotFound)
		return
	}
	// Exact origin equality is enforced above before the library's host-pattern checks.
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: a.rooms.Origins})
	if err != nil {
		return
	}
	defer func() { _ = conn.CloseNow() }()
	conn.SetReadLimit(protocol.MaxMessageBytes)
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	authCtx, authCancel := context.WithTimeout(ctx, 5*time.Second)
	kind, data, err := conn.Read(authCtx)
	authCancel()
	if err != nil || kind != websocket.MessageText {
		return
	}
	envelope, payload, err := protocol.Decode(data)
	if err != nil || envelope.Type != "session_auth" {
		_ = conn.Close(websocket.StatusPolicyViolation, "authenticate first")
		return
	}
	token := payload.(*protocol.Auth).Token
	id, updates, err := a.rooms.Registry.Subscribe(ctx, code, token)
	if err != nil {
		_ = conn.Close(websocket.StatusPolicyViolation, "session expired")
		return
	}
	defer a.rooms.Registry.Disconnect(code, id, updates)
	outgoing := make(chan []byte, 8)
	done := make(chan struct{})
	go func() {
		defer close(done)
		defer cancel()
		for {
			var message []byte
			select {
			case <-ctx.Done():
				return
			case next, ok := <-updates:
				if !ok {
					_ = conn.CloseNow()
					return
				}
				message = next
			case message = <-outgoing:
			}
			writeCtx, stop := context.WithTimeout(ctx, 5*time.Second)
			err := conn.Write(writeCtx, websocket.MessageText, message)
			stop()
			if err != nil {
				return
			}
		}
	}()
	defer func() { cancel(); _ = conn.CloseNow(); <-done }()
	for {
		readCtx, stop := context.WithTimeout(ctx, 45*time.Second)
		kind, data, err = conn.Read(readCtx)
		stop()
		if err != nil {
			return
		}
		if kind != websocket.MessageText {
			_ = conn.Close(websocket.StatusUnsupportedData, "text JSON required")
			return
		}
		envelope, payload, err = protocol.Decode(data)
		if err != nil || envelope.Type == "session_auth" {
			_ = conn.Close(websocket.StatusPolicyViolation, "invalid message")
			return
		}
		if err = a.rooms.Registry.Command(ctx, code, token, envelope.Type, payload); err != nil {
			select {
			case outgoing <- protocol.Message("error", envelope.ID, protocol.Error{Message: err.Error()}):
			case <-ctx.Done():
				return
			default:
				return
			}
			if errors.Is(err, platform.ErrUnauthorized) {
				return
			}
		}
		if envelope.Type == "leave_room" {
			return
		}
	}
}
