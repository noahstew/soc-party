# Backend conventions

Root AGENTS.md applies. Entrypoints: cmd; configuration: internal/config;
HTTP: internal/httpapi; reusable services: internal/platform; pure rules: internal/games;
generated queries: internal/store. No speculative implementations.

Use net/http, slog, explicit errors, context propagation, constructor injection and
small packages. Bound requests/timeouts. Use table-driven tests, handler fakes and
`go test -race ./...` (`make test` includes this).

Schema changes: add sequential `migrations/NNNNN_description.sql` with goose Up/Down,
add named SQL in `queries/*.sql`, run `make sqlc` and commit generated store files.
Add integration coverage; `make migrate` applies schema, `make seed` loads starter data.
