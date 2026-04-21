// src/lib/autoTags.ts
import prisma from "@/lib/prisma";

// Auto-tag definitions with names and colors
export const AUTO_TAGS = {
  // Classification tags
  CHURN_RISK: { name: "Churn Risk", color: "#e53e3e" },
  KEY_ACCOUNT: { name: "Key Account", color: "#ed8936" },
  EK12_RETURN: { name: "EK12 Return", color: "#6EA3BE" },
  EK12_NEW_BIZ_TARGET: { name: "EK12 New Biz Target", color: "#6EA3BE" },
  EK12_WIN_BACK_FY25: { name: "EK12 Win Back - FY25", color: "#6EA3BE" },
  EK12_WIN_BACK_FY24: { name: "EK12 Win Back - FY24", color: "#6EA3BE" },
  FULLMIND_RETURN: { name: "Fullmind Return", color: "#403770" },
  FULLMIND_NEW_BIZ_TARGET: { name: "Fullmind New Biz Target", color: "#403770" },
  FULLMIND_WIN_BACK_FY25: { name: "Fullmind Win Back - FY25", color: "#403770" },
  FULLMIND_WIN_BACK_FY26: { name: "Fullmind Win Back - FY26", color: "#403770" },
  MISSING_RENEWAL_OPP: { name: "Missing Renewal Opp", color: "#F37167" },
  // Locale tags
  CITY: { name: "City", color: "#403770" },
  SUBURB: { name: "Suburb", color: "#48bb78" },
  TOWN: { name: "Town", color: "#EC4899" },
  RURAL: { name: "Rural", color: "#A16207" },
  // Competitor tags - auto-applied based on district_financials data (non-fullmind vendors)
  PROXIMITY_LEARNING_FY24: { name: "Proximity Learning FY24", color: "#6EA3BE" },
  PROXIMITY_LEARNING_FY25: { name: "Proximity Learning FY25", color: "#6EA3BE" },
  PROXIMITY_LEARNING_FY26: { name: "Proximity Learning FY26", color: "#6EA3BE" },
  ELEVATE_K12_FY24: { name: "Elevate K12 FY24", color: "#E07A5F" },
  ELEVATE_K12_FY25: { name: "Elevate K12 FY25", color: "#E07A5F" },
  ELEVATE_K12_FY26: { name: "Elevate K12 FY26", color: "#E07A5F" },
  TUTORED_BY_TEACHERS_FY24: { name: "Tutored By Teachers FY24", color: "#7C3AED" },
  TUTORED_BY_TEACHERS_FY25: { name: "Tutored By Teachers FY25", color: "#7C3AED" },
  TUTORED_BY_TEACHERS_FY26: { name: "Tutored By Teachers FY26", color: "#7C3AED" },
} as const;

// Competitor tag mapping: vendor slug + FY -> tag key
export const COMPETITOR_TAG_MAP: Record<string, Record<string, keyof typeof AUTO_TAGS>> = {
  proximity: {
    FY24: "PROXIMITY_LEARNING_FY24",
    FY25: "PROXIMITY_LEARNING_FY25",
    FY26: "PROXIMITY_LEARNING_FY26",
  },
  elevate: {
    FY24: "ELEVATE_K12_FY24",
    FY25: "ELEVATE_K12_FY25",
    FY26: "ELEVATE_K12_FY26",
  },
  tbt: {
    FY24: "TUTORED_BY_TEACHERS_FY24",
    FY25: "TUTORED_BY_TEACHERS_FY25",
    FY26: "TUTORED_BY_TEACHERS_FY26",
  },
};

