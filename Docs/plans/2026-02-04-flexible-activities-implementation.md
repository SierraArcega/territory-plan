# Flexible Activities Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the activity system from plan-centric to flexible many-to-many relationships with plans, districts, contacts, and states.

**Architecture:** Replace `PlanActivity` with a new `Activity` model connected to plans, districts, contacts, and states via junction tables. Add top-level Activities tab with category sub-tabs (Events/Outreach/Meetings). Maintain backward compatibility during migration.

**Tech Stack:** Next.js 16, Prisma 5, PostgreSQL, React Query, Zustand, Tailwind CSS 4

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the new Activity model and junction tables**

Add after the existing `PlanActivityContact` model (around line 379):

```prisma
// ===== Flexible Activities System =====
// Replaces PlanActivity - activities can now link to multiple plans, districts, contacts, states

model Activity {
  id              String   @id @default(uuid())
  type            String   @db.VarChar(30) // conference, road_trip, email_campaign, etc.
  title           String   @db.VarChar(255)
  notes           String?
  startDate       DateTime @map("start_date")
  endDate         DateTime? @map("end_date")
  status          String   @default("planned") @db.VarChar(20) // planned, completed, cancelled
  createdByUserId String?  @map("created_by_user_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations (all many-to-many via junction tables)
  plans     ActivityPlan[]
  districts ActivityDistrict[]
  contacts  ActivityContact[]
  states    ActivityState[]

  @@index([createdByUserId])
  @@index([type])
  @@index([startDate])
  @@map("activities")
}

model ActivityPlan {
  activityId String        @map("activity_id")
  planId     String        @map("plan_id")
  activity   Activity      @relation(fields: [activityId], references: [id], onDelete: Cascade)
  plan       TerritoryPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@id([activityId, planId])
  @@map("activity_plans")
}

model ActivityDistrict {
  activityId       String   @map("activity_id")
  districtLeaid    String   @map("district_leaid") @db.VarChar(7)
  warningDismissed Boolean  @default(false) @map("warning_dismissed")
  activity         Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  district         District @relation(fields: [districtLeaid], references: [leaid], onDelete: Cascade)

  @@id([activityId, districtLeaid])
  @@map("activity_districts")
}

model ActivityContact {
  activityId String   @map("activity_id")
  contactId  Int      @map("contact_id")
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  contact    Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@id([activityId, contactId])
  @@map("activity_contacts")
}

model ActivityState {
  activityId String   @map("activity_id")
  stateFips  String   @map("state_fips") @db.VarChar(2)
  isExplicit Boolean  @default(false) @map("is_explicit")
  activity   Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  state      State    @relation(fields: [stateFips], references: [fips], onDelete: Cascade)

  @@id([activityId, stateFips])
  @@map("activity_states")
}
```

**Step 2: Add reverse relations to existing models**

Update the `TerritoryPlan` model (around line 317) to add:
```prisma
  activityLinks ActivityPlan[]
```

Update the `District` model relations (around line 152) to add:
```prisma
  activityLinks ActivityDistrict[]
```

Update the `Contact` model relations (around line 222) to add:
```prisma
  activityLinks ActivityContact[]
```

Update the `State` model relations (around line 295) to add:
```prisma
  activityLinks ActivityState[]
```

**Step 3: Generate and run migration**

Run: `cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan" && npx prisma migrate dev --name add_flexible_activities`

Expected: Migration creates 5 new tables (activities, activity_plans, activity_districts, activity_contacts, activity_states)

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add flexible Activity schema with junction tables"
```

---

## Task 2: Create Activity Types Constants

**Files:**
- Create: `src/lib/activityTypes.ts`

**Step 1: Create the types file**

```typescript
// Activity type definitions and category mappings

export const ACTIVITY_CATEGORIES = {
  events: ["conference", "road_trip", "trade_show", "school_visit_day"],
  outreach: ["email_campaign", "phone_call", "linkedin_message"],
  meetings: ["sales_meeting", "demo", "proposal_review"],
} as const;

export type ActivityCategory = keyof typeof ACTIVITY_CATEGORIES;
export type ActivityType = (typeof ACTIVITY_CATEGORIES)[ActivityCategory][number];

// Flat list of all activity types
export const ALL_ACTIVITY_TYPES = Object.values(ACTIVITY_CATEGORIES).flat() as ActivityType[];

