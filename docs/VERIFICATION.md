# Phase 0 verification

Bootstrap snapshot from 2026-11-07 on macOS/Apple Silicon with Docker Desktop.
At this snapshot M0 was complete and M1 had not started; later sections record M1.
Six focused local commits
record documentation, scaffold, database, skeleton/tests, CI and final verification.

## Acceptance results

- [x] Docker-only startup with `.env.example` copied to `.env`: database healthy,
  migrations and seed exit 0, backend and frontend healthy.
- [x] Fresh-volume restart: `docker compose down -v` followed by
  `docker compose up --build -d` and
  `docker compose up --wait --wait-timeout 300 backend frontend` succeeds.
  Repeated a fresh-database dev startup after the production rehearsal; it also succeeds.
- [x] HTTP smoke: `/healthz` returns 200 with `{"database":"ok","status":"ok"}`;
  `/api/packs` returns the published original pack; the rendered frontend contains
  “Reachable”, “Healthy”, and “Small Talk, Big Nonsense”.
- [x] `make check` passes: gofmt, go vet, golangci-lint (0 issues), ESLint,
  Prettier, strict TypeScript, Go race tests, five frontend tests and sqlc drift check.
- [x] `make sqlc` runs the pinned real generator (also invoked by `make check`);
  `git diff --exit-code -- backend/internal/store` is clean and no untracked output exists.
- [x] `make integration` passes against PostgreSQL 17.7: goose applies migrations,
  second migration run does nothing, seed twice keeps pack/prompt counts stable,
  generated create/list/count queries work, drafts stay hidden and invalid text is rejected.
  Test-only query data rolls back. The starter pack contains 24 original prompts.
- [x] Prod-like `docker compose -f docker-compose.yml -f docker-compose.prod.yml
  up --build -d` builds and runs successfully. Next production compilation and
  TypeScript finish successfully; page/API smoke passes. Backend process UID 65532,
  frontend process UID 1000, confirmed with `docker compose ... top backend frontend`.
  Image configuration users: `65532:65532` and `node`; sizes approximately 32.5 MB
  and 286.1 MB. Application/migration/seed source mounts are absent in merged config.
- [x] Both Compose configurations validate with `docker compose ... config`.
- [x] `.github/workflows/ci.yml` passes actionlint 1.7.12 (YAML, workflow expressions,
  action inputs and shell syntax). CI mirrors local lint/typecheck/race/unit/drift checks,
  adds a real Postgres integration job and frontend build, and smoke-tests dev/prod images.
- [x] Plan structure reviewed: M0–M9 each include goal, in/out of scope, session-sized
  tasks, required tests and observable completion; M1/M2 are concrete and unchecked.
- [x] README quickstart uses only Docker/Compose, explains automatic migration/seed,
  URL boundaries, reset, verification commands and production rehearsal.

## Limits and repairs

Initial bootstrap evidence predates the first hosted GitHub Actions run. The workflow
was validated with actionlint and its underlying builds/checks ran locally at that point.
No AWS deployment, browser E2E suite, load test, sockets or gameplay is claimed.

## GitHub Docker smoke repair — 2026-11-07

First hosted run: https://github.com/noahstew/soc-party/actions/runs/42404917013.
Backend/frontend jobs passed; production smoke failed starting /app/migrate, and the
development matrix entry was cancelled by fail-fast. No external infrastructure was involved.

- Reproduced retained production source mounts using the runner's Compose 2.38.2;
  the same original files resolve without mounts on local Compose 5.3.1.
- Added scripts/check-prod-compose.py to reject development volumes/build targets;
  it fails on the original 2.38.2 merged configuration and passes after the service-level
  resets on both versions. CI runs it before production builds.
- Production smoke with Compose 2.38.2 in an isolated project passes migrations,
  seed, service health, health/packs HTTP responses and rendered pack title.
  Actual runtime users are 65532:65532/node and both application containers have no mounts.
- Development smoke with Compose 2.38.2 in a separate fresh project also passes
  migrations, seed, service health, health/packs responses and rendered pack title.
- `make check` and actionlint 1.7.12 pass. Both matrix modes remain enabled for
  pushes/PRs; fail-fast is disabled to preserve independent results.
- Hosted validation of this repair remains pending the next push.

The first startup failed because Docker storage was full. With explicit approval,
pruned build cache unused for over 30 days (9.372 GB reclaimed); repeated checks passed.
A noninteractive pnpm install initially failed: set CI=true and pin the container store
path to /pnpm/store. The final configuration passes clean-volume startup and checks.

The development stack is left running at http://localhost:3000, with backend at
http://localhost:8080. `.env` is local and ignored. Assumptions, dependency choices and
remaining tooling compatibility concern are recorded in DECISIONS.md and PLAN.md.

## Decisions before M1

