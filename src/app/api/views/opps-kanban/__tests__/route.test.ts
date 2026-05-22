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

// Mock only the cached fetcher; keep the real rankLabelString derivation.
const mockGetLabels = vi.fn();
vi.mock("@/app/api/views/data/global-customer-labels", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/api/views/data/global-customer-labels")>();
  return { ...actual, getGlobalCustomerLabels: () => mockGetLabels() };
});

import { GET } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no rank data → every card resolves to "New".
  mockGetLabels.mockResolvedValue(new Map());
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
    expect(data.targeted).toEqual({
      count: 0,
      totalTarget: 0,
      cards: [],
      hasMore: false,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe("GET /api/views/opps-kanban — grouping", () => {
  it("groups cards into columns with true counts/totals and hasMore", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // Single fetch returns all rows — counts/totals derived in JS.
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "opp-1", stage: "1 - Discovery", name: "Acme Renewal",
          district_name: "Acme District", district_lea_id: "l1", contract_type: "Tier 1",
          net_booking_amount: "45000", minimum_purchase_amount: "20000",
          maximum_budget: null, close_date: "2026-06-01T00:00:00.000Z",
          sales_rep_name: "Alice Smith",
          details_link: "https://lms.fullmindlearning.com/opportunities/111/details",
          state: "NY",
        },
        {
          id: "opp-2", stage: "2 - Presentation", name: "Beta Expansion",
          district_name: "Beta School", district_lea_id: "l2", contract_type: null,
          net_booking_amount: "90000", minimum_purchase_amount: "30000",
          maximum_budget: "120000", close_date: null, sales_rep_name: null,
          details_link: "https://lms.fullmindlearning.com/opportunities/222/details",
          state: null,
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
    // count and totalBookings derived from JS grouping of the fetched rows
    expect(discovery.count).toBe(1);
    expect(discovery.totalBookings).toBe(45000);
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
    expect(discovery.cards[0].detailsLink).toBe(
      "https://lms.fullmindlearning.com/opportunities/111/details",
    );
    // 1 in stage, 1 card returned → no hasMore
    expect(discovery.hasMore).toBe(false);

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

  it("scopes the SQL to leaids, school year, and the stage allowlist", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValue({ rows: [] });

    await GET(makeRequest("/api/views/opps-kanban?leaids=l1,l2&schoolYr=2025-26&limit=50"));

    // Single fetch query (call 0)
    const sql = mockQuery.mock.calls[0][0] as string;
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(sql).toMatch(/district_lea_id = any/i);
    expect(sql).toMatch(/school_yr/i);
    expect(sql).toMatch(/stage = any/i);
    expect(sql).toMatch(/details_link/i);
    expect(params[0]).toEqual(["l1", "l2"]);
    expect(params[1]).toBe("2025-26");
    expect(params[2]).toHaveLength(8); // stage allowlist
  });

  it("caps a column at 50 cards via JS slice, hasMore true, count reflects all fetched rows", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `o${i}`, stage: "1 - Discovery", name: `N${i}`, district_name: null, district_lea_id: "d1",
      contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
      close_date: null, sales_rep_name: null, details_link: null, state: null,
    }));
    mockQuery.mockResolvedValueOnce({ rows });
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=d1&schoolYr=2025-26"));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.count).toBe(60);
    expect(disc.cards).toHaveLength(50);
    expect(disc.hasMore).toBe(true);
  });
});