// Get category for a given type
export function getCategoryForType(type: ActivityType): ActivityCategory {
  for (const [category, types] of Object.entries(ACTIVITY_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) {
      return category as ActivityCategory;
    }
  }
  return "events"; // fallback
}

// Display labels for activity types
export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  // Events
  conference: "Conference",
  road_trip: "Road Trip",
  trade_show: "Trade Show",
  school_visit_day: "School Visit Day",
  // Outreach
  email_campaign: "Email Campaign",
  phone_call: "Phone Call",
  linkedin_message: "LinkedIn Message",
  // Meetings
  sales_meeting: "Sales Meeting",
  demo: "Demo",
  proposal_review: "Proposal Review",
};

// Icons for each activity type (emoji for simplicity)
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  // Events
  conference: "🎤",
  road_trip: "🚗",
  trade_show: "🎪",
  school_visit_day: "🏫",
  // Outreach
  email_campaign: "📧",
  phone_call: "📞",
  linkedin_message: "💼",
  // Meetings
  sales_meeting: "🤝",
  demo: "🖥️",
  proposal_review: "📋",
};

// Category display labels
export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  events: "Events",
  outreach: "Outreach",
  meetings: "Meetings",
};

// Activity status types and config
export type ActivityStatus = "planned" | "completed" | "cancelled";

export const ACTIVITY_STATUS_CONFIG: Record<
  ActivityStatus,
  { label: string; color: string; bgColor: string }
> = {
  planned: { label: "Planned", color: "#6EA3BE", bgColor: "#EEF5F8" },
  completed: { label: "Completed", color: "#8AA891", bgColor: "#EFF5F0" },
  cancelled: { label: "Cancelled", color: "#9CA3AF", bgColor: "#F3F4F6" },
};

// Default type for each category (used when creating from category tab)
export const DEFAULT_TYPE_FOR_CATEGORY: Record<ActivityCategory, ActivityType> = {
  events: "conference",
  outreach: "email_campaign",
  meetings: "sales_meeting",
};
```

**Step 2: Commit**

```bash
git add src/lib/activityTypes.ts
git commit -m "feat: add activity type constants and category mappings"
```

---

## Task 3: Create Activity API Types

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add new Activity types after the existing PlanActivity types (around line 855)**

```typescript
// ===== Flexible Activities =====

import type { ActivityType, ActivityCategory, ActivityStatus } from "./activityTypes";

export interface ActivityPlanLink {
  planId: string;
  planName: string;
  planColor: string;
}

export interface ActivityDistrictLink {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  warningDismissed: boolean;
  isInPlan: boolean; // computed: is this district in any of the activity's linked plans?
}

export interface ActivityContactLink {
  id: number;
  name: string;
  title: string | null;
}

export interface ActivityStateLink {
  fips: string;
  abbrev: string;
  name: string;
  isExplicit: boolean;
}

export interface Activity {
  id: string;
  type: ActivityType;
  category: ActivityCategory; // computed from type
  title: string;
  notes: string | null;
  startDate: string;
  endDate: string | null;
  status: ActivityStatus;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  // Computed flags
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
  // Relations
  plans: ActivityPlanLink[];
  districts: ActivityDistrictLink[];
  contacts: ActivityContactLink[];
  states: ActivityStateLink[];
}

export interface ActivityListItem {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  startDate: string;
  endDate: string | null;
  status: ActivityStatus;
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
  planCount: number;
  districtCount: number;
  stateAbbrevs: string[];
}

export interface ActivitiesResponse {
  activities: ActivityListItem[];
  total: number;
}
```

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add Activity API types"
```

---

## Task 4: Create GET /api/activities Endpoint