// Get all competitor tag names
export const COMPETITOR_TAG_NAMES = [
  AUTO_TAGS.PROXIMITY_LEARNING_FY24.name,
  AUTO_TAGS.PROXIMITY_LEARNING_FY25.name,
  AUTO_TAGS.PROXIMITY_LEARNING_FY26.name,
  AUTO_TAGS.ELEVATE_K12_FY24.name,
  AUTO_TAGS.ELEVATE_K12_FY25.name,
  AUTO_TAGS.ELEVATE_K12_FY26.name,
  AUTO_TAGS.TUTORED_BY_TEACHERS_FY24.name,
  AUTO_TAGS.TUTORED_BY_TEACHERS_FY25.name,
  AUTO_TAGS.TUTORED_BY_TEACHERS_FY26.name,
];

// Locale code ranges
export const LOCALE_RANGES = {
  CITY: [11, 12, 13],
  SUBURB: [21, 22, 23],
  TOWN: [31, 32, 33],
  RURAL: [41, 42, 43],
} as const;

// Get all auto-tag names for easy lookup
export const AUTO_TAG_NAMES = Object.values(AUTO_TAGS).map((t) => t.name);

/**
 * Ensures all auto-tags exist in the database.
 * Call this on app initialization or via a migration.
 */
export async function ensureAutoTagsExist(): Promise<void> {
  const tagDefs = Object.values(AUTO_TAGS);

  for (const { name, color } of tagDefs) {
    await prisma.tag.upsert({
      where: { name },
      update: {}, // Don't update color if tag already exists
      create: { name, color },
    });
  }
}

/**
 * Gets multiple tags by name from the database in a single query.
 * Returns a Map of tag name to tag id.
 */
async function getTagsByNames(names: string[]): Promise<Map<string, number>> {
  const tags = await prisma.tag.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true },
  });
  return new Map(tags.map((t) => [t.name, t.id]));
}

// All classification tag names that are auto-synced (excluding Key Account and New Biz which are manual)
const CLASSIFICATION_TAG_NAMES = [
  AUTO_TAGS.CHURN_RISK.name,
  AUTO_TAGS.EK12_RETURN.name,
  AUTO_TAGS.EK12_WIN_BACK_FY25.name,
  AUTO_TAGS.EK12_WIN_BACK_FY24.name,
  AUTO_TAGS.FULLMIND_RETURN.name,
  AUTO_TAGS.FULLMIND_WIN_BACK_FY25.name,
];

/**
 * Syncs classification tags for a single district based on revenue data.
 *
 * Fullmind (from district_financials table, vendor = "fullmind"):
 *   - Fullmind Return: FY26 invoicing > 0 OR totalRevenue > 0
 *   - Churn Risk: FY26 bookings > 0 but NO FY26 invoicing/totalRevenue
 *   - Fullmind Win Back FY25: had FY25 revenue signal, no FY26 signal at all
 *
 * EK12 (from district_financials table, vendor = "elevate"):
 *   - EK12 Return: FY26 totalRevenue > 0
 *   - EK12 Win Back FY25: FY25 totalRevenue > 0 but NOT FY26
 *   - EK12 Win Back FY24: FY24 totalRevenue > 0 but NOT FY25 or FY26
 */
