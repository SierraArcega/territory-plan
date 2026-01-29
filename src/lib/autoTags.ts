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
} as const;

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
 * Gets a tag by name from the database.
 * Returns null if not found.
 */
async function getTagByName(name: string): Promise<{ id: number } | null> {
  return prisma.tag.findUnique({
    where: { name },
    select: { id: true },
  });
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
 * Adds a tag to a district if not already present.
 */
async function addTagToDistrict(leaid: string, tagId: number): Promise<void> {
  await prisma.districtTag.upsert({
    where: {
      districtLeaid_tagId: { districtLeaid: leaid, tagId },
    },
    update: {},
    create: { districtLeaid: leaid, tagId },
  });
}

/**
 * Removes a tag from a district if present.
 */
async function removeTagFromDistrict(leaid: string, tagId: number): Promise<void> {
  await prisma.districtTag.deleteMany({
    where: { districtLeaid: leaid, tagId },
  });
}

/**
 * Syncs all auto-tags for a single district based on current data.
 * Call this after adding/removing district from a plan or after data refresh.
 */
export async function syncAutoTagsForDistrict(leaid: string): Promise<void> {
  // Fetch district data with Fullmind data and territory plan membership
  const district = await prisma.district.findUnique({
    where: { leaid },
    include: {
      fullmindData: true,
      territoryPlans: { select: { planId: true } },
    },
  });

  if (!district) return;

  const fullmind = district.fullmindData;
  const isInAnyPlan = district.territoryPlans.length > 0;

  // Calculate conditions
  const isCustomer = fullmind?.isCustomer ?? false;
  const hasOpenPipeline = fullmind?.hasOpenPipeline ?? false;

  // Current year revenue = FY26 net invoicing + closed won bookings
  const currentYearRevenue = fullmind
    ? Number(fullmind.fy26NetInvoicing) + Number(fullmind.fy26ClosedWonNetBooking)
    : 0;

  // Previous year revenue = FY25 net invoicing + closed won bookings
  const previousYearRevenue = fullmind
    ? Number(fullmind.fy25NetInvoicing) + Number(fullmind.fy25ClosedWonNetBooking)
    : 0;

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
