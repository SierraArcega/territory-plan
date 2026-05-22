# Table Row Actions Menu — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trailing kebab (`⋯`) menu to each row of the plan-districts Table view exposing four inline actions — Log activity, Set targets, Create opportunity (LMS click-out), and Remove from plan.

**Architecture:** A new `RowActionsMenu` component renders a kebab button whose dropdown is portaled to `document.body` (so it escapes the table's `overflow:auto` clip). `GridView` renders it in a trailing actions cell, gated to `parentKind === "plan" && source === "districts"`. Actions reuse existing mutations (`useUpdateDistrictTargets`, `useRemoveDistrictFromPlan`, `useCreateActivity`) and invalidate the `["views","data"]` query so the grid refreshes. The "Add note" item and the District Notes Log inline cell are a **separate plan** (`2026-05-22-district-notes-log-phase1.md`).

**Tech Stack:** React 19, Next 16 App Router, TanStack Query v5, Tailwind 4, Lucide icons, Vitest + Testing Library + jsdom. No new dependencies.

**Source spec:** `Docs/superpowers/specs/2026-05-22-table-row-actions-design.md`

---

## Context the executor needs

**Worktree (shared branch — read before write):** This work happens in
`/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar` on branch
`worktree-saved-views-sidebar`. **Multiple Claude sessions commit here.** Before editing a
shared file (`GridView.tsx`), re-read it fresh — another session may have changed it. **Stage
only the exact files each commit touches — never `git add -A` / `git add .`.**

**Key existing code:**
- `src/features/views/components/grid/GridView.tsx` — the shared table. Rows carry
  `data-row-kind`/`data-row-id`; clicking a row opens the detail panel via event delegation in
  `GroupCanvas` (`src/features/views/components/GroupCanvas.tsx:155-175`). That delegation
  **ignores clicks on `a, button, input, select, textarea`** — so a `<button>` kebab and
  `<button>` menu items will NOT trigger detail navigation. No extra `stopPropagation` needed,
  but the portaled menu lives outside the row in the DOM anyway.
- `useRemoveDistrictFromPlan()` — `src/features/plans/lib/queries.ts`. Vars `{ planId, leaid }`,
  DELETEs `/api/territory-plans/{planId}/districts/{leaid}`. **Does NOT invalidate the views
  grid query** — we add that ourselves.
- `useUpdateDistrictTargets()` — `src/features/plans/lib/queries.ts`. Vars
  `{ planId, leaid, renewalTarget?, winbackTarget?, expansionTarget?, newBusinessTarget? }`
  (each `number | null`), PUTs the same route.
- `useCreateActivity()` — `src/features/activities/lib/queries.ts`. `.mutateAsync(formData)`.
- `ActivityFormModal` (default export) + `type ActivityFormData` —
  `src/features/plans/components/ActivityFormModal.tsx`. Props:
  `{ isOpen, onClose, onSubmit, districts: {leaid,name}[], contacts?: Contact[], initialData?, title? }`.
  Usage reference: `src/features/plans/components/ActivitiesPanel.tsx:274-291`.
- GET `/api/territory-plans/{planId}/districts/{leaid}` returns the plan-district detail
  including `renewalTarget`, `winbackTarget`, `expansionTarget`, `newBusinessTarget`
  (`number | null`).
- The grid data query lives in `useViewsData` (`src/features/views/hooks/useViewsData.ts`),
  query key prefixed `["views", "data", ...]`. Invalidate with
  `queryClient.invalidateQueries({ queryKey: ["views", "data"] })`.
- The districts grid does **not** expose the four individual targets per row (only a summed
  `target`), so Set-targets fetches current values lazily on open.

**Test idiom (house style — see `views/components/views/__tests__/PlanMapSelectionBar.test.tsx`):**
wrap in a `QueryClientProvider` with `retry:false`; stub the network with
`vi.stubGlobal("fetch", vi.fn(...))` returning `new Response(JSON.stringify(...), { status, headers: { "Content-Type": "application/json" } })`; assert on `fetchMock.mock.calls`. Mutations
call `fetchJson` → global `fetch`, so stubbing fetch exercises the real hooks.

**Run a single test file:** `npx vitest run <path>`

---

## File structure

- Create: `src/features/views/components/grid/actions/RowActionsMenu.tsx` — kebab + portaled
  dropdown; owns which action surface is open; wires all four actions.
- Create: `src/features/views/components/grid/actions/SetTargetsPopover.tsx` — 4-field targets
  editor.
- Create: `src/features/views/components/grid/actions/lms.ts` — LMS opportunity URL builder.
- Create tests under `src/features/views/components/grid/actions/__tests__/`.
- Modify: `src/features/views/components/grid/GridView.tsx` — add the gated trailing actions
  column (header cell + both body-row render paths + `colCount`).

---

## Task 1: RowActionsMenu shell (kebab + portaled dropdown + items)

**Files:**
- Create: `src/features/views/components/grid/actions/RowActionsMenu.tsx`
- Test: `src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/RowActionsMenu.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RowActionsMenu } from "../RowActionsMenu";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const props = { planId: "plan-1", leaid: "0601234", districtName: "Tedesco USD" };

describe("RowActionsMenu", () => {
  it("renders a kebab button and no menu by default", () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    expect(screen.getByRole("button", { name: /actions for tedesco usd/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });

  it("opens a menu with the four actions on click", () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
    expect(screen.getByRole("menuitem", { name: /log activity/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /set targets/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /create opportunity/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remove from plan/i })).toBeInTheDocument();
  });

  it("closes the menu on Escape", () => {
    render(<RowActionsMenu {...props} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`
Expected: FAIL — cannot resolve `../RowActionsMenu`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// RowActionsMenu.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreHorizontal, Pencil, Target, Briefcase, X,
} from "lucide-react";

