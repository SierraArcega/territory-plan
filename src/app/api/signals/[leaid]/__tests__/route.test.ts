import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

const mockReadonlyQuery = vi.fn();
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: {
    query: (...args: unknown[]) => mockReadonlyQuery(...args),
  },
}));

import { GET } from "../route";

const mockUser = { id: "user-1", email: "test@example.com" };

function makeRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: "GET",
  } as never);
}

function ctx(leaid: string) {
  return { params: Promise.resolve({ leaid }) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/signals/[leaid] — auth", () => {
  it("401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest("/api/signals/0100001"), ctx("0100001"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/signals/[leaid] — items", () => {
  beforeEach(() => mockGetUser.mockResolvedValue(mockUser));

  it("returns normalized reverse-chron items with rfp id as string", async () => {
    // The route ORDER BYs in SQL; the mock returns the already-ordered page.
    mockReadonlyQuery.mockResolvedValue({
      rows: [
        {
          type: "news",
          id: "ckn1",
          title: "Board approves ESSER budget",
          date: new Date("2026-05-20T00:00:00Z"),
          secondary_date: null,
          meta: "EdWeek",
        },
        {
          type: "rfp",
          id: "42",
          title: "Tutoring services",
          date: new Date("2026-05-19T00:00:00Z"),
          secondary_date: new Date("2026-06-15T00:00:00Z"),
          meta: "State of Alabama",
        },
        {
          type: "vac",
          id: "ckv1",
          title: "HS Math Teacher",
          date: new Date("2026-05-18T00:00:00Z"),
          secondary_date: null,
          meta: "Math",
        },
      ],
    });
    const res = await GET(
      makeRequest("/api/signals/0100001?since=all"),
      ctx("0100001"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasMore).toBe(false);
    expect(body.items).toEqual([
      {
        type: "news",
        id: "ckn1",
        title: "Board approves ESSER budget",
        date: "2026-05-20T00:00:00.000Z",
        secondaryDate: null,
        meta: "EdWeek",
      },
      {
        type: "rfp",
        id: "42", // Int → string
        title: "Tutoring services",
        date: "2026-05-19T00:00:00.000Z",
        secondaryDate: "2026-06-15T00:00:00.000Z",
        meta: "State of Alabama",
      },
      {
        type: "vac",
        id: "ckv1",
        title: "HS Math Teacher",
        date: "2026-05-18T00:00:00.000Z",
        secondaryDate: null,
        meta: "Math",
      },
    ]);
  });

  it("computes hasMore via the limit+1 sentinel and trims to limit", async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      type: "vac" as const,
      id: `v${i}`,
      title: `Vac ${i}`,
      date: new Date(2026, 4, 20 - i),
      secondary_date: null,
      meta: "General",
    }));
    mockReadonlyQuery.mockResolvedValue({ rows }); // 3 rows for limit=2
    const res = await GET(
      makeRequest("/api/signals/0100001?limit=2&since=all"),
      ctx("0100001"),
    );
    const body = await res.json();
    expect(body.hasMore).toBe(true);
    expect(body.items).toHaveLength(2);
    // The SQL LIMIT param should be limit+1 = 3.
    const params = mockReadonlyQuery.mock.calls[0][1] as unknown[];
    expect(params).toContain(3);
  });

  it("clamps limit to a max of 100", async () => {
    mockReadonlyQuery.mockResolvedValue({ rows: [] });
    await GET(
      makeRequest("/api/signals/0100001?limit=500"),
      ctx("0100001"),
    );
    const params = mockReadonlyQuery.mock.calls[0][1] as unknown[];
    // limit+1 sentinel = 101 when clamped to 100.
    expect(params).toContain(101);
  });

  it("excludes a source from the UNION when its type is off", async () => {
    mockReadonlyQuery.mockResolvedValue({ rows: [] });
    await GET(
      makeRequest("/api/signals/0100001?types=vac"),
      ctx("0100001"),
    );
    const sql = mockReadonlyQuery.mock.calls[0][0] as string;
    expect(sql).toContain("FROM vacancies");
    expect(sql).not.toContain("news_article_districts");
    expect(sql).not.toContain("FROM rfps");
  });

  it("excludes the since cutoff for the all window", async () => {
    mockReadonlyQuery.mockResolvedValue({ rows: [] });
    await GET(
      makeRequest("/api/signals/0100001?since=all&types=vac"),
      ctx("0100001"),
    );
    const sql = mockReadonlyQuery.mock.calls[0][0] as string;
    expect(sql).not.toContain("date_posted, v.first_seen_at) >=");
    // params: [leaid, limit+1, offset] — no cutoff.
    const params = mockReadonlyQuery.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("0100001");
    expect(params.every((p) => !(p instanceof Date))).toBe(true);
  });

  it("400 on empty leaid", async () => {
    const res = await GET(makeRequest("/api/signals/%20"), ctx("   "));
    expect(res.status).toBe(400);
  });
});
