# Opportunity Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the district-based Kanban view with a read-only board of the plan's opportunities, bucketed into the real Salesforce opportunity stages (funnel 0–5 + Closed Won / Closed Lost).

**Architecture:** A new column registry (`opp-stage-columns.ts`) defines the eight ordered stage columns. A new query-param endpoint (`GET /api/views/opps-kanban`) groups opps by stage server-side and returns per-column cards (capped at 50), true counts, and summed bookings. `KanbanView.tsx` is rewritten to consume it; `GroupCanvas` passes the plan's fiscal year so the view derives the school-year scope. Cards open the existing opp detail panel via the `[data-row-kind][data-row-id]` delegation already wired in `GroupCanvas` — no drag-to-move (opps are a read-only Salesforce mirror).

**Tech Stack:** Next.js App Router route handler, `readonlyPool` (pg) for SQL, TanStack Query + `fetchJson` on the client, Vitest + Testing Library for tests.

**Spec:** `docs/superpowers/specs/2026-05-21-opportunity-kanban-design.md`

**Worktree:** `/Users/sierraarcega/territory-plan/.claude/worktrees/saved-views-sidebar/` (branch `worktree-saved-views-sidebar`). All paths below are relative to it.

---

## File Structure

- **Create** `src/features/views/lib/opp-stage-columns.ts` — the eight-column registry + `columnForStage` + `OPP_KANBAN_STAGES` allowlist. One responsibility: the stage→column mapping shared by the route (SQL allowlist) and the client (accents/order).
- **Create** `src/features/views/lib/__tests__/opp-stage-columns.test.ts` — registry/order/matching unit tests.
- **Create** `src/app/api/views/opps-kanban/route.ts` — the data endpoint (auth, scope, grouping, totals).
- **Create** `src/app/api/views/opps-kanban/__tests__/route.test.ts` — route unit tests (mocked `getUser` + `readonlyPool`).
- **Rewrite** `src/features/views/components/views/KanbanView.tsx` — opp board UI consuming the endpoint.
- **Create** `src/features/views/components/views/__tests__/KanbanView.test.tsx` — component tests (mocked `fetchJson`).
- **Modify** `src/features/views/components/GroupCanvas.tsx` — pass `fiscalYear={plan?.fiscalYear ?? null}` to `KanbanView` in the `case "kanban"` branch.

---

## Task 1: Opportunity stage column registry

**Files:**
- Create: `src/features/views/lib/opp-stage-columns.ts`
- Test: `src/features/views/lib/__tests__/opp-stage-columns.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/lib/__tests__/opp-stage-columns.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  OPP_STAGE_COLUMNS,
  OPP_KANBAN_STAGES,
  columnForStage,
} from "../opp-stage-columns";

describe("OPP_STAGE_COLUMNS", () => {
  it("has eight columns in funnel order ending with the closed outcomes", () => {
    expect(OPP_STAGE_COLUMNS.map((c) => c.id)).toEqual([
      "meeting_booked",
      "discovery",
      "presentation",
      "proposal",
      "negotiation",
      "commitment",
      "closed_won",
      "closed_lost",
    ]);
  });

  it("gives every column a label, exact stage string, and accent hex", () => {
    for (const c of OPP_STAGE_COLUMNS) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.stage.length).toBeGreaterThan(0);
      expect(c.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("OPP_KANBAN_STAGES", () => {
  it("is the eight matched stage strings for the SQL allowlist", () => {
    expect(OPP_KANBAN_STAGES).toHaveLength(8);
    expect(OPP_KANBAN_STAGES).toContain("0 - Meeting Booked");
    expect(OPP_KANBAN_STAGES).toContain("5 - Commitment");
    expect(OPP_KANBAN_STAGES).toContain("Closed Won");
    expect(OPP_KANBAN_STAGES).toContain("Closed Lost");
  });
});

describe("columnForStage", () => {
  it("maps a known stage string to its column", () => {
    expect(columnForStage("1 - Discovery")?.id).toBe("discovery");
    expect(columnForStage("Closed Lost")?.id).toBe("closed_lost");
  });

  it("returns undefined for excluded / unknown / null stages", () => {
    expect(columnForStage("Position Purchased")).toBeUndefined();
    expect(columnForStage("Active")).toBeUndefined();
    expect(columnForStage(null)).toBeUndefined();
    expect(columnForStage(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/views/lib/__tests__/opp-stage-columns.test.ts`
