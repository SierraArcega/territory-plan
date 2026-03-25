import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/territory-plans/[id]/contacts/enrich-progress
 *
 * Returns enrichment progress: how many queued districts now have contacts.
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