1. Guest identity/reconnect policy: token storage, expiry/rotation, recovery and kick revocation.
2. Room policy: player cap, owner departure/transfer, disconnect grace and idle expiry.
3. Single-process durability: accept lost live rooms on restart, and define drain/restart behavior.

## 2026-11-07 — Requested neobrutalism frontend integration

- [x] `make fmt` and `make check` pass: lint, formatting, TypeScript, Go race tests,
  seven frontend tests (page success/failure/empty data and Button activation/disabled
  behavior), and sqlc drift checks.
- [x] `docker build --target build -t soc-party-frontend-ui-check ./frontend` passes
  with a frozen lockfile and optimized Next.js production compilation.
- [x] HTTP smoke against the running frontend returns 200 and renders the status
  section, imported cards/badges and Refresh status submit control.
- [x] Upstream MIT notice, exact dependency reasons, source attribution and commands
  for importing additional components are documented.

No schema/store changes; database integration checks were not required for this task.
No browser visual or end-to-end verification was performed.

## 2026-11-07 — Requested MVP database and backend

- Migration bootstrap created `wit_parade` without resetting existing dev data and
  applied platform rooms/membership and all game persistence tables.
- `make seed` loaded OG with five original prompts. `make integration` passed repeat
  migration/seed, generated query and DB constraint scenarios. Invalid duplicate votes,
  cross-matchup votes, duplicate answer slots, foreign participants and duplicate live
  games are rejected; test-only records roll back.
- Go race tests and golangci-lint pass for typed protocol validation, bounded actors,
  concurrent capacity, collisions, DB failure rollback, authorization, token rotation,
  kick revocation, grace/owner transfer and expiry policies.
- An httptest server with real WebSocket clients verifies create/join, distinct player
  projections, live roster broadcast, origin denial and kicked-socket closure/revocation.
- Gameplay rules and browser lobby acceptance are not claimed by the backend stage.

Backend stage: full `make check` and `make integration` passed after generation;
Go API compiled successfully. Frontend at this stage still shows the status page.

## 2026-11-07 — MVP frontend and M1 acceptance

- [x] Final `make check` passes: formatting, vet, golangci-lint (zero issues), ESLint,
  strict TypeScript, Go race tests, 14 frontend tests and both sqlc output drift checks.
- [x] `make integration` passes platform membership persistence/reset and game
  content/record query and constraint coverage against real PostgreSQL.
- [x] Production frontend compilation passes. All four updated production images
  build, including separate game migrations in the non-root backend image.
- [x] Development stack rebuild/start passes. `/healthz`, `/api/packs`, and rendered
  home page pass smoke checks, with OG and create/join controls visible.
- [x] Two real socket clients against the running development API/Postgres verify
  distinct identities, live rosters, reconnect rotation, old-token rejection, kick
  revocation and owner departure.
- [x] Fresh production-image startup in isolated `soc-party-mvp-prod` creates both
  databases, migrates/seeds, and serves healthy API/homepage with runtime public URL.
  The same socket smoke succeeds against that production API. No dev data was reset.
- [x] Installed headless Chrome 157, driven through CDP from the Docker toolchain,
  verifies two isolated browser contexts at 390px mobile width: create/join, both
  live rosters, guest permissions, refresh identity recovery with token rotation,
  owner capacity broadcast, kick returning the guest to admission, and leave.
  No page exceptions. Captured and visually inspected mobile lobby screenshot.
  This was an ad hoc acceptance harness in /private/tmp, not a committed E2E suite.
- [x] Isolated production rehearsal and browser process are stopped after checks;
  the development stack remains available at http://localhost:3000.

M1 acceptance is complete; current milestone is M2. The game schema includes sessions,
participants/scores, rounds, prompt snapshots/matchups, answer slots and votes. No
playable phases, answer/vote API, game start or scoring engine is claimed. No cloud
infrastructure or deployment. Updated hosted CI is pending a push; local checks passed.

## Zinger rename

`make check` and `make integration` pass. The new migration updates room game IDs
and defaults to `zinger`; integration verifies newly persisted room identity.
Physical game storage retains its legacy name and existing seed data.

## Dedicated health page

`make check` passes with all status/pack success, unavailable, empty and malformed
payload coverage moved to /health. Home tests verify diagnostic fetches/card are absent.
Live HTTP smoke passes for / and /health; CI smoke now checks both routes.

## General Soc Party home

`make check` passes. The home test verifies platform branding, game-neutral welcome
copy and admission controls; diagnostics remain on /health. No gameplay changes.

## Room game selection and final presentation acceptance

- `make check` passes: Go vet/lint/race tests, ESLint/format, TypeScript, 15 frontend
  tests and generated sqlc drift checks. `make integration` passes with selected
  game persistence. Frontend production build includes both / and /health.
