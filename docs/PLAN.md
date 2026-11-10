# Plan

## How to use this file
One focused task per diff; the requested MVP foundation spans four ordered commits. Follow milestone order; tick only verified work. Put discoveries in
Backlog, ideas in Parking lot. Refine later milestones when reached. Never begin M1 as part
of the bootstrap. Completion evidence lives in docs/VERIFICATION.md.

## Current milestone: M2

M0 and M1 are verified. User authorized M1 and MVP persistence design on 2026-11-07.
The requested four-stage foundation is implemented and verified. M2 gameplay and selected-pack retrieval are authorized on 2026-11-10.
Implement the ordered tasks below with one focused commit and green checks per task.

## Milestones

### M0, Bootstrap [status: done]

**Goal:** Prove the development and verification wiring.

**In scope:** Docs, container scaffold, schema/sqlc/seed, health/packs page, tests and CI.

**Out of scope:** All game/platform features and infrastructure.

**Tasks:**

- [x] Write agent instructions and planning docs
- [x] Scaffold containers, Make commands, CI and PR template
- [x] Generate store from goose schema and add idempotent original seed
- [x] Build health/packs API and status page
- [x] Add unit/integration tests and static checks
- [x] Run all acceptance checks and record real results

**Tests required:** Go config/handler table tests, database migrations/queries/seed integration, page success/error tests, Docker smoke and prod-like non-root checks.

**Done when:** All acceptance checks in docs/VERIFICATION.md pass, docs match files, then set current milestone to M1.

### M1, Rooms and lobby [status: done]

**Goal:** Create, join and manage a room from individual browsers.

**In scope:** Room lifecycle, WebSocket envelope, lobby, owner controls, reconnect and expiry.

**Out of scope:** Game phases, scoring, accounts, ads.

**Tasks:**

- [x] Define typed Go protocol envelope and mirrored TS types; validate size/type/origin limits
- [x] Implement CSPRNG codes and room registry with one actor/channel per room
- [x] Add create/join HTTP intents and minimal mobile lobby with one socket per tab
- [x] Add owner settings, start eligibility and kick with explicit authorization
- [x] Add reconnect token issuance, rotation/expiry and identity recovery policy
- [x] Add disconnect grace, room expiry and bounded connection cleanup

**Tests required:** Protocol decoding/invalid input; room-code collision; race-tested actors; unauthorized controls/kick; per-player lobby projections; reconnect abuse/expiry; fake-clock cleanup; browser lobby integration.

**Done when:** Two independent browsers create/join, owner can kick, valid reconnect restores identity, expired rooms disappear, race and check suites pass.

### M2, Zinger engine and UI [status: in progress]

**Goal:** Play the three-round original answer-and-vote game specified in docs/games/zinger.md.

**In scope:** Pure engine, selected-pack retrieval through sqlc, protocol, room lifecycle,
mobile player views, privacy and full-game verification. No game/result persistence.

**Out of scope:** Accounts, ads, sound, user content, spectators and infrastructure.

**Ordered tasks (one focused commit each):**

- [x] 1. Specify rules, tunables, state machine, architecture and ordered plan
- [x] 2. Engine config/types, initialization, prompt selection and matchup assignment
- [x] 3. Answer submission/drafts, deadlines, early completion and promotion
- [x] 4. Head-to-head votes, reveals, scoring and forfeits
- [x] 5. Two-round loop, multipliers and round scoreboards
- [x] 6. Final round, idle close, zero-eligible voters and game over
- [x] 7. Per-player projections and explicit privacy tests
- [x] 8. Validated Go protocol, TS mirror and docs/PROTOCOL.md
- [x] 9. Room/module registration, provider, single game timer, reconnect/leave,
  owner return to lobby and full-game WebSocket bot test
- [ ] 10. Frontend snapshot handling, countdown, container and answering views
- [ ] 11. Frontend head-to-head voting/reveal and round scoreboard
- [ ] 12. Frontend final voting/reveal, podium and return to lobby
- [ ] 13. Hardening, final checks/integration, clean-stack smoke and accurate docs

Tests ship with each behavior task: deterministic seeded/fake-time rules, N=3..8
assignment/simulation, scoring, forfeits, invalid intents, disconnects, privacy,
protocol, fixture-based accessible UI and a short-timer multi-client full game.

**Done when:** make check and integration pass, disposable clean-stack build works,
full three-round gameplay and forfeits are verified, no repeats/leaks, docs match code.
Record actual verification in docs/VERIFICATION.md; then advance the milestone.

### M3, Official pack in the DB [status: incorporated into M2]

The 2026-11-10 request moves selected-pack prompt loading and deterministic sampling
into M2. Catalog, selections and seed already exist. M2 tasks 2 and 9 deliver the
remaining runtime retrieval/sampling with sqlc and integration coverage; do not mark
M3 complete before those checks pass. No separate in-memory prompt implementation.

### M4, Accounts [status: not started]

**Goal:** Optional registered identities with guest play intact.

