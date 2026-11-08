# Decisions

ADR-lite: date, decision, reason, alternatives. All dates use the project timezone (America/Vancouver).

## 2026-11-07 — Portable production Compose resets
GitHub's Compose 2.38.2 loses the volumes reset inherited through x-prod; the retained
source mount hides /app/migrate in the production image. Compose 5.3.1 locally does
not reproduce this. Put !reset directly on migrate/seed/backend services, matching
frontend, and regression-check merged production targets/mounts before CI builds.
Keep both smoke modes on pushes and PRs; disable matrix fail-fast so one failure does
not cancel the other. Both stacks are runner-local and require no cloud deployment.
Alternative: skipping smoke until deployment would hide broken container packaging;
requiring everyone to upgrade Compose would leave the override fragile.
Related upstream issue: https://github.com/docker/compose/issues/11706

## 2026-11-07 — Focused agent context
Keep shared invariants and verification requirements once in root AGENTS.md; directory
files contain stack-specific guidance. Read supporting docs and large/generated files
only when relevant, while checking the active plan and applicable instructions each task.
This reduces repeated context without dropping security, tests or milestone constraints.
M1 in the plan identifies the next milestone; it does not override Phase 0 authorization.
Alternative: aggressive abbreviation or deleting safeguards saves text but risks ambiguity.
The three instruction files shrink from 5,778 to 4,278 bytes (26%); this is a context-size
proxy, not a measured token or latency reduction. No runtime/dependency/model changes.
Reference: https://learn.chatgpt.com/docs/agent-configuration/agents-md

## 2026-11-07 — Neobrutalism UI foundation
At the user's request, adopt neobrutalism.dev's Tailwind v4 blue theme and copy its
Button, Card, Badge, and Alert registry sources into frontend/src/components/ui.
Apply them to the existing foundation page and retain its health/pack failure states.
Keep this a frontend foundation task; no room or gameplay features are introduced.
Configure components.json for future selective shadcn imports rather than installing
the entire catalog. Preserve upstream MIT attribution in docs/licenses.

Add exact runtime dependencies @base-ui/react (accessible Button/Badge primitives),
class-variance-authority (variants), clsx (conditional class names), and tailwind-merge
(Tailwind class overrides). Retain the system font; omit unused animation/icon
dependencies from the full style preset. Alternative: a custom imitation would lose
compatibility with the requested upstream components. Source and extension instructions
live in frontend/src/components/README.md.

## 2026-11-07 — Scope and working title
Phase 0 is a walking skeleton only. “Wit Parade” is an original placeholder title, not a
trademark clearance. Empty platform/protocol packages document later work. Alternative:
one-shot implementation rejected by scope. No accounts, WebSockets, ads, AWS code, or game rules.

## 2026-11-07 — Stack and dependencies
Use Go latest stable (verify against go.dev at bootstrap), net/http, slog, PostgreSQL 17,
pgx/v5, goose SQL migrations, sqlc; Next.js App Router, React, strict TypeScript, Tailwind,
pnpm; Vitest, React Testing Library and jsdom. Keep exact JS versions and lockfile.
Air is a dev-only hot reloader; golangci-lint is a pinned tool. Goose is also a Go dependency
for real migration integration tests. No ORM, web framework, websocket library, or Playwright
until needed. Alternatives: ORM and additional web frameworks add no Phase 0 value.

## 2026-11-07 — Generated SQL is committed
Goose SQL is the schema authority. sqlc reads migrations/ and queries/, emits pgx/v5 code
into internal/store. Commit output so reviewers see query/API changes and builds need no
code generator. Pinned sqlc runs in Docker. `make sqlc-check` regenerates, checks tracked
changes with git diff --exit-code, and rejects untracked generated files; CI repeats it.
Alternative: generating only at build time obscures drift and increases build dependencies.

## 2026-11-07 — Docker lifecycle and seed
One-shot migrate precedes one-shot seed, then backend and frontend. Automatic seeding makes
the initial page useful with Docker alone. Seed is transactional and idempotent using stable
pack slug and prompt position, including repeated runs; unrelated prompts remain intact.
Default credentials are local development examples only. No host database port is published.
Prod-like override clears source mounts/dev commands, uses non-root standalone images,
and requires an explicit database password. It is a local rehearsal, not AWS deployment.

## 2026-11-07 — Networking and page
Next server fetches backend using API_INTERNAL_URL=http://backend:8080; browser-visible
API/WS examples use localhost:8080 (WS planned). Server rendering avoids CORS and exposes
no internal hostname to browser fetch. Render health and pack failures visibly; never fail
the build because the DB is unavailable. No remote fonts/assets or speculative UI.

## 2026-11-07 — Module boundary
Only an interface and registration stub exist. State/events/effects are opaque Go values
until M2; transition inputs include supplied time and RNG. Project separately per player.
No global live registry, actor implementation, room allocation, protocol types, or rules yet.

## 2026-11-07 — Repository and completion
The provided directory was empty and not a Git repository; initialize locally and create
six focused commits as requested. M0 stays pending until real acceptance results permit
a done status; never mark unverifiable Docker checks passed. No remote repository is assumed.