export async function syncClassificationTagsForDistrict(leaid: string): Promise<void> {
  // Fetch both Fullmind and EK12 data from district_financials in a single query
  const financials = await prisma.districtFinancials.findMany({
    where: { leaid },
    select: { vendor: true, fiscalYear: true, totalRevenue: true, invoicing: true, closedWonBookings: true },
  });

  if (financials.length === 0) {
    // Check if district exists at all before returning early
    const exists = await prisma.district.count({ where: { leaid } });
    if (!exists) return;
  }

  // Split into Fullmind and EK12 maps keyed by fiscal year
  const fmByFY: Record<string, { invoicing: number; totalRevenue: number; closedWonBookings: number }> = {};
  const ek12ByFY: Record<string, number> = {};

  for (const row of financials) {
    if (row.vendor === "fullmind") {
      fmByFY[row.fiscalYear] = {
        invoicing: Number(row.invoicing ?? 0),
        totalRevenue: Number(row.totalRevenue ?? 0),
        closedWonBookings: Number(row.closedWonBookings ?? 0),
      };
    } else if (row.vendor === "elevate") {
      ek12ByFY[row.fiscalYear] = Number(row.totalRevenue ?? 0);
    }
  }

  // Fullmind revenue signals per FY
  const fm25Invoicing = fmByFY["FY25"]?.invoicing ?? 0;
  const fm25Sessions = fmByFY["FY25"]?.totalRevenue ?? 0;
  const fm25Bookings = fmByFY["FY25"]?.closedWonBookings ?? 0;
  const fm26Invoicing = fmByFY["FY26"]?.invoicing ?? 0;
  const fm26Sessions = fmByFY["FY26"]?.totalRevenue ?? 0;
  const fm26Bookings = fmByFY["FY26"]?.closedWonBookings ?? 0;

  const fm25HasRevenue = fm25Invoicing > 0 || fm25Sessions > 0;
  const fm25HasAnySignal = fm25HasRevenue || fm25Bookings > 0;
  const fm26HasRevenue = fm26Invoicing > 0 || fm26Sessions > 0;
  const fm26HasAnySignal = fm26HasRevenue || fm26Bookings > 0;

  // EK12 signals per FY
  const ek12FY24 = (ek12ByFY["FY24"] ?? 0) > 0;
  const ek12FY25 = (ek12ByFY["FY25"] ?? 0) > 0;
  const ek12FY26 = (ek12ByFY["FY26"] ?? 0) > 0;

  // Determine which tags should be applied
  const tagsToApply = new Set<string>();

  // Fullmind tags
  if (fm26HasRevenue) {
    tagsToApply.add(AUTO_TAGS.FULLMIND_RETURN.name);
  } else if (fm26Bookings > 0) {
    // Bookings exist but no actual revenue — churn risk
    tagsToApply.add(AUTO_TAGS.CHURN_RISK.name);
  } else if (fm25HasAnySignal) {
    tagsToApply.add(AUTO_TAGS.FULLMIND_WIN_BACK_FY25.name);
  }

  // EK12 tags
  if (ek12FY26) {
    tagsToApply.add(AUTO_TAGS.EK12_RETURN.name);
  } else if (ek12FY25) {
    tagsToApply.add(AUTO_TAGS.EK12_WIN_BACK_FY25.name);
  } else if (ek12FY24) {
    tagsToApply.add(AUTO_TAGS.EK12_WIN_BACK_FY24.name);
  }

  // Get tag IDs
  const tagMap = await getTagsByNames(CLASSIFICATION_TAG_NAMES);

  await prisma.$transaction(async (tx) => {
    // Remove all classification tags first
    const allTagIds = Array.from(tagMap.values());
    if (allTagIds.length > 0) {
      await tx.districtTag.deleteMany({
        where: { districtLeaid: leaid, tagId: { in: allTagIds } },
      });
    }

    // Apply the computed tags
    for (const tagName of tagsToApply) {
      const tagId = tagMap.get(tagName);
      if (tagId !== undefined) {
        await tx.districtTag.create({
          data: { districtLeaid: leaid, tagId },
        });
      }
    }
  });
}

/**
 * Bulk-syncs classification tags for all districts using set-based SQL.
 * Much faster than per-district — a few queries instead of ~55k.
 */
