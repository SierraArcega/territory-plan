import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    school: {
      findMany: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { matchSchool } from "../school-matcher";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("matchSchool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("exact matching with normalization", () => {
    it("matches when school name is identical", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln Elementary School" },
      ]);

      const result = await matchSchool("Lincoln Elementary School", "3601234");
      expect(result).toBe("360001");
    });

    it("matches after stripping common suffixes like 'school' and 'elementary'", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln Elementary School" },
      ]);

      // Input without suffixes should still match
      const result = await matchSchool("Lincoln", "3601234");
      expect(result).toBe("360001");
    });

    it("matches case-insensitively", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln Elementary School" },
      ]);

      const result = await matchSchool("LINCOLN ELEMENTARY SCHOOL", "3601234");
      expect(result).toBe("360001");
    });

    it("collapses whitespace when normalizing", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln Elementary School" },
      ]);

      const result = await matchSchool("Lincoln   Elementary   School", "3601234");
      expect(result).toBe("360001");
    });
  });

  describe("fuzzy matching with Dice coefficient", () => {
    it("matches similar school names above the 0.8 threshold", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Washington Heights Elementary School" },
        { ncessch: "360002", schoolName: "Jefferson Middle School" },
      ]);

      // After normalization: "washington heights" vs "washington hights" (minor typo).
      // Bigrams: close enough for Dice >= 0.8.
      const result = await matchSchool("Washington Hights Elementary School", "3601234");
      expect(result).toBe("360001");
    });

    it("returns null when no name is similar enough (below 0.8 threshold)", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Washington Elementary School" },
        { ncessch: "360002", schoolName: "Jefferson Middle School" },
      ]);

      const result = await matchSchool("Completely Different Name Academy", "3601234");
      expect(result).toBeNull();
    });

    it("returns the best match when multiple schools have similar names", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln Elementary School" },
        { ncessch: "360002", schoolName: "Lincoln Middle School" },
        { ncessch: "360003", schoolName: "Adams Elementary School" },
      ]);

      // After normalization "Lincoln" should match both Lincoln schools equally,
      // but exact match will win
      const result = await matchSchool("Lincoln", "3601234");
      // Both normalize to "lincoln" so exact match fires for the first one
      expect(result).toBe("360001");
    });
  });

  describe("edge cases", () => {
    it("returns null when no schools exist for the district", async () => {
      mockPrisma.school.findMany.mockResolvedValue([]);

      const result = await matchSchool("Any School", "3601234");
      expect(result).toBeNull();
    });

    it("passes the correct leaid to the database query", async () => {
      mockPrisma.school.findMany.mockResolvedValue([]);

      await matchSchool("Lincoln", "3609999");

      expect(mockPrisma.school.findMany).toHaveBeenCalledWith({
        where: { leaid: "3609999" },
        select: { ncessch: true, schoolName: true },
      });
    });

    it("strips 'academy' suffix during normalization", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Riverside Academy" },
      ]);

      const result = await matchSchool("Riverside", "3601234");
      expect(result).toBe("360001");
    });

    it("strips 'center' suffix during normalization", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Learning Center" },
      ]);

      const result = await matchSchool("Learning", "3601234");
      expect(result).toBe("360001");
    });

    it("strips 'hs', 'ms', 'es' abbreviations during normalization", async () => {
      mockPrisma.school.findMany.mockResolvedValue([
        { ncessch: "360001", schoolName: "Lincoln HS" },
      ]);

      // "Lincoln HS" normalizes to "lincoln", "Lincoln" normalizes to "lincoln"
      const result = await matchSchool("Lincoln", "3601234");
      expect(result).toBe("360001");
    });
  });
});
