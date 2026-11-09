# Frontend conventions

Root AGENTS.md applies. App Router routes/layout: src/app; reusable UI: src/components;
utilities/protocol mirror: src/lib; platform/game UI: src/platform and src/games.
Use strict TypeScript, Tailwind, semantic accessible HTML and mobile-first layouts.
Keep server-only API URLs on the server; browsers cannot resolve Docker service names.
Use one socket per tab; future countdowns derive from server deadlines.

Frontend branding is **PartiSocial** (planned frontend domain: `parti.social`).
Use it in UI copy, metadata and frontend package naming. Backend/module/repository
names remain `soc-party`. Preserve the legacy `soc-party.guest` and `soc-party.name`
browser storage keys so existing room recovery and remembered names keep working.

Colocate meaningful `.test.tsx` tests; use Vitest + React Testing Library, mock fetch
at the boundary and assert visible outcomes including failure states.
Host commands: `pnpm --dir frontend <test|lint|typecheck|build>`; Docker checks use Make.
Component source/extension guidance: `src/components/README.md` (read for UI changes).

Default user feedback: use `useToast().notify(message, event)` from
`src/lib/use-toast.ts` for error, info, warning and success notifications.
The root layout mounts the single global ToastProvider; do not add local providers,
inline action alerts or native validation popups. Forms using custom validation must
set `noValidate`. Preserve the bottom-right placement, distinct pastel event accents, neobrutalist
outline/shadow, three-second timeout, smooth entry/fade and reduced-motion support. See `src/components/README.md` for behavior.
