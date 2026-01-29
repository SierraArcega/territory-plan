# Auto-Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify all district status indicators (Customer, Pipeline, Prospect, VIP, Win Back Target, locale) into a single auto-tag system, replacing special badge rendering.

**Architecture:** Create a centralized `autoTags.ts` module that defines tag constants and sync functions. API endpoints call sync functions after relevant changes. UI components display tags instead of special badges.

**Tech Stack:** Next.js 14, Prisma, React, TypeScript, TailwindCSS

---

## Task 1: Create Auto-Tags Constants Module

**Files:**
- Create: `src/lib/autoTags.ts`

**Step 1: Write the auto-tags constants file**

```typescript
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
```

**Step 2: Commit**

```bash
git add src/lib/autoTags.ts
git commit -m "feat: add auto-tags constants and sync functions

- Define 9 auto-tags: Customer, Pipeline, Prospect, VIP, Win Back Target, City, Suburb, Town, Rural
- Add syncAutoTagsForDistrict() for revenue/pipeline tags
- Add syncLocaleTagForDistrict() for static locale tags
- Add ensureAutoTagsExist() for initialization"
```

---

## Task 2: Create Seed Script for Auto-Tags

**Files:**
- Create: `scripts/seed-auto-tags.ts`

**Step 1: Write the seed script**

```typescript
// scripts/seed-auto-tags.ts
import prisma from "../src/lib/prisma";
import {
  ensureAutoTagsExist,
  syncAutoTagsForDistrict,
  syncLocaleTagForDistrict,
} from "../src/lib/autoTags";

async function main() {
  console.log("Seeding auto-tags...");

  // Step 1: Ensure all auto-tags exist in the Tag table
  await ensureAutoTagsExist();
  console.log("Auto-tags created/verified in database.");

  // Step 2: Get all districts
  const districts = await prisma.district.findMany({
    select: { leaid: true },
  });
  console.log(`Found ${districts.length} districts to process.`);

  // Step 3: Sync locale tags for all districts (one-time)
  console.log("Syncing locale tags...");
  let localeCount = 0;
  for (const { leaid } of districts) {
    await syncLocaleTagForDistrict(leaid);
    localeCount++;
    if (localeCount % 1000 === 0) {
      console.log(`  Processed ${localeCount}/${districts.length} locale tags...`);
    }
  }
  console.log(`Locale tags synced for ${localeCount} districts.`);

  // Step 4: Sync auto-tags (Customer, Pipeline, VIP, Win Back, Prospect)
  console.log("Syncing auto-tags...");
  let autoCount = 0;
  for (const { leaid } of districts) {
    await syncAutoTagsForDistrict(leaid);
    autoCount++;
    if (autoCount % 1000 === 0) {
      console.log(`  Processed ${autoCount}/${districts.length} auto-tags...`);
    }
  }
  console.log(`Auto-tags synced for ${autoCount} districts.`);

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error("Error seeding auto-tags:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Commit**

```bash
git add scripts/seed-auto-tags.ts
git commit -m "feat: add seed script for auto-tags

- Creates all 9 auto-tags in database
- Syncs locale tags for all districts (one-time)
- Syncs revenue/pipeline auto-tags for all districts"
```

---

## Task 3: Update Territory Plan Districts API - Add to Plan

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts`

**Step 1: Update the POST endpoint to sync auto-tags**

Add import at top of file:

```typescript
import { syncAutoTagsForDistrict } from "@/lib/autoTags";
```

After the `createMany` call (around line 71), add sync logic before the return:

```typescript
    // Sync auto-tags for all added districts
    await Promise.all(
      districtLeaids.map((leaid) => syncAutoTagsForDistrict(leaid))
    );

    return NextResponse.json(
```

**Step 2: Verify the complete file looks correct**

The modified file should have:
- Import for `syncAutoTagsForDistrict` at top
- `Promise.all` sync call after `createMany` and before `return`

**Step 3: Commit**

```bash
git add src/app/api/territory-plans/[id]/districts/route.ts
git commit -m "feat: sync auto-tags when adding districts to plan

- Call syncAutoTagsForDistrict() for each added district
- Updates Prospect tag based on plan membership"
```

---

## Task 4: Update Territory Plan Districts API - Remove from Plan

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/[leaid]/route.ts`

**Step 1: Update the DELETE endpoint to sync auto-tags**

Add import at top of file:

```typescript
import { syncAutoTagsForDistrict } from "@/lib/autoTags";
```

After the `delete` call (around line 38), add sync logic before the return:

```typescript
    // Sync auto-tags after removal (may affect Prospect tag)
    await syncAutoTagsForDistrict(leaid);

    return NextResponse.json({ success: true });
```

**Step 2: Commit**

```bash
git add src/app/api/territory-plans/[id]/districts/[leaid]/route.ts
git commit -m "feat: sync auto-tags when removing district from plan

- Call syncAutoTagsForDistrict() after removal
- Updates Prospect tag based on remaining plan membership"
```

---

## Task 5: Update DistrictHeader Component

**Files:**
- Modify: `src/components/panel/DistrictHeader.tsx`

**Step 1: Update props to accept tags**

Change the interface and imports:

```typescript
"use client";

import type { District, FullmindData, Tag } from "@/lib/api";

