# Feature Report: Saved Views Sidebar

**Date:** 2026-05-13
**Status:** Ready for Review (with one Important note)

## Summary

Unified "My Views" sidebar that consolidates plans and saved lists into a single navigable surface, with 8 view types (Map, Table, Kanban, Contacts, Opps, Vacancies, News, RFPs), an AI-assisted list builder (Anthropic SSE), and a per-entity detail panel. Delivered in 6 phases across 27 commits with full Prisma migration, new `/api/lists/*` CRUD, `/api/lists/preview` (filter-tree → parameterized read-only SQL), `/api/lists/ai-build` (SSE agent), parameterized agent loop, and an entire `/views/*` App Router segment.

## Changes

| File | Action | Lines |
|------|--------|-------|
| `prisma/migrations/20260513163806_saved_lists/migration.sql` | Created | +91 |
| `prisma/schema.prisma` | Modified | +216/-46 |
| `src/lib/saved-views/{filter-tree,schema,source-fields,sql-compiler,preview-sql}.ts` | Created | +1,094 |
| `src/lib/saved-views/__tests__/*.ts` | Created | +813 |
| `src/app/api/lists/route.ts` + `[id]/route.ts` | Created | +347 |
| `src/app/api/lists/preview/route.ts` | Created | +157 |
| `src/app/api/lists/ai-build/route.ts` | Created | +209 |
| `src/app/api/lists/[id]/hide/route.ts` | Created | +71 |
| `src/app/api/territory-plans/[id]/hide/route.ts` | Created | +67 |
| `src/app/api/territory-plans/route.ts` | Modified | +144 (?stats=1 extension) |
| `src/app/api/opportunities/[id]/route.ts` | Created | +96 |
| `src/app/api/news/[id]/route.ts` | Created | +82 |
| `src/app/api/rfps/[id]/route.ts` | Created | +97 |
| `src/app/api/contacts/[id]/route.ts` | Modified | +63 (new GET) |
| `src/app/api/vacancies/route.ts` | Created | +102 |
| `src/app/api/{opportunities,contacts,rfps,districts}/route.ts` | Modified | +57 (?leaids= param) |
| `src/app/views/{layout,page,plans/...,lists/...}.tsx` | Created | +196 |
| `src/features/views/**` | Created | ~7,500 |
| `src/features/reports/lib/agent/agent-loop.ts` | Modified | +331/-99 (variant fork) |
| `Docs/superpowers/{specs,plans}` + handoff/* | Created | +6,000 |
| **Total** | | **+23,473 / -172** across 135 files |

## Test Results

- **Vitest:** 2540 passed, 0 failed (240 test files, 22s wall clock — confirmed in this review)
- **New tests:** ~30 files added covering filter-tree, schema, source-fields, sql-compiler, preview-sql, all `/api/lists/*` routes, hide routes, AI build route, queries hook, useViewsRouter, GroupRow, PortfolioView, ViewsSidebar, ViewTabsStrip, ListBuilderModal, AiPromptBlock, LivePreviewPane, builder-utils, DetailPanel, DetailContent, opportunities/[id], news/[id], rfps/[id], vacancies, store, view-types, ai-list-builder/client
- **Build:** clean per task report
- **TypeScript:** baseline pre-existing errors unchanged (rfps tests, states.test.ts)

## Design Review

Out of scope for this code review — design review report should be consulted separately. Code-level Tailwind class usage observed matches the Fullmind palette (`#403770`, `#8A80A8`, `#FFFCFA`, `#EFEDF5`, `#FEF2F1`, etc.) and avoids Tailwind grays. `whitespace-nowrap` is consistently applied to narrow-width chrome (verified across `SidebarTopNav`, `SidebarFooter`, `GroupRow`, `ListsSubsection`, `PlansSubsection`, `SourcePicker`, builder header).

## Code Review Findings

### Strengths

- **SQL injection defense is exemplary.** Filter-tree → SQL compiler enforces a strict allowlist for column names (`SOURCE_FIELDS`) and table names (`SOURCE_TABLES`), all values are bound as `$N` parameters, and `quoteIdent()` plus alias validation include defense-in-depth `/^[a-z_][a-z0-9_]*$/i` regex checks even though identifiers come from a closed enum. Duration intervals are constructed from a strict regex match (no string concatenation). See `src/lib/saved-views/sql-compiler.ts:51-58, 65-73, 172-174`.
- **Read-only Postgres pool** (`src/lib/db-readonly.ts`) enforces 5s `statement_timeout` at the role level; preview route catches timeout errors and degrades to a `truncated: true` soft empty rather than hanging or 500-ing (`src/app/api/lists/preview/route.ts:149-153`).
- **Zod validation is comprehensive** at every API boundary — `previewBodySchema`, `createListBodySchema`, `updateListBodySchema`, `hideBodySchema`, plus the AI agent's emitted `listSpecSchema`. Recursive filter trees capped at `max(50)` children and `max(500)` `values` per any-node to bound payload size (`src/lib/saved-views/schema.ts:38, 58`).
- **Auth on every new API route**: all `/api/lists/*`, `/api/territory-plans/[id]/hide`, `/api/opportunities/[id]`, `/api/news/[id]`, `/api/rfps/[id]`, `/api/vacancies` route handlers call `getUser()` first and return 401 if missing. Visibility rules (`ownerId === user.id || shared`) correctly applied on list GET, PATCH, DELETE, hide, and the preview's referenced-list lookup. Plan-and-list hide routes confirm the referent exists before stamping the per-user row so attackers can't probe IDs (`src/app/api/lists/[id]/hide/route.ts:30-41`, `src/app/api/territory-plans/[id]/hide/route.ts:31-37`).
- **AI agent fork is backwards-compatible by design.** The default `agentVariant: "reports"` preserves the original `run_sql` branch verbatim; existing `chat/route.ts` and `chat/stream/route.ts` callers do not opt into the new variant and continue to receive `{ kind: "result" }`. The reports route was defensively updated to handle the new `terminal_result` kind via an unreachable fallback (`src/app/api/ai/query/chat/route.ts:87-88, 111`).
- **TanStack Query keys** are correctly serialized to primitives — most critically, `useListPreview` JSON-serializes the entire `PreviewSpec` before it enters the query key, so reference-fresh-but-deep-equal specs share a cache entry (`src/features/views/lib/queries.ts:305-312`).
- **Zustand subscriptions** uniformly use narrow selectors (`s => s.builderOpen`, `s => s.openBuilder`, etc.) — no broad `useViewsStore()` calls found. `openBuilder` correctly batches `set({builderOpen, builderSeed})` in one call per CLAUDE.md guidance (`src/features/views/lib/store.ts:116-117`).
- **Mobile coverage**: the views layout follows CLAUDE.md iOS rules — no `overflow:hidden` on html/body; backdrop padding tightens on mobile; ListBuilderModal `maxHeight: 92vh`; DetailPanel `maxWidth: calc(100vw - 16px)`; hamburger pattern uses local component state rather than store bloat.
- **No `any`, no `@ts-ignore`, no `@ts-nocheck`** in any new code under `src/features/views/`, `src/lib/saved-views/`, `src/app/api/lists/`, or the modified territory-plans/contacts/opps/news/rfps/vacancies route files.
- **No `dangerouslySetInnerHTML`** anywhere in the new code surface.

### Issues

| Severity | Description | File | Recommendation |
|----------|-------------|------|----------------|
| Important | **N+1-shaped query pattern in `?stats=1`.** `computePlanStats` issues 4 Prisma queries per plan via `Promise.all` inside `visiblePlans.map(...)`. For N plans the total fan-out is `4 × N` queries (200 queries for 50 plans). They're concurrent so wall-clock latency stays near `max(perPlanLatency)`, but each query is an aggregate on `opportunities` and `contacts` — at moderate scale this becomes Postgres-throughput-bound. Existing indexes cover the WHERE shape per migration comment, but plan-count growth will hit this hard. | `src/app/api/territory-plans/route.ts:166-185` | Either (a) collapse to a single grouped aggregate per metric using `GROUP BY plan-id` via raw SQL on a CTE that unions the plan→leaid mapping; (b) add a server-side cache keyed on `(user.id, plan.updatedAt)`; or (c) document a known ceiling (e.g., gate behind a `?planIds=` filter so the sidebar fetches only what's visible). Acknowledged this is the canonical-path replacement for `/api/plans` and is hit on portfolio load. |
| Minor | **`/api/contacts/[id]` GET has no auth check.** The new GET handler does not call `getUser()`. PUT and DELETE in the same file also have no auth, and `/api/contacts/route.ts` (parent) has none — so this is consistent with the *pre-existing* contacts surface and not a regression introduced by this PR. Still worth surfacing because every other detail endpoint added in this PR (opps, news, rfps, vacancies) does auth correctly. | `src/app/api/contacts/[id]/route.ts:17-68` | Add `const user = await getUser(); if (!user) return 401;` for consistency. Optionally a follow-up PR could harden PUT/DELETE and the list endpoint together. |
| Minor | **`OppsView`/`NewsView` accept `planId` props that are never read.** The destructure only pulls `leaids`. The prop is documented as "reserved for future plan-scoped endpoint" but currently dead. | `src/features/views/components/views/OppsView.tsx:40, 75`; same pattern in `NewsView.tsx` | Drop the prop until the v1.1 plan-scoped endpoint lands, or actually use it for the news/[plan-id] route's `territoryPlanId` param. (NewsView does pass `territoryPlanId` to the API, but OppsView ignores `planId` entirely.) |
| Minor | **List builder's `SOURCE_META` count values are hardcoded** (e.g., the rep-facing "12,584 districts" badge). This is acknowledged deviation #6, but worth confirming a TODO is tracked. | `src/features/views/components/builder/builder-utils.ts` (SOURCE_META export) | Acknowledged — wire to a real `/api/lists/source-totals` endpoint in F-follow-up. |
| Minor | **`AGENT_LOOP_DIAG=1` env-gated logging is preserved** as-is, but the agent-loop refactor inflated the file from ~330 to ~660 lines and the two terminal-tool branches duplicate ~80 lines of retry/error handling. This is a readability concern, not a correctness one — both branches share `MAX_SQL_RETRIES`, `sqlRetriesUsed`, `surrender` semantics, and `tool_result` emission shape. | `src/features/reports/lib/agent/agent-loop.ts:295-560` | Optional: extract a `handleTerminalResult()` helper that both branches call after they produce a `RunSqlResult`-shaped value. Defer to a separate refactor PR. |
| Minor | **No `cursor` pagination in `/api/vacancies` despite docstring promise.** The handler docstring says `?cursor=` is supported but the param is never read. | `src/app/api/vacancies/route.ts:25` | Either delete the line from the JSDoc or implement cursor in v1.1 — the limit-200 cap is sufficient for plan-scoped scopes today. |

### Spot-checks that passed

- **Filter-tree Zod recursion** correctly uses `z.lazy()` for self-reference and `max(50)` children to prevent stack-blowing payloads (`src/lib/saved-views/schema.ts:47-58`).
- **`/api/lists` POST** validates Zod first, then enforces the cross-field constraint that `scopeMode === "reference"` requires both `scopeRefKind` and `scopeRefId` (`src/app/api/lists/route.ts:98-105`). Same enforcement in PATCH and preview.
- **PATCH `/api/lists/[id]`** correctly distinguishes between `undefined` (don't change) and `null` (clear nullable column) when re-marshalling to Prisma — manually building `updateData` rather than spreading `data` (`src/app/api/lists/[id]/route.ts:120-137`).
- **`/api/lists/preview` with `scopeRefKind: "list"`** loads the referenced list with a visibility check (`ownerId === user.id || shared`) and rejects non-`districts` sources before composing the EXISTS clause (`src/app/api/lists/preview/route.ts:80-103`).
- **SSE stream contract on `/api/lists/ai-build`** emits `: stream-open\n\n` keepalive, terminates with a single `result` frame for ok/clarifying/surrender, sets correct content-type / `x-accel-buffering: no` / `cache-control: no-cache`, and wraps the entire body in try/catch/finally so the `controller.close()` always fires (`src/app/api/lists/ai-build/route.ts:127-198`).
- **AI agent variant retry budget** is shared with the reports `MAX_SQL_RETRIES`, so a malformed `emit_list_spec` (unknown field or op) gets re-prompted and the model has a chance to self-correct before surrendering (`src/features/reports/lib/agent/agent-loop.ts:494-516`).
- **DetailPanel** uses `mousedown` (not `click`) for outside-close detection to win the race against the canvas's `onClick` row-routing — opening a second detail kind correctly swaps content rather than closing first (`src/features/views/components/detail/DetailPanel.tsx:91, 117-122`).
- **`ListBuilderModal`** keys preview query AND debounces via the same JSON-serialized spec, so deep-equal-but-fresh inputs don't trigger refetches. Submit-disabled correctly requires non-empty rules + (when reference scope) a non-null ref id (`src/features/views/components/builder/ListBuilderModal.tsx:305-307`).
- **Per-user hide upserts** use `prisma.savedListHidden.upsert({ where: { listId_userId: ... }, create, update: {} })` — correct idempotent shape (`src/app/api/lists/[id]/hide/route.ts:58-63`).
- **Sample query identifiers in `sample_values`** are double-validated with `/^[a-z_][a-z0-9_]*$/i` before interpolation even though they come from `SOURCE_FIELDS` (`src/features/views/lib/ai-list-builder/handlers.ts:86-88`).
- **No raw `searchParams.get("state")`** without `normalizeState()` in any of the new routes — none of the new endpoints accept a state filter directly. The existing districts route already normalizes.

## Recommendation

**READY FOR REVIEW** — all tests pass, no critical security issues, the architecture is sound, and the acknowledged deviations are appropriate v1 scope cuts. The one Important issue (N+1 stats fanout) is a known scaling concern that's tolerable at current plan counts (per the migration comment, indexes are in place), but the human reviewer should decide whether to ship behind a follow-up perf issue or merge as-is given that this replaces an even-slower legacy code path. Minor issues are stylistic / consistency-only and can be folded into a follow-up PR.

### Counts

- **Critical:** 0
- **Important:** 1 (N+1-shaped query in `?stats=1`)
- **Minor:** 5

### One-line feature summary

Adds a unified "My Views" sidebar that fuses territory plans and AI-buildable saved lists into a single navigable surface, with 8 view types, a slide-in entity detail panel, and a parameterized read-only SQL preview pipeline.
