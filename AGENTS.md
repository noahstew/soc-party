# Agent instructions

## Scope
Browser multiplayer party games; each player uses their own device, rooms shared by
code/link, no host screen. First game: **Wit Parade** (working title). Original content only.
M0 and M1 are verified. The user authorized rooms/lobby plus MVP persistence models
and original OG seed, now complete. M2 gameplay implementation, accounts, ads and
infrastructure remain out of scope until explicitly authorized.

## Workflow
- Read the plan's current milestone and applicable `backend/AGENTS.md` or
  `frontend/AGENTS.md`. Unless directed otherwise, take its first unchecked task
  within the authorized scope; stop if none remain. Keep one focused task per diff.
- Read supporting docs only as needed: `docs/ARCHITECTURE.md` for boundaries,
  `docs/DECISIONS.md` for rationale/dependencies, `docs/DEPLOYMENT.md` for deployment,
  `docs/VERIFICATION.md` for acceptance evidence. Commands/setup: `README.md`, `Makefile`.
- Search with `rg`; read relevant sections rather than whole trees. Exclude generated
  output, lockfiles, dependencies and build artifacts from broad reads unless relevant.
- Add meaningful tests alongside behavior changes; fixes need regression coverage.
  Never weaken/delete tests to pass, silently add dependencies, or refactor unrelated code.
- Run `make check` (format/lint, types, race/unit tests, sqlc drift); also run
  `make integration` for schema/store changes. Report blocked checks honestly.
- Tick verified tasks; log discoveries in the plan's Backlog, non-trivial decisions
  and dependency reasons in Decisions. Keep docs accurate; leave no unlogged TODOs,
  secrets, generated junk, or unrelated changes. Never skip milestones.

## Shared invariants
- Separate platform services from game modules. Server owns state, scores, timers
  and phases; clients send intents and render per-player authorized projections.
  Never send secrets to unauthorized clients and rely on UI hiding.
- Each room has one goroutine/channel owning its state; only the registry is shared.
- Modules register by ID via a Go interface: deterministic state + event -> state +
  effects, injected clock/RNG, no I/O.
- Goose migrations define schema; SQL lives only in `backend/queries/{platform,game}/*.sql` and runs
  through committed sqlc output. Never hand-edit generated Go.
- Protocol authority: `backend/internal/protocol`, mirrored in
  `frontend/src/lib/protocol.ts`; `{type, id?, payload}`, snake_case types,
  camelCase payload fields. M1 message types must be mirrored.
- Validate input/size limits; WebSockets require origin checks; room codes use CSPRNG.
  Never commit secrets or inject user content with `dangerouslySetInnerHTML`.

## Commands
Docker only: copy `.env.example` to `.env` if absent, then `make up`.
Use `make fmt` to format and `make check` to verify. `make reset-db` destroys dev data.
