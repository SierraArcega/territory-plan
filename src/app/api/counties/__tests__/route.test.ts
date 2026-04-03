import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing the route
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      groupBy: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "../route";
import { NextRequest } from "next/server";

describe("GET /api/counties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns distinct county+state pairs sorted alphabetically", async () => {
    const mockData = [
      { countyName: "Harris County", stateAbbrev: "TX" },
      { countyName: "Adams County", stateAbbrev: "CO" },
      { countyName: "Harris County", stateAbbrev: "GA" },
    ];
    (prisma.district.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue(mockData);

    const req = new NextRequest("http://localhost:3005/api/counties");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(mockData);
    expect(prisma.district.groupBy).toHaveBeenCalledWith({
      by: ["countyName", "stateAbbrev"],
      where: { countyName: { not: null } },
      orderBy: [{ countyName: "asc" }, { stateAbbrev: "asc" }],
    });
  });

  it("returns 500 on database error", async () => {
    (prisma.district.groupBy as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB down")
    );

    const req = new NextRequest("http://localhost:3005/api/counties");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to fetch counties");
  });
});
