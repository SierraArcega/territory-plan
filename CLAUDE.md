# Territory Plan Builder

EdTech territory planning tool for Fullmind sales teams. Next.js 16 App Router,
React 19, TypeScript, Tailwind 4, Prisma/PostgreSQL+PostGIS, MapLibre, Zustand,
TanStack Query. Vitest for testing.

## Before You Start

- Read `docs/architecture.md` before any exploration or multi-file changes
- Read `Documentation/UI Framework/tokens.md` before any frontend work
- Run `npm run dev` on port 3005, `npm test` for Vitest

## Project Conventions

### File Organization
- Features live in `src/features/{name}/` with `components/`, `lib/`, and optional `hooks/`
- Queries/hooks: `src/features/{name}/lib/queries.ts` (TanStack Query hooks)
- API routes: `src/app/api/{resource}/route.ts` (Next.js App Router)
- Shared components: `src/features/shared/components/`
- Shared utilities: `src/features/shared/lib/`
- Global state: `src/features/map/lib/store.ts` (Zustand) — ~1400 lines, read selectively

### Database
- Prisma ORM: `prisma/schema.prisma`, client at `src/lib/prisma.ts`
- Raw SQL (geospatial): `src/lib/db.ts` (pg Pool)
- Districts keyed by `leaid` (string), plans by `id` (int)

### Styling
- Fullmind brand — use tokens from `Documentation/UI Framework/tokens.md`
- Never use Tailwind grays — use plum-derived neutrals (#F7F5FA, #EFEDF5)
- Icons: Lucide only, `currentColor`, semantic sizing
- **Narrow-width resilience** — every flex/grid containing text needs `whitespace-nowrap` on its text spans plus a planned overflow behavior (`overflow-x-auto`, `flex-wrap`, or vertical stack). Sidebars + right rails routinely squeeze the main column, so no chrome survives without it. See `Documentation/UI Framework/tokens.md` § Narrow-Width Resilience.

### Performance
This is a daily-use tool for sales reps. It must feel smooth — no user action
should cause a dramatic slowdown. Apply these rules to every new feature:

- **Paginate lists** — never render more than 50 items at once. Use "Show more"
  or scroll-based loading. Show a filter hint banner at 200+ results.
- **Stable query keys** — TanStack Query keys must use serialized primitives
  (strings, numbers), never raw objects. Object spreads create new references
  that trigger phantom refetches.
- **Batch store mutations** — when a user action requires multiple Zustand
  `set()` calls, combine them into a single `set()` to avoid cascading re-renders.
- **Isolate subscriptions** — components should subscribe to the narrowest
  store slice they need (e.g., `s.layerFilters.vacancies` not `s.layerFilters`).
  Broad subscriptions cause unrelated state changes to trigger re-renders.
- **Conditional rendering over conditional fetching** — prefer mounting/unmounting
  components (which own their own queries) over running all queries and gating
  with `enabled` flags. TanStack Query caches survive unmounts via `gcTime`.
- **Clean up on unmount** — useEffect hooks that write to shared state (store,
  context) must return a cleanup function to prevent stale data.

### UX Defaults
This is a single-user-first tool. Every interaction should feel personalized and
require the fewest clicks possible. Apply these rules to all forms, filters, and
creation flows:

- **Default owner to current user** — any form with an owner, assignee, or rep
  field must default to `profile.id` (via `useProfile()`), not "Unassigned" or
  empty. Editing an existing record should preserve the saved owner.
- **Create-and-add in one step** — when a user creates a new entity (plan, task,
  activity) in a context where items are already selected (districts, contacts),
  the creation flow must automatically associate those items. Never require a
  second click to add what was already selected.
- **Filter bars default to current user** — Rep/Owner filter dropdowns should
  default to the current user's ID on mount, not "all". Use a ref guard to set
  the default once without overwriting user-chosen filters.
- **Show loading state, don't hide UI** — filters or dropdowns whose options
  load asynchronously must render a disabled placeholder during loading, not
  disappear. Disappearing UI causes layout shift and confusion.

### Testing
- Vitest + Testing Library + jsdom
- Tests co-located in `__tests__/` directories next to source

### External Webhooks (Clay, etc.)
When touching any flow that asks a third party to POST back to us (Clay
`CLAY_WEBHOOK_URL` callbacks, future webhook integrations), the callback URL is
built from `NEXT_PUBLIC_SITE_URL`, which defaults to production
(`https://plan.fullmindlearning.com`). That means **end-to-end verification on
localhost requires a tunnel** — otherwise the third party POSTs back to prod and
your local code never runs.

- Start a tunnel: `ngrok http 3005` (ngrok is already authed on dev machines).
- Put the public URL in `.env.local` as `NEXT_PUBLIC_SITE_URL=<tunnel-url>` and
  restart `npm run dev` so the API routes pick it up.
- After testing, remove the override from `.env.local` so subsequent runs
  don't keep pointing Clay at a dead tunnel.
- If you modify webhook request/response shape, also update the corresponding
  Clay table's input columns / HTTP callback payload — app-side code alone
  won't fix a mismatch on Clay's side.

## Large Files — Read Selectively
- `src/features/map/lib/store.ts` (~1400 lines) — Zustand store, grep for specific slices
- `src/features/map/lib/layers.ts` (688 lines) — MapLibre layer configs
- `prisma/schema.prisma` — full DB schema, grep for specific models

## Skills Available
- `/new-feature` — full feature pipeline (discovery -> design -> implement -> ship)
- `/backend-discovery` — explore backend architecture before implementation
- `/design-explore` — create Paper prototypes for design exploration
- `/design-review` — post-implementation design QA audit
- `/frontend-design` — build UI with Fullmind brand compliance

## Documentation
- `Documentation/UI Framework/` — 80+ component/pattern specs (the design system)
- `Documentation/.md Files/TECHSTACK.md` — full tech stack reference
- `Documentation/.md Files/data-model.md` — database schema details
- `docs/architecture.md` — feature map and codebase navigation guide
- `docs/prompting-guide.md` — guide for non-technical contributors