interface Props {
  planId: string;
  leaid: string;
  districtName: string;
}

type Surface = null | "targets" | "remove" | "activity";

export function RowActionsMenu({ planId, leaid, districtName }: Props) {
  const [open, setOpen] = useState(false);
  const [, setSurface] = useState<Surface>(null); // surfaces wired in later tasks
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.right - 220 });
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#403770] hover:bg-[#F7F5FA]";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${districtName}`}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-[#544A78] hover:bg-[#F7F5FA]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 220 }}
            className="z-50 rounded-xl border border-[#E2DEEC] bg-white p-1.5 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
          >
            <button type="button" role="menuitem" className={item}
              onClick={() => { setSurface("activity"); setOpen(false); }}>
              <Pencil className="h-3.5 w-3.5 opacity-70" /> Log activity
            </button>
            <button type="button" role="menuitem" className={item}
              onClick={() => { setSurface("targets"); setOpen(false); }}>
              <Target className="h-3.5 w-3.5 opacity-70" /> Set targets
            </button>
            <button type="button" role="menuitem" className={item}
              onClick={() => setOpen(false)}>
              <Briefcase className="h-3.5 w-3.5 opacity-70" /> Create opportunity
              <span className="ml-auto text-[10px] text-[#A69DC0]">↗ LMS</span>
            </button>
            <div className="my-1 h-px bg-[#EFEDF5]" />
            <button type="button" role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#C2410C] hover:bg-[#FFF1EA]"
              onClick={() => { setSurface("remove"); setOpen(false); }}>
              <X className="h-3.5 w-3.5 opacity-80" /> Remove from plan
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx
git commit -m "feat(views): row actions kebab menu shell"
```

---

## Task 2: Remove from plan (inline confirm + DELETE + grid invalidation)

**Files:**
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx`
- Test: `src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`

- [ ] **Step 1: Add the failing test** (append inside the `describe`)

```tsx
import { vi, waitFor } from "vitest"; // add vi, waitFor to imports

it("removes the district after a two-step confirm and invalidates the grid", async () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    })));
  vi.stubGlobal("fetch", fetchMock);

  render(<RowActionsMenu {...props} />, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /remove from plan/i }));
  // First click reveals confirm; network not yet hit.
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toContain("/territory-plans/plan-1/districts/0601234");
  expect((init as RequestInit).method).toBe("DELETE");
  vi.unstubAllGlobals();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run .../RowActionsMenu.test.tsx`
Expected: FAIL — no "Remove" confirm button appears.

- [ ] **Step 3: Implement** — in `RowActionsMenu.tsx`:

Add imports and hooks at top of the component body:

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useRemoveDistrictFromPlan } from "@/features/plans/lib/queries";
```

```tsx
  const queryClient = useQueryClient();
  const removeMutation = useRemoveDistrictFromPlan();