**Files:**
- Create: `src/app/api/activities/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ACTIVITY_CATEGORIES, type ActivityCategory, type ActivityType } from "@/lib/activityTypes";

export const dynamic = "force-dynamic";

// GET /api/activities - List activities with filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as ActivityCategory | null;
    const planId = searchParams.get("planId");
    const stateAbbrev = searchParams.get("stateAbbrev");
    const needsPlanAssociation = searchParams.get("needsPlanAssociation") === "true";
    const hasUnlinkedDistricts = searchParams.get("hasUnlinkedDistricts") === "true";
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {
      createdByUserId: user.id,
    };

    // Filter by category (maps to types)
    if (category && ACTIVITY_CATEGORIES[category]) {
      where.type = { in: ACTIVITY_CATEGORIES[category] as unknown as string[] };
    }

    // Filter by plan
    if (planId) {
      where.plans = { some: { planId } };
    }

    // Filter by state
    if (stateAbbrev) {
      where.states = {
        some: {
          state: { abbrev: stateAbbrev },
        },
      };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by date range
    if (startDate) {
      where.startDate = { gte: new Date(startDate) };
    }
    if (endDate) {
      where.OR = [
        { endDate: { lte: new Date(endDate) } },
        { endDate: null, startDate: { lte: new Date(endDate) } },
      ];
    }

    // Fetch activities with relations
    const activities = await prisma.activity.findMany({
      where,
      include: {
        plans: {
          include: {
            plan: {
              select: { id: true, name: true, color: true },
            },
          },
        },
        districts: {
          include: {
            district: {
              select: { leaid: true, name: true, stateAbbrev: true },
            },
          },
        },
        states: {
          include: {
            state: { select: { fips: true, abbrev: true, name: true } },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Get all plan districts for computing hasUnlinkedDistricts
    const planIds = [...new Set(activities.flatMap((a) => a.plans.map((p) => p.planId)))];
    const planDistricts = await prisma.territoryPlanDistrict.findMany({
      where: { planId: { in: planIds } },
      select: { planId: true, districtLeaid: true },
    });

    // Map plan -> set of district leaids
    const planDistrictMap = new Map<string, Set<string>>();
    for (const pd of planDistricts) {
      if (!planDistrictMap.has(pd.planId)) {
        planDistrictMap.set(pd.planId, new Set());
      }
      planDistrictMap.get(pd.planId)!.add(pd.districtLeaid);
    }

    // Transform and filter by computed flags
    const transformed = activities
      .map((activity) => {
        const activityPlanIds = activity.plans.map((p) => p.planId);
        const needsPlan = activity.plans.length === 0;

        // Check if any district is not in any of the activity's plans
        const hasUnlinked = activity.districts.some((ad) => {
          if (ad.warningDismissed) return false;
          return !activityPlanIds.some((planId) =>
            planDistrictMap.get(planId)?.has(ad.districtLeaid)
          );
        });

        return {
          id: activity.id,
          type: activity.type as ActivityType,
          category: getCategoryForType(activity.type as ActivityType),
          title: activity.title,
          startDate: activity.startDate.toISOString(),
          endDate: activity.endDate?.toISOString() ?? null,
          status: activity.status,
          needsPlanAssociation: needsPlan,
          hasUnlinkedDistricts: hasUnlinked,
          planCount: activity.plans.length,
          districtCount: activity.districts.length,
          stateAbbrevs: activity.states.map((s) => s.state.abbrev),
        };
      })
      .filter((a) => {
        if (needsPlanAssociation && !a.needsPlanAssociation) return false;
        if (hasUnlinkedDistricts && !a.hasUnlinkedDistricts) return false;
        return true;
      });

    return NextResponse.json({
      activities: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/activities/route.ts
git commit -m "feat: add GET /api/activities endpoint with filtering"
```

---

## Task 5: Add POST /api/activities Endpoint

**Files:**
- Modify: `src/app/api/activities/route.ts`

**Step 1: Add POST handler after the GET handler**

