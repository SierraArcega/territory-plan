# Contacts Bulk Enrichment & CSV Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk Clay contact enrichment and full-plan CSV export to the Contacts tab, with activity logging for admin visibility.

**Architecture:** New API endpoints for bulk enrichment and progress tracking, frontend action bar with role selector popover and progress indicator, client-side CSV generation. Activity records log enrichment attempts. Three new columns on `TerritoryPlan` model for concurrency tracking.

**Tech Stack:** Next.js 16 App Router, Prisma/PostgreSQL, TanStack Query, React 19, Tailwind 4, Lucide icons

**Spec:** `Docs/superpowers/specs/2026-03-24-contacts-bulk-enrich-csv-export-design.md`

**Branch:** `feature/contacts-bulk-enrich-csv-export` (off `main`)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` | POST endpoint: concurrency guard, batch Clay webhooks, create Activity |
| `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts` | GET endpoint: return enrichment progress counts |
| `src/features/plans/components/ContactsActionBar.tsx` | Action bar with Find Contacts popover, Export CSV button, progress indicator |
| ~~`src/features/plans/lib/bulk-enrich.ts`~~ | *(removed — logic inlined in route and component)* |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 3 columns to `TerritoryPlan`: `enrichmentStartedAt`, `enrichmentQueued`, `enrichmentActivityId` |
| `src/features/shared/types/contact-types.ts` | Add `TARGET_ROLES` constant |
| `src/features/activities/types.ts` | Add `system` category with `contact_enrichment` type |
| `src/features/plans/lib/queries.ts` | Add `useBulkEnrich`, `useEnrichProgress` hooks |
| `src/features/plans/components/ContactsTable.tsx` | Import and render `ContactsActionBar` above table |

---

## Task 1: Create Branch and Add Prisma Schema Columns

**Files:**
- Modify: `prisma/schema.prisma:494-528` (TerritoryPlan model)

- [ ] **Step 1: Create the feature branch**

```bash
git checkout main && git pull
git checkout -b feature/contacts-bulk-enrich-csv-export
```

- [ ] **Step 2: Add enrichment tracking columns to TerritoryPlan**

In `prisma/schema.prisma`, add three new columns to the `TerritoryPlan` model, after the denormalized rollup columns block (after line 514, before the `// Relations` comment):

```prisma
  // Bulk enrichment tracking
  enrichmentStartedAt  DateTime? @map("enrichment_started_at")
  enrichmentQueued     Int?      @map("enrichment_queued")
  enrichmentActivityId String?   @map("enrichment_activity_id") @db.Uuid
```

- [ ] **Step 3: Generate and run the migration**

```bash
npx prisma migrate dev --name add-enrichment-tracking-columns
```

Expected: Migration created and applied, Prisma Client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add enrichment tracking columns to TerritoryPlan schema"
```

---

## Task 2: Add TARGET_ROLES and Activity Type Constants

**Files:**
- Modify: `src/features/shared/types/contact-types.ts`
- Modify: `src/features/activities/types.ts`

- [ ] **Step 1: Add TARGET_ROLES to contact-types.ts**

Add after the `SENIORITY_LEVELS` block (after line 61, before the validation helpers):

```typescript
// =============================================================================
// Target Roles (title-based, for Clay enrichment hints)
// =============================================================================

export const TARGET_ROLES = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Technology Officer",
  "Chief Financial Officer",
  "Curriculum Director",
  "Special Education Director",
  "HR Director",
] as const;

export type TargetRole = (typeof TARGET_ROLES)[number];
```

- [ ] **Step 2: Add system category to activity types**

In `src/features/activities/types.ts`, add `system` category to `ACTIVITY_CATEGORIES`:

```typescript
export const ACTIVITY_CATEGORIES = {
  events: [
    "conference",
    "road_trip",
    "dinner",
    "happy_hour",
    "school_site_visit",
    "fun_and_games",
  ],
  campaigns: ["mixmax_campaign"],
  meetings: [
    "discovery_call",
    "program_check_in",
    "proposal_review",
    "renewal_conversation",
  ],
  gift_drop: ["gift_drop"],
  thought_leadership: ["webinar", "speaking_engagement", "professional_development", "course"],
  system: ["contact_enrichment"],
} as const;
```

Add the label, icon, category label, and description entries:

In `ACTIVITY_TYPE_LABELS`, add:
```typescript
  // System
  contact_enrichment: "Contact Enrichment",
