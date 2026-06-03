# Dashboard Rep Filter + Whole-Team View — Design

**Date:** 2026-06-03
**Branch:** worktree-home-dashboard
**Status:** Approved (brainstorming)

## Problem

The Home → Dashboard tab always shows the **calling rep's** numbers, ranked
against the full `role='rep'` roster. Every dashboard route resolves the subject
from `getUser()` → the caller's email and scopes all queries to that one rep.
There is no way to view another rep's dashboard or a team-wide roll-up.

We want:
1. A **rep filter** — pick any active rep and see their dashboard.
2. A **whole-team view** — see the aggregate of all reps' data.

## Decisions (locked during brainstorming)

- **Who can switch:** Everyone — any logged-in user can pick any rep or the
  whole team. (Rep pipeline is not treated as private from peers.)
- **Team view semantics:** Team **total** (sum across the roster); **hide rank**
  on the rank-based cards.
- **Selector placement:** Inline, next to the existing fiscal-year pills at the
  top of the Performance section.
- **Rank Trajectory card in team view:** **Hidden** (unmounts). Rank over time
  has no meaning for the whole team.
- **Dropdown style:** **Names only** (no avatars, no emails/IDs surfaced).

## Architecture

### Scope parameter on every dashboard route

The six dashboard routes — `topline`, `targets`, `pipeline`, `velocity`,
`rank-trajectory`, `sparklines` — gain one query param:

- `?rep=<userId>` → scope to that rep. **Omitted → defaults to the caller**, so
  today's behavior is preserved byte-for-byte.
- `?rep=team` → aggregate across all active reps; no rank.

`getUser()` remains the auth gate (must be logged in). The *subject* of the
query becomes the resolved scope rather than always `user.id`.

A shared helper resolves the scope identically in every route:

```ts
// src/features/home/lib/scope.ts
export type DashboardScope =
  | { mode: "rep"; rep: ActiveRep }
  | { mode: "team" };

export function resolveScope(
  searchParams: URLSearchParams,
  reps: ActiveRep[],
  callerId: string,
): DashboardScope;
```

- `rep=team` → `{ mode: "team" }`.
- `rep=<id>` present and in roster → `{ mode: "rep", rep }`.
- absent → `{ mode: "rep", rep: caller }` (caller resolved from `reps`).
- `rep=<id>` not in roster → 400.

This replaces the inline `reps.find((r) => r.id === user.id)` pattern repeated
across the routes.

### Per-route team aggregation

| Route | Rep mode (unchanged) | Team mode |
|-------|----------------------|-----------|
| `topline` | caller's 4 cards + rank | Σ all reps per metric; `rank: null` |
| `targets` | caller's targets card + rank | Σ targets/segments; `rank: null` |
| `sparklines` | caller's weekly series | Σ series across reps (per-week sum) |
| `velocity` | caller's velocity cells | **pool** the raw `RepVelocityAgg` (Σ wonCount, closedCount, wonBookingSum, takeSum, revSum) across the roster, then **recompute** closeRate/avgDealSize/grossMargin/dealsWon over the pooled totals — never average per-rep rates; `rank: null` |
| `pipeline` | caller's coverage/funnel/opps | aggregate over whole roster |
| `rank-trajectory` | caller's monthly rank series | `{ mode: "team" }`, empty series (card hidden client-side) |

