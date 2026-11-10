# Components

Reusable accessible UI components belong here. `ui/` contains Button, Card, Badge,
and Alert imported from the [neobrutalism.dev registry](https://www.neobrutalism.dev/docs/installation).
Use these shared components rather than duplicating their styles in platform/game UI.

The soft-white, coral and pastel-blue palette and Tailwind v4 tokens live in
`src/app/globals.css`. The theme is fixed: `color-scheme: light` and constant root
tokens, with no toggle or system-preference palette. Layout viewport metadata
matches the warm off-white page background. Cards use soft white, primary actions
use coral, and neutral/secondary actions and dropdown highlights use pastel blue.
Charcoal ink, visible outlines and solid offset shadows retain the neobrutalist
foundation. A quiet dotted backdrop and local typography need no remote assets.

Use semantic tokens for component colors, including focus rings, input surfaces
and errors. Use `text-main-ink` for coral text on light surfaces; reserve `bg-main`
with `text-main-foreground` for coral fills. `bg-secondary` and
`text-secondary-foreground` provide the pastel-blue action palette, while
`bg-secondary-background` remains the card surface. Reduced motion removes button
translation/transition. Preserve light native form controls and visible keyboard focus.

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
with mobile gutters/safe-area clearance, soft-white fill, chunky outline and offset shadow.
Pastel blue info, yellow warning, pink error and mint success use matching darker
`--toast-ink` for readable message titles and outlines; `--toast-accent` supplies fills.
The notification message is the title; only colour indicates the event visually,
without generic severity labels or icons. Errors/warnings announce assertively;
info/success announce politely. Every event slides in over 300ms, stays for three seconds,
then fades out over 250ms. Hover/focus pauses dismissal and grants three seconds afterward.
Reduced motion disables animation. All events have a keyboard-accessible dismiss button;
notifications do not steal focus. Use `dismiss()` when retrying or invalidating old feedback.
No additional package is required.

## Branding

`brand.tsx` shares the tilted PartiSocial badge between admission and the lobby.
Keep its theme and typography consistent when replacing the text with future art.

## Select

`ui/select.tsx` composes the already installed `@base-ui/react/select` primitives
into a reusable labeled control, styled with the existing theme. The library owns
keyboard navigation, typeahead, disabled options, selection, focus restoration and
portal accessibility. The popup uses the trigger width and available viewport
height. No dependency is added. Source API: https://base-ui.com/react/components/select.

## Catalog choices

`choice-grid.tsx` contains a focusable, vertically scrollable two-column grid with
bounded height and one disabled Coming Soon button as the final grid tile, matching
the other buttons in size and style. Pass any number of game/pack buttons as
children; use `tileSize="lg"` for pack tiles. Use stable catalog IDs/slugs as keys
and let long labels wrap.
