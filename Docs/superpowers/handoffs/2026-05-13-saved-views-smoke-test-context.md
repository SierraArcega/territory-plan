# Context Prompt — Saved Views Smoke-Test Iteration

Copy everything below this line into a fresh Claude Code session in this worktree.

---

You are continuing work on the **Saved Views** feature in the Fullmind Territory Planner. The full /new-feature pipeline (Stages 1-7) was completed in a prior session. The feature is implemented across 27 commits in this worktree, all tests pass, build is clean, and reviews are in. Now we are in **smoke-test + iterate** mode: the user clicks around the running app, surfaces issues, and we fix them in tight loops.

## Workspace

- **Working directory:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/`
- **Branch:** `worktree-saved-views-sidebar` (forked from `main` at `0812a091`)
- **Git author identity is not set on this worktree.** Use per-command flags on every commit:
  ```
  git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "..."
  ```
  End every commit message with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Dev server:** `npx next dev -p 3005`. Run `lsof -ti :3005 | xargs -r kill -9` first if a previous server is running. The dev server may already be running in the background from the prior session.
- **Test:** `npx vitest run`. Baseline at handoff: 2540/2540 green. There are ~28 pre-existing typecheck warnings in `features/rfps/__tests__` and `lib/__tests__/states.test.ts` — not introduced by this feature, ignore.

## What's already built (read these before making changes)

- **Spec:** `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-spec.md`
- **Plan:** `Docs/superpowers/plans/2026-05-13-saved-views-sidebar-plan.md`
- **Backend context:** `Docs/superpowers/specs/2026-05-13-saved-views-sidebar-backend-context.md`
- **Design review:** `Docs/superpowers/reports/2026-05-13-saved-views-sidebar-design-review.md`
- **Code review (final report):** `Docs/superpowers/reports/2026-05-13-saved-views-sidebar-final-report.md`
- **Original design handoff** (visual source of truth): `design_handoff_activities_calendar/design_handoff_saved_views/` — especially `README.md`, `app-unified.jsx`, `district-panel.jsx`, `detail-panel.jsx`, `list-builder.jsx`.

## Code map (high-level)

- `src/features/views/` — the entire feature module (sidebar, group canvas, 8 views, detail panel, list builder modal, queries, store)
- `src/app/views/layout.tsx` + `src/app/views/page.tsx` + `src/app/views/plans/[planId]/[viewId]/page.tsx` + `src/app/views/lists/[listId]/[viewId]/page.tsx` — App Router segments
- `src/lib/saved-views/` — shared filter-tree types, Zod schemas, SQL compiler, preview-SQL composer, source-field allowlist
- `src/features/reports/lib/agent/agent-loop.ts` — parameterized agent loop (reports + list-builder variants share)
- `src/app/api/lists/` — CRUD + preview + ai-build (SSE) routes
- `src/app/api/territory-plans/` — extended with `?stats=1` and per-user hide
- `src/app/api/{opportunities,news,rfps,contacts}/[id]/route.ts` and `src/app/api/vacancies/route.ts` — detail/list endpoints added by this feature
- `prisma/migrations/20260513163806_saved_lists/migration.sql` — new tables `saved_lists`, `saved_list_hidden`, `territory_plan_hidden`

## Known acknowledged deviations (DO NOT re-litigate — these are documented intentional gaps)

1. **MapView v0**: mounts MapV2Container WITHOUT a leaid filter. Banner explains "Showing all districts — scoping coming soon". Threading the filter through MapV2 is a multi-day refactor. v1.1 work.
2. **Portfolio stats substituted**: 4 prototype stats (Total target / Booked / Open pipeline / To target) replaced with 4 client-computable totals (Open pipeline / Total contacts / Open opps / Plans count) because the API doesn't expose target. Documented in `PortfolioView.tsx` header.
3. **"8 views" hardcoded** on portfolio cards — no per-plan view counter in DB.
4. **List Builder source totals hardcoded** in `builder/builder-utils.ts` — placeholder; v1.1 should ship a `/api/lists/source-totals` endpoint.
5. **SidebarFooter pod** falls back to `jobTitle` because `UserProfile.pod` field doesn't exist.
6. **News source has no district scope** in `/api/lists/preview` — list-builder will 400 if you scope a news list to a plan/list reference.

These are tracked in the spec's "Out of Scope" section.

## Known issues from review NOT yet fixed (consider for this session)

| Severity | File | Issue |
|---|---|---|
| Important | `src/features/views/components/views/NewsView.tsx` | News cards wrap in `<a target="_blank">` so clicking opens the article instead of the detail panel. Breaks click-to-detail contract. ~10 LOC fix: drop the anchor, use `data-row-kind="news" data-row-id={id}` like the other views. |
| Important | `src/app/api/territory-plans/route.ts:166-185` (`computePlanStats`) | N+1 shape — 4 Prisma aggregates per plan × N plans. At 50 plans = 200 queries. Indexes are in place but rewrite to a single CTE/GROUP BY is the correct long-term shape. Probably defer to v1.1 unless user has 50+ plans. |
| Minor | NewsView, GroupViewList, TableView, pill fgs | 6 off-token color hex values: `#2d2750`, `#5C5277`, `#6f6786`, `#6f4c8c`, `#B8B0D0`, `#E0CFCC`, `#997c43`. See design review I-2..I-7 for exact file:line. |
| Minor | `src/app/api/contacts/[id]/route.ts` | Added by Phase D without `getUser()` auth. Other routes added in this PR have auth — inconsistent. |
| Minor | `OppsView.tsx`, `NewsView.tsx` | Accept `planId` props that are unread. Either wire them or drop. |
| Minor | `src/features/reports/lib/agent/agent-loop.ts` | ~80 LOC duplicated across reports/list-builder retry branches. Extract a helper. |
| Minor | `src/app/api/vacancies/route.ts` | Docstring mentions `?cursor=` pagination but it's unimplemented. |
| Doc | `Documentation/UI Framework/tokens.md` | Forbids `rounded-md`/`rounded-sm`, but the prototype demands 6px radii. 40+ places in the new code use these classes. Worth a tokens.md amendment, not a sweep. |