Expected: FAIL — cannot resolve `../opp-stage-columns` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `src/features/views/lib/opp-stage-columns.ts`:

```ts
/**
 * Column registry for the opportunity Kanban board.
 *
 * Columns are the real Salesforce opportunity stages (numbered funnel + the two
 * closed outcomes). Matching is exact string equality on `opportunities.stage`;
 * any stage outside this set (staffing "Position …" stages, "Complete …",
 * "Active", null) is intentionally excluded from the board.
 *
 * Accent hexes are drawn from the Fullmind brand palette already used across the
 * views feature (see detail/atoms STAGE_PILL and tokens.md). Funnel hues
 * progress cool→warm; Closed Won is green, Closed Lost is coral.
 */
export interface OppStageColumn {
  /** Stable column id (also the React key and the response column id). */
  id: string;
  /** Header label. */
  label: string;
  /** Exact `opportunities.stage` value this column matches. */
  stage: string;
  /** Accent hex for the header bar + card signal dot. */
  accent: string;
}

export const OPP_STAGE_COLUMNS: readonly OppStageColumn[] = [
  { id: "meeting_booked", label: "Meeting Booked", stage: "0 - Meeting Booked", accent: "#A69DC0" },
  { id: "discovery",      label: "Discovery",      stage: "1 - Discovery",      accent: "#6EA3BE" },
  { id: "presentation",   label: "Presentation",   stage: "2 - Presentation",   accent: "#6E5FA8" },
  { id: "proposal",       label: "Proposal",       stage: "3 - Proposal",       accent: "#E0A93B" },
  { id: "negotiation",    label: "Negotiation",    stage: "4 - Negotiation",    accent: "#D98C4A" },
  { id: "commitment",     label: "Commitment",     stage: "5 - Commitment",     accent: "#C58BB0" },
  { id: "closed_won",     label: "Closed Won",     stage: "Closed Won",         accent: "#69B34A" },
  { id: "closed_lost",    label: "Closed Lost",    stage: "Closed Lost",        accent: "#F37167" },
] as const;

/** The eight matched stage strings — used as the SQL `stage = ANY($)` allowlist. */
export const OPP_KANBAN_STAGES: readonly string[] = OPP_STAGE_COLUMNS.map((c) => c.stage);

/** Look up the column a raw stage string belongs to, or undefined if excluded. */
export function columnForStage(
  stage: string | null | undefined,
): OppStageColumn | undefined {
  if (!stage) return undefined;
  return OPP_STAGE_COLUMNS.find((c) => c.stage === stage);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/views/lib/__tests__/opp-stage-columns.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/features/views/lib/opp-stage-columns.ts src/features/views/lib/__tests__/opp-stage-columns.test.ts
git commit -m "feat(views): opportunity kanban stage-column registry"
```

---

## Task 2: `GET /api/views/opps-kanban` endpoint

**Files:**
- Create: `src/app/api/views/opps-kanban/route.ts`
- Test: `src/app/api/views/opps-kanban/__tests__/route.test.ts`

Mirrors the auth + `readonlyPool` patterns in `src/app/api/views/enum-values/route.ts`. Runs two queries: an aggregate (`GROUP BY stage`) for the true per-stage count + summed bookings, and a window-function query that returns at most `limit` cards per stage.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/views/opps-kanban/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: (...args: unknown[]) => mockQuery(...args),
  },
}));

