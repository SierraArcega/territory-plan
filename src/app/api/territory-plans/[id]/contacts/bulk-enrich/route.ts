import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getRollupLeaids, getChildren } from "@/features/districts/lib/rollup";

export const dynamic = "force-dynamic";

const ENRICHMENT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * POST /api/territory-plans/[id]/contacts/bulk-enrich
 *
 * Trigger bulk Clay contact enrichment for a plan.
 *   - Non-Principal roles: one webhook per district (skipping districts that already have contacts).
 *   - Principal: one webhook per School at the requested schoolLevels (skipping schools already linked
 *     to a principal via SchoolContact).
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
    const targetRole: string = body.targetRole ?? "Superintendent";
    const schoolLevelsRaw: unknown = body.schoolLevels;

    const isPrincipal = targetRole === "Principal";

    let schoolLevels: number[] = [];
    if (isPrincipal) {
      if (!Array.isArray(schoolLevelsRaw) || schoolLevelsRaw.length === 0) {
        return NextResponse.json(
          { error: "schoolLevels is required and must be non-empty when targetRole is Principal" },
          { status: 400 }
        );
      }
      schoolLevels = schoolLevelsRaw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 4);
      if (schoolLevels.length === 0) {
        return NextResponse.json(
          { error: "schoolLevels must contain integers 1–4" },
          { status: 400 }
        );
      }
    }

    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: { districts: { select: { districtLeaid: true } } },
    });

    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const allLeaids = plan.districts.map((d) => d.districtLeaid);

    // Rollup pre-check — fail fast with a reason code the UI can act on.
    // This is a defensive layer on top of T7's auto-migrate (which runs on plan GET);
    // plans modified out-of-band might still reach here with rollup leaids.
    const rollupLeaids = await getRollupLeaids(allLeaids);
    if (rollupLeaids.length > 0) {
      const childLeaids = (
        await Promise.all(rollupLeaids.map((l) => getChildren(l)))
      ).flat();
      return NextResponse.json(
        {
          error: "Plan contains rollup district(s); expand to children before enriching.",
          reason: "rollup-district",
          rollupLeaids,
          childLeaids,
        },
        { status: 400 }
      );
    }

    if (allLeaids.length === 0) {
      return NextResponse.json({ total: 0, skipped: 0, queued: 0, reason: "no-districts" });
    }

    const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;
    if (!clayWebhookUrl) {
      return NextResponse.json(
        { error: "Clay webhook not configured. Please add CLAY_WEBHOOK_URL to environment variables." },
        { status: 500 }
      );
    }

    const callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://plan.fullmindlearning.com"}/api/webhooks/clay`;

    // ---------- Concurrency guard (shared) ----------
    if (
      plan.enrichmentStartedAt &&
      plan.enrichmentQueued &&
      Date.now() - plan.enrichmentStartedAt.getTime() < ENRICHMENT_TIMEOUT_MS
    ) {
      // For district mode, the existing check against contact groupBy is correct.
      // For Principal mode, we conservatively refuse until the previous run times out.
      if (isPrincipal) {
        return NextResponse.json(
          {
            error: "Enrichment already in progress",
            enriched: 0,
            queued: plan.enrichmentQueued,
          },
          { status: 409 }
        );
      }
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

    // ============================================================
    // Principal path — one webhook per school
    // ============================================================
    if (isPrincipal) {
      const schools = await prisma.school.findMany({
        where: {
          leaid: { in: allLeaids },
          schoolLevel: { in: schoolLevels },
          schoolStatus: 1, // open schools only
        },
        select: {
          ncessch: true,
          schoolName: true,
          schoolLevel: true,
          schoolType: true,
          leaid: true,
          streetAddress: true,
          city: true,
          stateAbbrev: true,
          zip: true,
          phone: true,
        },
      });

      if (schools.length === 0) {
        const anySchoolsOnRecord = await prisma.school.count({
          where: { leaid: { in: allLeaids } },
        });
        return NextResponse.json({
          total: 0,
          skipped: 0,
          queued: 0,
          reason: anySchoolsOnRecord === 0 ? "no-schools-in-district" : "no-schools-at-levels",
        });
      }

      // NOTE: the "already enriched as principal" heuristic matches title /principal/i.
      // If match rate is poor in production, fall back to skipping schools with ANY SchoolContact.
      const alreadyPrincipal = await prisma.schoolContact.findMany({
        where: {
          schoolId: { in: schools.map((s) => s.ncessch) },
          contact: { title: { contains: "principal", mode: "insensitive" } },
        },
        select: { schoolId: true },
      });
      const alreadyPrincipalSet = new Set(alreadyPrincipal.map((r) => r.schoolId));
      const toEnrich = schools.filter((s) => !alreadyPrincipalSet.has(s.ncessch));

      const total = schools.length;
      const skipped = alreadyPrincipalSet.size;
      const queued = toEnrich.length;

      if (queued === 0) {
        return NextResponse.json({ total, skipped, queued: 0 });
      }

      const districtRows = await prisma.district.findMany({
        where: { leaid: { in: Array.from(new Set(toEnrich.map((s) => s.leaid))) } },
        select: {
          leaid: true,
          name: true,
          stateAbbrev: true,
          websiteUrl: true,
        },
      });
      const districtByLeaid = new Map(districtRows.map((d) => [d.leaid, d]));

      const activity = await prisma.activity.create({
        data: {
          type: "contact_enrichment",
          title: `Bulk contact enrichment — Principal`,
          status: "in_progress",
          source: "system",
          createdByUserId: user.id,
          metadata: {
            targetRole: "Principal",
            schoolLevels,
            schoolsQueued: queued,
            districtCount: districtRows.length,
            skipped,
          },
          plans: { create: { planId: id } },
        },
      });

      await prisma.territoryPlan.update({
        where: { id },
        data: {
          enrichmentStartedAt: new Date(),
          enrichmentQueued: queued,
          enrichmentActivityId: activity.id,
        },
      });

      const batchSize = 10;
      const fireBatches = async () => {
        for (let i = 0; i < toEnrich.length; i += batchSize) {
          const batch = toEnrich.slice(i, i + batchSize);
          await Promise.all(
            batch.map(async (school) => {
              const district = districtByLeaid.get(school.leaid);
              try {
                await fetch(clayWebhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    ncessch: school.ncessch,
                    school_name: school.schoolName,
                    school_level: school.schoolLevel,
                    school_type: school.schoolType,
                    leaid: school.leaid,
                    district_name: district?.name ?? null,
                    state: school.stateAbbrev,
                    city: school.city,
                    street: school.streetAddress,
                    zip: school.zip,
                    website_url: district?.websiteUrl ?? null,
                    target_role: "Principal",
                    callback_url: callbackUrl,
                  }),
                });
              } catch (error) {
                console.error(`Clay webhook failed for school ${school.ncessch}:`, error);
              }
            })
          );
          if (i + batchSize < toEnrich.length) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      };
      fireBatches().catch((error) => {
        console.error("Batch enrichment error (Principal):", error);
      });

      return NextResponse.json({ total, skipped, queued });
    }

    // ============================================================
    // Existing per-district path (unchanged behavior)
    // ============================================================
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

    const districts = await prisma.district.findMany({
      where: { leaid: { in: leaidsToEnrich } },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        cityLocation: true,
        streetLocation: true,
        zipLocation: true,
        websiteUrl: true,
      },
    });

    const activity = await prisma.activity.create({
      data: {
        type: "contact_enrichment",
        title: `Bulk contact enrichment — ${targetRole}`,
        status: "in_progress",
        source: "system",
        createdByUserId: user.id,
        metadata: { targetRole, queued, skipped },
        plans: { create: { planId: id } },
      },
    });

    await prisma.territoryPlan.update({
      where: { id },
      data: {
        enrichmentStartedAt: new Date(),
        enrichmentQueued: queued,
        enrichmentActivityId: activity.id,
      },
    });

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
                  street: district.streetLocation,
                  state_full: district.stateAbbrev,
                  zip: district.zipLocation,
                  website_url: district.websiteUrl,
                  target_role: targetRole,
                  callback_url: callbackUrl,
                }),
              });
            } catch (error) {
              console.error(`Clay webhook failed for district ${district.leaid}:`, error);
            }
          })
        );
        if (i + batchSize < districts.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    };
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
