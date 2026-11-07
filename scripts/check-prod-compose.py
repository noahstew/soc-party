"""Reject development mounts that would hide files in production images.

Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    config --format json | python3 scripts/check-prod-compose.py
"""

import json
import sys


config = json.load(sys.stdin)
for name in ("migrate", "seed", "backend", "frontend"):
    service = config["services"][name]
    if service["build"]["target"] != "prod":
        sys.exit(f"{name}: expected production build target")
    if service.get("volumes"):
        sys.exit(f"{name}: production must not inherit development volumes")

print("Production Compose targets and mounts verified")