## 2026-11-07 — Exact verified versions
Pin Go 1.27.3, sqlc 1.31.1, goose 3.29.0, pgx 5.12.0, Air 1.67.4,
golangci-lint 2.15.0, Node 24.22.1 and pnpm 10.34.9. Frontend resolves Next
16.4.5/React 19.3.1; exact transitive JS dependencies are in pnpm-lock.yaml.
TypeScript 6.0.3 and ESLint 9.39.5 match Next plugin peer ranges; the current
TypeScript 7/ESLint 10 releases do not. ESLint 9 is upstream-deprecated; track
plugin support and upgrade before extending frontend tooling. Goose runs via a
small application command using its library, avoiding an unused multi-driver CLI.
Sources checked: https://go.dev/dl/, https://nextjs.org/blog/, official package
registries and upstream GitHub release APIs.

## 2026-11-07 — Verification boundaries
Integration tests intentionally use the development/CI database, apply goose migrations
without dropping data, seed twice, and roll back test-only queries. They must receive a
disposable DATABASE_URL. Docker smoke runs a dev/prod matrix in CI and checks configured
non-root runtime users for prod. CI itself can only be exercised on GitHub after pushing;
validate the workflow locally with actionlint and execute its underlying checks here.

## 2026-11-07 — Noninteractive container dependency installation
Set frontend CI=true so pnpm never waits for a TTY. Explicitly keep pnpm's store at
/pnpm/store in the image and runtime: CI otherwise changes its default to a directory
under the source mount and forces a dependency reinstall. Ignore any local package store
in Git, Docker context and formatting. Named node_modules and .next volumes keep Linux
dependencies/build output separate from host tools.

## 2026-11-07 — Local module identity and environment repair
Use example.com/soc-party/backend until an actual repository/module hostname is chosen.
PostgreSQL 17.7 is a pinned development baseline, not a claim to be the newest major.
During verification Docker storage filled and PostgreSQL could not write; with explicit
approval, pruned build cache unused for over 30 days (9.372 GB reclaimed), then recreated
only this project's disposable volumes. Subsequent migration/integration checks passed.
No images or database volumes from other projects were removed.

## 2026-11-07 — Authorized MVP persistence and lobby
User explicitly advances Phase 0 to M1 and requests four commits: schema, OG seed,
generated SQL/API/WebSocket, frontend. Game records are designed now; M2 rules and
M3 playable pack selection remain unchecked until implemented and verified.
Use a second database `wit_parade` in the same instance as requested. Platform rooms
and guest membership stay in `party`; content and game history live in `wit_parade`.
Separate databases cannot have cross-database foreign keys or atomic transactions:
Go validates platform IDs when future games start. Per-game schemas in one database
would be simpler for joins/transactions, but separate databases preserve the requested
isolation. A fixed CREATE DATABASE in migration bootstrap needs CREATEDB on first run;
goose owns all tables and each database has its own migration history.
Preserve M0 packs in the platform database for rollback/data retention; the API and
seed switch to the game database. The legacy tables are unused after that switch.
Sessions, participants, rounds, prompt snapshots, two answer slots and votes cover
MVP persistence. Composite keys prevent cross-game/cross-matchup writes; voter
eligibility and phase/scoring rules will be enforced by M2, not exposed as CRUD.
Live rooms use one actor per room. DB membership is a durable audit, not restart
recovery; restart closes old rooms and invalidates their tokens. No accounts yet.

## 2026-11-07 — Guest lobby policy and WebSocket dependency
Add exact github.com/coder/websocket v1.8.15 for maintained RFC6455 framing, context
cancellation and read limits; net/http remains the HTTP server. Source/release checked:
https://github.com/coder/websocket/releases/tag/v1.8.15 .
Allow exact configured HTTP(S) origins for both admission and sockets. Authenticate
within five seconds using the first session_auth message, never a URL token. Bound
messages to 4 KiB, reads to 45 seconds, writes to five seconds, actor queues to 32,
rooms to 256, players to eight and total memberships per room to 128. Slow readers
receive only the latest bounded projection. Clients send ping every 20 seconds.
Guest tokens contain 256 CSPRNG bits; only SHA-256 hashes enter PostgreSQL. Each
browser tab stores its credential in sessionStorage, reconnect rotates it atomically
and revokes the old token; kicks/leave revoke membership. A second socket replaces
the previous socket for the same credential. Disconnect grace is 60 seconds, owner
transfers to the earliest remaining member, idle expiry 30 minutes, hard expiry two
hours. No identity recovery after grace/restart/expiry. All state writes precede
publication; failures preserve actor state. Three connected players make a room
eligible, but starting gameplay remains M2. One process only; no multi-replica claims.

## 2026-11-07 — Zinger game identity
Rename the game to Zinger and its public/persisted game ID to `zinger`. A new goose
migration updates existing rooms and their default/check constraint; historical
migrations remain unchanged. Retain the physical `wit_parade` database name as a
legacy storage identifier to preserve content and avoid disrupting active database
connections. The database name is not exposed as the game name in the UI/protocol.