interface DistrictHeaderProps {
  district: District;
  fullmindData: FullmindData | null;
  tags: Tag[];
}
```

**Step 2: Update function signature**

```typescript
export default function DistrictHeader({
  district,
  fullmindData,
  tags,
}: DistrictHeaderProps) {
```

**Step 3: Replace badge rendering with tags**

Remove the `isCustomer` and `hasOpenPipeline` variables and the Status Chips section. Replace with:

```typescript
      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
```

**Step 4: Commit**

```bash
git add src/components/panel/DistrictHeader.tsx
git commit -m "refactor: replace badges with tags in DistrictHeader

- Accept tags prop instead of computing badges
- Display all tags uniformly as colored pills
- Remove special Customer/Pipeline/No Data badge logic"
```

---

## Task 6: Update DistrictHeader Usage

**Files:**
- Find and update all usages of DistrictHeader to pass tags prop

**Step 1: Search for DistrictHeader usage**

Run: `grep -r "DistrictHeader" src/`

Expected: Find the parent component that renders DistrictHeader

**Step 2: Update the parent component**

Pass the `tags` prop from `DistrictDetail`:

```typescript
<DistrictHeader
  district={districtDetail.district}
  fullmindData={districtDetail.fullmindData}
  tags={districtDetail.tags}
/>
```

**Step 3: Commit**

```bash
git add <parent-file>
git commit -m "feat: pass tags to DistrictHeader component"
```

---

## Task 7: Update MapTooltip Component

**Files:**
- Modify: `src/components/map/MapTooltip.tsx`
- Modify: `src/lib/store.ts` (if TooltipData needs tags)

**Step 1: Update TooltipData type to include tags**

In `src/lib/store.ts`, update the TooltipData interface:

```typescript
export interface TooltipData {
  // ... existing fields
  tags?: Array<{ name: string; color: string }>;
}
```

**Step 2: Update DistrictTooltipContent in MapTooltip.tsx**

Replace the hardcoded badge section (lines 189-201) with:

```typescript
      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
```

**Step 3: Update where tooltip data is set**

Find where `showTooltip` is called with district data and include tags.

**Step 4: Commit**

```bash
git add src/components/map/MapTooltip.tsx src/lib/store.ts
git commit -m "refactor: replace badges with tags in MapTooltip

- Add tags to TooltipData interface
- Display tags as colored pills in tooltip
- Remove hardcoded Customer/Pipeline badges"
```

---

## Task 8: Update DistrictsTable Component

**Files:**
- Modify: `src/components/plans/DistrictsTable.tsx`
- Modify: `src/lib/api.ts` (TerritoryPlanDistrict type)

**Step 1: Update TerritoryPlanDistrict type in api.ts**

```typescript
export interface TerritoryPlanDistrict {
  leaid: string;
  addedAt: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  tags: Array<{ id: number; name: string; color: string }>;
}
```

Remove `isCustomer` and `hasOpenPipeline` fields.

**Step 2: Update the territory plan detail API to return tags**

The API at `src/app/api/territory-plans/[id]/route.ts` needs to include tags in the district response.

**Step 3: Update DistrictsTable.tsx Status column**

Replace the Status column content (lines 174-191):

```typescript
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {district.tags && district.tags.length > 0 ? (
                    district.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No tags</span>
                  )}
                </div>
              </td>
```

**Step 4: Update table header**

Change "Status" to "Tags":

```typescript
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Tags
            </th>
```

**Step 5: Commit**

```bash
git add src/components/plans/DistrictsTable.tsx src/lib/api.ts
git commit -m "refactor: replace Status badges with Tags in DistrictsTable

- Update TerritoryPlanDistrict type to include tags array
- Remove isCustomer/hasOpenPipeline from type
- Display tags as colored pills in table"
```

---

## Task 9: Update Territory Plan Detail API

**Files:**
- Modify: `src/app/api/territory-plans/[id]/route.ts`

**Step 1: Update the query to include tags for each district**

Find the query that fetches territory plan with districts and add tag inclusion:

```typescript
const plan = await prisma.territoryPlan.findUnique({
  where: { id: planId },
  include: {
    districts: {
      include: {
        district: {
          include: {
            districtTags: {
              include: {
                tag: true,
              },
            },
          },
        },
      },
    },
  },
});
```

**Step 2: Transform the response to include tags**

Map the districts to include tags:

```typescript
districts: plan.districts.map((pd) => ({
  leaid: pd.districtLeaid,
  addedAt: pd.addedAt.toISOString(),
  name: pd.district.name,
  stateAbbrev: pd.district.stateAbbrev,
  enrollment: pd.district.enrollment,
  tags: pd.district.districtTags.map((dt) => ({
    id: dt.tag.id,
    name: dt.tag.name,
    color: dt.tag.color,
  })),
})),
```

**Step 3: Commit**

```bash
git add src/app/api/territory-plans/[id]/route.ts
git commit -m "feat: include tags in territory plan district responses

- Query district tags when fetching territory plan
- Return tags array for each district"
```

---

## Task 10: Run Seed Script and Test

**Step 1: Run the seed script**

```bash
npx tsx scripts/seed-auto-tags.ts
```

Expected: Script completes with "Done!" message

**Step 2: Verify tags were created**

Check the database for the 9 auto-tags.

**Step 3: Test the UI**

1. Open a district in the side panel - should see tags instead of badges
2. Hover over a district on the map - tooltip should show tags
3. View a territory plan - districts table should show tags column

**Step 4: Test auto-tag sync**

1. Add a district to a territory plan
2. Verify Prospect tag appears if district has no pipeline
3. Remove district from all plans
4. Verify Prospect tag is removed

**Step 5: Commit any fixes**

```bash
git add .
git commit -m "fix: resolve any issues found during testing"
```

---

## Task 11: Final Cleanup

**Step 1: Remove unused code**

- Remove `isCustomer` and `hasOpenPipeline` from `TerritoryPlanDistrict` interface if not done
- Remove `hasRevenue` and `hasPipeline` from `TooltipData` if not done

**Step 2: Run linter**

```bash
npm run lint
```

Fix any linting errors.

**Step 3: Run type check**

```bash
npm run type-check
```

Fix any type errors.

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: cleanup unused badge-related code and fix lint errors"
```
