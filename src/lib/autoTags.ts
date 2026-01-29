// src/lib/autoTags.ts
import prisma from "@/lib/prisma";

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

  // Get tag IDs
  const customerTag = await getTagByName(AUTO_TAGS.CUSTOMER.name);
  const pipelineTag = await getTagByName(AUTO_TAGS.PIPELINE.name);
  const prospectTag = await getTagByName(AUTO_TAGS.PROSPECT.name);
  const vipTag = await getTagByName(AUTO_TAGS.VIP.name);
  const winBackTag = await getTagByName(AUTO_TAGS.WIN_BACK_TARGET.name);

  // Sync Customer tag
  if (customerTag) {
    if (isCustomer) {
      await addTagToDistrict(leaid, customerTag.id);
    } else {
      await removeTagFromDistrict(leaid, customerTag.id);
    }
  }

  // Sync Pipeline tag
  if (pipelineTag) {
    if (hasOpenPipeline) {
      await addTagToDistrict(leaid, pipelineTag.id);
    } else {
      await removeTagFromDistrict(leaid, pipelineTag.id);
    }
  }

  // Sync Prospect tag
  if (prospectTag) {
    if (isProspect) {
      await addTagToDistrict(leaid, prospectTag.id);
    } else {
      await removeTagFromDistrict(leaid, prospectTag.id);
    }
  }

  // Sync VIP tag
  if (vipTag) {
    if (isVIP) {
      await addTagToDistrict(leaid, vipTag.id);
    } else {
      await removeTagFromDistrict(leaid, vipTag.id);
    }
  }

  // Sync Win Back Target tag
  if (winBackTag) {
    if (isWinBackTarget) {
      await addTagToDistrict(leaid, winBackTag.id);
    } else {
      await removeTagFromDistrict(leaid, winBackTag.id);
    }
  }
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

  // Get all locale tag IDs
  const cityTag = await getTagByName(AUTO_TAGS.CITY.name);
  const suburbTag = await getTagByName(AUTO_TAGS.SUBURB.name);
  const townTag = await getTagByName(AUTO_TAGS.TOWN.name);
  const ruralTag = await getTagByName(AUTO_TAGS.RURAL.name);

  // Remove all locale tags first
  if (cityTag) await removeTagFromDistrict(leaid, cityTag.id);
  if (suburbTag) await removeTagFromDistrict(leaid, suburbTag.id);
  if (townTag) await removeTagFromDistrict(leaid, townTag.id);
  if (ruralTag) await removeTagFromDistrict(leaid, ruralTag.id);

  // Add the correct locale tag
  if (LOCALE_RANGES.CITY.includes(locale) && cityTag) {
    await addTagToDistrict(leaid, cityTag.id);
  } else if (LOCALE_RANGES.SUBURB.includes(locale) && suburbTag) {
    await addTagToDistrict(leaid, suburbTag.id);
  } else if (LOCALE_RANGES.TOWN.includes(locale) && townTag) {
    await addTagToDistrict(leaid, townTag.id);
  } else if (LOCALE_RANGES.RURAL.includes(locale) && ruralTag) {
    await addTagToDistrict(leaid, ruralTag.id);
  }
}
