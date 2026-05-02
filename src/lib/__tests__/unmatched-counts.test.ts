import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { getUnmatchedCountsByRep } from "@/lib/unmatched-counts";

const mockQueryRaw = vi.mocked(prisma.$queryRaw);

describe("getUnmatchedCountsByRep", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("groups unresolved unmatched opps by sales_rep_email", async () => {
    mockQueryRaw.mockResolvedValue([
      { sales_rep_email: "alice@x.com", unmatched_count: 3, unmatched_revenue: 12500 },
      { sales_rep_email: "bob@x.com", unmatched_count: 1, unmatched_revenue: 7000 },
    ] as never);

    const result = await getUnmatchedCountsByRep(["alice@x.com", "bob@x.com", "carol@x.com"]);

    expect(result.size).toBe(2);
    expect(result.get("alice@x.com")).toEqual({ count: 3, revenue: 12500 });
    expect(result.get("bob@x.com")).toEqual({ count: 1, revenue: 7000 });
    expect(result.get("carol@x.com")).toBeUndefined();
  });

  it("short-circuits when given an empty rep list", async () => {
    const result = await getUnmatchedCountsByRep([]);
    expect(result.size).toBe(0);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("coerces numeric DB values to plain numbers", async () => {
    // Postgres COUNT(*)::int and SUM()::float can come back as bigints/strings via Prisma raw
    mockQueryRaw.mockResolvedValue([
      { sales_rep_email: "alice@x.com", unmatched_count: 3 as unknown as number, unmatched_revenue: "12500" as unknown as number },
    ] as never);

    const result = await getUnmatchedCountsByRep(["alice@x.com"]);
    const a = result.get("alice@x.com")!;
    expect(typeof a.count).toBe("number");
    expect(typeof a.revenue).toBe("number");
    expect(a.count).toBe(3);
    expect(a.revenue).toBe(12500);
  });
});