Most routes already do a **batched all-reps fetch** and then pick the caller's
slice (e.g. `getRepActualsBatch(reps.map(r => r.email), …)` in `topline`, and
`rank-trajectory` already builds every rep's series for its modal). Team mode
sums that same batch instead of selecting one row — the heavy query is already
there.

The card-builder functions (`buildToplineCards`, the targets builder, the
funnel/coverage builders) take a scope/mode argument and either rank a single
rep or sum the roster. **Rank computation is skipped entirely in team mode**, and
the response carries a `mode: "rep" | "team"` flag (and `rank: null`) so the
client renders the rank UI conditionally rather than guessing from data shape.

### Rep list endpoint for the dropdown

No client-facing roster endpoint exists today.

- **`GET /api/reps`** → `getActiveReps()` projected to `{ id, fullName,
  avatarUrl }[]`. **No emails** (PII / "no IDs to reps" convention). The `id` is
  used only as the opaque dropdown value passed back as `?rep=`.
- **`useActiveReps()`** hook added to a shared `queries.ts`, long `staleTime`
  (roster rarely changes), key `["reps"]`.

## UI

### Selector

In `DashboardTab.tsx`, beside the fiscal-year pills:

- A `<select>`-style dropdown (brand-styled), options = **Whole team** + each
  active rep (names only, sorted as `getActiveReps` returns).
- **Defaults to the current user** (`profile.id`) on mount via a **ref guard**
  that sets the default once and never overwrites a user-chosen value (per the
  "filter bars default to current user" convention).
- While the roster query loads, render a **disabled placeholder** (don't hide
  it) to avoid layout shift.

### State + query keys

- `DashboardTab` owns `fy` (existing) and new `repScope: string` state
  (`"team"` or a rep id).
- `repScope` is threaded into every child card via props alongside `fy`.
- Each card's `useQuery` key gains `repScope`:
  `["dashboard", "topline", fy, repScope]` — serialized primitives only, stable
  key, so switching reps refetches cleanly and caches per (fy, rep).
- The query hooks (`useTopline`, `useTargets`, `usePipeline`, `useVelocity`,
  `useRankTrajectory`, `useSparklines`) gain a `repScope` arg appended to the
  URL as `&rep=${repScope}` (the caller's own id is sent explicitly, which is
  equivalent to omitting it).

### Conditional rank UI

- `RankPill` / rank labels: in `mode === "team"`, render a neutral **"Team"**
  chip (or omit the pill) instead of "N of M".
- `RankTrajectoryCard`: **unmounts** when `repScope === "team"`
  (`{repScope !== "team" && <RankTrajectoryCard … />}` in `DashboardTab`).
- All other cards render the summed values with the rank slot suppressed.

## Components / units

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `resolveScope()` | Parse `?rep=` → rep-or-team scope; validate against roster | `getActiveReps` result |
| route handlers (×6) | Call `resolveScope`, branch rep vs team aggregation | `resolveScope`, existing builders |
| builders (topline/targets/funnel/coverage) | Accept scope; rank one rep OR sum roster, skip rank in team mode | — |
| `GET /api/reps` | Serve roster `{id, fullName, avatarUrl}` | `getActiveReps` |
| `useActiveReps()` | Client roster query | `/api/reps` |
| `RepScopeSelect` | Dropdown (Whole team + reps), default-to-self ref guard, loading placeholder | `useActiveReps`, `useProfile` |
| `DashboardTab` | Own `fy` + `repScope`, thread to cards, hide RankTrajectory in team mode | all of the above |
| card hooks (×6) | Append `&rep=` + add `repScope` to query key | — |

## Error handling

- Unauthenticated → 401 (unchanged).
- `rep=<id>` not in the active roster → 400 `"unknown rep"`.
- Empty roster (shouldn't happen) → team mode returns zeroed aggregates, not an
  error.
- Dropdown roster fetch failure → selector stays disabled showing current user's
  name; cards still load the caller's own data (default scope).

## Testing

- **`resolveScope` unit tests:** absent → caller; `team`; valid id; unknown id →
  throws/400; caller-not-in-roster edge.
- **Route tests (extend existing `__tests__/route.test.ts`):** for each route,
  assert (a) `rep=<id>` returns that rep's figures, (b) `rep=team` returns the
  summed figures with `rank: null` / `mode: "team"`, (c) omitted param ==
  caller. Reuse existing fixtures.
- **Builder tests:** team mode sums correctly and omits rank; rep mode unchanged
  (existing assertions must still pass).
- **`RepScopeSelect` component test:** defaults to current user once, doesn't
  overwrite a user choice on roster refetch, renders disabled placeholder while
  loading.
- **`DashboardTab` test:** `RankTrajectoryCard` is absent when `repScope ===
  "team"`; query keys include `repScope`.

## Out of scope (YAGNI)

- Per-rep team breakdown bars within cards (only the team total).
- Team **averages** (we ship totals only).
- Repurposing Rank Trajectory into a team-value trend (card just hides).
- Permission gating (everyone can switch).
- Avatars / search in the dropdown.
- Persisting the selected rep across sessions.