import { GET } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/views/opps-kanban — auth & validation", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=l1&schoolYr=2025-26"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when schoolYr is missing", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=l1"));
    expect(res.status).toBe(400);
  });

  it("short-circuits to eight zeroed columns and no DB call when leaids is empty", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=&schoolYr=2025-26"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.columns).toHaveLength(8);
    expect(data.columns.every((c: { count: number }) => c.count === 0)).toBe(true);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("GET /api/views/opps-kanban — grouping", () => {
  it("groups cards into columns with true counts/totals and hasMore", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // First call: aggregate. Second call: cards.
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { stage: "1 - Discovery", count: "3", total: "175000" },
          { stage: "2 - Presentation", count: "1", total: "90000" },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "opp-1", stage: "1 - Discovery", name: "Acme Renewal",
            district_name: "Acme District", contract_type: "Tier 1",
            net_booking_amount: "45000", minimum_purchase_amount: "20000",
            maximum_budget: null, close_date: "2026-06-01T00:00:00.000Z",
            sales_rep_name: "Alice Smith",
          },
          {
            id: "opp-2", stage: "2 - Presentation", name: "Beta Expansion",
            district_name: "Beta School", contract_type: null,
            net_booking_amount: "90000", minimum_purchase_amount: "30000",
            maximum_budget: "120000", close_date: null, sales_rep_name: null,
          },
        ],
      });

    const res = await GET(
      makeRequest("/api/views/opps-kanban?leaids=l1,l2&schoolYr=2025-26&limit=50"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.schoolYr).toBe("2025-26");
    expect(data.columns).toHaveLength(8);

    const discovery = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(discovery.count).toBe(3);
    expect(discovery.totalBookings).toBe(175000);
    expect(discovery.cards).toHaveLength(1);
    expect(discovery.cards[0]).toMatchObject({
      id: "opp-1",
      name: "Acme Renewal",
      districtName: "Acme District",
      contractType: "Tier 1",
      netBookingAmount: 45000,
      minimumPurchaseAmount: 20000,
      maximumBudget: null,
      salesRepName: "Alice Smith",
    });
    expect(discovery.cards[0].closeDate).toContain("2026-06-01");
    // 3 in stage, 1 card returned → hasMore
    expect(discovery.hasMore).toBe(true);

    const presentation = data.columns.find((c: { id: string }) => c.id === "presentation");
    expect(presentation.count).toBe(1);
    expect(presentation.cards[0].maximumBudget).toBe(120000);
    expect(presentation.cards[0].closeDate).toBeNull();
    expect(presentation.hasMore).toBe(false);

    // Stage with no rows still renders, zeroed
    const won = data.columns.find((c: { id: string }) => c.id === "closed_won");
    expect(won.count).toBe(0);
    expect(won.cards).toHaveLength(0);
  });

  it("scopes the SQL to leaids, school year, the stage allowlist, and a per-stage cap", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({ rows: [] });

    await GET(makeRequest("/api/views/opps-kanban?leaids=l1,l2&schoolYr=2025-26&limit=50"));

    // Aggregate query (call 0)
    const aggSql = mockQuery.mock.calls[0][0] as string;
    const aggParams = mockQuery.mock.calls[0][1] as unknown[];
    expect(aggSql).toMatch(/group by stage/i);
    expect(aggSql).toMatch(/district_lea_id = any/i);
    expect(aggParams[0]).toEqual(["l1", "l2"]);
    expect(aggParams[1]).toBe("2025-26");
    expect(aggParams[2]).toHaveLength(8); // stage allowlist

    // Cards query (call 1) — windowed cap
    const cardSql = mockQuery.mock.calls[1][0] as string;
    const cardParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(cardSql).toMatch(/row_number\(\) over/i);
    expect(cardSql).toMatch(/rn <= \$4/i);
    expect(cardParams[3]).toBe(50);
  });

  it("clamps limit to a max of 50", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({ rows: [] });
    await GET(makeRequest("/api/views/opps-kanban?leaids=l1&schoolYr=2025-26&limit=999"));
    const cardParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(cardParams[3]).toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: FAIL — cannot resolve `../route` (not created yet).

- [ ] **Step 3: Write the implementation**

Create `src/app/api/views/opps-kanban/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { readonlyPool } from "@/lib/db-readonly";
import { getUser } from "@/lib/supabase/server";
import {
  OPP_STAGE_COLUMNS,
  OPP_KANBAN_STAGES,
} from "@/features/views/lib/opp-stage-columns";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

interface KanbanCard {
  id: string;
  name: string | null;
  districtName: string | null;
  contractType: string | null;
  netBookingAmount: number | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  closeDate: string | null;
  salesRepName: string | null;
}

interface KanbanColumn {
  id: string;
  label: string;
  count: number;
  totalBookings: number;
  cards: KanbanCard[];
  hasMore: boolean;
}

interface AggRow {
  stage: string;
  count: string;
  total: string;
}

interface CardRow {
  id: string;
  stage: string;
  name: string | null;
  district_name: string | null;
  contract_type: string | null;
  net_booking_amount: string | null;
  minimum_purchase_amount: string | null;
  maximum_budget: string | null;
  close_date: Date | string | null;
  sales_rep_name: string | null;
}

/** Decimal columns arrive as strings from pg — coerce to number or null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function emptyColumns(): KanbanColumn[] {
  return OPP_STAGE_COLUMNS.map((c) => ({
    id: c.id,
    label: c.label,
    count: 0,
    totalBookings: 0,
    cards: [],
    hasMore: false,
  }));
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const schoolYr = params.get("schoolYr") ?? "";
  const leaids = (params.get("leaids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  if (!schoolYr) {
    return NextResponse.json({ error: "schoolYr is required" }, { status: 400 });
  }

  if (leaids.length === 0) {
    return NextResponse.json({ schoolYr, columns: emptyColumns() });
  }

  const stages = [...OPP_KANBAN_STAGES];

  // True per-stage count + summed bookings (independent of the card cap).
  const aggResult = await readonlyPool.query<AggRow>(
    `SELECT stage,
            COUNT(*) AS count,
            COALESCE(SUM(net_booking_amount), 0) AS total
       FROM opportunities
      WHERE district_lea_id = ANY($1)
        AND school_yr = $2
        AND stage = ANY($3)
      GROUP BY stage`,
    [leaids, schoolYr, stages],
  );

  // At most `limit` cards per stage via a window function.
  const cardResult = await readonlyPool.query<CardRow>(
    `SELECT id, stage, name, district_name, contract_type, net_booking_amount,
            minimum_purchase_amount, maximum_budget, close_date, sales_rep_name
       FROM (
         SELECT o.id, o.stage, o.name, o.district_name, o.contract_type,
                o.net_booking_amount, o.minimum_purchase_amount, o.maximum_budget,
                o.close_date, o.sales_rep_name,
                ROW_NUMBER() OVER (
                  PARTITION BY o.stage
                  ORDER BY o.close_date ASC NULLS LAST, o.net_booking_amount DESC NULLS LAST
                ) AS rn
           FROM opportunities o
          WHERE o.district_lea_id = ANY($1)
            AND o.school_yr = $2
            AND o.stage = ANY($3)
       ) ranked
      WHERE rn <= $4`,
    [leaids, schoolYr, stages, limit],
  );

  const aggByStage = new Map<string, { count: number; total: number }>();
  for (const r of aggResult.rows) {
    aggByStage.set(r.stage, {
      count: Number(r.count) || 0,
      total: Number(r.total) || 0,
    });
  }

  const cardsByStage = new Map<string, KanbanCard[]>();
  for (const r of cardResult.rows) {
    const list = cardsByStage.get(r.stage) ?? [];
    list.push({
      id: r.id,
      name: r.name,
      districtName: r.district_name,
      contractType: r.contract_type,
      netBookingAmount: num(r.net_booking_amount),
      minimumPurchaseAmount: num(r.minimum_purchase_amount),
      maximumBudget: num(r.maximum_budget),
      closeDate: r.close_date ? new Date(r.close_date).toISOString() : null,
      salesRepName: r.sales_rep_name,
    });
    cardsByStage.set(r.stage, list);
  }

  const columns: KanbanColumn[] = OPP_STAGE_COLUMNS.map((c) => {
    const agg = aggByStage.get(c.stage) ?? { count: 0, total: 0 };
    const cards = cardsByStage.get(c.stage) ?? [];
    return {
      id: c.id,
      label: c.label,
      count: agg.count,
      totalBookings: agg.total,
      cards,
      hasMore: agg.count > cards.length,
    };
  });

  return NextResponse.json({ schoolYr, columns });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/views/opps-kanban/__tests__/route.test.ts`
Expected: PASS (auth, validation, grouping, SQL-shape, and clamp tests all green).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/views/opps-kanban/route.ts src/app/api/views/opps-kanban/__tests__/route.test.ts
git commit -m "feat(views): opps-kanban endpoint groups plan opps by stage"
```

---

## Task 3: Rewrite KanbanView + wire GroupCanvas

Rewrites `KanbanView.tsx` to consume the new endpoint, and updates the single `GroupCanvas` call site in the same commit so the build/types stay green.

**Files:**
- Modify (rewrite): `src/features/views/components/views/KanbanView.tsx`
- Modify: `src/features/views/components/GroupCanvas.tsx:227`
- Test: `src/features/views/components/views/__tests__/KanbanView.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/views/components/views/__tests__/KanbanView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { ReactNode } from "react";

vi.mock("@/features/shared/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shared/lib/api-client")>();
  return { ...actual, fetchJson: vi.fn() };
});

