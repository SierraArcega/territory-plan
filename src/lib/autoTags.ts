// src/lib/autoTags.ts
import prisma from "./prisma";

// Auto-tag definitions with names and colors
export const AUTO_TAGS = {
  // Revenue/Pipeline status tags
  CUSTOMER: { name: "Customer", color: "#F37167" },
  PIPELINE: { name: "Pipeline", color: "#6EA3BE" },
  PROSPECT: { name: "Prospect", color: "#38b2ac" },
  VIP: { name: "VIP", color: "#9f7aea" },
  WIN_BACK_TARGET: { name: "Win Back Target", color: "#ed8936" },
  // Locale tags
  CITY: { name: "City", color: "#403770" },
  SUBURB: { name: "Suburb", color: "#48bb78" },
  TOWN: { name: "Town", color: "#EC4899" },
  RURAL: { name: "Rural", color: "#A16207" },
  // Competitor tags - auto-applied based on competitor_spend data
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

// Competitor tag mapping: competitor name + FY -> tag key
export const COMPETITOR_TAG_MAP: Record<string, Record<string, keyof typeof AUTO_TAGS>> = {
  "Proximity Learning": {
    FY24: "PROXIMITY_LEARNING_FY24",
    FY25: "PROXIMITY_LEARNING_FY25",
    FY26: "PROXIMITY_LEARNING_FY26",
  },
  "Elevate K12": {
    FY24: "ELEVATE_K12_FY24",
    FY25: "ELEVATE_K12_FY25",
    FY26: "ELEVATE_K12_FY26",
  },
  "Tutored By Teachers": {
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

// VIP threshold in dollars
export const VIP_REVENUE_THRESHOLD = 100_000;

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

/**
 * Syncs all auto-tags for a single district based on current data.
 * Call this after adding/removing district from a plan or after data refresh.
 *
 * Note: Fullmind data is now directly on the district (consolidated schema).
 */
export async function syncAutoTagsForDistrict(leaid: string): Promise<void> {
  // Fetch district with territory plan membership
  // Fullmind data is now directly on the district (consolidated schema)
  const district = await prisma.district.findUnique({
    where: { leaid },
    include: {
      territoryPlans: { select: { planId: true } },
    },
  });

  if (!district) return;

  const isInAnyPlan = district.territoryPlans.length > 0;

  // Calculate conditions - data is now directly on district
  const isCustomer = district.isCustomer ?? false;
  const hasOpenPipeline = district.hasOpenPipeline ?? false;

  // Current year revenue = FY26 net invoicing + closed won bookings
  const currentYearRevenue =
    Number(district.fy26NetInvoicing ?? 0) +
    Number(district.fy26ClosedWonNetBooking ?? 0);

  // Previous year revenue = FY25 net invoicing + closed won bookings
  const previousYearRevenue =
    Number(district.fy25NetInvoicing ?? 0) +
    Number(district.fy25ClosedWonNetBooking ?? 0);

  const isVIP = currentYearRevenue > VIP_REVENUE_THRESHOLD;
  const isWinBackTarget = previousYearRevenue > 0 && currentYearRevenue === 0;
  const isProspect = isInAnyPlan && !hasOpenPipeline;

  // Batch fetch all tag IDs in a single query
  const tagNames = [
    AUTO_TAGS.CUSTOMER.name,
    AUTO_TAGS.PIPELINE.name,
    AUTO_TAGS.PROSPECT.name,
    AUTO_TAGS.VIP.name,
    AUTO_TAGS.WIN_BACK_TARGET.name,
  ];
  const tagMap = await getTagsByNames(tagNames);

  const customerTagId = tagMap.get(AUTO_TAGS.CUSTOMER.name);
  const pipelineTagId = tagMap.get(AUTO_TAGS.PIPELINE.name);
  const prospectTagId = tagMap.get(AUTO_TAGS.PROSPECT.name);
  const vipTagId = tagMap.get(AUTO_TAGS.VIP.name);
  const winBackTagId = tagMap.get(AUTO_TAGS.WIN_BACK_TARGET.name);

  // Wrap all tag sync operations in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Helper functions that use the transaction client
    const addTag = async (tagId: number) => {
      await tx.districtTag.upsert({
        where: {
          districtLeaid_tagId: { districtLeaid: leaid, tagId },
        },
        update: {},
        create: { districtLeaid: leaid, tagId },
      });
    };

    const removeTag = async (tagId: number) => {
      await tx.districtTag.deleteMany({
        where: { districtLeaid: leaid, tagId },
      });
    };

    // Sync Customer tag
    if (customerTagId !== undefined) {
      if (isCustomer) {
        await addTag(customerTagId);
      } else {
        await removeTag(customerTagId);
      }
    }

    // Sync Pipeline tag
    if (pipelineTagId !== undefined) {
      if (hasOpenPipeline) {
        await addTag(pipelineTagId);
      } else {
        await removeTag(pipelineTagId);
      }
    }

    // Sync Prospect tag
    if (prospectTagId !== undefined) {
      if (isProspect) {
        await addTag(prospectTagId);
      } else {
        await removeTag(prospectTagId);
      }
    }

    // Sync VIP tag
    if (vipTagId !== undefined) {
      if (isVIP) {
        await addTag(vipTagId);
      } else {
        await removeTag(vipTagId);
      }
    }

    // Sync Win Back Target tag
    if (winBackTagId !== undefined) {
      if (isWinBackTarget) {
        await addTag(winBackTagId);
      } else {
        await removeTag(winBackTagId);
      }
    }
  });
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
 * Syncs competitor tags for a district based on competitor_spend data.
 * Tags are added when spend > 0 for a competitor-FY combination.
 * Tags are removed when no spend exists.
 */
export async function syncCompetitorTagsForDistrict(leaid: string): Promise<void> {
  // Fetch competitor spend data for this district
  const competitorSpend = await prisma.competitorSpend.findMany({
    where: { leaid },
    select: { competitor: true, fiscalYear: true, totalSpend: true },
  });

  // Build set of tag names that should be applied
  const tagsToApply = new Set<string>();
  for (const spend of competitorSpend) {
    if (Number(spend.totalSpend) > 0) {
      const competitorMap = COMPETITOR_TAG_MAP[spend.competitor];
      if (competitorMap) {
        const tagKey = competitorMap[spend.fiscalYear];
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
 * Syncs competitor tags for all districts that have competitor spend data.
 * Call this after running the competitor spend ETL.
 */
export async function syncAllCompetitorTags(): Promise<number> {
  // Get all distinct LEAIDs with competitor spend
  const distinctLeaids = await prisma.competitorSpend.findMany({
    select: { leaid: true },
    distinct: ["leaid"],
  });

  console.log(`Syncing competitor tags for ${distinctLeaids.length} districts...`);

  for (const { leaid } of distinctLeaids) {
    await syncCompetitorTagsForDistrict(leaid);
  }

  return distinctLeaids.length;
}