```

In `ACTIVITY_TYPE_ICONS`, add:
```typescript
  // System
  contact_enrichment: "🔍",
```

In `CATEGORY_LABELS`, add:
```typescript
  system: "System",
```

In `CATEGORY_ICONS`, add:
```typescript
  system: "⚙️",
```

In `CATEGORY_DESCRIPTIONS`, add:
```typescript
  system: "Automated system activities",
```

In `DEFAULT_TYPE_FOR_CATEGORY`, add:
```typescript
  system: "contact_enrichment",
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new errors related to these files.

- [ ] **Step 4: Commit**

```bash
git add src/features/shared/types/contact-types.ts src/features/activities/types.ts
git commit -m "feat: add TARGET_ROLES constant and contact_enrichment activity type"
```

---

## Task 3: Build the Bulk Enrichment API Endpoint

**Files:**
- Create: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`

- [ ] **Step 1: Create the bulk-enrich route directory**

```bash
mkdir -p "src/app/api/territory-plans/[id]/contacts/bulk-enrich"
```

- [ ] **Step 2: Implement the POST endpoint**

Create `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// How long before a previous enrichment is considered expired (10 minutes)
const ENRICHMENT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * POST /api/territory-plans/[id]/contacts/bulk-enrich
 *
 * Trigger bulk Clay contact enrichment for all districts in a plan.
 * Skips districts that already have contacts. Creates an Activity record
 * for admin visibility. Fires Clay webhooks in batches of 10.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { targetRole = "Superintendent" } = body;

    // Fetch the plan with its districts
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          select: { districtLeaid: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    // Concurrency guard: check if enrichment is already in progress
    if (
      plan.enrichmentStartedAt &&
      plan.enrichmentQueued &&
      Date.now() - plan.enrichmentStartedAt.getTime() < ENRICHMENT_TIMEOUT_MS
    ) {
      // Count how many queued districts now have contacts
      const allLeaids = plan.districts.map((d) => d.districtLeaid);
      const enrichedCount = await prisma.contact.groupBy({
        by: ["leaid"],
        where: { leaid: { in: allLeaids } },
      });

      if (enrichedCount.length < plan.enrichmentQueued) {
        return NextResponse.json(
          {
            error: "Enrichment already in progress",
            enriched: enrichedCount.length,
            queued: plan.enrichmentQueued,
          },
          { status: 409 }
        );
      }
    }

    const allLeaids = plan.districts.map((d) => d.districtLeaid);

    if (allLeaids.length === 0) {
      return NextResponse.json({ total: 0, skipped: 0, queued: 0 });
    }

    // Find districts that already have contacts (skip these)
    const districtsWithContacts = await prisma.contact.groupBy({
      by: ["leaid"],
      where: { leaid: { in: allLeaids } },
    });
    const enrichedLeaids = new Set(districtsWithContacts.map((d) => d.leaid));
    const leaidsToEnrich = allLeaids.filter((l) => !enrichedLeaids.has(l));

    const total = allLeaids.length;
    const skipped = enrichedLeaids.size;
    const queued = leaidsToEnrich.length;

    if (queued === 0) {
      return NextResponse.json({ total, skipped, queued: 0 });
    }

    // Fetch district details for Clay payload
    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaidsToEnrich } },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        cityLocation: true,
      },
    });

    const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
    if (!clayWebhookUrl) {
      return NextResponse.json(
        { error: "Clay webhook not configured. Please add CLAY_WEBHOOK_URL to environment variables." },
        { status: 500 }
      );
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://plan.fullmindlearning.com"}/api/webhooks/clay`;

    // Create Activity record for admin visibility
    const activity = await prisma.activity.create({
      data: {
        type: "contact_enrichment",
        title: `Bulk contact enrichment — ${targetRole}`,
        status: "in_progress",
        source: "system",
        createdByUserId: user.id,
        metadata: { targetRole, queued, skipped },
        plans: {
          create: { planId: id },
        },
      },
    });

    // Update plan with enrichment tracking
    await prisma.territoryPlan.update({
      where: { id },
      data: {
        enrichmentStartedAt: new Date(),
        enrichmentQueued: queued,
        enrichmentActivityId: activity.id,
      },
    });

    // Fire Clay webhooks in batches of 10, sequentially with 1s delay
    // This runs in the background after we return the response
    const batchSize = 10;
    const fireBatches = async () => {
      for (let i = 0; i < districts.length; i += batchSize) {
        const batch = districts.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (district) => {
            try {
              await fetch(clayWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  leaid: district.leaid,
                  district_name: district.name,
                  state: district.stateAbbrev,
                  city: district.cityLocation,
                  target_role: targetRole,
                  callback_url: callbackUrl,
                }),
              });
            } catch (error) {
              console.error(`Clay webhook failed for district ${district.leaid}:`, error);
            }
          })
        );

        // 1 second delay between batches (skip after last batch)
        if (i + batchSize < districts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };

    // Fire batches without awaiting — return immediately
    fireBatches().catch((error) => {
      console.error("Batch enrichment error:", error);
    });

    return NextResponse.json({ total, skipped, queued });
  } catch (error) {
    console.error("Error triggering bulk enrichment:", error);
    return NextResponse.json(
      { error: "Failed to trigger bulk enrichment" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "bulk-enrich"
```

Expected: No errors for this file.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/territory-plans/\[id\]/contacts/bulk-enrich/
git commit -m "feat: add bulk enrichment API endpoint with concurrency guard and activity logging"
```

---

## Task 4: Build the Enrichment Progress API Endpoint

**Files:**
- Create: `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts`

- [ ] **Step 1: Create the enrich-progress route directory**

```bash
mkdir -p "src/app/api/territory-plans/[id]/contacts/enrich-progress"
```

- [ ] **Step 2: Implement the GET endpoint**

Create `src/app/api/territory-plans/[id]/contacts/enrich-progress/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/territory-plans/[id]/contacts/enrich-progress
 *
 * Returns enrichment progress: how many queued districts now have contacts.
 * Also completes the Activity record when enrichment finishes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          select: { districtLeaid: true },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const allLeaids = plan.districts.map((d) => d.districtLeaid);
    const total = allLeaids.length;
    const queued = plan.enrichmentQueued ?? 0;

    if (queued === 0 || allLeaids.length === 0) {
      return NextResponse.json({ total, enriched: 0, queued: 0 });
    }

    // Count districts that have at least one contact
    const districtsWithContacts = await prisma.contact.groupBy({
      by: ["leaid"],
      where: { leaid: { in: allLeaids } },
    });

    // Enriched = districts with contacts minus those that were skipped (pre-existing)
    // skipped = total - queued (districts that already had contacts before enrichment)
    const skipped = total - queued;
    const enriched = Math.max(0, districtsWithContacts.length - skipped);

    // Check if enrichment is complete or stalled
    const isComplete = enriched >= queued;
    const isStalled =
      plan.enrichmentStartedAt &&
      Date.now() - plan.enrichmentStartedAt.getTime() > 10 * 60 * 1000;

    if ((isComplete || isStalled) && plan.enrichmentActivityId) {
      try {
        // Read existing Activity to preserve targetRole from metadata
        const existingActivity = await prisma.activity.findUnique({
          where: { id: plan.enrichmentActivityId },
          select: { metadata: true },
        });
        const existingMeta = (existingActivity?.metadata as Record<string, unknown>) ?? {};

        await prisma.activity.update({
          where: { id: plan.enrichmentActivityId },
          data: {
            status: "completed",
            metadata: { ...existingMeta, queued, skipped, enriched },
            ...(isStalled && !isComplete
              ? {
                  outcome: `Partial — enrichment stalled after ${enriched} of ${queued} districts`,
                  outcomeType: "neutral",
                }
              : {}),
          },
        });

        // Clear enrichment tracking on the plan
        await prisma.territoryPlan.update({
          where: { id },
          data: {
            enrichmentStartedAt: null,
            enrichmentQueued: null,
            enrichmentActivityId: null,
          },
        });
      } catch (error) {
        // Non-fatal: progress is still correct even if activity update fails
        console.error("Failed to update enrichment activity:", error);
      }
    }

    return NextResponse.json({ total, enriched, queued });
  } catch (error) {
    console.error("Error fetching enrichment progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch enrichment progress" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "enrich-progress"
```

Expected: No errors for this file.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/territory-plans/\[id\]/contacts/enrich-progress/
git commit -m "feat: add enrichment progress endpoint with activity completion"
```

---

## Task 5: Add TanStack Query Hooks

**Files:**
- Modify: `src/features/plans/lib/queries.ts:216-224` (after `usePlanContacts`)

- [ ] **Step 1: Update usePlanContacts to support polling**

In `src/features/plans/lib/queries.ts`, modify the existing `usePlanContacts` hook to accept an optional polling flag:

```typescript
export function usePlanContacts(planId: string | null, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["planContacts", planId],
    queryFn: () =>
      fetchJson<Contact[]>(`${API_BASE}/territory-plans/${planId}/contacts`),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
    refetchInterval: options?.refetchInterval ?? false,
  });
}
```

- [ ] **Step 2: Add the useBulkEnrich and useEnrichProgress hooks**

In `src/features/plans/lib/queries.ts`, add after the updated `usePlanContacts` hook:

```typescript
export function useBulkEnrich() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, targetRole }: { planId: string; targetRole: string }) =>
      fetchJson<{ total: number; skipped: number; queued: number }>(
        `${API_BASE}/territory-plans/${planId}/contacts/bulk-enrich`,
        {
          method: "POST",
          body: JSON.stringify({ targetRole }),
        }
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["planContacts", variables.planId] });
    },
  });
}

