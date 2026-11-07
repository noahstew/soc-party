package httpapi

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"example.com/soc-party/backend/internal/store"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(ctx context.Context) error {
	if _, ok := ctx.Deadline(); !ok {
		return errors.New("missing DB timeout")
	}
	return f.err
}

type fakePacks struct {
	rows []store.ListOfficialPacksRow
	err  error
}

func (f fakePacks) ListOfficialPacks(ctx context.Context) ([]store.ListOfficialPacksRow, error) {
	if _, ok := ctx.Deadline(); !ok {
		return nil, errors.New("missing query timeout")
	}
	return f.rows, f.err
}

func TestHandlers(t *testing.T) {
	secretErr := errors.New("postgres password=do-not-expose")
	tests := []struct {
		name, method, path string
		dbErr, packErr     error
		rows               []store.ListOfficialPacksRow
		status             int
		body               string
	}{
		{name: "healthy", method: "GET", path: "/healthz", status: 200, body: `{"database":"ok","status":"ok"}`},
		{name: "database down", method: "GET", path: "/healthz", dbErr: secretErr, status: 503, body: `{"database":"unavailable","status":"error"}`},
		{name: "packs", method: "GET", path: "/api/packs", rows: []store.ListOfficialPacksRow{{ID: 1, Slug: "original", Title: "Original pack"}}, status: 200, body: `[{"id":1,"slug":"original","title":"Original pack"}]`},
		{name: "empty packs", method: "GET", path: "/api/packs", status: 200, body: `[]`},
		{name: "packs unavailable", method: "GET", path: "/api/packs", packErr: secretErr, status: 503, body: `{"error":"packs unavailable"}`},
		{name: "wrong method", method: "POST", path: "/api/packs", status: 405},
		{name: "unknown route", method: "GET", path: "/missing", status: 404},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := New(fakeDB{tt.dbErr}, fakePacks{tt.rows, tt.packErr}, slog.New(slog.NewTextHandler(io.Discard, nil)))
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, nil))
			if w.Code != tt.status {
				t.Fatalf("status=%d want=%d body=%s", w.Code, tt.status, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "do-not-expose") {
				t.Fatal("internal error leaked")
			}
			if tt.body != "" {
				if strings.TrimSpace(w.Body.String()) != tt.body {
					t.Fatalf("body=%s want=%s", w.Body.String(), tt.body)
				}
				if w.Header().Get("Content-Type") != "application/json" || w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("missing JSON/cache headers")
				}
			}
			if tt.status == http.StatusMethodNotAllowed && w.Header().Get("Allow") != "GET, HEAD" {
				t.Fatalf("Allow=%s", w.Header().Get("Allow"))
			}
		})
	}
}
