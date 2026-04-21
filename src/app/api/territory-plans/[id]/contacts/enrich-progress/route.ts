import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/territory-plans/[id]/contacts/enrich-progress
 *
 * Returns enrichment progress. Branches on the active enrichment Activity's
 * metadata.targetRole:
 *   - "Principal": counts schools with a principal SchoolContact.
 *   - anything else (or no active activity): counts districts with any contact.
 *
 * Also completes the Activity record when enrichment finishes or stalls.
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
      include: { districts: { select: { districtLeaid: true } } },
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

    // Read the active activity's metadata to decide counting strategy
    let targetRole: string | null = null;
    let activityMeta: Record<string, unknown> = {};
    if (plan.enrichmentActivityId) {
      const activity = await prisma.activity.findUnique({
        where: { id: plan.enrichmentActivityId },
        select: { metadata: true },
      });
      activityMeta = (activity?.metadata as Record<string, unknown>) ?? {};
      targetRole = typeof activityMeta.targetRole === "string" ? activityMeta.targetRole : null;
    }

    let enriched: number;
    let skipped: number;

    if (targetRole === "Principal") {
      // Count distinct schools (in the plan's districts) that now have a principal SchoolContact.
      const principalLinks = await prisma.schoolContact.findMany({
        where: {
          school: { leaid: { in: allLeaids } },
          contact: { title: { contains: "principal", mode: "insensitive" } },
        },
        select: { schoolId: true },
        distinct: ["schoolId"],
      });
      const schoolsWithPrincipal = principalLinks.length;
      // `skipped` was recorded at fire time; subtract it so we only count newly enriched.
      skipped = typeof activityMeta.skipped === "number" ? activityMeta.skipped : 0;
      enriched = Math.max(0, schoolsWithPrincipal - skipped);
    } else {
      const districtsWithContacts = await prisma.contact.groupBy({
        by: ["leaid"],
        where: { leaid: { in: allLeaids } },
      });
      skipped = total - queued;
      enriched = Math.max(0, districtsWithContacts.length - skipped);
    }

    const isComplete = enriched >= queued;
    const isStalled =
      plan.enrichmentStartedAt &&
      Date.now() - plan.enrichmentStartedAt.getTime() > 10 * 60 * 1000;

    if ((isComplete || isStalled) && plan.enrichmentActivityId) {
      try {
        await prisma.activity.update({
          where: { id: plan.enrichmentActivityId },
          data: {
            status: "completed",
            metadata: { ...activityMeta, queued, skipped, enriched },
            ...(isStalled && !isComplete
              ? {
                  outcome: `Partial — enrichment stalled after ${enriched} of ${queued}`,
                  outcomeType: "neutral",
                }
              : {}),
          },
        });

        await prisma.territoryPlan.update({
          where: { id },
          data: {
            enrichmentStartedAt: null,
            enrichmentQueued: null,
            enrichmentActivityId: null,
          },
        });
      } catch (error) {
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