## URLs to smoke-test (dev server on port 3005)

- `http://localhost:3005/views` → portfolio with real plan cards
- `http://localhost:3005/views?archived=1` → archived plans tab
- `http://localhost:3005/views/plans/<planId>` → redirects to default view
- `http://localhost:3005/views/plans/<planId>/{map,table,kanban,contacts,opps,vacancies,news,rfps}` → each of the 8 views
- Click any row → URL gains `?detail=<kind>:<id>`, panel slides in from right
- Click `+` next to "Lists" or "+ New list" footer button → list builder modal opens
- AI Build with a suggested chip → fields populate (SSE flow)
- `http://localhost:3005/?tab=plans` → legacy PlansView (untouched fallback)

---

## TOP-PRIORITY ITERATION (start here)

**Move My Views from the `/views/*` sub-route into the MAIN app sidebar.**

Current state:
- `Sidebar.tsx` (`src/features/shared/components/navigation/Sidebar.tsx`) is the 140px legacy tab nav used on every route EXCEPT `/views/*`. It has tabs for Home, Map, Plans (legacy), Activities, Tasks, Reports, Leaderboard, LHF, Resources, Profile, Admin.
- `ViewsSidebar.tsx` (`src/features/views/components/ViewsSidebar.tsx`) is the new 252px unified sidebar that only mounts under `/views/*` via `src/app/views/layout.tsx`.
- This creates two different sidebars depending on URL — reps have to navigate to a separate `/views` URL to see their plans/lists, which the user finds awkward ("weird sublink").

Desired state:
- The "My Views" section (with All Plans, Plans subsection, Lists subsection, hidden footer, list builder triggers) should appear in the **main app sidebar across every route**, not just `/views/*`. It should be a top-level section visible from the Home / Map / Activities tabs etc.
- Routes to plans/lists views could either:
  - (Option A) Stay at `/views/plans/[id]/[viewId]` — links in the main sidebar nav to these routes. Old AppShell wraps `/views/*` content too.
  - (Option B) Get rewritten under `/?tab=views&group=...&view=...` query-param style to match the rest of the app's URL convention.
  - (Option C) Move to top-level routes like `/plans/[id]/[viewId]` and `/lists/[id]/[viewId]` (no `/views` prefix).
