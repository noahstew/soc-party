# Components

Reusable accessible UI components belong here. `ui/` contains Button, Card, Badge,
and Alert imported from the [neobrutalism.dev registry](https://www.neobrutalism.dev/docs/installation).
Use these shared components rather than duplicating their styles in platform/game UI.

The blue palette and Tailwind v4 tokens live in `src/app/globals.css`; change those
tokens to customize colors, borders, shadows, and weights. Fonts use the local
system stack. No theme switcher or remote font is required.

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