```typescript
// POST /api/activities - Create a new activity
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      title,
      notes,
      startDate,
      endDate,
      status = "planned",
      planIds = [],
      districtLeaids = [],
      contactIds = [],
      stateFips = [], // explicit states
    } = body;

    // Validate required fields
    if (!type || !title || !startDate) {
      return NextResponse.json(
        { error: "type, title, and startDate are required" },
        { status: 400 }
      );
    }

    // Validate type is valid
    if (!ALL_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type: ${type}` },
        { status: 400 }
      );
    }

    // Get states derived from districts
    const derivedStates = new Set<string>();
    if (districtLeaids.length > 0) {
      const districts = await prisma.district.findMany({
        where: { leaid: { in: districtLeaids } },
        select: { stateFips: true },
      });
      districts.forEach((d) => derivedStates.add(d.stateFips));
    }

    // Create activity with all relations
    const activity = await prisma.activity.create({
      data: {
        type,
        title: title.trim(),
        notes: notes?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status,
        createdByUserId: user.id,
        plans: {
          create: planIds.map((planId: string) => ({ planId })),
        },
        districts: {
          create: districtLeaids.map((leaid: string) => ({
            districtLeaid: leaid,
            warningDismissed: false,
          })),
        },
        contacts: {
          create: contactIds.map((contactId: number) => ({ contactId })),
        },
        states: {
          create: [
            // Derived states (from districts)
            ...[...derivedStates].map((fips) => ({
              stateFips: fips,
              isExplicit: false,
            })),
            // Explicit states (user-added)
            ...stateFips
              .filter((fips: string) => !derivedStates.has(fips))
              .map((fips: string) => ({
                stateFips: fips,
                isExplicit: true,
              })),
          ],
        },
      },
      include: {
        plans: {
          include: { plan: { select: { id: true, name: true, color: true } } },
        },
        districts: {
          include: {
            district: { select: { leaid: true, name: true, stateAbbrev: true } },
          },
        },
        contacts: {
          include: { contact: { select: { id: true, name: true, title: true } } },
        },
        states: {
          include: { state: { select: { fips: true, abbrev: true, name: true } } },
        },
      },
    });

    return NextResponse.json(transformActivity(activity));
  } catch (error) {
    console.error("Error creating activity:", error);
    return NextResponse.json(
      { error: "Failed to create activity" },
      { status: 500 }
    );
  }
}

// Add import at top
import { ALL_ACTIVITY_TYPES } from "@/lib/activityTypes";

// Helper to transform activity for response
function transformActivity(activity: any) {
  return {
    id: activity.id,
    type: activity.type,
    category: getCategoryForType(activity.type as ActivityType),
    title: activity.title,
    notes: activity.notes,
    startDate: activity.startDate.toISOString(),
    endDate: activity.endDate?.toISOString() ?? null,
    status: activity.status,
    createdByUserId: activity.createdByUserId,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    needsPlanAssociation: activity.plans.length === 0,
    hasUnlinkedDistricts: false, // Will be computed on fetch
    plans: activity.plans.map((p: any) => ({
      planId: p.plan.id,
      planName: p.plan.name,
      planColor: p.plan.color,
    })),
    districts: activity.districts.map((d: any) => ({
      leaid: d.district.leaid,
      name: d.district.name,
      stateAbbrev: d.district.stateAbbrev,
      warningDismissed: d.warningDismissed,
      isInPlan: false, // Will be computed on fetch
    })),
    contacts: activity.contacts.map((c: any) => ({
      id: c.contact.id,
      name: c.contact.name,
      title: c.contact.title,
    })),
    states: activity.states.map((s: any) => ({
      fips: s.state.fips,
      abbrev: s.state.abbrev,
      name: s.state.name,
      isExplicit: s.isExplicit,
    })),
  };
}
```

**Step 2: Commit**

```bash
git add src/app/api/activities/route.ts
git commit -m "feat: add POST /api/activities endpoint"
```

---

## Task 6: Create Activity Detail Endpoint

**Files:**
- Create: `src/app/api/activities/[id]/route.ts`

**Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getCategoryForType, ALL_ACTIVITY_TYPES, type ActivityType } from "@/lib/activityTypes";

export const dynamic = "force-dynamic";

// GET /api/activities/[id] - Get activity detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
      include: {
        plans: {
          include: { plan: { select: { id: true, name: true, color: true } } },
        },
        districts: {
          include: {
            district: { select: { leaid: true, name: true, stateAbbrev: true } },
          },
        },
        contacts: {
          include: { contact: { select: { id: true, name: true, title: true } } },
        },
        states: {
          include: { state: { select: { fips: true, abbrev: true, name: true } } },
        },
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Get plan districts for computing isInPlan
    const planIds = activity.plans.map((p) => p.planId);
    const planDistricts = await prisma.territoryPlanDistrict.findMany({
      where: { planId: { in: planIds } },
      select: { planId: true, districtLeaid: true },
    });

    const planDistrictMap = new Map<string, Set<string>>();
    for (const pd of planDistricts) {
      if (!planDistrictMap.has(pd.planId)) {
        planDistrictMap.set(pd.planId, new Set());
      }
      planDistrictMap.get(pd.planId)!.add(pd.districtLeaid);
    }

    // Check which districts are in plans
    const districtsWithPlanStatus = activity.districts.map((d) => {
      const isInPlan = planIds.some((planId) =>
        planDistrictMap.get(planId)?.has(d.districtLeaid)
      );
      return {
        leaid: d.district.leaid,
        name: d.district.name,
        stateAbbrev: d.district.stateAbbrev,
        warningDismissed: d.warningDismissed,
        isInPlan,
      };
    });

    const needsPlanAssociation = activity.plans.length === 0;
    const hasUnlinkedDistricts = districtsWithPlanStatus.some(
      (d) => !d.isInPlan && !d.warningDismissed
    );

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      category: getCategoryForType(activity.type as ActivityType),
      title: activity.title,
      notes: activity.notes,
      startDate: activity.startDate.toISOString(),
      endDate: activity.endDate?.toISOString() ?? null,
      status: activity.status,
      createdByUserId: activity.createdByUserId,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      needsPlanAssociation,
      hasUnlinkedDistricts,
      plans: activity.plans.map((p) => ({
        planId: p.plan.id,
        planName: p.plan.name,
        planColor: p.plan.color,
      })),
      districts: districtsWithPlanStatus,
      contacts: activity.contacts.map((c) => ({
        id: c.contact.id,
        name: c.contact.name,
        title: c.contact.title,
      })),
      states: activity.states.map((s) => ({
        fips: s.state.fips,
        abbrev: s.state.abbrev,
        name: s.state.name,
        isExplicit: s.isExplicit,
      })),
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

// PATCH /api/activities/[id] - Update activity
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existing = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const body = await request.json();
    const { type, title, notes, startDate, endDate, status } = body;

    // Validate type if provided
    if (type && !ALL_ACTIVITY_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid activity type: ${type}` },
        { status: 400 }
      );
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title: title.trim() }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && {
          endDate: endDate ? new Date(endDate) : null,
        }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      updatedAt: activity.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    return NextResponse.json(
      { error: "Failed to update activity" },
      { status: 500 }
    );
  }
}