```

Change the surface state to drive a confirm dialog. Replace the Remove `menuitem`'s
`onClick` with `() => { setSurface("remove"); setOpen(false); }` (already set) and render a
confirm popover (portaled, same positioning) when `surface === "remove"`:

```tsx
{surface === "remove" &&
  createPortal(
    <div
      role="dialog"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 240 }}
      className="z-50 rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
    >
      <p className="m-0 mb-2.5 text-[13px] text-[#403770]">
        Remove <b>{districtName}</b> from this plan?
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className="rounded-md border border-[#E2DEEC] px-3 py-1.5 text-[12px] text-[#544A78]"
          onClick={() => setSurface(null)}>Cancel</button>
        <button type="button" disabled={removeMutation.isPending}
          className="rounded-md bg-[#C2410C] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
          onClick={() => {
            removeMutation.mutate(
              { planId, leaid },
              { onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ["views", "data"] });
                  setSurface(null);
                } },
            );
          }}>
          {removeMutation.isPending ? "Removing…" : "Remove"}
        </button>
      </div>
    </div>,
    document.body,
  )}
```

Make `surface`/`setSurface` actually used (remove the throwaway `,` destructure from Task 1:
`const [surface, setSurface] = useState<Surface>(null);`).

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run .../RowActionsMenu.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx
git commit -m "feat(views): row action — remove district from plan"
```

---

## Task 3: Set targets popover (lazy GET prefill + PUT save + invalidation)

