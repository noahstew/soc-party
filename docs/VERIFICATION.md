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

## 2026-11-09 — Lobby copy URL

- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and 37
  frontend tests. Added coverage for the disabled URL, copying the canonical link,
  success feedback, clipboard denial and unavailable clipboard APIs.
- The first check encountered transient missing Next dev types during container
  startup; the subsequent full check passes after startup and an async test fix.
- No schema changes or new dependencies.

## 2026-11-09 — PartiSocial branding

- Frontend badge, page title, health-page navigation and package name use PartiSocial.
  Root/frontend agent guidance records the planned `parti.social` domain and preserves
  legacy browser storage keys for existing names and room recovery.
- `make check` passes, including 37 frontend tests with home branding and health
  navigation assertions, Go race/unit tests, lint/format/types and sqlc drift.
- Backend/repository naming and domain/hosting configuration are unchanged.

## 2026-11-09 — Responsive lobby rebuild

- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and 41
  frontend tests. Regression coverage includes clipboard success/failure, game
  tiles/settings intents, owner removal, guest permissions/crown, connected count,
  mobile default/keyboard tabs, desktop media-query changes, reconnect and leave.
- Isolated headless Chrome acceptance passes against the running local Docker app:
  real UI admission, eight authenticated connected players, scrollable roster,
  desktop players alongside both settings tabs, mobile Lobby/Room/Game visibility,
  OG included state, owner removal and no horizontal overflow at 320/375/390/768/
  1024/1280px. No runtime exceptions. Desktop/mobile screenshots were inspected;
  the temporary browser was closed and artifacts remain in `/private/tmp`.
- OG stays fixed; other game/pack tiles are disabled. Shared pack toggling needs
  later server support. No schema/backend changes or added dependencies; database
  integration is not required.

## 2026-11-09 — Lobby simplification and join notifications