// DELETE /api/activities/[id] - Delete activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership and delete
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    await prisma.activity.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return NextResponse.json(
      { error: "Failed to delete activity" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/activities/[id]/route.ts
git commit -m "feat: add GET/PATCH/DELETE /api/activities/[id] endpoints"
```

---

## Task 7: Create Activity Association Endpoints

**Files:**
- Create: `src/app/api/activities/[id]/plans/route.ts`
- Create: `src/app/api/activities/[id]/plans/[planId]/route.ts`
- Create: `src/app/api/activities/[id]/districts/route.ts`
- Create: `src/app/api/activities/[id]/districts/[leaid]/route.ts`

**Step 1: Create plans association route**

Create `src/app/api/activities/[id]/plans/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/activities/[id]/plans - Link plans to activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planIds } = body;

    if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
      return NextResponse.json(
        { error: "planIds array is required" },
        { status: 400 }
      );
    }

    // Verify activity ownership
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Verify plans belong to user
    const plans = await prisma.territoryPlan.findMany({
      where: { id: { in: planIds }, userId: user.id },
      select: { id: true },
    });

    if (plans.length !== planIds.length) {
      return NextResponse.json(
        { error: "One or more plans not found" },
        { status: 400 }
      );
    }

    // Create links (ignore duplicates)
    await prisma.activityPlan.createMany({
      data: planIds.map((planId: string) => ({
        activityId: id,
        planId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, linked: planIds.length });
  } catch (error) {
    console.error("Error linking plans:", error);
    return NextResponse.json(
      { error: "Failed to link plans" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create plan unlink route**

Create `src/app/api/activities/[id]/plans/[planId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/plans/[planId] - Unlink plan from activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  try {
    const { id, planId } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity ownership
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    await prisma.activityPlan.delete({
      where: {
        activityId_planId: { activityId: id, planId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking plan:", error);
    return NextResponse.json(
      { error: "Failed to unlink plan" },
      { status: 500 }
    );
  }
}
```

**Step 3: Create districts association route**

Create `src/app/api/activities/[id]/districts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/activities/[id]/districts - Link districts to activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { leaids } = body;

    if (!leaids || !Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json(
        { error: "leaids array is required" },
        { status: 400 }
      );
    }

    // Verify activity ownership
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Verify districts exist
    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaids } },
      select: { leaid: true, stateFips: true },
    });

    if (districts.length !== leaids.length) {
      return NextResponse.json(
        { error: "One or more districts not found" },
        { status: 400 }
      );
    }

    // Create district links
    await prisma.activityDistrict.createMany({
      data: leaids.map((leaid: string) => ({
        activityId: id,
        districtLeaid: leaid,
        warningDismissed: false,
      })),
      skipDuplicates: true,
    });

    // Auto-derive states from districts
    const stateFipsSet = new Set(districts.map((d) => d.stateFips));
    await prisma.activityState.createMany({
      data: [...stateFipsSet].map((fips) => ({
        activityId: id,
        stateFips: fips,
        isExplicit: false,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, linked: leaids.length });
  } catch (error) {
    console.error("Error linking districts:", error);
    return NextResponse.json(
      { error: "Failed to link districts" },
      { status: 500 }
    );
  }
}
```

**Step 4: Create district unlink route**

Create `src/app/api/activities/[id]/districts/[leaid]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/activities/[id]/districts/[leaid] - Unlink district from activity
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id, leaid } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify activity ownership
    const activity = await prisma.activity.findUnique({
      where: { id, createdByUserId: user.id },
      include: {
        districts: {
          include: { district: { select: { stateFips: true } } },
        },
        states: true,
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    // Find the district being removed
    const removedDistrict = activity.districts.find(
      (d) => d.districtLeaid === leaid
    );
    if (!removedDistrict) {
      return NextResponse.json(
        { error: "District not linked to activity" },
        { status: 404 }
      );
    }

    const removedStateFips = removedDistrict.district.stateFips;

    // Delete the district link
    await prisma.activityDistrict.delete({
      where: {
        activityId_districtLeaid: { activityId: id, districtLeaid: leaid },
      },
    });

    // Check if we should remove the derived state
    // Only remove if: not explicit AND no other districts have this state
    const stateLink = activity.states.find((s) => s.stateFips === removedStateFips);
    if (stateLink && !stateLink.isExplicit) {
      const otherDistrictsInState = activity.districts.filter(
        (d) =>
          d.districtLeaid !== leaid &&
          d.district.stateFips === removedStateFips
      );

      if (otherDistrictsInState.length === 0) {
        await prisma.activityState.delete({
          where: {
            activityId_stateFips: { activityId: id, stateFips: removedStateFips },
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error unlinking district:", error);
    return NextResponse.json(
      { error: "Failed to unlink district" },
      { status: 500 }
    );
  }
}
```

**Step 5: Commit**

```bash
git add src/app/api/activities/[id]/plans/ src/app/api/activities/[id]/districts/
git commit -m "feat: add activity association endpoints (plans, districts)"
```

---

## Task 8: Add API Hooks for Activities

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add hooks after the existing activity hooks (around line 960)**

```typescript
// ===== Flexible Activities Hooks =====

import type { ActivityType, ActivityCategory, ActivityStatus } from "./activityTypes";

// Fetch all activities with filtering
export function useActivities(params: {
  category?: ActivityCategory;
  planId?: string;
  stateAbbrev?: string;
  needsPlanAssociation?: boolean;
  hasUnlinkedDistricts?: boolean;
  status?: ActivityStatus;
  startDate?: string;
  endDate?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set("category", params.category);
  if (params.planId) searchParams.set("planId", params.planId);
  if (params.stateAbbrev) searchParams.set("stateAbbrev", params.stateAbbrev);
  if (params.needsPlanAssociation) searchParams.set("needsPlanAssociation", "true");
  if (params.hasUnlinkedDistricts) searchParams.set("hasUnlinkedDistricts", "true");
  if (params.status) searchParams.set("status", params.status);
  if (params.startDate) searchParams.set("startDate", params.startDate);
  if (params.endDate) searchParams.set("endDate", params.endDate);

  const queryString = searchParams.toString();

  return useQuery({
    queryKey: ["activities", params],
    queryFn: () =>
      fetchJson<ActivitiesResponse>(
        `${API_BASE}/activities${queryString ? `?${queryString}` : ""}`
      ),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Fetch single activity detail
export function useActivity(activityId: string | null) {
  return useQuery({
    queryKey: ["activity", activityId],
    queryFn: () => fetchJson<Activity>(`${API_BASE}/activities/${activityId}`),
    enabled: !!activityId,
    staleTime: 2 * 60 * 1000,
  });
}

// Create activity
export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      type: ActivityType;
      title: string;
      startDate: string;
      endDate?: string | null;
      notes?: string;
      status?: ActivityStatus;
      planIds?: string[];
      districtLeaids?: string[];
      contactIds?: number[];
      stateFips?: string[];
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Update activity
export function useUpdateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      type?: ActivityType;
      title?: string;
      startDate?: string;
      endDate?: string | null;
      notes?: string;
      status?: ActivityStatus;
    }) =>
      fetchJson<Activity>(`${API_BASE}/activities/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.id] });
    },
  });
}

