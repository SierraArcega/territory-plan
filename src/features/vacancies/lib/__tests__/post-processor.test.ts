import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    vacancyKeywordConfig: {
      findMany: vi.fn(),
    },
    school: {
      findMany: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
    },
    vacancy: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import { processVacancies } from "../post-processor";
import type { RawVacancy } from "../parsers/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

describe("processVacancies", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no exclusion keywords, no relevance configs, no schools, no contacts
    mockPrisma.vacancyKeywordConfig.findMany.mockResolvedValue([]);
    mockPrisma.school.findMany.mockResolvedValue([]);
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.vacancy.upsert.mockResolvedValue({} as never);
    mockPrisma.vacancy.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.vacancy.count.mockResolvedValue(0);
  });

  it("returns counts for processed vacancies", async () => {
    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher" },
      { title: "Science Teacher" },
    ];

    const result = await processVacancies("3601234", "scan-1", rawVacancies);

    expect(result.vacancyCount).toBe(2);
    expect(result.fullmindRelevantCount).toBe(0);
  });

  it("upserts each filtered vacancy into the database", async () => {
    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher" },
      { title: "English Teacher" },
    ];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledTimes(2);
  });

  it("marks old open vacancies as closed when new vacancies are processed", async () => {
    const rawVacancies: RawVacancy[] = [{ title: "Math Teacher" }];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leaid: "3601234",
          status: "open",
          fingerprint: expect.objectContaining({ notIn: expect.any(Array) }),
        }),
        data: { status: "closed" },
      })
    );
  });

  it("filters out excluded roles before processing", async () => {
    // processVacancies uses Promise.all which calls vacancyKeywordConfig.findMany twice:
    // once for relevance configs and once (via filterExcludedRoles) for exclusion keywords.
    // Since call ordering within Promise.all is non-deterministic, we use mockImplementation
    // to route based on the query's where clause.
    mockPrisma.vacancyKeywordConfig.findMany.mockImplementation(((args: { where: { type: string } }) => {
      if (args.where.type === "exclusion") {
        return Promise.resolve([{ keywords: ["custodian", "bus driver"] }]);
      }
      // relevance configs
      return Promise.resolve([]);
    }) as typeof mockPrisma.vacancyKeywordConfig.findMany);

    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher" },
      { title: "Custodian" },
      { title: "Bus Driver" },
    ];

    const result = await processVacancies("3601234", "scan-1", rawVacancies);

    // Custodian and Bus Driver should be filtered out
    expect(result.vacancyCount).toBe(1);
  });

  it("flags fullmind-relevant vacancies based on relevance keywords", async () => {
    // Route based on query type to handle Promise.all ordering
    mockPrisma.vacancyKeywordConfig.findMany.mockImplementation(((args: { where: { type: string } }) => {
      if (args.where.type === "relevance") {
        return Promise.resolve([
          {
            label: "SPED Services",
            keywords: ["special education", "sped"],
            serviceLine: "Fullmind SPED",
          },
        ]);
      }
      // exclusion configs
      return Promise.resolve([]);
    }) as typeof mockPrisma.vacancyKeywordConfig.findMany);

    const rawVacancies: RawVacancy[] = [
      { title: "Special Education Teacher" },
      { title: "Math Teacher" },
    ];

    const result = await processVacancies("3601234", "scan-1", rawVacancies);

    expect(result.fullmindRelevantCount).toBe(1);
  });

  it("matches school names to ncessch IDs", async () => {
    mockPrisma.school.findMany.mockResolvedValue([
      { ncessch: "360001", schoolName: "Lincoln Elementary School" },
    ] as never);

    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher", schoolName: "Lincoln Elementary School" },
    ];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          schoolNcessch: "360001",
        }),
      })
    );
  });

  it("matches contact emails to contact IDs", async () => {
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: 42, email: "jsmith@springfield.k12.ny.us" },
    ] as never);

    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher", hiringEmail: "jsmith@springfield.k12.ny.us" },
    ];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contactId: 42,
        }),
      })
    );
  });

  it("sets contactId to null when no email match is found", async () => {
    mockPrisma.contact.findMany.mockResolvedValue([
      { id: 42, email: "jsmith@springfield.k12.ny.us" },
    ] as never);

    const rawVacancies: RawVacancy[] = [
      { title: "Math Teacher", hiringEmail: "unknown@other.org" },
    ];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          contactId: null,
        }),
      })
    );
  });

  describe("zero-result scan safety", () => {
    it("closes open vacancies when count is at or below the threshold (3)", async () => {
      mockPrisma.vacancy.count.mockResolvedValue(2);

      await processVacancies("3601234", "scan-1", []);

      expect(mockPrisma.vacancy.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            leaid: "3601234",
            status: "open",
          }),
          data: { status: "closed" },
        })
      );
    });

    it("skips closing when open count exceeds threshold (likely partial scrape)", async () => {
      mockPrisma.vacancy.count.mockResolvedValue(10);

      await processVacancies("3601234", "scan-1", []);

      expect(mockPrisma.vacancy.updateMany).not.toHaveBeenCalled();
    });
  });

  it("assigns correct category from categorizer", async () => {
    const rawVacancies: RawVacancy[] = [
      { title: "Special Education Teacher" },
    ];

    await processVacancies("3601234", "scan-1", rawVacancies);

    expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          category: "SPED",
        }),
      })
    );
  });

  it("generates fingerprint and uses it for upsert where clause", async () => {
    const rawVacancies: RawVacancy[] = [{ title: "Math Teacher" }];

    await processVacancies("3601234", "scan-1", rawVacancies);

    const upsertCall = mockPrisma.vacancy.upsert.mock.calls[0][0];
    expect(upsertCall.where.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(upsertCall.create.fingerprint).toBe(upsertCall.where.fingerprint);
  });

  describe("district affinity (districtVerified)", () => {
    it("sets districtVerified=true for district-scoped platforms (applitrack)", async () => {
      const rawVacancies: RawVacancy[] = [
        { title: "Math Teacher", employerName: "Some Other District" },
      ];

      await processVacancies("3601234", "scan-1", rawVacancies, "applitrack", "Springfield School District");

      expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ districtVerified: true }),
        })
      );
    });

    it("sets districtVerified=true when employer matches district on statewide board", async () => {
      const rawVacancies: RawVacancy[] = [
        { title: "Math Teacher", employerName: "Springfield Public Schools" },
      ];

      await processVacancies("3601234", "scan-1", rawVacancies, "olas", "Springfield School District");

      expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ districtVerified: true }),
        })
      );
    });

    it("sets districtVerified=false when employer mismatches district on statewide board", async () => {
      const rawVacancies: RawVacancy[] = [
        { title: "Math Teacher", employerName: "Albany City School District" },
      ];

      await processVacancies("3601234", "scan-1", rawVacancies, "olas", "Springfield School District", false);

      expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ districtVerified: false }),
        })
      );
    });

    it("sets districtVerified=true when no employerName on statewide board (benefit of doubt)", async () => {
      const rawVacancies: RawVacancy[] = [
        { title: "Math Teacher" },
      ];

      await processVacancies("3601234", "scan-1", rawVacancies, "schoolspring", "Springfield School District");

      expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ districtVerified: true }),
        })
      );
    });

    it("defaults districtVerified=true when platform/districtName not provided", async () => {
      const rawVacancies: RawVacancy[] = [{ title: "Math Teacher" }];

      await processVacancies("3601234", "scan-1", rawVacancies);

      expect(mockPrisma.vacancy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ districtVerified: true }),
        })
      );
    });
  });
});
