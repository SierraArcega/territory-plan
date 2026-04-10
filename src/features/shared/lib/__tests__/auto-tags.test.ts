import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      district: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
      districtFinancials: { findMany: vi.fn() },
      tag: { findMany: vi.fn(), upsert: vi.fn() },
      districtTag: { deleteMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

import prisma from "@/lib/prisma";
import {
  AUTO_TAGS,
  AUTO_TAG_NAMES,
  COMPETITOR_TAG_MAP,
  COMPETITOR_TAG_NAMES,
  LOCALE_RANGES,
  ensureAutoTagsExist,
  syncClassificationTagsForDistrict,
  syncLocaleTagForDistrict,
  syncCompetitorTagsForDistrict,
} from "../auto-tags";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All classification tag names synced by syncClassificationTagsForDistrict */
const CLASSIFICATION_TAG_NAMES = [
  "Churn Risk",
  "EK12 Return",
  "EK12 Win Back - FY25",
  "EK12 Win Back - FY24",
  "Fullmind Return",
  "Fullmind Win Back - FY25",
];

/** Build a fake tag lookup result for prisma.tag.findMany */
function makeTagRecords(names: string[]) {
  return names.map((name, i) => ({ id: i + 1, name }));
}

/** Mock prisma.tag.findMany so getTagsByNames resolves correctly */
function mockClassificationTagLookup() {
  vi.mocked(prisma.tag.findMany).mockResolvedValue(
    makeTagRecords(CLASSIFICATION_TAG_NAMES) as any,
  );
}

/** Locale tag names in the order used by the module */
const LOCALE_TAG_NAMES = ["City", "Suburb", "Town", "Rural"];

function mockLocaleTagLookup() {
  vi.mocked(prisma.tag.findMany).mockResolvedValue(
    makeTagRecords(LOCALE_TAG_NAMES) as any,
  );
}

function mockCompetitorTagLookup() {
  vi.mocked(prisma.tag.findMany).mockResolvedValue(
    makeTagRecords(COMPETITOR_TAG_NAMES) as any,
  );
}

/** Creates a Fullmind districtFinancials row for a given FY */
function makeFullmindRow(fiscalYear: string, overrides: Record<string, unknown> = {}) {
  return {
    vendor: "fullmind",
    fiscalYear,
    invoicing: 0,
    totalRevenue: 0,
    closedWonBookings: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Shared beforeEach
// ---------------------------------------------------------------------------
let mockTx: {
  districtTag: { deleteMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; createMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();

  mockTx = {
    districtTag: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };

  // The module calls prisma.$transaction(async (tx) => { ... })
  // We need to invoke the callback with our mockTx.
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(mockTx));
});

// ===========================================================================
// 1. Constants -- data integrity
// ===========================================================================

describe("AUTO_TAGS constant", () => {
  it("has expected classification tag keys", () => {
    const expectedKeys = [
      "CHURN_RISK",
      "KEY_ACCOUNT",
      "EK12_RETURN",
      "EK12_NEW_BIZ_TARGET",
      "EK12_WIN_BACK_FY25",
      "EK12_WIN_BACK_FY24",
      "FULLMIND_RETURN",
      "FULLMIND_NEW_BIZ_TARGET",
      "FULLMIND_WIN_BACK_FY25",
      "FULLMIND_WIN_BACK_FY26",
    ];
    for (const key of expectedKeys) {
      expect(AUTO_TAGS).toHaveProperty(key);
    }
  });

  it("has expected locale tag keys", () => {
    expect(AUTO_TAGS).toHaveProperty("CITY");
    expect(AUTO_TAGS).toHaveProperty("SUBURB");
    expect(AUTO_TAGS).toHaveProperty("TOWN");
    expect(AUTO_TAGS).toHaveProperty("RURAL");
  });

  it("has expected competitor tag keys", () => {
    const competitors = ["PROXIMITY_LEARNING", "ELEVATE_K12", "TUTORED_BY_TEACHERS"];
    const fys = ["FY24", "FY25", "FY26"];
    for (const c of competitors) {
      for (const fy of fys) {
        expect(AUTO_TAGS).toHaveProperty(`${c}_${fy}`);
      }
    }
  });

  it("every tag has a non-empty name and a valid hex color", () => {
    for (const [key, tag] of Object.entries(AUTO_TAGS)) {
      expect(tag.name, `${key} should have a non-empty name`).toBeTruthy();
      expect(tag.color, `${key} should have a hex color`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("COMPETITOR_TAG_MAP constant", () => {
  const EXPECTED_VENDORS = ["proximity", "elevate", "tbt"];
  const EXPECTED_FYS = ["FY24", "FY25", "FY26"];

  it("covers all 3 vendors", () => {
    expect(Object.keys(COMPETITOR_TAG_MAP)).toEqual(expect.arrayContaining(EXPECTED_VENDORS));
    expect(Object.keys(COMPETITOR_TAG_MAP)).toHaveLength(EXPECTED_VENDORS.length);
  });

  it("maps each vendor to FY24, FY25, and FY26", () => {
    for (const vendor of EXPECTED_VENDORS) {
      const map = COMPETITOR_TAG_MAP[vendor];
      expect(Object.keys(map)).toEqual(expect.arrayContaining(EXPECTED_FYS));
      expect(Object.keys(map)).toHaveLength(EXPECTED_FYS.length);
    }
  });

  it("maps to valid AUTO_TAGS keys", () => {
    for (const vendor of EXPECTED_VENDORS) {
      for (const fy of EXPECTED_FYS) {
        const tagKey = COMPETITOR_TAG_MAP[vendor][fy];
        expect(AUTO_TAGS).toHaveProperty(tagKey);
      }
    }
  });
});

describe("LOCALE_RANGES constant", () => {
  it("has all 4 locale categories", () => {
    expect(LOCALE_RANGES).toHaveProperty("CITY");
    expect(LOCALE_RANGES).toHaveProperty("SUBURB");
    expect(LOCALE_RANGES).toHaveProperty("TOWN");
    expect(LOCALE_RANGES).toHaveProperty("RURAL");
  });

  it("CITY contains codes 11, 12, 13", () => {
    expect([...LOCALE_RANGES.CITY]).toEqual([11, 12, 13]);
  });

  it("SUBURB contains codes 21, 22, 23", () => {
    expect([...LOCALE_RANGES.SUBURB]).toEqual([21, 22, 23]);
  });

  it("TOWN contains codes 31, 32, 33", () => {
    expect([...LOCALE_RANGES.TOWN]).toEqual([31, 32, 33]);
  });

  it("RURAL contains codes 41, 42, 43", () => {
    expect([...LOCALE_RANGES.RURAL]).toEqual([41, 42, 43]);
  });

  it("each category has exactly 3 codes", () => {
    for (const key of Object.keys(LOCALE_RANGES) as Array<keyof typeof LOCALE_RANGES>) {
      expect(LOCALE_RANGES[key]).toHaveLength(3);
    }
  });
});

describe("AUTO_TAG_NAMES constant", () => {
  it("includes every tag name defined in AUTO_TAGS", () => {
    const expectedNames = Object.values(AUTO_TAGS).map((t) => t.name);
    expect(AUTO_TAG_NAMES).toEqual(expectedNames);
  });

  it("has no duplicate names", () => {
    const unique = new Set(AUTO_TAG_NAMES);
    expect(unique.size).toBe(AUTO_TAG_NAMES.length);
  });
});

describe("COMPETITOR_TAG_NAMES constant", () => {
  it("includes all 9 competitor tag names (3 competitors x 3 FYs)", () => {
    expect(COMPETITOR_TAG_NAMES).toHaveLength(9);
  });

  it("contains the expected tag names", () => {
    const expected = [
      "Proximity Learning FY24",
      "Proximity Learning FY25",
      "Proximity Learning FY26",
      "Elevate K12 FY24",
      "Elevate K12 FY25",
      "Elevate K12 FY26",
      "Tutored By Teachers FY24",
      "Tutored By Teachers FY25",
      "Tutored By Teachers FY26",
    ];
    expect(COMPETITOR_TAG_NAMES).toEqual(expected);
  });
});

// ===========================================================================
// 2. ensureAutoTagsExist
// ===========================================================================

describe("ensureAutoTagsExist", () => {
  it("upserts every tag defined in AUTO_TAGS", async () => {
    vi.mocked(prisma.tag.upsert).mockResolvedValue({} as any);

    await ensureAutoTagsExist();

    const allTags = Object.values(AUTO_TAGS);
    expect(prisma.tag.upsert).toHaveBeenCalledTimes(allTags.length);

    for (const { name, color } of allTags) {
      expect(prisma.tag.upsert).toHaveBeenCalledWith({
        where: { name },
        update: {},
        create: { name, color },
      });
    }
  });
});

// ===========================================================================
// 3. syncClassificationTagsForDistrict
// ===========================================================================

describe("syncClassificationTagsForDistrict", () => {
  const LEAID = "0100001";

  // ----- Fullmind tag logic -----

  describe("Fullmind tags", () => {
    it("applies 'Fullmind Return' when FY26 invoicing > 0", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { invoicing: 50000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      // Expect create to be called with the Fullmind Return tag
      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Return",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
      // Should NOT apply Churn Risk or Win Back
      const createCalls = mockTx.districtTag.create.mock.calls.map((c: any) => c[0].data.tagId);
      const churnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Churn Risk",
      )!.id;
      expect(createCalls).not.toContain(churnId);
    });

    it("applies 'Fullmind Return' when FY26 totalRevenue > 0 (no invoicing)", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { totalRevenue: 12000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Return",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'Churn Risk' when FY26 bookings > 0 but no invoicing or totalRevenue", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { closedWonBookings: 10000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Churn Risk",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'Fullmind Win Back - FY25' when FY25 had any signal but no FY26 signal", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY25", { invoicing: 30000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Win Back - FY25",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'Fullmind Win Back - FY25' when only FY25 bookings existed", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY25", { closedWonBookings: 5000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Win Back - FY25",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'Fullmind Win Back - FY25' when only FY25 totalRevenue existed", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY25", { totalRevenue: 8000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Win Back - FY25",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies no Fullmind tag when there is no FY25 or FY26 signal", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([]);
      vi.mocked(prisma.district.count).mockResolvedValue(1);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      expect(mockTx.districtTag.create).not.toHaveBeenCalled();
    });

    it("Fullmind Return takes priority over Churn Risk when both invoicing and bookings exist in FY26", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { invoicing: 20000, closedWonBookings: 15000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const fullmindReturnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Return",
      )!.id;
      const churnRiskId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Churn Risk",
      )!.id;

      const createdTagIds = mockTx.districtTag.create.mock.calls.map(
        (c: any) => c[0].data.tagId,
      );
      expect(createdTagIds).toContain(fullmindReturnId);
      expect(createdTagIds).not.toContain(churnRiskId);
    });
  });

  // ----- EK12 tag logic -----

  describe("EK12 tags", () => {
    it("applies 'EK12 Return' when FY26 totalRevenue > 0", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 25000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Return",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'EK12 Win Back - FY25' when FY25 totalRevenue > 0 but no FY26", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        { vendor: "elevate", fiscalYear: "FY25", totalRevenue: 18000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Win Back - FY25",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("applies 'EK12 Win Back - FY24' when only FY24 totalRevenue > 0", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        { vendor: "elevate", fiscalYear: "FY24", totalRevenue: 10000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const tagId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Win Back - FY24",
      )!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it("EK12 Return takes priority over Win Back when multiple FYs have revenue", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        { vendor: "elevate", fiscalYear: "FY24", totalRevenue: 5000, invoicing: 0, closedWonBookings: 0 },
        { vendor: "elevate", fiscalYear: "FY25", totalRevenue: 8000, invoicing: 0, closedWonBookings: 0 },
        { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 12000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const ek12ReturnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Return",
      )!.id;
      const ek12Wb25Id = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Win Back - FY25",
      )!.id;
      const ek12Wb24Id = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Win Back - FY24",
      )!.id;

      const createdTagIds = mockTx.districtTag.create.mock.calls.map(
        (c: any) => c[0].data.tagId,
      );
      expect(createdTagIds).toContain(ek12ReturnId);
      expect(createdTagIds).not.toContain(ek12Wb25Id);
      expect(createdTagIds).not.toContain(ek12Wb24Id);
    });

    it("applies no EK12 tag when financials are empty", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([]);
      vi.mocked(prisma.district.count).mockResolvedValue(1);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      expect(mockTx.districtTag.create).not.toHaveBeenCalled();
    });
  });

  // ----- Combined Fullmind + EK12 -----

  describe("combined Fullmind + EK12 tags", () => {
    it("applies both Fullmind Return and EK12 Return simultaneously", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { invoicing: 40000 }),
        { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 20000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const fullmindReturnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Fullmind Return",
      )!.id;
      const ek12ReturnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Return",
      )!.id;

      const createdTagIds = mockTx.districtTag.create.mock.calls.map(
        (c: any) => c[0].data.tagId,
      );
      expect(createdTagIds).toContain(fullmindReturnId);
      expect(createdTagIds).toContain(ek12ReturnId);
      expect(mockTx.districtTag.create).toHaveBeenCalledTimes(2);
    });

    it("applies Churn Risk + EK12 Win Back FY25 simultaneously", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { closedWonBookings: 7000 }),
        { vendor: "elevate", fiscalYear: "FY25", totalRevenue: 15000, invoicing: 0, closedWonBookings: 0 },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      const churnId = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "Churn Risk",
      )!.id;
      const ek12Wb25Id = makeTagRecords(CLASSIFICATION_TAG_NAMES).find(
        (t) => t.name === "EK12 Win Back - FY25",
      )!.id;

      const createdTagIds = mockTx.districtTag.create.mock.calls.map(
        (c: any) => c[0].data.tagId,
      );
      expect(createdTagIds).toContain(churnId);
      expect(createdTagIds).toContain(ek12Wb25Id);
      expect(mockTx.districtTag.create).toHaveBeenCalledTimes(2);
    });
  });

  // ----- Edge cases -----

  describe("edge cases", () => {
    it("returns early when district does not exist and no financials found", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([]);
      vi.mocked(prisma.district.count).mockResolvedValue(0);

      await syncClassificationTagsForDistrict(LEAID);

      expect(prisma.tag.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("clears existing classification tags before adding new ones", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        makeFullmindRow("FY26", { invoicing: 10000 }),
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      // deleteMany should be called before create
      expect(mockTx.districtTag.deleteMany).toHaveBeenCalledTimes(1);

      const deleteCall = mockTx.districtTag.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.districtLeaid).toBe(LEAID);
      expect(deleteCall.where.tagId.in).toEqual(
        expect.arrayContaining(
          makeTagRecords(CLASSIFICATION_TAG_NAMES).map((t) => t.id),
        ),
      );

      // Verify deleteMany was invoked before create
      const deleteOrder = mockTx.districtTag.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.districtTag.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("handles null revenue fields gracefully (treats as 0)", async () => {
      vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
        { vendor: "fullmind", fiscalYear: "FY25", invoicing: null, totalRevenue: null, closedWonBookings: null },
        { vendor: "fullmind", fiscalYear: "FY26", invoicing: null, totalRevenue: null, closedWonBookings: null },
      ] as any);
      mockClassificationTagLookup();

      await syncClassificationTagsForDistrict(LEAID);

      // No tags applied when everything is null
      expect(mockTx.districtTag.create).not.toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// 4. syncLocaleTagForDistrict
// ===========================================================================

describe("syncLocaleTagForDistrict", () => {
  const LEAID = "0100002";

  describe("locale code mapping", () => {
    it.each([
      { code: 11, expectedTag: "City" },
      { code: 12, expectedTag: "City" },
      { code: 13, expectedTag: "City" },
    ])("maps locale code $code to '$expectedTag'", async ({ code, expectedTag }) => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: code,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      const tagId = makeTagRecords(LOCALE_TAG_NAMES).find((t) => t.name === expectedTag)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it.each([
      { code: 21, expectedTag: "Suburb" },
      { code: 22, expectedTag: "Suburb" },
      { code: 23, expectedTag: "Suburb" },
    ])("maps locale code $code to '$expectedTag'", async ({ code, expectedTag }) => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: code,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      const tagId = makeTagRecords(LOCALE_TAG_NAMES).find((t) => t.name === expectedTag)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it.each([
      { code: 31, expectedTag: "Town" },
      { code: 32, expectedTag: "Town" },
      { code: 33, expectedTag: "Town" },
    ])("maps locale code $code to '$expectedTag'", async ({ code, expectedTag }) => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: code,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      const tagId = makeTagRecords(LOCALE_TAG_NAMES).find((t) => t.name === expectedTag)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });

    it.each([
      { code: 41, expectedTag: "Rural" },
      { code: 42, expectedTag: "Rural" },
      { code: 43, expectedTag: "Rural" },
    ])("maps locale code $code to '$expectedTag'", async ({ code, expectedTag }) => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: code,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      const tagId = makeTagRecords(LOCALE_TAG_NAMES).find((t) => t.name === expectedTag)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    });
  });

  describe("no tag assigned", () => {
    it("does not assign a tag when urbanCentricLocale is null", async () => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: null,
      } as any);

      await syncLocaleTagForDistrict(LEAID);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.tag.findMany).not.toHaveBeenCalled();
    });

    it("returns early when district is not found", async () => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue(null);

      await syncLocaleTagForDistrict(LEAID);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.tag.findMany).not.toHaveBeenCalled();
    });
  });

  describe("transaction behavior", () => {
    it("deletes existing locale tags before adding new one", async () => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: 22,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      expect(mockTx.districtTag.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockTx.districtTag.create).toHaveBeenCalledTimes(1);

      // deleteMany before create
      const deleteOrder = mockTx.districtTag.deleteMany.mock.invocationCallOrder[0];
      const createOrder = mockTx.districtTag.create.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(createOrder);
    });

    it("deletes all locale tag IDs from the district", async () => {
      vi.mocked(prisma.district.findUnique).mockResolvedValue({
        urbanCentricLocale: 11,
      } as any);
      mockLocaleTagLookup();

      await syncLocaleTagForDistrict(LEAID);

      const deleteCall = mockTx.districtTag.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.districtLeaid).toBe(LEAID);
      // All 4 locale tag IDs should be in the "in" array
      const allLocaleTagIds = makeTagRecords(LOCALE_TAG_NAMES).map((t) => t.id);
      expect(deleteCall.where.tagId.in).toEqual(expect.arrayContaining(allLocaleTagIds));
    });
  });
});