// Delete activity
export function useDeleteActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/activities/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Link plans to activity
export function useLinkActivityPlans() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planIds }: { activityId: string; planIds: string[] }) =>
      fetchJson<{ success: boolean }>(`${API_BASE}/activities/${activityId}/plans`, {
        method: "POST",
        body: JSON.stringify({ planIds }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Unlink plan from activity
export function useUnlinkActivityPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, planId }: { activityId: string; planId: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/plans/${planId}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Link districts to activity
export function useLinkActivityDistricts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaids }: { activityId: string; leaids: string[] }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/districts`,
        {
          method: "POST",
          body: JSON.stringify({ leaids }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}

// Unlink district from activity
export function useUnlinkActivityDistrict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId, leaid }: { activityId: string; leaid: string }) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/activities/${activityId}/districts/${leaid}`,
        { method: "DELETE" }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["activity", variables.activityId] });
    },
  });
}
```

**Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add React Query hooks for flexible activities"
```

---

## Task 9: Update Store with Activities Tab

**Files:**
- Modify: `src/lib/store.ts`

**Step 1: Add "activities" to TabId type (around line 5)**

Change:
```typescript
export type TabId = "map" | "plans" | "goals" | "data" | "profile";
```

To:
```typescript
export type TabId = "map" | "plans" | "activities" | "goals" | "data" | "profile";
```

