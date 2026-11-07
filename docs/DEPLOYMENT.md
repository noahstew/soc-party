# Deployment plan (not implemented)

All services below are **planned**. No infrastructure code exists in Phase 0.
Candidate AWS layout: ECR stores images; ECS Fargate runs frontend/backend tasks;
RDS PostgreSQL stores durable content/accounts; ALB routes HTTP and upgrades WebSockets;
CloudFront serves cacheable frontend assets; Secrets Manager supplies credentials;
CloudWatch collects structured logs, metrics and alarms.

Use separate development, staging, production databases/secrets; apply migrations as a
one-shot release task before rolling out compatible code. Backups and restore drills,
TLS, restricted security groups and health checks are M8 requirements.

ALB supports WebSockets. Choose idle timeout longer than heartbeat interval; graceful
shutdown must drain connections before task termination. Never cache personalized state.
For v1, rooms live in one Go process. Losing that process loses live rooms; deployments
need draining/maintenance behavior. Multiple replicas require room-to-process routing,
connection affinity, registry coordination, and a policy for failover/recovery. Redis alone
does not preserve actor state. Resolve routing and lifecycle before horizontal scaling.

The prod-like Compose override tests non-root runtime images locally; it is not a production
security or deployment configuration. Database credentials and TLS need environment-specific
configuration. See README for exact rehearsal commands.
