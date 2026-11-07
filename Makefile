SHELL := /bin/sh
DC := docker compose
BACK := $(DC) run --rm --no-deps backend
FRONT := $(DC) run --rm --no-deps frontend

.PHONY: up down logs test integration lint typecheck fmt sqlc sqlc-check migrate seed psql reset-db check build
up:
	$(DC) up --build -d

down:
	$(DC) down

logs:
	$(DC) logs -f

build:
	$(DC) build backend frontend

test:
	$(BACK) go test -race ./...
	$(FRONT) pnpm test

integration:
	$(DC) up -d --wait db
	$(DC) run --rm --no-deps backend go test -race -tags=integration ./...

lint:
	$(BACK) sh -c 'test -z "$$(gofmt -l .)" && go vet ./... && golangci-lint run ./...'
	$(FRONT) pnpm lint
	$(FRONT) pnpm format:check

typecheck:
	$(FRONT) pnpm typecheck

fmt:
	$(BACK) gofmt -w .
	$(FRONT) pnpm format

sqlc:
	$(DC) run --rm --no-deps sqlc generate

sqlc-check: sqlc
	git diff --exit-code -- backend/internal/store
	@test -z "$$(git ls-files --others --exclude-standard backend/internal/store)" || (echo 'Untracked generated SQL files'; exit 1)

migrate:
	$(DC) up -d --wait db
	$(DC) run --rm --no-deps migrate

seed: migrate
	$(DC) run --rm --no-deps seed

psql:
	$(DC) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

reset-db:
	$(DC) down -v
	$(DC) up --build -d

check: lint typecheck test sqlc-check
