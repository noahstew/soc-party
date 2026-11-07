# Frontend conventions

Follow root AGENTS.md. App Router routes/layout in src/app; reusable UI in src/components;
shared utilities and mirrored protocol in src/lib; platform/game UI in their own directories.
Use strict TypeScript and Tailwind, semantic accessible HTML, mobile-first layouts.
Keep server-only API URLs on the server; browsers cannot resolve Docker service names.
When sockets arrive, use one per tab and render only server-authorized projections.
Compute countdowns from server deadlines. Never inject user HTML.

Place meaningful `.test.tsx` tests alongside components/routes; Vitest + React Testing Library
mock fetch at the boundary and assert user-visible outcomes including failure states.
Use `pnpm --dir frontend test`, `lint`, `typecheck`, `build` for host development;
Docker equivalents are available through `make test`, `make lint`, `make typecheck`.
Run `make fmt` and `make check` before completion. Do not add gameplay during Phase 0.
