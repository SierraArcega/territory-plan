// src/lib/autoTags.ts
import prisma from "./prisma";

// Auto-tag definitions with names and colors
export const AUTO_TAGS = {
  // Manual classification tags
  CHURN_RISK: { name: "Churn Risk", color: "#F37167" },
  KEY_ACCOUNT: { name: "Key Account", color: "#9f7aea" },
  EK12_RETURN: { name: "EK12 Return", color: "#E07A5F" },
  EK12_NEW_BIZ_TARGET: { name: "EK12 New Biz Target", color: "#ed8936" },
  EK12_WIN_BACK_FY25: { name: "EK12 Win Back - FY25", color: "#d97706" },
  EK12_WIN_BACK_FY24: { name: "EK12 Win Back - FY24", color: "#b45309" },
  FULLMIND_RETURN: { name: "Fullmind Return", color: "#6EA3BE" },
  FULLMIND_NEW_BIZ_TARGET: { name: "Fullmind New Biz Target", color: "#38b2ac" },
  FULLMIND_WIN_BACK_FY25: { name: "Fullmind Win Back - FY25", color: "#3182ce" },
  FULLMIND_WIN_BACK_FY26: { name: "Fullmind Win Back - FY26", color: "#2563eb" },
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
 * Syncs auto-tags for a single district.
 * Currently a no-op for classification tags (manually applied).
 * Retained for locale and competitor tag syncing via separate functions.
 */
export async function syncAutoTagsForDistrict(_leaid: string): Promise<void> {
  // Classification tags (Churn Risk, Key Account, EK12/Fullmind tags)
  // are manually applied — no auto-sync logic needed.
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
