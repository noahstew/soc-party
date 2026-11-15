# Deployment plan (preparation; not deployed)

AWS Lightsail is the selected M4 hosting provider (2026-11-14). Prepare one Linux
instance running Docker Engine and Compose, with Caddy for HTTPS, the production
Next frontend, exactly one Go backend and PostgreSQL containing both party and
wit_parade. Deployment configuration and automation are still pending; no cloud
resources have been provisioned as part of this decision.

EC2 plus RDS and the earlier ECR/ECS Fargate/ALB/CloudFront managed topology remain
M9 candidates when measured demand or operational needs justify their cost.

Use separate development, staging, production databases/secrets; apply migrations as a
one-shot release task before rolling out compatible code. Backups and restore drills,
TLS, restricted security groups and health checks are required for M4; managed infrastructure is deferred to M9.

The HTTPS proxy must support WebSockets. Choose idle timeout longer than heartbeat interval; graceful
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
prod-like override as safe for public exposure. Lightsail is selected; final instance
size, region, total budget and domain/DNS access still need confirmation before
provisioning. The planned domain is parti.social.
The user plans to register it through Namecheap; purchase and DNS access are not
yet verified. Keep Namecheap BasicDNS for M4 rather than adding Route 53.

Live rooms remain in one Go process. Restarts, host failure and deployments end
active games; audit rows cannot recover them. Schedule releases outside test
sessions, notify testers before maintenance and ask them to create new rooms
afterward. Do not claim seamless reconnect across backend restarts. Horizontal
scaling and actor recovery are later work driven by measured need.

### Lightsail sizing, costs and access

Rehearse against a 2 GB memory budget before selecting the initial instance.
The candidate is the Linux public-IPv4 US$12/month bundle (about C$17.11);
the 4 GB US$24/month bundle (about C$34.22) is the fallback if measurements require
more memory. These are base prices, not an approved total spending limit. CAD
estimates use the 2026-11-13 rate of C$1.4257 per US dollar; exchange rates, taxes
and payment conversion fees affect the actual bill. Backups, snapshots, domain
registration and transfer overages are additional. Recheck pricing before purchase:
[Lightsail bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html),
[Bank of Canada rates](https://www.bankofcanada.ca/rates/daily-digest/).

Stopping Lightsail or its containers does not stop instance billing. Deleting the
instance stops its charge, but retained snapshots and other resources can still
cost money. Do not use deletion as a routine beta shutdown procedure. Budget alerts
are notifications, not a guaranteed bill cap. See
[Lightsail billing](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html).

At provisioning, attach a static IP and point the confirmed domain to it. Permit
public TCP 80/443, restrict SSH to approved administrative/deployment access and
review IPv4 and IPv6 firewall rules. Database and application ports stay private.
Keep production secrets on the host with restricted permissions, separate from
development .env files and image contents. The operator owns OS/container updates,
database maintenance, disk capacity and restore drills. Host snapshots supplement
off-host backups of both databases; they do not replace verified logical restores.

### Namecheap domain and DNS (planned)

Use Namecheap for registration and BasicDNS, Lightsail for hosting and Caddy for
automatic HTTPS certificate issuance/renewal. No Namecheap web hosting, paid SSL
certificate or AWS DNS service is required for this topology. Confirm domain
availability, initial and renewal prices, and account/DNS access before purchase
or changes. Domain fees remain separate from the Lightsail budget.

Once the reviewed host has its attached static IPv4 and provisioning is approved,
open Namecheap Domain List > Manage > Advanced DNS > Host Records (with BasicDNS
nameservers active). Use this intended record set:

| Type | Host | Value | Purpose |
| --- | --- | --- | --- |
| A | @ | Attached Lightsail static IPv4 | Canonical parti.social origin |
| CNAME | www | parti.social | Optional alias; Caddy must serve TLS and redirect it to the canonical origin |

Replace conflicting parking/URL-redirect records for these hosts, preserving any
unrelated mail/TXT records. Do not publish an AAAA record until IPv6 routing,
firewall rules and HTTPS have been verified. Namecheap's URL forwarding is not
the application reverse proxy. No wildcard or separate API domain is required.
See [Namecheap A-record setup](https://www.namecheap.com/support/knowledgebase/article.aspx/319/2237/how-can-i-set-up-an-a-address-record-for-my-domain/).

Verify public DNS resolution before requesting certificates. Caddy's certificate
challenges need reachable public ports 80/443 and persistent certificate storage.
Review any existing CAA records for compatibility with the configured issuer.
Use https://parti.social for API_PUBLIC_URL and the exact ALLOWED_ORIGINS value;
redirect www before users create rooms. Verify HTTPS, canonical redirects,
invitations and WSS externally after DNS propagation. Standard HTTP/TLS challenges
do not require a Namecheap API key in GitHub Actions or on the host. Record domain
renewal ownership and reminders alongside the operating procedures.

### GitHub Actions release automation (planned)

Build production frontend/backend images on GitHub runners, not the small Lightsail
host. Use GHCR for images, record immutable digests and retain the previous release.
CI must pass checks, integration, production builds and deployment smoke before a
release is eligible. Initial beta releases use a manual workflow for a selected
tested commit, serialized so two deployments cannot overlap.

The release workflow will use restricted SSH access with a verified host key to
run the reviewed host release procedure: validate configuration, take verified
backups of both databases, pull the selected images, enter scheduled maintenance,
run one-shot migrations and idempotent seeds, update services and check HTTPS/WSS
health. Define failure handling and compatible-image rollback before enabling it;
an image rollback does not undo database migrations. Keep deployment credentials
in GitHub secrets and never expose them to pull-request workflows. If AWS API
access is needed, use narrowly scoped OIDC roles rather than long-lived AWS keys.
Private GHCR pulls also require a host credential with read-only package access.

GitHub Actions release automation is part of M4's release task; broader AWS IaC
and managed scaling remain M9 work. No deployment workflow or release command is
implemented by this document.

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
- Final Lightsail size/region, total budget and domain/DNS access confirmed before provisioning; external
  HTTPS/WSS verification and a small invited playtest before wider sharing.

Record actual results in docs/VERIFICATION.md. All gates remain pending except
this topology/scope decision; this document is not deployment evidence.