**Step 2: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: add activities tab to navigation state"
```

---

## Task 10: Add Activities Icon to Sidebar

**Files:**
- Modify: `src/components/navigation/Sidebar.tsx`

**Step 1: Add ActivitiesIcon component (after GoalsIcon, around line 48)**

```typescript
const ActivitiesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);
```

**Step 2: Update TabId type (around line 7)**

```typescript
type TabId = "map" | "plans" | "activities" | "goals" | "data" | "profile";
```

**Step 3: Add Activities to MAIN_TABS array (around line 88)**

Change:
```typescript
const MAIN_TABS: Tab[] = [
  { id: "map", label: "Map", icon: <MapIcon /> },
  { id: "plans", label: "Plans", icon: <PlansIcon /> },
  { id: "goals", label: "Goals", icon: <GoalsIcon /> },
  { id: "data", label: "Data", icon: <DataIcon /> },
];
```

To:
```typescript
const MAIN_TABS: Tab[] = [
  { id: "map", label: "Map", icon: <MapIcon /> },
  { id: "plans", label: "Plans", icon: <PlansIcon /> },
  { id: "activities", label: "Activities", icon: <ActivitiesIcon /> },
  { id: "goals", label: "Goals", icon: <GoalsIcon /> },
  { id: "data", label: "Data", icon: <DataIcon /> },
];
```

**Step 4: Commit**

```bash
git add src/components/navigation/Sidebar.tsx
git commit -m "feat: add Activities tab to sidebar navigation"
```

---

## Task 11: Create ActivitiesView Component

**Files:**
- Create: `src/components/views/ActivitiesView.tsx`

**Step 1: Create the view component**

```typescript
"use client";

import { useState } from "react";
import { useActivities } from "@/lib/api";
import {
  type ActivityCategory,
  CATEGORY_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
} from "@/lib/activityTypes";

type CategoryTab = ActivityCategory | "all";