describe("GET /api/views/opps-kanban — targeted column", () => {
  it("returns plan districts with no FY opps + summed targets when planId is given", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    // Call order: cards (0), targeted (1).
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { leaid: "1100030", name: "Untouched A", target: "100000" },
          { leaid: "1100060", name: "Untouched B", target: "50000" },
        ],
      });

    const res = await GET(
      makeRequest("/api/views/opps-kanban?leaids=l1,l2&schoolYr=2025-26&planId=plan-1"),
    );
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.targeted).toEqual({
      count: 2,
      totalTarget: 150000,
      cards: [
        { leaid: "1100030", name: "Untouched A", target: 100000, rankLabel: "New" },
        { leaid: "1100060", name: "Untouched B", target: 50000, rankLabel: "New" },
      ],
      hasMore: false,
    });

    // Targeted is the 2nd query (index 1), scoped to the plan with a NOT EXISTS opp guard.
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const targetedSql = mockQuery.mock.calls[1][0] as string;
    const targetedParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(targetedSql).toMatch(/territory_plan_districts/i);
    expect(targetedSql).toMatch(/not exists/i);
    expect(targetedParams).toEqual(["plan-1", "2025-26"]);
  });

  it("omits the targeted query and zeroes the column when no planId is given", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await GET(
      makeRequest("/api/views/opps-kanban?leaids=l1&schoolYr=2025-26"),
    );
    const data = await res.json();

    expect(data.targeted).toEqual({
      count: 0,
      totalTarget: 0,
      cards: [],
      hasMore: false,
    });
    // Only cards query ran — no targeted query without a planId.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/views/opps-kanban — rank labels", () => {
  it("attaches each card's district rank label (opp + targeted)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockGetLabels.mockResolvedValue(
      new Map([
        ["d-1", { rank: 3, label: "rank" }],
        ["d-2", { rank: null, label: "win_back" }],
      ]),
    );
    // Single fetch (call 0) + targeted (call 1, because planId is present)
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "opp-1", stage: "1 - Discovery", name: "Acme",
            district_name: "Acme District", district_lea_id: "d-1",
            contract_type: null, net_booking_amount: "45000",
            minimum_purchase_amount: null, maximum_budget: null,
            close_date: null, sales_rep_name: null, details_link: null, state: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ leaid: "d-2", name: "Beta District", target: "50000" }],
      });

    const res = await GET(
      makeRequest("/api/views/opps-kanban?leaids=d-1,d-2&schoolYr=2025-26&planId=plan-1"),
    );
    const data = await res.json();

    const discovery = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(discovery.cards[0].rankLabel).toBe("#3");
    expect(data.targeted.cards[0].rankLabel).toBe("Win Back");
  });

  it("labels a district with no rank entry as New", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockGetLabels.mockResolvedValue(new Map());
    // Single fetch only (no planId)
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "opp-x", stage: "1 - Discovery", name: "X", district_name: null,
          district_lea_id: "unknown", contract_type: null, net_booking_amount: null,
          minimum_purchase_amount: null, maximum_budget: null, close_date: null,
          sales_rep_name: null, details_link: null, state: null,
        },
      ],
    });

    const res = await GET(
      makeRequest("/api/views/opps-kanban?leaids=l1&schoolYr=2025-26"),
    );
    const data = await res.json();
    const discovery = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(discovery.cards[0].rankLabel).toBe("New");
  });
});

describe("GET /api/views/opps-kanban — filter & sort", () => {
  it("compiles a filter into the WHERE, narrowing counts/totals", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "o1", stage: "1 - Discovery", name: "Big", district_name: "D", district_lea_id: "d1",
          contract_type: "Tier 1", net_booking_amount: "90000", minimum_purchase_amount: null,
          maximum_budget: null, close_date: null, sales_rep_name: null, details_link: null, state: "NY" },
      ],
    });
    const filters = encodeURIComponent(JSON.stringify({ kind: "and", children: [{ kind: "rule", fieldId: "net_booking_amount", op: ">=", value: 50000 }] }));
    const res = await GET(makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&filters=${filters}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.count).toBe(1);
    expect(disc.totalBookings).toBe(90000);
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toMatch(/net_booking_amount/i);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(50000);
  });

  it("sorts cards within a column per the sort spec (bookings desc)", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: "small", stage: "1 - Discovery", name: "S", district_name: null, district_lea_id: "d1", contract_type: null, net_booking_amount: "10000", minimum_purchase_amount: null, maximum_budget: null, close_date: null, sales_rep_name: null, details_link: null, state: null },
        { id: "big", stage: "1 - Discovery", name: "B", district_name: null, district_lea_id: "d1", contract_type: null, net_booking_amount: "90000", minimum_purchase_amount: null, maximum_budget: null, close_date: null, sales_rep_name: null, details_link: null, state: null },
      ],
    });
    const sort = encodeURIComponent(JSON.stringify([{ id: "net_booking_amount", dir: "desc" }]));
    const res = await GET(makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&sort=${sort}`));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.cards.map((c: { id: string }) => c.id)).toEqual(["big", "small"]);
  });

  it("rejects a filter referencing an unknown field with 400", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const filters = encodeURIComponent(JSON.stringify({ kind: "and", children: [{ kind: "rule", fieldId: "nope", op: "is", value: "x" }] }));
    const res = await GET(makeRequest(`/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&filters=${filters}`));
    expect(res.status).toBe(400);
  });

  it("rejects malformed filters JSON with 400", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest(
      `/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&filters=${encodeURIComponent("{bad json")}`,
    ));
    expect(res.status).toBe(400);
  });

  it("rejects malformed sort JSON with 400", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const res = await GET(makeRequest(
      `/api/views/opps-kanban?leaids=d1&schoolYr=2025-26&sort=${encodeURIComponent("{bad json")}`,
    ));
    expect(res.status).toBe(400);
  });

  it("caps a column at 50 cards with hasMore, count reflects all fetched rows", async () => {
    mockGetUser.mockResolvedValue(mockUser);
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `o${i}`, stage: "1 - Discovery", name: `N${i}`, district_name: null, district_lea_id: "d1",
      contract_type: null, net_booking_amount: "100", minimum_purchase_amount: null, maximum_budget: null,
      close_date: null, sales_rep_name: null, details_link: null, state: null,
    }));
    mockQuery.mockResolvedValueOnce({ rows });
    const res = await GET(makeRequest("/api/views/opps-kanban?leaids=d1&schoolYr=2025-26"));
    const data = await res.json();
    const disc = data.columns.find((c: { id: string }) => c.id === "discovery");
    expect(disc.count).toBe(60);
    expect(disc.cards).toHaveLength(50);
    expect(disc.hasMore).toBe(true);
  });
});