- Protocol and actor tests cover typed selection, owner authorization, rejection of
  empty/unknown/legacy/unavailable IDs, persisted state and guest broadcasts.
- UI tests cover the owner's selection intent, the disabled Coming soon option,
  and the guest's disabled selector showing the same selected game.
- Two isolated mobile Chrome sessions verify general home create/join, Zinger game
  selector and guest permissions, disabled placeholder, live roster, refresh/token
  rotation, room size changes, kick/leave, and the dedicated /health route. No page
  exceptions. Mobile screenshot inspected; temporary browser closed after acceptance.
- Development stack remains running. Existing game data is preserved under the
  legacy physical database name. Gameplay remains unimplemented and unauthorized.

## 2026-11-08 — Custom dark/coral theme

- `make check` passes: lint/format/types, Go race tests, 15 frontend tests and sqlc drift.
- Browser acceptance passes in two isolated Chrome contexts: fixed dark root/native
  controls under emulated light and dark OS preferences, reduced-motion transitions,
  no mobile horizontal overflow, and existing create/join/reconnect/owner/health flows.
- Captured and visually inspected desktop home plus mobile home, lobby and health.
  Ad hoc browser harness/screenshots remain in /private/tmp; no new runtime dependencies.
- Calculated WCAG contrast for the chosen palette: body 16.24:1, muted text on surface
  7.72:1, primary button text 7.39:1, control border against surface 3.72:1, error text
  11:1. This is targeted color verification, not a full accessibility audit.
- No backend/schema behavior changes; database integration is not required for this theme.

Production frontend compilation passed for both / and /health. The temporary browser
was closed and the development frontend restarted after the production build check.

## 2026-11-08 — Global animated notifications

- `make check` passes: lint/format, TypeScript, Go race/unit tests, sqlc drift and
  26 frontend tests. Toast regressions cover all four events, three-second timeout,
  250ms exit cleanup, manual dismissal, hover/focus pause, repeated feedback and
  superseding a toast during its exit. Lobby coverage proves validation errors
  render in the global notification region outside the form/card.
- Temporary Chrome acceptance passes at 390px and 1280px: bottom-right placement,
  entry/exit animations, auto/manual dismissal, four distinct non-coral pastel
  accents, readable icon foreground, reduced-motion behavior, no horizontal overflow
  and no runtime exceptions. Screenshots/harness remain in /private/tmp;
  the temporary browser was closed after acceptance.
- No backend/schema changes or new dependencies; database integration is not required.

## 2026-11-08 — Two-step home admission

- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and
  28 frontend tests. Coverage includes initial card visibility, validation, focus
  movement, preserving fields while editing, shared codes, admission failures,
  successful create/join toasts and existing reconnect/owner controls.
- Temporary Chrome acceptance passes at 390px and 1280px: no horizontal overflow,
  both card faces, name/code focus, reduced-motion switching, real two-client
  create/join with success toasts, live roster, reload/token rotation, owner
  settings, kick/leave and /health. No runtime exceptions. Mobile screenshots
  inspected; harness/screenshots remain in /private/tmp and Chrome was closed.
- No schema/backend changes or new dependencies; database integration not required.

### Admission card feedback

- `make check` passes with 29 frontend tests, including active-face height changes
  in both directions, Back placement and preserving fields/focus on return.
- Chrome verifies compact initial height, expansion to the room face's measured
  height, collapse on Back, height transition configuration, reduced motion and
  existing two-client room behavior at mobile/desktop sizes. No runtime exceptions.
  Updated mobile screenshots inspected; the temporary browser was closed.

Back now uses the shared small Button with soft-white fill and charcoal text.
The name placeholder reads "What other players will see you as". `make check`
passes, including 29 frontend tests and existing Back navigation coverage.

Back presentation was revised to a muted chevron-and-label control above the
badge, with a transparent resting surface, subtle hover background and visible
keyboard focus. `make check` passes, including 29 frontend tests covering Back,
field preservation and card resizing.

## 2026-11-08 — Lobby route and automatic shared links

- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and 34
  frontend tests. Coverage includes automatic joins with remembered names,
  first-time Continue joining directly, matching-credential recovery, a different
  invitation overriding the saved room, malformed codes, expired invitations,
  canonical links/URLs, leaving home and preserving freshly typed names.
- Isolated production frontend build passes and lists `/`, `/lobby` and `/health`.
  Build output stayed in a temporary Docker volume; generated next-env references
  were restored to the running development configuration.
- Temporary Chrome acceptance passes: real owner creation at `/lobby`, legacy
  shared-link canonicalization, first-time name-only admission, another isolated
  browser joining automatically with a remembered name, live roster, reload/token
  rotation, owner settings, kick/leave and /health. Mobile/desktop layout checks and
  reduced motion pass; no runtime exceptions. Temporary Chrome was closed.
- No backend/schema changes or new dependencies; database integration not required.
