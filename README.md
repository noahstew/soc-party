# Soc Party

Foundation for a multiplayer party-game website. Every player uses their own browser;
there is no host screen. The first planned game is **Zinger** (working title).
Implemented: room create/join/reconnect API and WebSocket lobby service, health/packs
API, separate platform/game databases, generated models and original OG seed.
Gameplay, accounts and ads remain planned.

## Quickstart — Docker only

Install Docker Desktop (or Docker Engine + Compose **2.24.4+**). Clone your copy of this
repository, then from its root:

```sh
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000. The home page lets you create/join a room and shows live players.
API/DB status and **OG** pack diagnostics are at http://localhost:3000/health.
Backend: http://localhost:8080/healthz and http://localhost:8080/api/packs.
First build downloads pinned tools/dependencies and can take several minutes.
Postgres becomes healthy, one-shot migrate and seed succeed, then the backend and frontend start.
The seed is idempotent. Source bind mounts + Air/Next dev provide hot reload.

```sh
docker compose down               # preserve database
docker compose down -v            # delete ALL local stack volumes/data
docker compose up --build         # verify a fresh database again
```

`.env.example` credentials are disposable local examples. Never commit `.env`.
Postgres is reachable by services at `db:5432`; it has no published host port.
`API_INTERNAL_URL=http://backend:8080` is used by the Next server. Browsers cannot resolve
`backend` or `db`; browser API URLs use `http://localhost:8080` and WebSockets
use `ws://localhost:8080`. `ALLOWED_ORIGINS` lists exact browser origins.

## Commands

GNU/POSIX make is optional convenience; all targets run tools inside Docker. Run `make build`
first after a clean checkout if using checks before `up`.

| Command | Purpose |
| --- | --- |
| `make up`, `make down`, `make logs` | Start detached, stop, follow logs |
| `make test` | Go race tests and frontend unit tests |
| `make integration` | Apply migrations in development/CI Postgres and exercise queries/seed |
| `make lint`, `make typecheck` | Go vet/golangci/gofmt, ESLint/Prettier, TypeScript |
| `make fmt` | Format source |
| `make sqlc`, `make sqlc-check` | Regenerate committed store; reject drift/untracked output |
| `make migrate`, `make seed` | Apply migrations and idempotent starter data |
| `make psql` | Open database shell |
| `make reset-db` | Destroy development volumes and recreate stack |
| `make check` | Formatting/lint + typecheck + unit tests + sqlc drift |

Run the production frontend compile with `docker compose run --rm --no-deps frontend pnpm build`.
CI also runs integration tests, frontend build, and Docker smoke. See
[verification evidence](docs/VERIFICATION.md) for actual bootstrap results.
Every push (including to main) and pull request runs these checks. Both smoke modes
start disposable stacks on the GitHub runner; `prod` means production images, not a
deployment. No cloud infrastructure or deployment secrets are required.

## Prod-like local rehearsal

Set `POSTGRES_PASSWORD` in `.env` (change it on an existing DB via SQL or recreate the dev volume).
Stop the dev stack before reusing its ports. This configuration has no hot reload/source mounts;
it runs the Go binaries and Next standalone as non-root users:

```sh
docker compose down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

This is a local rehearsal, not an AWS deployment. No IaC exists. See [deployment plan](docs/DEPLOYMENT.md).

## Contributing

Read [AGENTS.md](AGENTS.md), [plan](docs/PLAN.md), [architecture](docs/ARCHITECTURE.md),
and [decisions](docs/DECISIONS.md). Work one task at a time. M1 is authorized by the user;
gameplay remains a later milestone. SQL lives in queries/; migrations are the schema authority;
commit generated store changes. Do not begin gameplay as part of this bootstrap.

## Databases and lobby API

`DATABASE_URL` identifies the platform database (default `party`). Startup migration
creates `wit_parade` on the same PostgreSQL instance and migrates it separately.
This legacy database name stores Zinger content; the game ID is `zinger`.
The migration role needs CREATEDB to provision it. Existing platform content is
preserved for data retention; new content and `/api/packs` use the game database.
`make seed` idempotently loads **OG** with five original comedy prompts.

With an allowed `Origin` header, POST `/api/rooms` with `{ "name": "Alex" }`,
POST `/api/rooms/{code}/join` with a name, or POST `/api/rooms/{code}/reconnect`
with `{ "token": "…" }`. Replies contain a private token and public lobby projection.
Connect `/api/rooms/{code}/ws`, send a `session_auth` envelope with that token as
its first payload, then receive `lobby_state` projections. Tokens never enter URLs.
Go protocol is authoritative; TypeScript mirrors it. Owner intents: `kick_player`,
`update_settings` and `select_game`; all members may `ping` or `leave_room`. No start-game intent yet.

Guest tokens rotate on reconnect. Grace: 60 seconds; hard room lifetime: two hours.
Owner transfers on departure; rooms need three connected players to be eligible.
All live rooms close on backend restart. Database records are audit records, not
restart recovery. Run exactly one backend process. Game record models are prepared
for the future engine; there is no public answer/vote/history CRUD API.

## Try the lobby

Open http://localhost:3000, enter a name and choose **Create a room**. In another
browser/tab, use a different name and the six-character room code, or open the
shared link. Both players appear live. The owner can select **Zinger**, change capacity or remove
players; everyone can see the selected game. **Coming soon** is disabled until another
game is available. Anyone can leave. Refreshing within the reconnect grace restores identity.
The page shows readiness at three connected players; game rounds are not built yet.

For phones on your LAN, set `API_PUBLIC_URL=http://YOUR_LAN_IP:8080` and
`ALLOWED_ORIGINS=http://YOUR_LAN_IP:3000`, then rerun `make up`. Open
`http://YOUR_LAN_IP:3000` on each phone. Match these URLs to your configured ports;
use HTTPS/WSS for any shared deployment. `API_INTERNAL_URL` remains Docker-only.
Room credentials live in sessionStorage per tab. Joining a fresh tab creates a new
player; duplicating a tab may copy its credential and replace the original socket.
