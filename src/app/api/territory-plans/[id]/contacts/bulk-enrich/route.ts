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