// ===========================================================================
// 5. syncCompetitorTagsForDistrict
// ===========================================================================

describe("syncCompetitorTagsForDistrict", () => {
  const LEAID = "0100003";

  it("applies tags when totalRevenue > 0", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "proximity", fiscalYear: "FY25", totalRevenue: 30000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    const tagId = makeTagRecords(COMPETITOR_TAG_NAMES).find(
      (t) => t.name === "Proximity Learning FY25",
    )!.id;
    expect(mockTx.districtTag.create).toHaveBeenCalledWith({
      data: { districtLeaid: LEAID, tagId },
    });
  });

  it("does not apply tags when totalRevenue is 0", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "proximity", fiscalYear: "FY25", totalRevenue: 0 },
      { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 0 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    expect(mockTx.districtTag.create).not.toHaveBeenCalled();
  });

  it("applies multiple vendor FY tags simultaneously", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "proximity", fiscalYear: "FY24", totalRevenue: 10000 },
      { vendor: "proximity", fiscalYear: "FY25", totalRevenue: 15000 },
      { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 20000 },
      { vendor: "tbt", fiscalYear: "FY24", totalRevenue: 5000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    const tagRecords = makeTagRecords(COMPETITOR_TAG_NAMES);
    const expectedTagNames = [
      "Proximity Learning FY24",
      "Proximity Learning FY25",
      "Elevate K12 FY26",
      "Tutored By Teachers FY24",
    ];

    expect(mockTx.districtTag.create).toHaveBeenCalledTimes(expectedTagNames.length);

    for (const tagName of expectedTagNames) {
      const tagId = tagRecords.find((t) => t.name === tagName)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    }
  });

  it("ignores unknown vendor slugs not in COMPETITOR_TAG_MAP", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "unknown_vendor", fiscalYear: "FY25", totalRevenue: 50000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    expect(mockTx.districtTag.create).not.toHaveBeenCalled();
  });

  it("ignores unknown fiscal years not in COMPETITOR_TAG_MAP", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "proximity", fiscalYear: "FY23", totalRevenue: 50000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    expect(mockTx.districtTag.create).not.toHaveBeenCalled();
  });

  it("clears all competitor tags before adding new ones", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "elevate", fiscalYear: "FY26", totalRevenue: 9000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    expect(mockTx.districtTag.deleteMany).toHaveBeenCalledTimes(1);

    const deleteCall = mockTx.districtTag.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.districtLeaid).toBe(LEAID);
    const allCompetitorTagIds = makeTagRecords(COMPETITOR_TAG_NAMES).map((t) => t.id);
    expect(deleteCall.where.tagId.in).toEqual(expect.arrayContaining(allCompetitorTagIds));

    // deleteMany before create
    const deleteOrder = mockTx.districtTag.deleteMany.mock.invocationCallOrder[0];
    const createOrder = mockTx.districtTag.create.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it("handles empty financials list", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([]);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    // Still clears existing tags (deleteMany in transaction)
    expect(mockTx.districtTag.deleteMany).toHaveBeenCalledTimes(1);
    // But does not add any new tags
    expect(mockTx.districtTag.create).not.toHaveBeenCalled();
  });

  it("applies all tags for a single vendor across all FYs", async () => {
    vi.mocked(prisma.districtFinancials.findMany).mockResolvedValue([
      { vendor: "tbt", fiscalYear: "FY24", totalRevenue: 1000 },
      { vendor: "tbt", fiscalYear: "FY25", totalRevenue: 2000 },
      { vendor: "tbt", fiscalYear: "FY26", totalRevenue: 3000 },
    ] as any);
    mockCompetitorTagLookup();

    await syncCompetitorTagsForDistrict(LEAID);

    const tagRecords = makeTagRecords(COMPETITOR_TAG_NAMES);
    expect(mockTx.districtTag.create).toHaveBeenCalledTimes(3);

    for (const fy of ["FY24", "FY25", "FY26"]) {
      const tagName = `Tutored By Teachers ${fy}`;
      const tagId = tagRecords.find((t) => t.name === tagName)!.id;
      expect(mockTx.districtTag.create).toHaveBeenCalledWith({
        data: { districtLeaid: LEAID, tagId },
      });
    }
  });
});
