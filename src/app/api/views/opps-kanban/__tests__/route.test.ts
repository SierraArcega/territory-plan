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
            details_link: "https://lms.fullmindlearning.com/opportunities/111/details",
          },
          {
            id: "opp-2", stage: "2 - Presentation", name: "Beta Expansion",
            district_name: "Beta School", contract_type: null,
            net_booking_amount: "90000", minimum_purchase_amount: "30000",
            maximum_budget: "120000", close_date: null, sales_rep_name: null,
            details_link: "https://lms.fullmindlearning.com/opportunities/222/details",
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
    expect(discovery.cards[0].detailsLink).toBe(
      "https://lms.fullmindlearning.com/opportunities/111/details",
    );
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
    expect(cardSql).toMatch(/details_link/i);
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