export interface EnrichProgress {
  total: number;
  enriched: number;
  queued: number;
}

export function useEnrichProgress(planId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["enrichProgress", planId],
    queryFn: () =>
      fetchJson<EnrichProgress>(
        `${API_BASE}/territory-plans/${planId}/contacts/enrich-progress`
      ),
    enabled: !!planId && enabled,
    refetchInterval: enabled ? 5000 : false, // Poll every 5 seconds when active
    staleTime: 0, // Always refetch
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "queries"
```

Expected: No errors. Note: existing callers of `usePlanContacts(planId)` continue to work — the new `options` parameter is optional.

- [ ] **Step 4: Commit**

```bash
git add src/features/plans/lib/queries.ts
git commit -m "feat: add useBulkEnrich and useEnrichProgress TanStack Query hooks"
```

---

## Task 6: Build the ContactsActionBar Component

**Files:**
- Create: `src/features/plans/components/ContactsActionBar.tsx`

**Docs to reference:** `Documentation/UI Framework/tokens.md` for Fullmind brand colors/styling.

- [ ] **Step 1: Create ContactsActionBar.tsx**

```typescript
"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Download, ChevronDown } from "lucide-react";
import { TARGET_ROLES, type TargetRole } from "@/features/shared/types/contact-types";
import type { Contact } from "@/lib/api";
import {
  useBulkEnrich,
  useEnrichProgress,
  type EnrichProgress,
} from "@/features/plans/lib/queries";

interface ContactsActionBarProps {
  planId: string;
  planName: string;
  contacts: Contact[];
  districtNameMap?: Map<string, string>;
  /** All district LEAIDs in the plan — used for CSV export of empty districts */
  allDistrictLeaids: string[];
  /** Callback to notify parent when enrichment starts/stops (for polling usePlanContacts) */
  onEnrichingChange?: (isEnriching: boolean) => void;
}

export default function ContactsActionBar({
  planId,
  planName,
  contacts,
  districtNameMap,
  allDistrictLeaids,
  onEnrichingChange,
}: ContactsActionBarProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");
  const [isEnriching, setIsEnriching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEnrichedRef = useRef<number>(0);

  const bulkEnrich = useBulkEnrich();
  const { data: progress } = useEnrichProgress(planId, isEnriching);

  // Notify parent of enrichment state changes (for usePlanContacts polling)
  useEffect(() => {
    onEnrichingChange?.(isEnriching);
  }, [isEnriching, onEnrichingChange]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  // Track enrichment completion and stall detection
  useEffect(() => {
    if (!isEnriching || !progress) return;

    // Completion check
    if (progress.queued > 0 && progress.enriched >= progress.queued) {
      setIsEnriching(false);
      setToast({ message: `Contact enrichment complete — ${progress.enriched} districts enriched`, type: "success" });
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }

    // Stall detection: if progress hasn't changed in 2 minutes
    if (progress.enriched !== lastEnrichedRef.current) {
      lastEnrichedRef.current = progress.enriched;
      // Reset stall timer
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({ message: "Enrichment may be stalled — some districts may not have results", type: "warning" });
      }, 2 * 60 * 1000);
    }
  }, [isEnriching, progress]);

  // Cleanup stall timer on unmount
  useEffect(() => {
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  const handleStartEnrichment = useCallback(async () => {
    setShowPopover(false);

    try {
      const result = await bulkEnrich.mutateAsync({ planId, targetRole: selectedRole });

      if (result.queued === 0) {
        setToast({ message: "All districts already have contacts — nothing to enrich", type: "info" });
        return;
      }

      setIsEnriching(true);
      lastEnrichedRef.current = 0;

      // Start stall timer
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({ message: "Enrichment may be stalled — some districts may not have results", type: "warning" });
      }, 2 * 60 * 1000);

      setToast({ message: `Contact enrichment started for ${result.queued} districts`, type: "info" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start contact enrichment";
      if (message.includes("409") || message.includes("already in progress")) {
        setToast({ message: "Enrichment already in progress", type: "info" });
        setIsEnriching(true);
      } else {
        setToast({ message, type: "error" });
      }
    }
  }, [planId, selectedRole, bulkEnrich]);

  const handleExportCsv = useCallback(() => {
    const headers = ["District Name", "Contact Name", "Title", "Email", "Phone", "Department", "Seniority Level"];

    // Build a map of leaid -> primary contact
    const primaryByDistrict = new Map<string, Contact>();
    for (const contact of contacts) {
      const existing = primaryByDistrict.get(contact.leaid);
      if (!existing) {
        primaryByDistrict.set(contact.leaid, contact);
      } else if (contact.isPrimary && !existing.isPrimary) {
        primaryByDistrict.set(contact.leaid, contact);
      } else if (
        !existing.isPrimary &&
        !contact.isPrimary &&
        contact.name.localeCompare(existing.name) < 0
      ) {
        primaryByDistrict.set(contact.leaid, contact);
      }
    }

    // One row per district (including districts with no contacts)
    const rows = allDistrictLeaids.map((leaid) => {
      const districtName = districtNameMap?.get(leaid) || leaid;
      const contact = primaryByDistrict.get(leaid);

      return [
        districtName,
        contact?.name || "",
        contact?.title || "",
        contact?.email || "",
        contact?.phone || "",
        contact?.persona || "",
        contact?.seniorityLevel || "",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = planName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeName}-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [contacts, allDistrictLeaids, districtNameMap, planName]);

  const progressPercent =
    progress && progress.queued > 0
      ? Math.round((progress.enriched / progress.queued) * 100)
      : 0;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EFEDF5]">
        <div className="flex items-center gap-2">
          {/* Find Contacts */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover(!showPopover)}
              disabled={isEnriching || bulkEnrich.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Find Contacts
            </button>

            {showPopover && (
              <div
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#EFEDF5] p-3 z-50"
                style={{ animation: "tooltipEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
              >
                <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                  Target Role
                </label>
                <div className="relative mb-3">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
                  >
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
                </div>
                <button
                  onClick={handleStartEnrichment}
                  disabled={bulkEnrich.isPending}
                  className="w-full px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 rounded-lg transition-colors"
                >
                  {bulkEnrich.isPending ? "Starting..." : "Start"}
                </button>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          {isEnriching && progress && progress.queued > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-24 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8AA891] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[12px] text-[#403770]/60 font-medium whitespace-nowrap">
                {progress.enriched}/{progress.queued}
              </span>
            </div>
          )}
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#403770] hover:bg-[#F7F5FA] rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium ${
            toast.type === "success"
              ? "bg-[#8AA891] text-white"
              : toast.type === "warning"
                ? "bg-amber-500 text-white"
                : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-[#403770] text-white"
          }`}
          style={{ animation: "tooltipEnter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "ContactsActionBar"
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/plans/components/ContactsActionBar.tsx
git commit -m "feat: add ContactsActionBar with Find Contacts popover, progress, and CSV export"
```

---

## Task 7: Integrate ContactsActionBar into the Contacts Tab

**Files:**
- Modify: `src/features/plans/components/PlanTabs.tsx:32-48, 800-820` (parent that renders ContactsTable)
- Modify: `src/features/plans/components/ContactsTable.tsx:81-100, 180-194, 196-200`

**Context:** `ContactsTable` is rendered by `PlanTabs` (at `src/features/plans/components/PlanTabs.tsx:811`). `PlanTabs` already has `planId` and `districts` (which gives us LEAIDs). The plan name is available from `PlansView.tsx` which renders `PlanTabs`. We need to thread `planName` through.

- [ ] **Step 1: Add `planName` and `onEnrichingChange` to PlanTabsProps**

In `src/features/plans/components/PlanTabs.tsx`, add to the `PlanTabsProps` interface (around line 33):

```typescript
interface PlanTabsProps {
  planId: string;
  planName: string;  // NEW
  districts: TerritoryPlanDistrict[];
  // ... rest unchanged
  onEnrichingChange?: (isEnriching: boolean) => void;  // NEW
}
```

Add to destructuring (around line 221):
```typescript
export default function PlanTabs({
  planId,
  planName,  // NEW
  districts,
  // ... rest unchanged
  onEnrichingChange,  // NEW
}: PlanTabsProps) {
```

- [ ] **Step 2: Compute allDistrictLeaids and pass new props to ContactsTable**

In PlanTabs, compute the LEAIDs list (add near the top of the component body):

```typescript
const allDistrictLeaids = useMemo(
  () => districts.map((d) => d.leaid),
  [districts]
);
```

Add `useMemo` to the import if not already imported.

Then update both `<ContactsTable>` renders (around lines 811 and 834) to pass the new props:

```typescript
<ContactsTable
  contacts={filtered}
  districtNameMap={districtNameMap}
  totalCount={contacts.length}
  onEdit={onEditContact}
  onDelete={onDeleteContact}
  onContactClick={onContactClick}
  planId={planId}
  planName={planName}
  allDistrictLeaids={allDistrictLeaids}
  onEnrichingChange={onEnrichingChange}
/>
```

- [ ] **Step 3: Add new props to ContactsTable**

In `src/features/plans/components/ContactsTable.tsx`, add to `ContactsTableProps`:

```typescript
interface ContactsTableProps {
  contacts: Contact[];
  districtNameMap?: Map<string, string>;
  totalCount?: number;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contactId: number) => void;
  onContactClick?: (leaid: string, contactId: number) => void;
  // New props for action bar
  planId?: string;
  planName?: string;
  allDistrictLeaids?: string[];
  onEnrichingChange?: (isEnriching: boolean) => void;
}
```

Add to destructuring:
```typescript
export default function ContactsTable({
  contacts, districtNameMap, totalCount,
  onEdit, onDelete, onContactClick,
  planId, planName, allDistrictLeaids, onEnrichingChange,
}: ContactsTableProps) {
```

- [ ] **Step 4: Import and render ContactsActionBar in ContactsTable**

Add import at top:
```typescript
import ContactsActionBar from "./ContactsActionBar";
```

Add a helper component to avoid duplication. Above the `return` statement, define:

```typescript
const actionBar = planId && planName && allDistrictLeaids ? (
  <div className="mb-3 overflow-hidden border border-[#EFEDF5] rounded-lg bg-white shadow-sm">
    <ContactsActionBar
      planId={planId}
      planName={planName}
      contacts={contacts}
      districtNameMap={districtNameMap}
      allDistrictLeaids={allDistrictLeaids}
      onEnrichingChange={onEnrichingChange}
    />
  </div>
) : null;
```

In the empty state return (line ~180), wrap with the action bar:
```typescript
if (contacts.length === 0) {
  return (
    <div className="relative">
      {actionBar}
      <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
        {/* ... existing empty state content unchanged ... */}
      </div>
    </div>
  );
}
```

In the main return (line ~196), add above the table:
```typescript
return (
  <div className="relative">
    {actionBar}
    {/* Table */}
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
      {/* ... existing table unchanged ... */}
```

- [ ] **Step 5: Pass planName from PlansView to PlanTabs**

In `src/features/shared/components/views/PlansView.tsx` (around line 989), add `planName` prop:

```typescript
<PlanTabs
  planId={planId}
  planName={plan.name}
  districts={plan.districts}
  // ... rest unchanged
/>
```

Also add an `onEnrichingChange` handler in PlansView. This is needed so the parent can toggle `usePlanContacts` polling. In the PlansView component body (near where `usePlanContacts` is called), add state and pass it:

```typescript
const [isEnriching, setIsEnriching] = useState(false);
```

Update the `usePlanContacts` call to poll during enrichment:
```typescript
const { data: contacts = [] } = usePlanContacts(planId, {
  refetchInterval: isEnriching ? 5000 : false,
});
```

Pass to PlanTabs:
```typescript
<PlanTabs
  planId={planId}
  planName={plan.name}
  // ... rest unchanged
  onEnrichingChange={setIsEnriching}
/>
```

Note: Find where `usePlanContacts` is called in PlansView first — it may be called directly or the contacts may come from a different source. Adjust accordingly.

- [ ] **Step 6: Verify TypeScript compiles and dev server runs**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run dev
```

Open the Contacts tab in the browser to visually verify the action bar renders.

- [ ] **Step 7: Commit**

```bash
git add src/features/plans/components/ContactsTable.tsx src/features/plans/components/ContactsActionBar.tsx src/features/plans/components/PlanTabs.tsx src/features/shared/components/views/PlansView.tsx
git commit -m "feat: integrate ContactsActionBar with Find Contacts, CSV export, and real-time polling"
```

---

## Task 8: End-to-End Manual Testing

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test the Find Contacts flow**

1. Open a territory plan with districts
2. Go to the Contacts tab
3. Verify the action bar shows "Find Contacts" and "Export CSV" buttons
4. Click "Find Contacts" — verify the popover opens with role dropdown defaulting to "Superintendent"
5. Click "Start" — verify toast appears, progress bar shows
6. If Clay is not configured, verify the error toast appears with a clear message

- [ ] **Step 3: Test the CSV Export flow**

1. Click "Export CSV" — verify a CSV file downloads
2. Open the CSV — verify it has all plan districts as rows
3. Districts with no contacts should have empty contact fields
4. Districts with contacts should show the primary contact's info

- [ ] **Step 4: Test empty state**

1. Open a plan with no contacts
2. Verify the action bar still renders above the empty state message
3. Verify "Find Contacts" and "Export CSV" both work from empty state

- [ ] **Step 5: Commit any fixes**

```bash
git add -u
git commit -m "fix: address issues found during manual testing"
```

---

## Task 9: Final Verification and Cleanup

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No new errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All existing tests pass.

- [ ] **Step 3: Verify no console errors in browser**

Open the Contacts tab, open browser devtools console, verify no errors or warnings from the new code.

- [ ] **Step 4: Final commit if needed**

```bash
git add -u
git commit -m "chore: cleanup and final verification"
```
