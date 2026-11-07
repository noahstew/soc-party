# Agent instructions

## Purpose and stage
Build a browser-based multiplayer party-game platform: each player uses their own device;
rooms are shared by code/link, with no host screen. First game working title: **Wit Parade**.
Use original content only. Platform services and game modules stay separate.
Current work is Phase 0 only. No gameplay, sockets, accounts, ads, or infrastructure yet.

## Layout
- `backend/cmd`: server and JSON seed entrypoints.
- `backend/internal/{config,httpapi,platform,games,protocol,store}`: configuration, transport,
  reusable platform, deterministic modules, protocol source of truth, generated queries.
- `backend/{migrations,queries,data}`: goose schema, sqlc inputs, original starter content.
- `frontend/src/{app,components,lib,platform,games}`: routes, components, utilities, platform UI, game UI.
- `docs/PLAN.md`: ordered tasks; architecture, deployment, decisions explain the boundaries.

## Commands (Docker is the only prerequisite)
Copy `.env.example` to `.env`, then `make up` (or `docker compose up --build`).
`make down`, `make logs`, `make test`, `make integration`, `make lint`, `make typecheck`,
`make fmt`, `make sqlc`, `make sqlc-check`, `make migrate`, `make seed`, `make psql`,
`make reset-db` (destroys development data), `make check`.
Prod-like: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d`.

## Engineering rules
1. Server owns game state, scoring, timers, phases. Clients send intents and render projections.
2. Each room has one goroutine consuming one channel and owning all its state. Only the registry
   is shared; no shared mutable state across rooms.
3. Game modules register by ID and implement a Go interface. Pure deterministic transitions:
   state + event -> state + effects, injected clock and RNG, no I/O.
4. Project state separately per player. Never broadcast secrets and hide them in the UI.
5. SQL queries exist only in `backend/queries/*.sql`, executed through committed sqlc output.
   Goose migrations are the schema source of truth. Never edit generated Go by hand.
6. Every behavior change includes tests in the same commit; fixes include regression tests.
7. Protocol source of truth: `backend/internal/protocol`, mirrored in
   `frontend/src/lib/protocol.ts`. Envelope `{type, id?, payload}`, snake_case types,
   camelCase payload fields. No message types until M1.
8. Validate input and size limits; WebSockets require origin checks; room codes use CSPRNG.
   No secrets in Git or user content passed to `dangerouslySetInnerHTML`.

## Conventions
Go: standard net/http, slog, explicit errors, context propagation, constructor injection,
small packages, table-driven tests and race detector. See `backend/AGENTS.md`.
Next: App Router, strict TypeScript, mobile-first individual player UI. One socket per tab
when introduced; countdowns derive from server deadlines. See `frontend/AGENTS.md`.

## Session protocol
1. Read `docs/PLAN.md`; choose the first unchecked task in the current milestone unless directed otherwise.
2. Work on one task at a time with a focused diff.
3. Write/update tests first or alongside code.
4. Run `make check` (lint, formatting, typecheck, unit tests, sqlc drift) before declaring done.
   Run integration tests for schema/store changes. Report blocked checks honestly.
5. Tick completed tasks; put discoveries in Backlog instead of expanding scope. Record
   non-trivial decisions and dependency reasons in `docs/DECISIONS.md`.
6. Never weaken/delete tests to pass, silently add dependencies, or refactor unrelated code.
7. Do not skip milestones. Phase 0 ends at verification; do not begin M1 automatically.

## Definition of Done
- [ ] Behavior covered by meaningful tests; regression covered for fixes.
- [ ] `make check` green and relevant integration checks passed.
- [ ] Docs and plan match implementation; new dependencies/decisions explained.
- [ ] No unlogged TODOs, secrets, generated junk, or unrelated changes.
