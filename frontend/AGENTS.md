# Frontend conventions

Root AGENTS.md applies. App Router routes/layout: src/app; reusable UI: src/components;
utilities/protocol mirror: src/lib; platform/game UI: src/platform and src/games.
Use strict TypeScript, Tailwind, semantic accessible HTML and mobile-first layouts.
Keep server-only API URLs on the server; browsers cannot resolve Docker service names.
Use one socket per tab; future countdowns derive from server deadlines.

Colocate meaningful `.test.tsx` tests; use Vitest + React Testing Library, mock fetch
at the boundary and assert visible outcomes including failure states.
Host commands: `pnpm --dir frontend <test|lint|typecheck|build>`; Docker checks use Make.
Component source/extension guidance: `src/components/README.md` (read for UI changes).
