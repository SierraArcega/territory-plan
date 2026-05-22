# Main Sidebar Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the legacy `Sidebar` the single sidebar on every route, with the existing `MyViewsSection` rendered below the main tabs. `/views/*` routes swap their bespoke shell for `AppShell` (with a new `hideFilterBar` prop). `/views/*` URLs stay intact.

**Architecture:** Five small, focused commits. (1) Type widening + props plumbing. (2) Sidebar layout change + MyViewsSection render. (3) /views/layout rewrite to mount AppShell. (4) Dead-file cleanup. (5) Verification. Each task self-contained, tests + typecheck + build after the steps that move code.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Vitest + Testing Library + jsdom, Zustand (`useMapStore`), TanStack Query.

**Spec:** `Docs/superpowers/specs/2026-05-13-main-sidebar-relocation-design.md`

---

## Pre-flight

- [ ] **Step 0a: Confirm worktree + branch**

```bash
git -C /Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar branch --show-current
```

Expected: `worktree-saved-views-sidebar`

- [ ] **Step 0b: Confirm baseline tests pass**

```bash
cd /Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar && npx vitest run 2>&1 | tail -5
```

Expected: `Test Files <N> passed (<N>)` — baseline is 2540 tests at handoff. Capture the exact number, all green.

- [ ] **Step 0c: Confirm dev server is running**

```bash
lsof -ti :3005
```

Expected: a PID. If empty, start with `npx next dev -p 3005 &`.

---

### Task 1: Type widening and FilterBar gating

This task does all type/prop plumbing in one focused commit so the bigger layout edits in Task 2/3 are pure layout edits.

**Files:**
- Modify: `src/features/shared/components/navigation/Sidebar.tsx` (line 11 — add `"views"` to local `TabId` union)
- Modify: `src/features/shared/components/layout/AppShell.tsx` (add `hideFilterBar` prop, conditional render)

- [ ] **Step 1.1: Widen the TabId union in Sidebar.tsx**

Edit `src/features/shared/components/navigation/Sidebar.tsx` line 11 — append `| "views"` to the union:

```tsx
// Tab configuration - defines all navigation items
// The 'id' matches the activeTab state values we'll use throughout the app.
// "views" is a sentinel passed from /views/* routes so no main tab is highlighted —
// it never appears in MAIN_TABS or BOTTOM_TABS.
type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "reports" | "leaderboard" | "low-hanging-fruit" | "resources" | "profile" | "admin" | "views";
```

Do NOT add `"views"` to `src/features/shared/lib/app-store.ts` — the Zustand store never holds `"views"`. Sidebar's TabId is a superset; `app-store.ts`'s TabId is a subset, which is type-compatible at every call site.

- [ ] **Step 1.2: Add `hideFilterBar` prop to AppShell**

Edit `src/features/shared/components/layout/AppShell.tsx`. Add the prop to the interface and condition the `<FilterBar />` render:

```tsx
interface AppShellProps {
  activeTab: TabId;
  onTabChange: (tab: TabId, adminSection?: string) => void;
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;
  isAdmin?: boolean;
  /** When true, the global FilterBar is not rendered. /views/* routes use this. */
  hideFilterBar?: boolean;
  children: React.ReactNode;
}

export default function AppShell({
  activeTab,
  onTabChange,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  isAdmin = false,
  hideFilterBar = false,
  children,
}: AppShellProps) {
  return (
    <div className="fixed inset-0 h-dvh flex flex-col bg-[#FFFCFA] overflow-hidden overscroll-none">
      {!hideFilterBar && <FilterBar activeTab={activeTab} />}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={sidebarCollapsed}
          onCollapsedChange={onSidebarCollapsedChange}
          isAdmin={isAdmin}
        />
        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 1.3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -20
```

Expected: clean exit, or only the pre-existing warnings in `features/rfps/__tests__` and `lib/__tests__/states.test.ts` flagged in the handoff. No new errors.

- [ ] **Step 1.4: Run tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: baseline still green (`2540 passed`).

