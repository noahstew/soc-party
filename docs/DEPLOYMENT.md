# Deployment plan (not implemented)

All services below are **planned**. No infrastructure code exists in Phase 0.
Candidate AWS layout: ECR stores images; ECS Fargate runs frontend/backend tasks;
RDS PostgreSQL stores durable content/accounts; ALB routes HTTP and upgrades WebSockets;
CloudFront serves cacheable frontend assets; Secrets Manager supplies credentials;
CloudWatch collects structured logs, metrics and alarms.

Use separate development, staging, production databases/secrets; apply migrations as a
one-shot release task before rolling out compatible code. Backups and restore drills,
TLS, restricted security groups and health checks are required for M4; managed infrastructure is deferred to M9.

ALB supports WebSockets. Choose idle timeout longer than heartbeat interval; graceful
shutdown must drain connections before task termination. Never cache personalized state.
For v1, rooms live in one Go process. Losing that process loses live rooms; deployments
need draining/maintenance behavior. Multiple replicas require room-to-process routing,
connection affinity, registry coordination, and a policy for failover/recovery. Redis alone
does not preserve actor state. Resolve routing and lifecycle before horizontal scaling.

The prod-like Compose override tests non-root runtime images locally; it is not a production
security or deployment configuration. Database credentials and TLS need environment-specific
configuration. See README for exact rehearsal commands.

## Ad-free playtest release (2026-11-14)

M4 is now the first deployment milestone. The existing game is the MVP feature
scope; accounts, ads, community prompts and a second game are deferred. This
section supersedes the original requirement to wait for the later AWS milestone for deployment.

### Initial topology and lifecycle

Prepare one Docker host running a TLS reverse proxy, the production Next frontend,
exactly one production Go backend and PostgreSQL on a private container network.
Only the proxy publishes public application ports (80/443); neither PostgreSQL nor
the frontend/backend ports should be publicly reachable. Use one browser origin
for the frontend and proxied API/WebSocket paths, with an exact ALLOWED_ORIGINS
value and HTTPS API_PUBLIC_URL. API_INTERNAL_URL remains Docker-internal.
Verify the frontend routes and WebSocket upgrade through the actual proxy.

Keep persistent database and TLS certificate volumes. Production credentials must
be supplied separately from the disposable development .env, never committed.
Use an explicit deployment configuration rather than treating the existing
prod-like override as safe for public exposure. No hosting provider, instance,
budget, DNS change or cloud resource has been selected or created by this decision.

Live rooms remain in one Go process. Restarts, host failure and deployments end
active games; audit rows cannot recover them. Schedule releases outside test
sessions, notify testers before maintenance and ask them to create new rooms
afterward. Do not claim seamless reconnect across backend restarts. Horizontal
scaling and actor recovery are later work driven by measured need.

### Remaining launch gates

- Reviewed deployment Compose/proxy configuration, production images, HTTPS/WSS,
  exact-origin enforcement, private service ports and durable volume storage.
- Reviewed public admission/resource limits and logs that exclude guest tokens,
  database credentials and private answers/votes.
- Repeatable migration and idempotent seed steps for party and wit_parade;
  release and compatible-image rollback instructions. A code rollback does not
  automatically undo migrations; destructive rollback needs a verified backup.
- Off-host backups of both databases with an actual disposable restore rehearsal;
  documented retention, backup frequency and acceptable data loss before launch.
- Health/log monitoring, disk/backup checks, a feedback channel and a measured
  initial concurrency target. Do not infer capacity from unit tests alone.
- make check, make integration, production build, disposable production-stack
  smoke, and full games on independent mobile/desktop browsers. Test invitations,
  reconnect within grace, forfeits, selected packs and audio controls.
- Hosting/budget and domain/DNS access confirmed before provisioning; external
  HTTPS/WSS verification and a small invited playtest before wider sharing.

Record actual results in docs/VERIFICATION.md. All gates remain pending except
this topology/scope decision; this document is not deployment evidence.
