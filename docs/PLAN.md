# Plan

## How to use this file
One focused task per diff; the requested MVP foundation spans four ordered commits. Follow milestone order; tick only verified work. Put discoveries in
Backlog, ideas in Parking lot. Refine later milestones when reached. Never begin M1 as part
of the bootstrap. Completion evidence lives in docs/VERIFICATION.md.

## Current milestone: M2

M0 and M1 are verified. User authorized M1 and MVP persistence design on 2026-11-07.
The requested four-stage foundation is implemented and verified. M2 gameplay is next;
its schema is prepared but rules are not implemented or authorized by this request.

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

### M2, Zinger engine and UI [status: not started]

**Goal:** Play an original answer-and-vote game end to end.

**In scope:** Pure phases, scoring, projections and disconnect behavior with temporary original in-memory prompts.

**Out of scope:** DB pack selection (M3), account features, ads.

**Tasks:**

- [ ] Refine module contract and implement deterministic initialization and answer assignment
- [ ] Implement answer intents, validation, deadlines and transition with fake clock/RNG
- [ ] Implement head-to-head voting, eligibility, hidden identity and deadline handling
- [ ] Implement deterministic scoring, ties, round results and final results
- [ ] Add per-player projections with tests proving private answers/votes never leak
- [ ] Wire module effects into room actor and render answer/vote/results player screens
- [ ] Handle missing answers, disconnects, reconnects and insufficient-player termination

**Tests required:** Pure table tests for phases/deadlines/scoring/ties; seeded replay; invalid/duplicate intents; privacy projections; disconnect boundaries; UI render/action tests; multi-client round integration.

**Done when:** Multiple devices complete a deterministic session with private answers, valid voting and server-owned scores; reconnect and timeout paths are tested.

### M3, Official pack in the DB [status: not started]

**Goal:** Use curated stored prompts during games.

**In scope:** Extend existing M0 schema/queries, pack selection and versioned JSON seed.

**Out of scope:** User submissions and accounts.

**Tasks:**

- [ ] Refine content query/selection rules and seed validation
- [ ] Add room pack settings and deterministic prompt sampling
- [ ] Add pack selection UI and integration coverage

**Tests required:** Migration/seed idempotency, sqlc drift, selection bounds and missing pack behavior.

**Done when:** A room selects a published official pack and plays prompts loaded through sqlc.

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
- [ ] Make the home page a general Soc Party entry point.
- [ ] Add room game selection with Zinger and a disabled coming-soon option.

One commit per task; gameplay remains outside this request.