**In scope:** Registration/login, secure account sessions, guest upgrade.

**Out of scope:** Social login, payments.

**Tasks:**

- [ ] Decide password/session security policy and threat model
- [ ] Add users/sessions migrations and generated queries
- [ ] Implement account endpoints and UI with guest regression coverage

**Tests required:** Password/session expiry, CSRF/origin defenses, rate limits, guest compatibility.

**Done when:** Users register/login/logout securely; guests can still play without an account.

### M5, User-submitted prompts [status: not started]

**Goal:** Support moderated original community content.

**In scope:** Submission, moderation status, reports and restricted moderation queue.

**Out of scope:** Unmoderated public publishing.

**Tasks:**

- [ ] Refine ownership/moderation schema and policies
- [ ] Build submission/report API and UI
- [ ] Build authorized moderation queue and audit coverage

**Tests required:** Authorization, publication filtering, abuse limits and status transitions.

**Done when:** Approved content is playable; unapproved content stays private; reports reach moderators.

### M6, AdGate [status: not started]

**Goal:** Gate eligible admission behind an interchangeable provider.

**In scope:** Mock then real provider, consent, failure policy.

**Out of scope:** Ads during rounds.

**Tasks:**

- [ ] Define provider/consent and regional behavior
- [ ] Integrate mock admission with join and reconnect
- [ ] Select real provider and add verified completion integration

**Tests required:** Consent declined, provider failure, forged completion, reconnect and no mid-round interruption.

**Done when:** Admission honors consent/provider policy without interrupting active rounds.

### M7, Second game [status: not started]

**Goal:** Validate reusable platform boundaries.

**In scope:** Original Imposter-style module; targeted platform fixes.

**Out of scope:** Large unrelated refactors.

**Tasks:**

- [ ] Refine original rules and privacy model
- [ ] Implement deterministic module and per-player UI
- [ ] Remove demonstrated platform leaks with regression tests

**Tests required:** Role secrecy, deterministic rounds, disconnects and both-game platform regressions.

**Done when:** Both games use the same room/connection machinery without game-specific platform branches.

### M8, AWS deployment [status: not started]

**Goal:** Operate and measure the platform on AWS.

**In scope:** IaC, CI/CD, observability, load testing and multi-process design.

**Out of scope:** Premature implementation before prior milestones.

**Tasks:**

- [ ] Choose topology, room routing and recovery policy
- [ ] Add reviewed AWS IaC and staged CI/CD
- [ ] Add dashboards, alerts, backups and restore drills
- [ ] Load test and implement measured scaling needs

**Tests required:** Deploy/rollback, migration compatibility, drain/reconnect, load, backup restore and routing failure.

**Done when:** Staging/production deploy repeatably with measured capacity, monitoring and documented recovery.

### M9, Polish [status: not started]

**Goal:** Improve player experience and accessibility.

**In scope:** Sound, animation, accessibility and Playwright E2E.

**Out of scope:** New game scope.

**Tasks:**

- [ ] Audit mobile/keyboard/screen-reader experience
- [ ] Add optional sound/motion with preference controls
- [ ] Add critical multi-browser E2E flows

**Tests required:** Accessibility, reduced motion, audio controls, responsive layout and multi-client E2E.

**Done when:** Core flows are accessible and E2E-tested with documented browser support.

## Backlog

- [x] Repair seed regressions after the official-to-OG fixture merge: validate
  the current 29-prompt OG, full-game capacity and normalized cross-pack uniqueness.

- Multi-browser E2E for the full three-round game (M9; no Playwright dependency in M2).

- Room audit last_seen_at currently reflects the latest persisted room snapshot;
  pass each member's injected Seen timestamp through SQL before using it for analytics.

- Upgrade ESLint/TypeScript when Next lint plugin peer ranges support current majors.

## Requested frontend foundation work

- [x] Import neobrutalism.dev theme and starter components, apply to the status page,
  document dependencies/extension, and verify with `make check` and frontend build.

## Requested agent instruction maintenance

- [x] Reduce repeated agent context, preserve engineering safeguards, clarify the M1
  authorization boundary, and verify with `make check`.

## Requested CI repair

- [x] Fix production mount resets on the GitHub runner's Compose version; verify
  configuration regression, dev/prod smoke and `make check` without deployment.

## Parking lot (ideas explicitly not scheduled)

- Spectators, localization, tournament modes, custom art, social login.

## Requested MVP foundation

- [x] Add platform rooms/membership and a second `wit_parade` database with MVP game models.
- [x] Seed OG with five original prompts, verifying idempotency.
- [x] Generate both sqlc stores and build/test the Go API and authenticated room sockets.
- [x] Build/test a home page for creating/joining rooms and seeing live members.

Four ordered local commits; no gameplay rules, accounts, ads or deployment added.
Schema preparation does not complete or skip M2/M3 behavior and acceptance.

## Requested platform presentation updates