- Discuss with the user which routing approach they prefer before implementing.

Constraints:
- Don't break the legacy `?tab=plans` URL — it stays as a fallback per the original spec.
- Don't double-sidebar (current legacy is 140px; new is 252px). Either replace the legacy with the new design entirely, OR collapse the new "My Views" section into the 140px legacy width (tighter density).
- The user picked "Replace sidebar; keep old route as fallback" back in Stage 2, but Phase B scoped the new sidebar to `/views/*` only as a smaller blast radius. The user is now asking us to honor the original Stage 2 intent fully.

### Suggested approach

1. **Brainstorm with the user**: present 2-3 integration options with previews (use `AskUserQuestion` with `preview` field for visual comparisons). Likely options:
   - A. Replace `Sidebar.tsx` entirely. The new design's top nav (Home/Map/Activities/Tasks/Leaderboard) PLUS My Views all live in one 252px column on every route. Legacy `/?tab=plans` still resolves but no UI links there. Old `Sidebar.tsx` deleted or archived.
   - B. Keep `Sidebar.tsx` at 140px for top nav but ADD My Views as a section below it (sidebar grows to ~252px when expanded). Stays narrow when collapsed.
   - C. Hybrid: a 56px icon rail (old sidebar collapsed permanently) + a 252px secondary panel that's the new My Views section. Two columns total. Bulky but maximally separated.
2. **Pick A by default** — it matches the original prototype most faithfully and the user's stated preference in Stage 2.
3. **Implementation outline** if A:
   - Move `ViewsSidebar.tsx` content into the global `AppShell.tsx` slot, replacing the existing `Sidebar.tsx` import.
   - Update `SidebarTopNav.tsx` to wire each tab to the same `onTabChange` handler that `src/app/page.tsx` uses for the legacy Sidebar (Home / Map / Activities / Tasks / Leaderboard click handlers — they currently navigate to `/?tab=<id>` legacy URLs from Phase B's quick stub).
   - Delete `src/app/views/layout.tsx`'s mobile hamburger duplicate — the main `AppShell` handles that.
   - Keep the `/views/*` routes working so existing URLs don't 404. Their layout can mount the existing `AppShell`.
   - Verify legacy `?tab=plans` URL still loads `PlansView` unchanged.
4. **Test** that nothing broke on Home / Map / Activities / Tasks / Reports / Leaderboard / LHF / Resources / Profile / Admin tabs.
5. **Commit** as a single change: `feat(saved-views): move My Views into main app sidebar across all routes`.

### After that

Continue smoke-testing. The user will surface more issues as they click around. For each:
- Verify the issue in the running app or by reading the implicated code.
- Fix the smallest viable change.
- Run tests + typecheck after each fix.
- Commit per fix with a descriptive message.

For larger items (e.g., wiring real MapV2 scoping, building a SourceTotals endpoint, the N+1 plan stats rewrite, real portfolio Target stat), pause and brainstorm with the user first.

## Working norms (from user feedback memory)

- **Default to feat/* branch + many small focused commits** — the user prefers regular commits during implementation, not one big final commit (already established working pattern in this branch).
- **Don't add features beyond the ask.** YAGNI applies. Smoke-test-driven iteration means making the smallest fix that addresses the reported issue.
- **Token compliance is sacred.** No Tailwind grays. Plum-derived neutrals only. Lucide icons with `currentColor`.
- **Verify before claiming done.** Run the verification commands (`npx vitest run`, `npm run build`, smoke test in browser). Don't say "fixed" without evidence.
- **No emojis in files unless explicitly asked.**
- **Be terse.** Short responses. The user reads diffs themselves.

## Start here

1. Read this entire context prompt.
2. Confirm the dev server is running on 3005 (if not, start it).
3. Ask the user whether they want to start with the main-sidebar relocation (option A/B/C from above) or smoke-test something else first.
