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

### Testing
- Vitest + Testing Library + jsdom
- Tests co-located in `__tests__/` directories next to source

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
