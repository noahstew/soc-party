# Soc Party — Phase 0

Foundation for a multiplayer party-game website. Every player uses their own browser;
there is no host screen. The first planned game is **Wit Parade** (working title).
Currently implemented: health/status page, published official pack API, migrations and original seed.
No game, room, socket, account, or ad behavior is implemented.

## Quickstart — Docker only

Install Docker Desktop (or Docker Engine + Compose **2.24.4+**). Clone your copy of this
repository, then from its root:

```sh
cp .env.example .env
docker compose up --build
```

Open http://localhost:3000. The page shows API/DB health and **Small Talk, Big Nonsense**.
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
`backend` or `db`; browser API URLs use `http://localhost:8080` and future WebSockets will
use `ws://localhost:8080`. There are no WebSockets in M0. No public API env variable is needed.

## Commands

GNU/POSIX make is optional convenience; all targets run tools inside Docker. Run `make build`
first after a clean checkout if using checks before `up`.

| Command | Purpose |
| --- | --- |
| `make up`, `make down`, `make logs` | Start detached, stop, follow logs |
| `make test` | Go race tests and frontend unit tests |
| `make integration` | Migrate isolated test schema in real Postgres and exercise queries/seed |
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
and [decisions](docs/DECISIONS.md). Work one task at a time. Phase 0 stops after verification;
M1 is a separate session. SQL lives in queries/; migrations are the schema authority;
commit generated store changes. Do not begin gameplay as part of this bootstrap.