- [x] Rename the first game to Zinger, preserving existing content.
- [x] Move home status card to /health.
- [x] Make the home page a general Soc Party entry point.
- [x] Add room game selection with Zinger and a disabled coming-soon option.

One commit per task; gameplay remains outside this request.

## Requested custom theme

- [x] Apply and verify a fixed dark neobrutalist theme with coral primary accents
  across home, lobby, health, form controls and error/focus/disabled states.

## Requested global notifications

- [x] Replace lobby action/validation alerts with a shared bottom-right animated toast for error,
  info, warning and success; auto-dismiss with distinct pastel accents, document the agent default,
  and verify with regression coverage and `make check`.

- [x] Use the notification message as the toast title, remove generic severity
  labels/icons and indicate event type visually through colour only; preserve
  announcements, timing and dismissal, and verify with `make check`.

## Requested home admission card

- [x] Replace the home introduction with a modular branded player-name card,
  animated Continue arrow and flip to room connection/creation; preserve shared
  links/recovery, add admission success toasts and verify with regression tests,
  `make check` and mobile/desktop browser acceptance. Gameplay remains out of scope.

- [x] Refine the admission card with a tilted badge, Back above Room Code and
  animated natural-height sizing; verify both directions with regression tests,
  `make check` and mobile/desktop Chrome acceptance.

- [x] Style Back as a small soft-white button with charcoal text and clarify the
  player-name placeholder; verify with `make check` (29 frontend tests).

- [x] Replace the filled Back button with subtle chevron navigation at the top
  of the room face; verify with `make check` and existing navigation regressions.

## Requested lobby route and shared links

- [x] Serve active rooms at `/lobby`, generate canonical room links and bypass
  room-code admission for invitations. Remember a valid player name for automatic
  joins; ask first-time players for their name, then join directly. Preserve
  matching-room recovery and honor new invitations over a different saved room.
  Verify errors, malformed links, identity/socket behavior, production routes,
  `make check` and real multi-browser admission; commit work in focused groups.

## Requested lobby link controls

- [x] Disable the invitation URL input and add a trailing Copy URL button with
  global success/error feedback; verify clipboard regression tests and `make check`.

## Requested frontend branding

- [x] Rename frontend branding and package to PartiSocial, document planned domain
  `parti.social` and compatibility guidance for future agents, and verify `make check`.

## Requested lobby rebuild

- [x] Move the shared badge above a desktop lobby card with players on the left
  and Room/Game settings on the right; use Lobby/Room/Game tabs on mobile.
  Pin the local player above a scrollable roster, show the owner crown and
  connected count, add circular removal controls, code/link copying, room size,
  game/pack tiles and persistent leave/reconnect controls. Verify regression
  coverage, `make check` and responsive Chrome acceptance.

OG is the only available pack; coming-soon tiles are disabled. The later pack-control
request authorizes toggling OG and gating readiness, without prompt retrieval,
sampling, gameplay, accounts or infrastructure.

## Requested lobby simplification

- [x] Remove the lobby header, Live/Connected and redundant text, the repeated
  room code and extra Coming Soon tiles. Keep the footer controls on the right,
  use an SVG copy icon and the shared Base UI Select, and announce joins with
  info toasts for existing members and new arrivals. Verify all checks/tests
  together after implementation, including notification deduplication and
  custom-select interactions/permissions. User verified and accepted the frontend.

## Requested soft-white theme

- [x] Replace the dark palette with soft-white surfaces, coral primary and pastel
  blue secondary actions. Update viewport/native control colors, readable accent
  text and toast styling; verify contrast and run `make check`.

## Requested lobby entrance and pack controls

- [x] Slide the lobby card in from the top on mount, respecting reduced motion;
  verify and commit separately before implementing pack controls.
- [x] Allow owner pack toggles, mark selected pack tiles with a green circle check,
  and require at least one selected pack for server-owned start eligibility.
  Gameplay remains outside this request.

The 2026-11-09 pack-control request authorizes a persisted OG selection flag and
owner intent, mirrored projections, selected indicators and eligibility guard.
This does not complete M3 content sampling or authorize M2 gameplay/start phases.

## Requested Extended seed pack

- [x] Add the official Zinger Extended pack with three original prompts, include it
  alongside OG in `make seed`, verify contents and repeated-seed idempotency, and
  apply the seed to the development database. Room selection/gameplay stays outside
  this seed-only request.

## Requested scalable lobby catalog

- [x] Commit the Extended seed, load published Zinger packs into lobby projections,
  support registered game catalogs and persistent multiple-pack selections, and
  render game/pack buttons in bounded scroll grids with one disabled Coming Soon
  button as the final grid tile in each. Verify authorization, validation, catalog refresh, readiness,
  persistence, large catalogs and responsive/keyboard scrolling.

This request authorizes catalog/selection plumbing only; actual game engines,
DB prompt sampling and gameplay phases remain outside scope. Catalog entries are
included in room projections; pagination/virtualized rendering can be introduced
if production catalogs exceed practical snapshot/rendering sizes.