**Files:**
- Create: `src/features/views/components/grid/actions/SetTargetsPopover.tsx`
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx`
- Test: `src/features/views/components/grid/actions/__tests__/SetTargetsPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/SetTargetsPopover.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach, waitFor } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SetTargetsPopover } from "../SetTargetsPopover";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const detail = {
  renewalTarget: 24000, expansionTarget: 12000,
  winbackTarget: null, newBusinessTarget: 12000,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
    if (!init || init.method === "GET" || init.method === undefined) {
      return Promise.resolve(new Response(JSON.stringify(detail), {
        status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ ...detail }), {
      status: 200, headers: { "Content-Type": "application/json" } }));
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("SetTargetsPopover", () => {
  it("prefills the four targets from the GET", async () => {
    render(<SetTargetsPopover planId="plan-1" leaid="0601234" districtName="Tedesco USD"
      anchor={{ top: 0, left: 0 }} onClose={() => {}} />, { wrapper });
    expect(await screen.findByDisplayValue("24000")).toBeInTheDocument();
    expect(screen.getByLabelText(/winback/i)).toHaveValue(""); // null → blank
  });

  it("saves all four fields via PUT (blank → null)", async () => {
    const onClose = vi.fn();
    render(<SetTargetsPopover planId="plan-1" leaid="0601234" districtName="Tedesco USD"
      anchor={{ top: 0, left: 0 }} onClose={onClose} />, { wrapper });
    await screen.findByDisplayValue("24000");
    fireEvent.change(screen.getByLabelText(/winback/i), { target: { value: "5,000" } });
    fireEvent.click(screen.getByRole("button", { name: /save targets/i }));

    await waitFor(() => {
      const putCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => c[1]?.method === "PUT");
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall[1].body));
      expect(body).toMatchObject({
        renewalTarget: 24000, expansionTarget: 12000,
        winbackTarget: 5000, newBusinessTarget: 12000,
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run .../SetTargetsPopover.test.tsx`
Expected: FAIL — cannot resolve `../SetTargetsPopover`.

- [ ] **Step 3: Implement**

```tsx
// SetTargetsPopover.tsx
"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";

interface Detail {
  renewalTarget: number | null; expansionTarget: number | null;
  winbackTarget: number | null; newBusinessTarget: number | null;
}
type Field = keyof Detail;
const FIELDS: { field: Field; label: string }[] = [
  { field: "renewalTarget", label: "Renewal" },
  { field: "expansionTarget", label: "Expansion" },
  { field: "winbackTarget", label: "Winback" },
  { field: "newBusinessTarget", label: "New business" },
];

function parseCurrency(v: string): number | null {
  const cleaned = v.replace(/[,$\s]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

interface Props {
  planId: string; leaid: string; districtName: string;
  anchor: { top: number; left: number };
  onClose: () => void;
}

export function SetTargetsPopover({ planId, leaid, districtName, anchor, onClose }: Props) {
  const queryClient = useQueryClient();
  const update = useUpdateDistrictTargets();
  const q = useQuery({
    queryKey: ["planDistrict", planId, leaid],
    queryFn: () =>
      fetchJson<Detail>(`${API_BASE}/territory-plans/${planId}/districts/${leaid}`),
  });

  const [vals, setVals] = useState<Record<Field, string>>({
    renewalTarget: "", expansionTarget: "", winbackTarget: "", newBusinessTarget: "",
  });

  useEffect(() => {
    if (!q.data) return;
    setVals({
      renewalTarget: q.data.renewalTarget != null ? String(q.data.renewalTarget) : "",
      expansionTarget: q.data.expansionTarget != null ? String(q.data.expansionTarget) : "",
      winbackTarget: q.data.winbackTarget != null ? String(q.data.winbackTarget) : "",
      newBusinessTarget: q.data.newBusinessTarget != null ? String(q.data.newBusinessTarget) : "",
    });
  }, [q.data]);

  function save() {
    update.mutate(
      {
        planId, leaid,
        renewalTarget: parseCurrency(vals.renewalTarget),
        expansionTarget: parseCurrency(vals.expansionTarget),
        winbackTarget: parseCurrency(vals.winbackTarget),
        newBusinessTarget: parseCurrency(vals.newBusinessTarget),
      },
      { onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["views", "data"] });
          onClose();
        } },
    );
  }

  return createPortal(
    <div role="dialog" aria-label={`Set targets for ${districtName}`}
      style={{ position: "fixed", top: anchor.top, left: anchor.left, width: 300 }}
      className="z-50 rounded-xl border border-[#E2DEEC] bg-white p-3.5 shadow-[0_10px_30px_rgba(64,55,112,0.18)]">
      <h4 className="m-0 mb-0.5 text-[13px] font-bold text-[#403770]">
        Set targets · {districtName}
      </h4>
      <p className="m-0 mb-3 text-[11px] text-[#8A80A8]">Enter any FY revenue target. Blank = unset.</p>
      <div className="grid grid-cols-2 gap-2">
        {FIELDS.map(({ field, label }) => (
          <label key={field} className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.05em] text-[#8A80A8]">{label}</span>
            <input
              aria-label={label}
              value={vals[field]}
              onChange={(e) => setVals((p) => ({ ...p, [field]: e.target.value }))}
              placeholder="—"
              inputMode="numeric"
              className="w-full rounded-lg border border-[#E2DEEC] bg-[#FFFCFA] px-2.5 py-2 text-[13px] text-[#403770]"
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className="rounded-lg border border-[#E2DEEC] px-3.5 py-1.5 text-[12px] font-semibold text-[#544A78]">Cancel</button>
        <button type="button" onClick={save} disabled={update.isPending || q.isLoading}
          className="rounded-lg bg-[#403770] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60">
          {update.isPending ? "Saving…" : "Save targets"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
```

Wire it into `RowActionsMenu.tsx`: import `SetTargetsPopover`; when `surface === "targets"`,
render `<SetTargetsPopover planId={planId} leaid={leaid} districtName={districtName} anchor={pos} onClose={() => setSurface(null)} />`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run .../SetTargetsPopover.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/SetTargetsPopover.tsx \
        src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/SetTargetsPopover.test.tsx
git commit -m "feat(views): row action — set district targets"
```

---

## Task 4: Create opportunity (LMS click-out)

**Files:**
- Create: `src/features/views/components/grid/actions/lms.ts`
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx`
- Test: `src/features/views/components/grid/actions/__tests__/lms.test.ts`

LMS has no in-app opp creation and no confirmed district-scoping param today, so v1 opens the
generic LMS opportunity board for the current school year (derived from the date). The
district's account id is accepted as an argument and appended as a comment-marked param hook
for the future, but not sent unless `LMS_SUPPORTS_ACCOUNT_PARAM` is true (currently false).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lms.test.ts
import { describe, it, expect } from "vitest";
import { lmsOpportunityUrl, schoolYearFor } from "../lms";

describe("lms opportunity url", () => {
  it("derives the school year from a date (>= July rolls forward)", () => {
    expect(schoolYearFor(new Date("2026-05-22"))).toBe("2025-26");
    expect(schoolYearFor(new Date("2026-08-01"))).toBe("2026-27");
  });
  it("builds the generic board url with the school year", () => {
    const url = lmsOpportunityUrl({ now: new Date("2026-05-22") });
    expect(url).toBe("https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/views/components/grid/actions/__tests__/lms.test.ts`
Expected: FAIL — cannot resolve `../lms`.

- [ ] **Step 3: Implement**

```ts
// lms.ts
const LMS_BASE = "https://lms.fullmindlearning.com/opportunities/kanban";

/** K-12 school year string like "2025-26"; rolls to the next year in July+. */
export function schoolYearFor(now: Date): string {
  const m = now.getMonth(); // 0=Jan
  const start = m >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

/**
 * URL for creating/finding an opportunity in the external LMS. District scoping
 * awaits a confirmed LMS account param; until then we open the generic board for
 * the current school year. `accountLmsId` is accepted for the future enhancement.
 */
export function lmsOpportunityUrl(opts: { now?: Date; accountLmsId?: string | null } = {}): string {
  const now = opts.now ?? new Date();
  const params = new URLSearchParams({ school_year: schoolYearFor(now) });
  // Future: if LMS adds an account filter param, append it from opts.accountLmsId here.
  return `${LMS_BASE}?${params.toString()}`;
}
```

Wire into `RowActionsMenu.tsx`: import `lmsOpportunityUrl`; the "Create opportunity" item's
`onClick` becomes
`() => { window.open(lmsOpportunityUrl(), "_blank", "noopener,noreferrer"); setOpen(false); }`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/views/components/grid/actions/__tests__/lms.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/lms.ts \
        src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/lms.test.ts
git commit -m "feat(views): row action — create opportunity LMS click-out"
```

---

## Task 5: Log activity (ActivityFormModal, district preselected)

**Files:**
- Modify: `src/features/views/components/grid/actions/RowActionsMenu.tsx`
- Test: `src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx`

v1 simplification: pass `contacts={[]}` (the modal's contact link is optional). Prefilling the
district's contacts is a fast-follow.

- [ ] **Step 1: Add the failing test** (append inside the `describe`)

```tsx
it("opens the activity modal with the district preselected", () => {
  render(<RowActionsMenu {...props} />, { wrapper });
  fireEvent.click(screen.getByRole("button", { name: /actions for tedesco usd/i }));
  fireEvent.click(screen.getByRole("menuitem", { name: /log activity/i }));
  // ActivityFormModal renders a dialog; the district name appears as the preselected option.
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getAllByText(/tedesco usd/i).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run .../RowActionsMenu.test.tsx`
Expected: FAIL — no dialog opens on "Log activity".

- [ ] **Step 3: Implement** — in `RowActionsMenu.tsx`:

```tsx
import ActivityFormModal, { type ActivityFormData } from "@/features/plans/components/ActivityFormModal";
import { useCreateActivity } from "@/features/activities/lib/queries";
```

```tsx
  const createActivity = useCreateActivity();

  async function handleCreateActivity(data: ActivityFormData) {
    await createActivity.mutateAsync(data);
    queryClient.invalidateQueries({ queryKey: ["views", "data"] });
    setSurface(null);
  }
```

When `surface === "activity"`:

```tsx
{surface === "activity" && (
  <ActivityFormModal
    isOpen
    onClose={() => setSurface(null)}
    onSubmit={handleCreateActivity}
    districts={[{ leaid, name: districtName }]}
    contacts={[]}
    title={`Log activity · ${districtName}`}
  />
)}
```

> If `ActivityFormData` requires fields the modal does not collect, read
> `src/features/plans/components/ActivitiesPanel.tsx` `handleCreateActivity` for the exact
> mapping and mirror it. If the `districts` option objects need more than `{ leaid, name }`,
> read the `DistrictOption` interface at the top of `ActivityFormModal.tsx` and supply those
> fields.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run .../RowActionsMenu.test.tsx`
Expected: PASS (all RowActionsMenu tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/RowActionsMenu.tsx \
        src/features/views/components/grid/actions/__tests__/RowActionsMenu.test.tsx
git commit -m "feat(views): row action — log activity"
```

---

## Task 6: Mount the actions column in GridView (gated)

**Files:**
- Modify: `src/features/views/components/grid/GridView.tsx`
- Test: `src/features/views/components/grid/__tests__/GridView.rowactions.test.tsx`

**Re-read `GridView.tsx` before editing — shared file on a shared branch.**

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/GridView.rowactions.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GridView from "../GridView";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const layout: GridViewLayout = { columns: [], sort: [], filters: { kind: "and", children: [] } };
const rows = [{ leaid: "0601234", name: "Tedesco USD" }];

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ rows, total: 1 }), {
      status: 200, headers: { "Content-Type": "application/json" } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("GridView row actions column", () => {
  it("shows the kebab for plan + districts", async () => {
    render(<GridView source="districts" leaids={["0601234"]} listId={null}
      parentKind="plan" parentId="plan-1" viewType="table" layout={layout} onLayoutChange={() => {}} />,
      { wrapper });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /actions for tedesco usd/i })).toBeInTheDocument());
  });

  it("hides the kebab for a list scope", async () => {
    render(<GridView source="districts" leaids={["0601234"]} listId={null}
      parentKind="list" parentId="list-1" viewType="table" layout={layout} onLayoutChange={() => {}} />,
      { wrapper });
    await waitFor(() => expect(screen.getByText("Tedesco USD")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /actions for/i })).not.toBeInTheDocument();
  });
});
```

> Confirm the default districts layout makes a `name`-bearing column visible so "Tedesco USD"
> renders; if not, add a `name` column entry to `layout.columns` in the test.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridView.rowactions.test.tsx`
Expected: FAIL — no "actions for" button rendered.

- [ ] **Step 3: Implement** — edit `GridView.tsx`:

a) Import at top:
```tsx
import { RowActionsMenu } from "./actions/RowActionsMenu";
```

b) After `planId` is computed (around line 197), add:
```tsx
  const showRowActions = parentKind === "plan" && source === "districts" && planId != null;
```

c) Update `colCount` (line ~379):
```tsx
  const colCount = visibleCols.length + 1 + (showRowActions ? 1 : 0);
```

d) In **both** body-row render paths (the ungrouped map ~line 388 and the grouped map ~line 477),
insert an actions `<td>` immediately before the existing `<td aria-hidden ... />` spacer:
```tsx
{showRowActions && (
  <td className="border-b border-[#EFEDF5] px-2 py-1.5 text-right whitespace-nowrap">
    <RowActionsMenu
      planId={planId!}
      leaid={String(original.leaid ?? "")}
      districtName={String(original.name ?? "")}
    />
  </td>
)}
```
(`original` is already in scope in both maps as `row.original`.)

e) In the column header row (~line 609, before the `width:100%` spacer `<th>`), insert:
```tsx
{showRowActions && (
  <th aria-hidden className="border-b border-[#D4CFE2] bg-[#F7F5FA]" />
)}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/features/views/components/grid/__tests__/GridView.rowactions.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full grid + actions suites to catch regressions**

Run: `npx vitest run src/features/views/components/grid`
Expected: PASS (existing GridView tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx \
        src/features/views/components/grid/__tests__/GridView.rowactions.test.tsx
git commit -m "feat(views): mount row actions column in plan-districts table"
```

---

## Final verification

- [ ] Run the whole views feature suite: `npx vitest run src/features/views`
- [ ] Manual smoke (`npm run dev`, port 3005): open a plan's Table view → kebab on a row →
  exercise Set targets (saves, grid refreshes), Remove (confirm, row disappears), Create
  opportunity (LMS tab opens), Log activity (modal opens with district preselected). Verify the
  kebab is **absent** in a List's table.
- [ ] Mobile check per CLAUDE.md: kebab tappable; popovers scroll-safe on iPhone Safari.

## Out of scope (separate plan)

"Add note" and the inline District Notes Log cell are implemented in
`Docs/superpowers/plans/2026-05-22-district-notes-log-phase1.md` (TipTap composer, popover,
`DistrictNotesCell` replacing `PlanNotesCell`, CRUD hooks, latest-note backend field). When
that lands, add an "Add note" `menuitem` to `RowActionsMenu` (position 2) opening the notes
popover.