export async function syncAllClassificationTags(): Promise<number> {
  // 1. Resolve tag IDs
  const tagMap = await getTagsByNames(CLASSIFICATION_TAG_NAMES);
  const tagIds = Array.from(tagMap.values());
  if (tagIds.length === 0) return 0;

  const fullmindReturnId = tagMap.get(AUTO_TAGS.FULLMIND_RETURN.name);
  const churnRiskId = tagMap.get(AUTO_TAGS.CHURN_RISK.name);
  const fmWinBackFy25Id = tagMap.get(AUTO_TAGS.FULLMIND_WIN_BACK_FY25.name);
  const ek12ReturnId = tagMap.get(AUTO_TAGS.EK12_RETURN.name);
  const ek12WbFy25Id = tagMap.get(AUTO_TAGS.EK12_WIN_BACK_FY25.name);
  const ek12WbFy24Id = tagMap.get(AUTO_TAGS.EK12_WIN_BACK_FY24.name);

  // 2. Fetch all Fullmind and EK12 data from district_financials in one query
  const allFinancials = await prisma.districtFinancials.findMany({
    where: { vendor: { in: ["fullmind", "elevate"] } },
    select: { leaid: true, vendor: true, fiscalYear: true, totalRevenue: true, invoicing: true, closedWonBookings: true },
  });

  // Build Fullmind and EK12 maps keyed by leaid
  const fmMap = new Map<string, Record<string, { invoicing: number; totalRevenue: number; closedWonBookings: number }>>();
  const ek12Map = new Map<string, Record<string, number>>();
  const allLeaids = new Set<string>();

  for (const row of allFinancials) {
    if (!row.leaid) continue;
    allLeaids.add(row.leaid);

    if (row.vendor === "fullmind") {
      if (!fmMap.has(row.leaid)) fmMap.set(row.leaid, {});
      fmMap.get(row.leaid)![row.fiscalYear] = {
        invoicing: Number(row.invoicing ?? 0),
        totalRevenue: Number(row.totalRevenue ?? 0),
        closedWonBookings: Number(row.closedWonBookings ?? 0),
      };
    } else if (row.vendor === "elevate") {
      if (!ek12Map.has(row.leaid)) ek12Map.set(row.leaid, {});
      ek12Map.get(row.leaid)![row.fiscalYear] = Number(row.totalRevenue ?? 0);
    }
  }
  console.log(`Loaded financials for ${allLeaids.size} districts (${fmMap.size} Fullmind, ${ek12Map.size} EK12).`);

  // 3. Compute tags per district
  const inserts: Array<{ districtLeaid: string; tagId: number }> = [];

  for (const leaid of allLeaids) {
    const fm = fmMap.get(leaid);
    const fm25Inv = fm?.["FY25"]?.invoicing ?? 0;
    const fm25Sess = fm?.["FY25"]?.totalRevenue ?? 0;
    const fm25Book = fm?.["FY25"]?.closedWonBookings ?? 0;
    const fm26Inv = fm?.["FY26"]?.invoicing ?? 0;
    const fm26Sess = fm?.["FY26"]?.totalRevenue ?? 0;
    const fm26Book = fm?.["FY26"]?.closedWonBookings ?? 0;

    const fm26HasRevenue = fm26Inv > 0 || fm26Sess > 0;
    const fm25HasAny = fm25Inv > 0 || fm25Sess > 0 || fm25Book > 0;

    // Fullmind classification
    if (fm26HasRevenue && fullmindReturnId) {
      inserts.push({ districtLeaid: leaid, tagId: fullmindReturnId });
    } else if (fm26Book > 0 && churnRiskId) {
      inserts.push({ districtLeaid: leaid, tagId: churnRiskId });
    } else if (fm25HasAny && fmWinBackFy25Id) {
      inserts.push({ districtLeaid: leaid, tagId: fmWinBackFy25Id });
    }

    // EK12 classification
    const ek12 = ek12Map.get(leaid);
    if (ek12) {
      const fy24 = (ek12["FY24"] ?? 0) > 0;
      const fy25 = (ek12["FY25"] ?? 0) > 0;
      const fy26 = (ek12["FY26"] ?? 0) > 0;

      if (fy26 && ek12ReturnId) {
        inserts.push({ districtLeaid: leaid, tagId: ek12ReturnId });
      } else if (fy25 && ek12WbFy25Id) {
        inserts.push({ districtLeaid: leaid, tagId: ek12WbFy25Id });
      } else if (fy24 && ek12WbFy24Id) {
        inserts.push({ districtLeaid: leaid, tagId: ek12WbFy24Id });
      }
    }
  }

  console.log(`Computed ${inserts.length} tag assignments.`);

  // 5. Bulk delete + insert in a transaction
  await prisma.$transaction(async (tx) => {
    // Remove all existing classification tags
    const deleted = await tx.districtTag.deleteMany({
      where: { tagId: { in: tagIds } },
    });
    console.log(`Removed ${deleted.count} old classification tags.`);

    // Batch insert in chunks of 1000
    const CHUNK = 1000;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      await tx.districtTag.createMany({
        data: inserts.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
      if (i + CHUNK < inserts.length) {
        console.log(`  Inserted ${Math.min(i + CHUNK, inserts.length)}/${inserts.length}...`);
      }
    }
  });

  console.log(`Applied ${inserts.length} classification tags.`);
  return allLeaids.size;
}

/**
 * Assigns locale tag to a district based on urbanCentricLocale code.
 * This is static data, so only run on initial data load.
 */
export async function syncLocaleTagForDistrict(leaid: string): Promise<void> {
  const district = await prisma.district.findUnique({
    where: { leaid },
    select: { urbanCentricLocale: true },
  });

  if (!district || district.urbanCentricLocale === null) return;

  const locale = district.urbanCentricLocale;

  // Batch fetch all locale tag IDs in a single query
  const localeTagNames = [
    AUTO_TAGS.CITY.name,
    AUTO_TAGS.SUBURB.name,
    AUTO_TAGS.TOWN.name,
    AUTO_TAGS.RURAL.name,
  ];
  const tagMap = await getTagsByNames(localeTagNames);

  const cityTagId = tagMap.get(AUTO_TAGS.CITY.name);
  const suburbTagId = tagMap.get(AUTO_TAGS.SUBURB.name);
  const townTagId = tagMap.get(AUTO_TAGS.TOWN.name);
  const ruralTagId = tagMap.get(AUTO_TAGS.RURAL.name);

  // Wrap all operations in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Remove all locale tags first
    const allLocaleTagIds = [cityTagId, suburbTagId, townTagId, ruralTagId].filter(
      (id): id is number => id !== undefined
    );

    if (allLocaleTagIds.length > 0) {
      await tx.districtTag.deleteMany({
        where: {
          districtLeaid: leaid,
          tagId: { in: allLocaleTagIds },
        },
      });
    }

    // Add the correct locale tag
    let tagIdToAdd: number | undefined;
    if ((LOCALE_RANGES.CITY as readonly number[]).includes(locale) && cityTagId !== undefined) {
      tagIdToAdd = cityTagId;
    } else if ((LOCALE_RANGES.SUBURB as readonly number[]).includes(locale) && suburbTagId !== undefined) {
      tagIdToAdd = suburbTagId;
    } else if ((LOCALE_RANGES.TOWN as readonly number[]).includes(locale) && townTagId !== undefined) {
      tagIdToAdd = townTagId;
    } else if ((LOCALE_RANGES.RURAL as readonly number[]).includes(locale) && ruralTagId !== undefined) {
      tagIdToAdd = ruralTagId;
    }

    if (tagIdToAdd !== undefined) {
      await tx.districtTag.create({
        data: { districtLeaid: leaid, tagId: tagIdToAdd },
      });
    }
  });
}

