# Components

Reusable accessible UI components belong here. `ui/` contains Button, Card, Badge,
and Alert imported from the [neobrutalism.dev registry](https://www.neobrutalism.dev/docs/installation).
Use these shared components rather than duplicating their styles in platform/game UI.

The custom dark/coral palette and Tailwind v4 tokens live in `src/app/globals.css`.
The theme is fixed: `color-scheme: dark` and constant root tokens, with no toggle or
system-preference palette. Layout viewport metadata matches the dark page background.
Coral is the primary accent with dark ink on filled buttons; charcoal surfaces,
warm-white text, muted lavender copy, visible outlines and solid offset shadows
retain the neobrutalist foundation. Rounded corners, a quiet dotted backdrop and
local system typography keep it playful without remote fonts or assets.

Use semantic tokens for component colors, including focus rings, input surfaces and
errors; avoid hard-coded white/black focus styles. Reduced motion removes button
translation/transition. Preserve dark native form controls and visible keyboard focus.

`components.json` configures shadcn aliases and the `@neobrutalism` registry. To add
another component from the repository root using Docker:

```sh
docker compose run --rm --no-deps frontend pnpm dlx shadcn@latest add @neobrutalism/input
```

Or, from `frontend/` with host pnpm installed:

```sh
pnpm dlx shadcn@latest add @neobrutalism/input
```

Review generated files and dependencies, retain exact dependency versions, and run
`make fmt` and `make check`. Components are committed source, not an automatically
updated library. Add only what the UI needs.

Upstream sources: `https://neobrutalism.dev/r/{button,card,badge,alert}.json` and
`https://neobrutalism.dev/r/styling/blue.json`, retrieved 2026-11-07. Local adaptations:
Button declares a Next.js client boundary; Badge omits an unused React import;
the theme omits unused animation/scrollbar styles and adds reduced-motion support.
The MIT notice is preserved in
[`docs/licenses/neobrutalism-components.txt`](../../../../docs/licenses/neobrutalism-components.txt).

## Notifications

`ToastProvider` is mounted once in the root layout. Use the custom hook from
`@/lib/use-toast`: `const { notify, dismiss } = useToast()`, then
`notify(message, "info" | "warning" | "error" | "success")`. This is the default
for action feedback and validation throughout platform/game UI. Do not add inline
alerts or browser validation bubbles; custom-validated forms use `noValidate`.
Persistent page content, such as the health diagnostic report, remains in the page.

The latest notification replaces the previous one at the bottom-right of the viewport,
with mobile gutters/safe-area clearance, charcoal fill, chunky outline and offset shadow.
Event accents complement coral without reusing it: blue info, yellow warning, pink error,
and mint success. Labels and icons supplement color. Errors/warnings announce assertively;
info/success announce politely. Every event slides in over 300ms, stays for three seconds,
then fades out over 250ms. Hover/focus pauses dismissal and grants three seconds afterward.
Reduced motion disables animation. All events have a keyboard-accessible dismiss button;
notifications do not steal focus. Use `dismiss()` when retrying or invalidating old feedback.
No additional package is required.
