import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    savedReport: {
      findMany: vi.fn(async () => [
        {
          id: 1,
          title: "Texas pipeline",
          question: "Texas open opportunities",
          summary: { source: "Opportunities", filters: [{ label: "State", value: "Texas" }] },
          updatedAt: new Date("2026-04-01"),
        },
      ]),
      findUnique: vi.fn(async ({ where }: { where: { id: number } }) => {
        if (where.id === 1)
          return {
            id: 1,
            userId: "user-123",
            title: "Texas pipeline",
            question: "Texas open opportunities",
            sql: "SELECT * FROM opportunities WHERE state = 'Texas' LIMIT 100",
            summary: { source: "Opportunities", filters: [], columns: [], sort: null, limit: 100 },
          };
        return null;
      }),
    },
  },
}));

import { handleSearchSavedReports, handleGetSavedReport } from "../saved-reports";

describe("saved-report tool handlers", () => {
  it("searches by title + summary", async () => {
    const res = await handleSearchSavedReports("texas", "user-123");
    expect(res).toContain("Texas pipeline");
  });

  it("returns not-found for missing reports", async () => {
    const res = await handleGetSavedReport(999, "user-123");
    expect(res.toLowerCase()).toContain("not found");
  });

  it("returns SQL + summary for a real report", async () => {
    const res = await handleGetSavedReport(1, "user-123");
    expect(res).toContain("opportunities");
    expect(res).toContain("Texas");
  });
});