/**
 * Syncs competitor tags for a district based on district_financials data (non-fullmind vendors).
 * Tags are added when totalRevenue > 0 for a vendor-FY combination.
 * Tags are removed when no revenue exists.
 */
export async function syncCompetitorTagsForDistrict(leaid: string): Promise<void> {
  // Fetch non-fullmind financials for this district
  const competitorFinancials = await prisma.districtFinancials.findMany({
    where: { leaid, vendor: { not: "fullmind" } },
    select: { vendor: true, fiscalYear: true, totalRevenue: true },
  });

  // Build set of tag names that should be applied
  const tagsToApply = new Set<string>();
  for (const row of competitorFinancials) {
    if (Number(row.totalRevenue) > 0) {
      const competitorMap = COMPETITOR_TAG_MAP[row.vendor];
      if (competitorMap) {
        const tagKey = competitorMap[row.fiscalYear];
        if (tagKey) {
          tagsToApply.add(AUTO_TAGS[tagKey].name);
        }
      }
    }
  }

  // Get all competitor tag IDs
  const tagMap = await getTagsByNames(COMPETITOR_TAG_NAMES);

  // Wrap in transaction
  await prisma.$transaction(async (tx) => {
    // Remove all competitor tags first
    const allCompetitorTagIds = Array.from(tagMap.values());
    if (allCompetitorTagIds.length > 0) {
      await tx.districtTag.deleteMany({
        where: {
          districtLeaid: leaid,
          tagId: { in: allCompetitorTagIds },
        },
      });
    }

    // Add tags that should be applied
    for (const tagName of tagsToApply) {
      const tagId = tagMap.get(tagName);
      if (tagId !== undefined) {
        await tx.districtTag.create({
          data: { districtLeaid: leaid, tagId },
        });
      }
    }
  });
}

