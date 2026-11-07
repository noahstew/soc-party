# Phase 0 verification

Verified 2026-11-07 on macOS/Apple Silicon with Docker Desktop. M0 is complete;
current milestone is M1, which has **not** been started. Six focused local commits
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