- [ ] **Step 1.5: Commit**

```bash
git add src/features/shared/components/navigation/Sidebar.tsx src/features/shared/components/layout/AppShell.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "$(cat <<'EOF'
feat(saved-views): widen Sidebar TabId + add AppShell hideFilterBar

Adds a "views" sentinel to Sidebar's local TabId union (no main tab
highlights on /views/* routes) and a hideFilterBar prop to AppShell so
the saved-views layout can mount AppShell without the legacy global
filter chrome.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Grow legacy Sidebar to 252px and host MyViewsSection

**Files:**
- Modify: `src/features/shared/components/navigation/Sidebar.tsx` (top imports, width class, new render block)
- Test: `src/features/shared/components/navigation/__tests__/Sidebar.test.tsx` (new)

- [ ] **Step 2.1: Write the failing test**

Create `src/features/shared/components/navigation/__tests__/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import Sidebar from "../Sidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/leaderboard/components/LeaderboardNavWidget", () => ({
  default: () => <div data-testid="leaderboard-widget" />,
}));
vi.mock("@/features/leaderboard/components/LeaderboardModal", () => ({
  default: () => null,
}));

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe("Sidebar (legacy + MyViewsSection)", () => {
  beforeEach(() => {
    // Empty plans + empty lists → MyViewsSection renders its empty-state CTA.
    fetchMock.mockReset?.();
    global.fetch = vi.fn(async (input: RequestInfo) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/territory-plans")) {
        return new Response(JSON.stringify({ plans: [], hidden: [] }), { status: 200 });
      }
      if (url.includes("/api/lists")) {
        return new Response(JSON.stringify({ lists: [], hidden: [] }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
  });

  it("renders MyViewsSection content when expanded", async () => {
    const Wrapper = makeWrapper();
    render(
      <Sidebar
        activeTab="home"
        onTabChange={vi.fn()}
        collapsed={false}
        onCollapsedChange={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    expect(await screen.findByText(/my views/i)).toBeInTheDocument();
  });

  it("does NOT render MyViewsSection content when collapsed", () => {
    const Wrapper = makeWrapper();
    render(
      <Sidebar
        activeTab="home"
        onTabChange={vi.fn()}
        collapsed={true}
        onCollapsedChange={vi.fn()}
      />,
      { wrapper: Wrapper }
    );
    expect(screen.queryByText(/my views/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2: Run the test — expect FAIL**

```bash
npx vitest run src/features/shared/components/navigation/__tests__/Sidebar.test.tsx 2>&1 | tail -20
```

Expected: 2 tests fail. The first because no `/my views/i` text exists in the current sidebar; the second passes trivially today but will keep passing after the implementation, which is fine.

- [ ] **Step 2.3: Bump expanded width**

Edit `src/features/shared/components/navigation/Sidebar.tsx` line 327:

Replace:

```tsx
${collapsed ? "w-14" : "w-[140px]"}
```

With:

```tsx
${collapsed ? "w-14" : "w-[252px]"}
```

- [ ] **Step 2.4: Import MyViewsSection at the top of Sidebar.tsx**

Add to the import block at the top of `src/features/shared/components/navigation/Sidebar.tsx`:

```tsx
import MyViewsSection from "@/features/views/components/MyViewsSection";
```

- [ ] **Step 2.5: Render MyViewsSection inside the sidebar when expanded**

Edit the JSX inside the `<aside>` in `Sidebar.tsx`. Currently lines 330-337 look like:

```tsx
{/* Main navigation tabs */}
<nav className="flex-1 py-2">
  {MAIN_TABS.map(renderTab)}
</nav>

{/* Admin section (expandable, only for admins) */}
{renderAdminSection()}
```

Change to:

```tsx
{/* Main navigation tabs */}
<nav className="py-2 flex-shrink-0">
  {MAIN_TABS.map(renderTab)}
</nav>

{/* My Views section — hidden when sidebar is collapsed (icon-only mode).
    Owns its own scroll; lives between main tabs and the admin/bottom
    block so the leaderboard + profile stay anchored to the floor. */}
{!collapsed && (
  <div className="flex-1 min-h-0 flex flex-col border-t border-[#E2DEEC] overflow-hidden">
    <MyViewsSection />
  </div>
)}

{/* Admin section (expandable, only for admins) */}
{renderAdminSection()}
```

Two non-obvious changes:
- The main-tabs `<nav>` loses `flex-1` and gains `flex-shrink-0`. With MyViewsSection now taking the growing slot, main tabs render at intrinsic height.
- When `collapsed`, MyViewsSection isn't rendered at all — keeping the main-tabs nav with `flex-shrink-0` means the bottom Leaderboard/Profile block floats to the bottom via `mt-auto` is unneeded because the layout still has `flex flex-col` and now an explicit gap. **Check after step 2.7 that Leaderboard/Profile sit at the bottom when collapsed**; if not, also add `mt-auto` to the `<div className="mx-3 border-t border-[#E2DEEC]" />` divider on line 339 by wrapping it in a container with `mt-auto`. (Re-running the dev server is the fastest visual check.)

- [ ] **Step 2.6: Run the test — expect PASS**

```bash
npx vitest run src/features/shared/components/navigation/__tests__/Sidebar.test.tsx 2>&1 | tail -20
```

Expected: 2 tests pass.

- [ ] **Step 2.7: Visual check in browser**

Open `http://localhost:3005/?tab=home`. Expect:
- Sidebar is 252px wide on desktop, top nav (Home/Map/Plans/etc) visible, My Views section visible below with the empty-state CTA OR real plan/list rows.
- Click the chevron at the bottom — sidebar narrows to 56px, My Views disappears, only icons visible.
- Click chevron again — sidebar expands to 252px, My Views returns.
- Leaderboard widget + Profile + collapse chevron should still pin to the bottom. If they float halfway up the column, return to step 2.5 and add `mt-auto` to the leaderboard/profile container as noted.

- [ ] **Step 2.8: Run full test suite + typecheck**

```bash
npx vitest run 2>&1 | tail -5
npx tsc --noEmit 2>&1 | tail -5
```

Expected: baseline + 2 new tests = 2542 green. Typecheck clean.

- [ ] **Step 2.9: Commit**

```bash
git add src/features/shared/components/navigation/Sidebar.tsx src/features/shared/components/navigation/__tests__/Sidebar.test.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "$(cat <<'EOF'
feat(saved-views): render MyViewsSection inside legacy Sidebar

Bumps expanded width 140 → 252 and renders MyViewsSection between the
main tabs and the admin/leaderboard block when the sidebar is expanded.
Collapsed view (56px) hides the section, matching the user's chosen
collapse behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Rewrite `/views/layout.tsx` to mount AppShell

**Files:**
- Modify: `src/app/views/layout.tsx` (full rewrite)

- [ ] **Step 3.1: Replace `/views/layout.tsx` contents**

Overwrite `src/app/views/layout.tsx` with:

```tsx
/**
 * Layout for the unified My Views feature.
 *
 * Mounts the global AppShell so every /views/* page gets the same legacy
 * sidebar (now hosting MyViewsSection) as the rest of the app. AppShell's
 * hideFilterBar prop suppresses the global FilterBar since /views/* has
 * its own ViewTabsStrip per group.
 *
 * DetailPanel + ListBuilderModal stay mounted at this level because they
 * are route-scoped state surfaces. They render null when their open
 * states are falsy, so the mount is a no-op on the portfolio page.
 */
"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/features/shared/components/layout/AppShell";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useProfile } from "@/features/shared/lib/queries";
import DetailPanel from "@/features/views/components/detail/DetailPanel";
import ListBuilderModal from "@/features/views/components/builder/ListBuilderModal";

export default function ViewsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const sidebarCollapsed = useMapStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useMapStore((s) => s.setSidebarCollapsed);
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  return (
    <AppShell
      // Sentinel — no main tab highlights while on /views/* routes; the
      // MyViewsSection inside the sidebar handles its own active state.
      activeTab={"views" as const}
      onTabChange={(tab) => {
        // Main-tab clicks on /views/* leave the route and rejoin the legacy
        // app at /?tab=<id>. The legacy page reads ?tab= on mount.
        router.push(`/?tab=${tab}`);
      }}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
      isAdmin={isAdmin}
      hideFilterBar
    >
      <Suspense fallback={null}>{children}</Suspense>
      {/* DetailPanel reads ?detail=kind:id and renders null when absent. */}
      <Suspense fallback={null}>
        <DetailPanel />
      </Suspense>
      {/* ListBuilderModal reads useViewsStore.builderOpen and renders null when closed. */}
      <Suspense fallback={null}>
        <ListBuilderModal />
      </Suspense>
    </AppShell>
  );
}
```

Three notable choices:
- `activeTab={"views" as const}` is the sentinel introduced in Task 1.
- `onTabChange` is a thin router.push wrapper, intentionally simpler than `src/app/page.tsx`'s Zustand-driven handler (we're leaving / and there's no view state to preserve).
- The mobile hamburger top bar from the old layout is removed entirely. Mobile users now use the sidebar's chevron to collapse/expand inline.

- [ ] **Step 3.2: Run tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: 2542 passing (Task 2's count), PLUS the `ViewsSidebar.test.tsx` may now fail because its `ViewsSidebar` component is still on disk but no longer mounted by the layout. That's fine — Task 4 deletes the test alongside the component. If it fails here, that's expected.

Capture the exact pass/fail breakdown.

- [ ] **Step 3.3: Smoke-test in browser**

Open `http://localhost:3005/views`. Expect:
- Same 252px sidebar as on `/?tab=home`, with My Views visible and "All plans" highlighted.
- Plan card grid renders in the main column.
- No FilterBar at the top.
- No mobile hamburger.
- Clicking a plan card → URL changes to `/views/plans/<id>/<defaultView>` and the chosen plan row in the sidebar gets the active style.
- Clicking "Home" in the sidebar → URL goes to `/?tab=home`, legacy view renders, Home highlighted.

- [ ] **Step 3.4: Commit**

```bash
git add src/app/views/layout.tsx
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "$(cat <<'EOF'
feat(saved-views): mount AppShell for /views/* routes

Replaces the bespoke /views layout with the global AppShell + a sentinel
"views" activeTab and hideFilterBar=true. DetailPanel and
ListBuilderModal remain mounted at the layout level. Mobile hamburger
removed — the sidebar chevron is now the only mobile pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Delete dead components and tests

**Files:**
- Delete: `src/features/views/components/ViewsSidebar.tsx`
- Delete: `src/features/views/components/SidebarTopNav.tsx`
- Delete: `src/features/views/components/SidebarFooter.tsx`
- Delete: `src/features/views/components/__tests__/ViewsSidebar.test.tsx`

- [ ] **Step 4.1: Confirm nothing else imports the dead files**

```bash
grep -rn 'from.*ViewsSidebar\|from.*SidebarTopNav\|from.*SidebarFooter' src/
```

Expected: empty output (or only references inside the three to-be-deleted files themselves).

If anything else imports them, STOP and report — Task 3 should have severed the last call site. Investigate before continuing.

- [ ] **Step 4.2: Delete the four files**

```bash
rm src/features/views/components/ViewsSidebar.tsx \
   src/features/views/components/SidebarTopNav.tsx \
   src/features/views/components/SidebarFooter.tsx \
   src/features/views/components/__tests__/ViewsSidebar.test.tsx
```

- [ ] **Step 4.3: Run tests + typecheck + build**

```bash
npx vitest run 2>&1 | tail -10
npx tsc --noEmit 2>&1 | tail -10
npm run build 2>&1 | tail -20
```

Expected:
- Vitest: `2542 - 1(ViewsSidebar.test) = 2541` (or whatever Task 2's baseline + 2 - the deleted tests count). Capture exact number.
- Typecheck: no new errors beyond the pre-existing rfps/states warnings.
- Build: clean exit, no missing-module errors.

- [ ] **Step 4.4: Commit**

```bash
git add -A src/features/views/components/
git -c user.email=sierra.arcega@fullmindlearning.com -c user.name=SierraArcega commit -m "$(cat <<'EOF'
chore(saved-views): delete dead ViewsSidebar components

ViewsSidebar, SidebarTopNav, and SidebarFooter are obsolete now that
/views/* mounts the global AppShell. Removes the duplicate test alongside.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Final verification

- [ ] **Step 5.1: Full test run**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all green. Note the final count.

- [ ] **Step 5.2: Full build**

```bash
npm run build 2>&1 | tail -10
```

Expected: clean exit.

- [ ] **Step 5.3: Manual smoke test checklist**

Walk through these in the running dev server (port 3005):

1. `http://localhost:3005/?tab=home` — sidebar 252px, Home highlighted, My Views visible with real plan/list rows.
2. Click "Map" in sidebar — `/?tab=map` loads, Map tab highlighted, map renders, My Views still visible in sidebar.
3. Click a plan row in My Views (still on `/?tab=map`) — navigates to `/views/plans/<id>/<defaultView>`. No main tab highlighted, the plan row in My Views shows active state.
4. Click a view tab inside the group canvas (Table, Kanban, etc) — URL updates to the new viewId; group canvas re-renders.
5. Click "Home" in the sidebar from the views route — `/?tab=home` loads, Home highlighted.
6. From `/?tab=home`, click the chevron at the bottom of the sidebar — sidebar collapses to 56px, My Views disappears, only icon column remains. Leaderboard widget + Profile sit at the bottom.
7. Click chevron again — expands back to 252px, My Views returns.
8. Open `http://localhost:3005/views` directly — portfolio loads with sidebar.
9. Resize window to <768px (or open responsive design mode) — sidebar auto-collapses on first load. Manual chevron expand still works.
10. On `/views/plans/<id>/<view>`, click any row — DetailPanel slides in from the right (still works post-relocation).
11. Click `+` next to Lists OR the empty-state CTA → ListBuilderModal opens.
12. Reload on `/views/plans/<id>/<view>` — page renders directly without redirect loops.
13. `/?tab=plans` (legacy PlansView) still renders unchanged.

Document any deviations or visual regressions inline before continuing.

- [ ] **Step 5.4: Done**

If all 13 smoke-test items pass, the relocation is shipped. Notify the user and ask which item to tackle next from the smoke-test backlog (NewsView click fix, off-token colors, etc.).

---

## Rollback

If anything goes catastrophically wrong, the 4 feature commits are linear and revertable:

```bash
git log --oneline | head -5
# Find the SHA *before* the Task 1 commit, e.g. dff38fa0 (spec commit).
git reset --hard <pre-task-1-sha>
```

Or revert individual commits:

```bash
git revert <task-n-sha>
```

Tasks 1–4 are designed to be revert-safe individually; reverting Task 3 alone returns /views/* to the old bespoke layout, leaving the Sidebar widening (Task 2) intact and harmless.

---

## Self-review notes (already addressed inline)

- Spec coverage: every spec section maps to a task — Sidebar width + MyViewsSection (T2), AppShell hideFilterBar + TabId widening (T1), /views layout rewrite (T3), file deletions (T4), mobile pattern decision documented in the spec (no code task needed; emerging from T3's deletion of the hamburger top bar).
- Placeholder scan: clean.
- Type consistency: `TabId` in `Sidebar.tsx` is widened to include `"views"`; `app-store.ts`'s narrower `TabId` is type-compatible at every call site (subset assignability). `AppShell`'s `activeTab: TabId` references Sidebar's TabId via the existing `import { TabId } from "@/features/shared/components/navigation/Sidebar"`.