- Final `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and
  45 frontend tests. Coverage includes owner/guest arrival info toasts, duplicate
  suppression on repeated snapshots and reconnect, grouped arrivals, concise UI,
  one Coming Soon tile per tab, custom-select settings intents, disabled sizes,
  guest permissions, Escape/focus restoration and existing admission regressions.
- Chrome verified info notifications across three real clients and room-size
  selection propagating to all clients. The automated browser run did not finish:
  its popup DOM-removal assertion timed out despite the trigger reporting closed
  and the new size reaching all clients. No source changes followed the passing
  checks. The user independently verified the frontend and accepted it for commit.
- No backend/schema changes or new dependencies; database integration not required.

## 2026-11-09 — Soft-white, coral and pastel-blue theme

- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift and all
  45 frontend tests. No behavior, schema or dependency changes.
- Palette contrast calculations pass: main/muted/coral text is at least 4.62:1
  across page/card/input/secondary surfaces, primary-button text is 5.64:1,
  toast labels exceed 6.8:1, and focus rings exceed 3:1 on all tested surfaces
  including coral. These checks cover enabled palette pairings, not disabled opacity.
- Isolated Chrome verifies the light palette even with a dark OS preference,
  matching viewport metadata, soft-white cards, coral primary and pastel-blue
  secondary actions, error-label ink, desktop/mobile admission and lobby, and
  no horizontal overflow. Mobile home and desktop lobby screenshots inspected;
  temporary browser closed. Screenshots remain in `/private/tmp`.
- Components documentation describes the light palette and accent-ink tokens.
  No database changes; integration testing is not required.

## 2026-11-09 — Lobby card entrance

- The lobby card animates from above the viewport on mount over 550ms; the badge
  stays stationary, regular room updates retain the same card, and reduced-motion
  preferences disable the animation.
- `make check` passes with 45 frontend tests, lint/format/types, Go race/unit tests
  and sqlc drift. No behavior, dependency or schema changes.

## 2026-11-09 — Shared OG pack toggles and start eligibility

- `make check` passes with 47 frontend tests, lint/format/types, Go race/unit tests
  and sqlc drift against the intentionally regenerated store. `make integration`
  passes after applying additive migration 00004; selection defaults and both toggle
  states persist through the generated queries.
- Regression coverage verifies guest/malformed/unavailable-pack rejection,
  persistence failure rollback, selected/empty broadcasts, reconnect retention,
  reselecting Zinger preserving an empty pack choice, and three-player eligibility
  being removed/restored by pack toggles. Fewer than three connected players remain
  ineligible even with OG selected. Frontend tests cover authoritative toggle
  intents/updates, green indicators, guest restrictions and disconnected controls.
- Three-client Chrome acceptance verifies shared OG checks, owner-only toggles,
  server `canStart` true with three players/OG and false without OG, selection
  surviving reload, and mobile layout without overflow. Selected desktop/mobile
  screenshots inspected. The same run verifies the card starts above the viewport,
  retains its animation across tab/state updates, and disables it for reduced
  motion. Temporary browser closed; artifacts remain in `/private/tmp`.
- Gameplay start remains unimplemented (M2); this change guards server-owned start
  eligibility and does not implement DB prompt retrieval/sampling (M3).

## 2026-11-09 — Extended Zinger seed pack

- Added the official published Extended pack (`extended`) with three original
  approved prompts. The standard seed command now loads OG (five prompts) and
  Extended (three prompts), each in its existing per-pack transaction.
- `make seed` successfully applied both packs to the development game database.
  `make check` passes, including 47 frontend tests and the Extended metadata/
  originality regression. `make integration` passes: repeated seeding preserves
  pack counts, prompt IDs, exact text/order, approval visibility and OG contents.
- No schema/query/dependency changes. This request seeds content only; the current
  lobby selection remains OG and does not add Extended selection/gameplay logic.

## 2026-11-09 — Catalog-driven scrolling lobby choices

- Extended seed committed separately as `8e35820`. Lobby catalogs now load published
  Zinger packs from game sqlc queries, including OG and Extended. Selected pack
  arrays replace the prior flag, with migration 00005 preserving checked/unchecked
  state. Registered game IDs no longer require a schema/frontend edit.
- `make check` passes: lint/format/types, Go race/unit tests, sqlc drift against
  intentionally regenerated output and 60 frontend tests. `make integration`
  passes with persisted multiple packs, empty selection and registered game IDs.
- Actor tests cover multi-pack idempotency, rollback of slice mutations on failed
  persistence, source errors, refresh/removal of unavailable packs, game-switch
  selection clearing and stale/cross-game intent rejection. Catalog validation
  handles 100 games with 100 packs each; frontend tests exercise 60 games/90 packs
  and reject malformed catalog/selection projections.
- Three real Chrome clients verify Extended appears, OG/Extended toggle
  independently, multiple selections are shared, guests cannot change them,
  Extended-only selection remains eligible with three players, empty selection
  becomes ineligible and selections survive reload.
- Browser-local synthetic catalogs verify 100-game/90-pack grids scroll by
  keyboard, reach the final choices and emit the right intents. Coming Soon is
  exactly one disabled final button inside each grid, matching peer dimensions.
  Desktop/mobile screenshots inspected and no horizontal overflow at 320/390/
  768/1280px. Synthetic entries were never added to application data; temporary
  browser closed and screenshots remain in `/private/tmp`.
- No new dependencies or gameplay rules; prompt sampling/start phases remain
  later milestones. Lobby catalog changes are left uncommitted for review.

## 2026-11-10 — Toast message titles

- Notifications show the actual message as their title without generic severity
  labels or icons. Existing event colours, live-region urgency, replacement,
  timeout, hover/focus pause and dismiss controls remain intact.
- `make fmt` and `make check` pass, including lint/format/types, Go race/unit
  tests, sqlc drift and 60 frontend tests. Toast regressions cover message titles,
  absence of generic labels/icons and preserved event styling for all four types.

## 2026-11-10 — M2 specification and seed prerequisite

`make check` passed (Go lint/vet/race tests, frontend lint/format/types, 60 frontend
tests and sqlc drift). First run exposed stale fixture tests after the user's
official-to-OG merge; repaired fixture paths/count expectations and normalized
uniqueness checks without changing seed content. OG contains 29 prompts.
M2 task 1 specifies the authorized rules; engine/protocol/UI remain pending.

M2 task 2: make check passed, including seeded initialization, normalized prompt
deduplication, clone isolation and assignment invariants for N=3..8.

M2 task 3: make check passed. Regression tests cover draft edit after reconnect,
deadline promotion, connected-only early completion, Unicode validation, sanitation,
answer locking, foreign prompts and rejection without mutating prior state.

M2 task 4: make check passed. Tests verify 100/150-point votes, scaled unanimous
bonuses, ties/missing-voter bonus exclusion, author rejection, vote locking, and
one/both-empty forfeits preserving both answer slots.

M2 task 5: make check passed. A two-round test verifies all matchups, intro/reveal/
scoreboard deadlines, cumulative scores, round deltas and transition to final intro.

M2 task 6: `make check` passed. Tests cover final vote validation/resubmission,
the five-second all-done inactivity window and reconnect cancellation, zero-eligible
automatic completion, the absolute deadline, 200-point picks without a bonus,
insufficient-player grace, and deterministic full-game simulations for N=3..8.

M2 task 7: `make check` passed. Per-player projection tests assert that answering
shows only the requesting player's drafts, head-to-head and final voting omit author
and vote metadata, authors are ineligible, and reveal views include attributed scores.

M2 task 8: `make check` passed with 66 frontend tests. Strict Go decoding now covers
all game intents, rejects oversized/duplicate/malformed payloads, mirrors game-state
types and validation in TypeScript, and documents envelopes, privacy and stable codes.
