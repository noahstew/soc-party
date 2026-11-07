# Backend conventions
Follow root AGENTS.md. Entrypoints belong in cmd; configuration in internal/config;
HTTP transport in internal/httpapi; reusable room services in internal/platform;
pure rules in internal/games. Do not introduce speculative implementations.
Use net/http and slog; pass context and dependencies explicitly; bound requests and timeouts.
Use table-driven testing, fakes for handlers, and `go test -race ./...`.

To change schema: add a sequential `migrations/NNNNN_description.sql` with goose Up/Down.
Add named SQL in `queries/*.sql`, run `make sqlc`, commit all generated store files.
Never hand-edit generated files or put SQL strings in Go. Add an integration test and run
`make integration`; use `make migrate` to apply schema and `make seed` for starter data.
Run `make fmt` and `make check` before completion.