export default function ActivitiesView() {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>("all");
  const [showNeedsPlan, setShowNeedsPlan] = useState(false);
  const [showUnlinked, setShowUnlinked] = useState(false);

  const { data, isLoading, error } = useActivities({
    category: activeCategory === "all" ? undefined : activeCategory,
    needsPlanAssociation: showNeedsPlan || undefined,
    hasUnlinkedDistricts: showUnlinked || undefined,
  });

  const categories: CategoryTab[] = ["all", "events", "outreach", "meetings"];

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Activities</h1>
            <p className="text-sm text-gray-500">
              Track meetings, events, and outreach across your territory
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Activity
          </button>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeCategory === cat
                    ? "border-[#F37167] text-[#F37167]"
                    : "border-transparent text-gray-500 hover:text-[#403770]"
                }`}
              >
                {cat === "all" ? "All" : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showNeedsPlan}
              onChange={(e) => setShowNeedsPlan(e.target.checked)}
              className="rounded border-gray-300 text-[#F37167] focus:ring-[#F37167]"
            />
            Needs Plan
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showUnlinked}
              onChange={(e) => setShowUnlinked(e.target.checked)}
              className="rounded border-gray-300 text-[#F37167] focus:ring-[#F37167]"
            />
            Has Unlinked Districts
          </label>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
              <p className="text-[#403770] font-medium">Loading activities...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-red-500">
              <p className="font-medium">Error loading activities</p>
              <p className="text-sm">{error.message}</p>
            </div>
          </div>
        ) : data && data.activities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.activities.map((activity) => (
              <div
                key={activity.id}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-xl flex-shrink-0">
                      {ACTIVITY_TYPE_ICONS[activity.type]}
                    </span>
                    <div className="min-w-0">
                      <h4 className="font-medium text-[#403770] truncate">
                        {activity.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </p>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: ACTIVITY_STATUS_CONFIG[activity.status].bgColor,
                      color: ACTIVITY_STATUS_CONFIG[activity.status].color,
                    }}
                  >
                    {ACTIVITY_STATUS_CONFIG[activity.status].label}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <span>
                    {new Date(activity.startDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    {activity.endDate &&
                      activity.endDate !== activity.startDate &&
                      ` – ${new Date(activity.endDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {activity.needsPlanAssociation && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                      No plan
                    </span>
                  )}
                  {activity.hasUnlinkedDistricts && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                      Unlinked districts
                    </span>
                  )}
                  {activity.planCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {activity.planCount} plan{activity.planCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {activity.districtCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {activity.districtCount} district{activity.districtCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <svg
              className="w-20 h-20 mx-auto text-gray-300 mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              No activities yet
            </h2>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Create your first activity to start tracking meetings, conferences, and outreach.
            </p>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Activity
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/views/ActivitiesView.tsx
git commit -m "feat: add ActivitiesView component with category tabs"
```

---

## Task 12: Wire Up ActivitiesView to App

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Import ActivitiesView (after line 10)**

```typescript
import ActivitiesView from "@/components/views/ActivitiesView";
```

**Step 2: Update VALID_TABS (around line 14)**

Change:
```typescript
const VALID_TABS: TabId[] = ["map", "plans", "goals", "data", "profile"];
```

To:
```typescript
const VALID_TABS: TabId[] = ["map", "plans", "activities", "goals", "data", "profile"];
```

**Step 3: Add case for activities in renderContent (around line 130)**

Add after the "plans" case:
```typescript
      case "activities":
        return <ActivitiesView />;
```

**Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up ActivitiesView to main app routing"
```

---

## Task 13: Push to Remote

**Step 1: Push all changes**

```bash
cd "/Users/sierraholstad/Desktop/Interactive Territory Plan Builder/territory-plan"
git push -u origin feature/flexible-activities
```

---

## Remaining Tasks (Phase 2+)

The following tasks complete the feature but are separate from the core infrastructure:

- **Task 14-18:** Activity Form Modal with smart pre-filling
- **Task 19-21:** Plan view integration (category tabs within plans)
- **Task 22-24:** Context entry points (district panel, contact panel)
- **Task 25-27:** Warning resolution flows
- **Task 28-30:** Data migration from old PlanActivity tables
- **Task 31:** Remove legacy tables

---

## Verification Checklist

After completing Tasks 1-13:

1. [ ] `npx prisma migrate dev` succeeds
2. [ ] App compiles without errors: `npm run build`
3. [ ] Activities tab appears in sidebar
4. [ ] GET /api/activities returns empty array (no activities yet)
5. [ ] POST /api/activities creates an activity
6. [ ] Activity appears in ActivitiesView
7. [ ] Category tabs filter correctly