/**
 * Computes the set of leaids that should carry the "Missing Renewal Opp" tag.
 * Matches the Increase Targets tab filter exactly:
 *   - FY26 revenue signal (district_financials.total_revenue > 0
 *     OR FY26 Closed Won opp bookings/min commits > 0)
 *   - AND no FY27 closed_won or booked revenue (not already renewed)
 *   - AND no FY27 open_pipeline (no deal in flight)
 */
async function computeMissingRenewalOppLeaids(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ leaid: string }[]>`
    WITH fy26_df AS (
      SELECT leaid FROM district_financials
      WHERE vendor = 'fullmind' AND fiscal_year = 'FY26' AND total_revenue > 0
    ),
    fy26_opp AS (
      SELECT district_lea_id AS leaid
      FROM opportunities
      WHERE school_yr = '2025-26' AND stage ILIKE 'Closed Won%'
        AND district_lea_id IS NOT NULL
      GROUP BY district_lea_id
      HAVING SUM(COALESCE(net_booking_amount, 0))
           + SUM(COALESCE(minimum_purchase_amount, 0)) > 0
    ),
    fy26_any AS (SELECT leaid FROM fy26_df UNION SELECT leaid FROM fy26_opp),
    fy27_done AS (
      SELECT leaid FROM district_financials
      WHERE vendor = 'fullmind' AND fiscal_year = 'FY27'
        AND (COALESCE(closed_won_bookings, 0) + COALESCE(total_revenue, 0)) > 0
    ),
    fy27_pipe AS (
      SELECT leaid FROM district_financials
      WHERE vendor = 'fullmind' AND fiscal_year = 'FY27'
        AND COALESCE(open_pipeline, 0) > 0
    )
    SELECT a.leaid FROM fy26_any a
    WHERE a.leaid NOT IN (SELECT leaid FROM fy27_done WHERE leaid IS NOT NULL)
      AND a.leaid NOT IN (SELECT leaid FROM fy27_pipe WHERE leaid IS NOT NULL)
  `;
  return new Set(rows.map((r) => r.leaid));
}

/**
 * Recomputes the "Missing Renewal Opp" tag for a single district. Call after
 * any mutation that could flip the status: plan district add/remove, FY27 opp
 * stage change, district_financials refresh. Fast path — scoped query, no
 * full table scan.
 */