import KanbanView from "../KanbanView";
import { fetchJson } from "@/features/shared/lib/api-client";

function wrap(c: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{c}</QueryClientProvider>;
}

function col(over: Record<string, unknown>) {
  return { count: 0, totalBookings: 0, cards: [], hasMore: false, ...over };
}

const fixture = {
  schoolYr: "2025-26",
  columns: [
    col({ id: "meeting_booked", label: "Meeting Booked" }),
    col({
      id: "discovery", label: "Discovery", count: 3, totalBookings: 175000, hasMore: true,
      cards: [{
        id: "opp-1", name: "Acme Renewal", districtName: "Acme District",
        contractType: "Tier 1", netBookingAmount: 45000, minimumPurchaseAmount: 20000,
        maximumBudget: null, closeDate: "2026-06-01T00:00:00.000Z", salesRepName: "Alice Smith",
      }],
    }),
    col({
      id: "presentation", label: "Presentation", count: 1, totalBookings: 90000,
      cards: [{
        id: "opp-2", name: "Beta Expansion", districtName: "Beta School",
        contractType: null, netBookingAmount: 90000, minimumPurchaseAmount: 30000,
        maximumBudget: 120000, closeDate: null, salesRepName: null,
      }],
    }),
    col({ id: "proposal", label: "Proposal" }),
    col({ id: "negotiation", label: "Negotiation" }),
    col({ id: "commitment", label: "Commitment" }),
    col({ id: "closed_won", label: "Closed Won" }),
    col({ id: "closed_lost", label: "Closed Lost" }),
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("KanbanView", () => {
  it("shows the list-scope empty state and never fetches when leaids is null", () => {
    render(wrap(<KanbanView leaids={null} fiscalYear={2026} />));
    expect(screen.getByText("List scoping not wired yet")).toBeInTheDocument();
    expect(fetchJson as Mock).not.toHaveBeenCalled();
  });

  it("renders opportunity cards with their district and amount", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    expect(await screen.findByText("Acme Renewal")).toBeInTheDocument();
    expect(screen.getByText("Beta Expansion")).toBeInTheDocument();
    expect(screen.getByText("Acme District")).toBeInTheDocument();
  });

  it("shows the contract-type badge only when present", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("Tier 1")).toBeInTheDocument(); // opp-1
    // opp-2 has null contractType → only one badge total
    expect(screen.queryByText("null")).toBeNull();
  });

  it("renders a Max budget row only for cards that have one", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    // Only opp-2 (Beta) has maximumBudget set
    expect(screen.getAllByText("Max budget")).toHaveLength(1);
  });

  it("shows the per-column summed bookings in the header", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("$175K")).toBeInTheDocument(); // Discovery total
  });

  it("shows a '+N more' footer when a column has more than the rendered cards", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(screen.getByText("+2 more")).toBeInTheDocument(); // 3 - 1
  });

  it("marks cards for detail-panel routing", async () => {
    (fetchJson as Mock).mockResolvedValue(fixture);
    const { container } = render(wrap(<KanbanView leaids={["lea1"]} fiscalYear={2026} />));
    await screen.findByText("Acme Renewal");
    expect(
      container.querySelector('[data-row-kind="opp"][data-row-id="opp-1"]'),
    ).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanView.test.tsx`
Expected: FAIL — `KanbanView` does not accept a `fiscalYear` prop / still renders the district board (no "List scoping" text path for these inputs, badge/footer assertions fail).

- [ ] **Step 3: Rewrite KanbanView**

Replace the entire contents of `src/features/views/components/views/KanbanView.tsx` with:

```tsx
"use client";

/**
 * KanbanView — opportunity pipeline board for the active plan.
 *
 * Columns are the real Salesforce opportunity stages (funnel 0–5 + Closed Won /
 * Closed Lost) from lib/opp-stage-columns. Opps are scoped to the plan's
 * districts and the plan's fiscal year (→ school year). Read-only: cards open
 * the opp detail panel via GroupCanvas's [data-row-kind][data-row-id]
 * delegation — there is no drag-to-move and no card create in v1 (opps are a
 * read-only Salesforce mirror).
 *
 * Lists are not scoped yet (leaids === null) — same plan-only empty state as the
 * other views until list previews are wired.
 */
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";
import { OPP_STAGE_COLUMNS } from "@/features/views/lib/opp-stage-columns";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PAGE_SIZE,
  leaidsCsv,
  leaidsKey,
} from "./_shared";
import { formatMoney } from "./TableView";

interface KanbanViewProps {
  leaids: string[] | null;
  /** Plan's fiscal year (e.g. 2026). null for lists (not scoped in v1). */
  fiscalYear: number | null;
}

interface KanbanCard {
  id: string;
  name: string | null;
  districtName: string | null;
  contractType: string | null;
  netBookingAmount: number | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  closeDate: string | null;
  salesRepName: string | null;
}

interface KanbanColumnData {
  id: string;
  label: string;
  count: number;
  totalBookings: number;
  cards: KanbanCard[];
  hasMore: boolean;
}

interface KanbanResponse {
  schoolYr: string;
  columns: KanbanColumnData[];
}

const ACCENT_BY_ID: Record<string, string> = Object.fromEntries(
  OPP_STAGE_COLUMNS.map((c) => [c.id, c.accent]),
);

export default function KanbanView({ leaids, fiscalYear }: KanbanViewProps) {
  const keyTag = leaidsKey(leaids);
  const schoolYr = fiscalYear != null ? fiscalYearToSchoolYear(fiscalYear) : "";

  const q = useQuery({
    queryKey: ["views", "opps-kanban", keyTag, schoolYr, PAGE_SIZE] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<KanbanResponse>(
        `${API_BASE}/views/opps-kanban?leaids=${encodeURIComponent(csv)}` +
          `&schoolYr=${encodeURIComponent(schoolYr)}&limit=${PAGE_SIZE}`,
      );
    },
    enabled: leaids !== null && schoolYr !== "",
    staleTime: 60 * 1000,
  });

  if (leaids === null) {
    return (
      <EmptyState
        title="List scoping not wired yet"
        hint="Phase E adds live list previews — until then the kanban view is plan-only."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={3} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch opportunities.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const columns = q.data?.columns ?? [];
  const totalOpps = columns.reduce((sum, c) => sum + c.count, 0);
  if (totalOpps === 0) {
    return (
      <EmptyState
        title="No opportunities for this plan's year"
        hint="Opportunities sync from Salesforce for the plan's districts and fiscal year."
      />
    );
  }

  return (
    <div
      className="h-full overflow-auto bg-[#FFFCFA] p-4"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex gap-3 min-w-max h-full">
        {columns.map((col) => (
          <Column
            key={col.id}
            col={col}
            accent={ACCENT_BY_ID[col.id] ?? "#A69DC0"}
          />
        ))}
      </div>
    </div>
  );
}

function Column({ col, accent }: { col: KanbanColumnData; accent: string }) {
  return (
    <div className="w-64 flex flex-col flex-shrink-0">
      <div
        className="rounded-full mb-2"
        style={{ height: 2, background: accent }}
        aria-hidden
      />
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="text-[12px] font-semibold text-[#403770] whitespace-nowrap truncate">
            {col.label}
          </span>
          <span className="text-[11px] text-[#8A80A8] tabular-nums whitespace-nowrap">
            {col.count}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-[#544A78] tabular-nums whitespace-nowrap">
          {formatMoney(col.totalBookings)}
        </span>
      </div>
      <div className="flex flex-col gap-2 flex-1">
        {col.cards.map((card) => (
          <Card key={card.id} card={card} accent={accent} />
        ))}
        {col.cards.length === 0 && (
          <div className="px-2.5 py-3 text-[11px] text-[#A69DC0] text-center whitespace-nowrap">
            No opportunities
          </div>
        )}
        {col.hasMore && (
          <div className="px-2.5 py-1 text-[11px] text-[#8A80A8] text-center whitespace-nowrap">
            +{col.count - col.cards.length} more
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ card, accent }: { card: KanbanCard; accent: string }) {
  return (
    <div
      data-row-kind="opp"
      data-row-id={card.id}
      className="bg-white border border-[#D4CFE2] rounded-lg p-2.5 cursor-pointer hover:border-[#B8B0D0] transition-colors duration-100"
      style={{ boxShadow: "0 1px 2px rgba(64,55,112,0.05)" }}
    >
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: accent }}
            aria-hidden
          />
          <span className="text-[13px] font-semibold text-[#403770] truncate whitespace-nowrap">
            {card.name ?? "Untitled opportunity"}
          </span>
        </div>
        {card.contractType && (
          <span className="inline-block px-1.5 py-0.5 rounded-full bg-[#EFEDF5] text-[10px] font-semibold text-[#6f6786] whitespace-nowrap flex-shrink-0">
            {card.contractType}
          </span>
        )}
      </div>
      <dl className="flex flex-col gap-0.5 text-[11px]">
        <CardRow label="District" value={card.districtName ?? "—"} />
        <CardRow
          label="Amount"
          value={card.netBookingAmount != null ? formatMoney(card.netBookingAmount) : "—"}
        />
        <CardRow
          label="Min purchase"
          value={
            card.minimumPurchaseAmount != null
              ? formatMoney(card.minimumPurchaseAmount)
              : "—"
          }
        />
        {card.maximumBudget != null && (
          <CardRow label="Max budget" value={formatMoney(card.maximumBudget)} />
        )}
        <CardRow label="Close" value={formatCloseDate(card.closeDate)} />
        <CardRow label="Sales rep" value={card.salesRepName ?? "—"} />
      </dl>
    </div>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[#8A80A8] whitespace-nowrap">{label}</span>
      <span className="text-[#544A78] font-medium tabular-nums truncate text-right">
        {value}
      </span>
    </div>
  );
}

function formatCloseDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
```

- [ ] **Step 4: Update the GroupCanvas call site**

In `src/features/views/components/GroupCanvas.tsx`, find the `case "kanban"` branch (currently `return <KanbanView leaids={leaids} />;`) and replace it with:

```tsx
    case "kanban":
      return <KanbanView leaids={leaids} fiscalYear={plan?.fiscalYear ?? null} />;
```

(`plan` is already destructured in `ViewBody`'s props, so it is in scope here.)

- [ ] **Step 5: Run the component test to verify it passes**

Run: `npx vitest run src/features/views/components/views/__tests__/KanbanView.test.tsx`
Expected: PASS (all seven cases green).

- [ ] **Step 6: Typecheck the touched files compile**

Run: `npx tsc --noEmit`
Expected: no errors (in particular, `GroupCanvas.tsx` passing `fiscalYear` matches the new `KanbanViewProps`).

- [ ] **Step 7: Commit**

```bash
git add src/features/views/components/views/KanbanView.tsx \
        src/features/views/components/views/__tests__/KanbanView.test.tsx \
        src/features/views/components/GroupCanvas.tsx
git commit -m "feat(views): opportunity kanban board replaces district kanban"
```

---

## Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full Vitest suite**

Run: `npx vitest run`
Expected: PASS — the pre-existing suite stays green and the three new test files pass. If anything fails, fix before continuing.

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean for the new/changed files.

- [ ] **Step 3: Manual smoke test in the app**

```bash
npm run dev   # http://localhost:3005
```

Verify:
- Open a territory plan in the views sidebar, switch to the **Kanban** tab.
- Eight columns render in funnel order (Meeting Booked → … → Closed Won → Closed Lost), each with an accent bar, count, and summed bookings.
- Cards show name, contract-type badge (when present), district, amount, min purchase, max budget (only when present), close date, sales rep — and **no** `#ID` line and **no** Files line.
- Clicking a card opens the opportunity detail panel.
- A column with more than 50 in-scope opps shows a "+N more" footer; the header count/total reflect the true totals.
- Switching to a **list** (not a plan) shows the "List scoping not wired yet" empty state.

- [ ] **Step 4: Mobile scroll check (per CLAUDE.md)**

In Safari Responsive Design Mode (or a real iPhone), confirm the board scrolls horizontally across columns and vertically within a column, and that switching to the Map tab afterward still pinch-zooms/pans (shared touch event system).

- [ ] **Step 5: Final commit (only if Step 1–2 required fixes)**

```bash
git add -A
git commit -m "test(views): opportunity kanban verification fixes"
```

---

## Self-Review Notes (author)

- **Spec coverage:** columns/registry → Task 1; scope + endpoint + grouping + totals + cap + hasMore → Task 2; card content (badge, min purchase, max-budget-when-present, no ID, no Files), read-only click-to-detail, list empty state, plan-fiscal-year scope, GroupCanvas wiring → Task 3; testing + mobile → Tasks 2–4.
- **Types consistent across tasks:** `KanbanCard` / `KanbanColumn(Data)` field names match between the route (Task 2) and the client (Task 3) and the test fixtures. `columnForStage` / `OPP_KANBAN_STAGES` / `OPP_STAGE_COLUMNS` names match between Task 1 and its consumers.
- **No placeholders:** every code step is complete and runnable.