export async function syncMissingRenewalOppTagForDistrict(
  leaid: string,
): Promise<void> {
  const tag = await prisma.tag.findUnique({
    where: { name: AUTO_TAGS.MISSING_RENEWAL_OPP.name },
    select: { id: true },
  });
  if (!tag) return;

  const rows = await prisma.$queryRaw<{ eligible: boolean }[]>`
    WITH fy26_df AS (
      SELECT 1 AS hit FROM district_financials
      WHERE leaid = ${leaid} AND vendor = 'fullmind' AND fiscal_year = 'FY26'
        AND total_revenue > 0
    ),
    fy26_opp AS (
      SELECT 1 AS hit FROM opportunities
      WHERE district_lea_id = ${leaid}
        AND school_yr = '2025-26'
        AND stage ILIKE 'Closed Won%'
      HAVING SUM(COALESCE(net_booking_amount, 0))
           + SUM(COALESCE(minimum_purchase_amount, 0)) > 0
    ),
    fy27_done AS (
      SELECT 1 AS hit FROM district_financials
      WHERE leaid = ${leaid} AND vendor = 'fullmind' AND fiscal_year = 'FY27'
        AND (COALESCE(closed_won_bookings, 0) + COALESCE(total_revenue, 0)) > 0
    ),
    fy27_pipe AS (
      SELECT 1 AS hit FROM district_financials
      WHERE leaid = ${leaid} AND vendor = 'fullmind' AND fiscal_year = 'FY27'
        AND COALESCE(open_pipeline, 0) > 0
    )
    SELECT
      ((EXISTS (SELECT 1 FROM fy26_df) OR EXISTS (SELECT 1 FROM fy26_opp))
        AND NOT EXISTS (SELECT 1 FROM fy27_done)
        AND NOT EXISTS (SELECT 1 FROM fy27_pipe)) AS eligible
  `;
  const shouldHave = rows[0]?.eligible === true;

  if (shouldHave) {
    await prisma.districtTag.upsert({
      where: { districtLeaid_tagId: { districtLeaid: leaid, tagId: tag.id } },
      create: { districtLeaid: leaid, tagId: tag.id },
      update: {},
    });
  } else {
    await prisma.districtTag.deleteMany({
      where: { districtLeaid: leaid, tagId: tag.id },
    });
  }
}

/**
 * Bulk-syncs the "Missing Renewal Opp" tag across all districts. Replaces the
 * entire tag assignment set in a single transaction.
 */
export async function syncAllMissingRenewalOppTags(): Promise<number> {
  const tag = await prisma.tag.findUnique({
    where: { name: AUTO_TAGS.MISSING_RENEWAL_OPP.name },
    select: { id: true },
  });
  if (!tag) return 0;

  const eligible = await computeMissingRenewalOppLeaids();

  await prisma.$transaction(async (tx) => {
    await tx.districtTag.deleteMany({ where: { tagId: tag.id } });
    if (eligible.size === 0) return;
    const CHUNK = 1000;
    const leaids = Array.from(eligible);
    for (let i = 0; i < leaids.length; i += CHUNK) {
      await tx.districtTag.createMany({
        data: leaids
          .slice(i, i + CHUNK)
          .map((leaid) => ({ districtLeaid: leaid, tagId: tag.id })),
        skipDuplicates: true,
      });
    }
  });

  return eligible.size;
}

/**
 * Syncs competitor tags for all districts that have competitor spend data.
 * Call this after running the competitor spend ETL.
 */
export async function syncAllCompetitorTags(): Promise<number> {
  // Get all distinct LEAIDs with non-fullmind financials
  const distinctLeaids = await prisma.districtFinancials.findMany({
    where: { vendor: { not: "fullmind" }, leaid: { not: null } },
    select: { leaid: true },
    distinct: ["leaid"],
  });

  console.log(`Syncing competitor tags for ${distinctLeaids.length} districts...`);

  for (const { leaid } of distinctLeaids) {
    if (leaid) await syncCompetitorTagsForDistrict(leaid);
  }

  return distinctLeaids.length;
}
