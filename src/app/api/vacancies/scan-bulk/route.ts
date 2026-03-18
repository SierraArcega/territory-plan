import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { runScan } from "@/features/vacancies/lib/scan-runner";

export const dynamic = "force-dynamic";

// Allow up to 300s for bulk scans (runs districts sequentially)
export const maxDuration = 300;

/**
 * POST /api/vacancies/scan-bulk
 *
 * Trigger vacancy scans for all districts in a territory plan.
 *
 * Request body: { territoryPlanId: string }
 * Response: {
 *   batchId: string,
 *   totalDistricts: number,
 *   scansCreated: number,
 *   skipped: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { territoryPlanId } = body as { territoryPlanId?: string };

    if (!territoryPlanId || typeof territoryPlanId !== "string") {
      return NextResponse.json(
        { error: "territoryPlanId is required" },
        { status: 400 }
      );
    }

    // Verify the territory plan exists
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: territoryPlanId },
      select: { id: true },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Fetch all districts in the territory plan
    const planDistricts = await prisma.territoryPlanDistrict.findMany({
      where: { planId: territoryPlanId },
      include: {
        district: {
          select: {
            leaid: true,
            jobBoardUrl: true,
          },
        },
      },
    });

    const totalDistricts = planDistricts.length;

    // Filter to districts with a job board URL
    const eligibleDistricts = planDistricts.filter(
      (pd) => pd.district.jobBoardUrl
    );

    const skipped = totalDistricts - eligibleDistricts.length;

    // Generate a batch ID
    const batchId = crypto.randomUUID();

    // Create VacancyScan rows for each eligible district
    const scans = await Promise.all(
      eligibleDistricts.map((pd) =>
        prisma.vacancyScan.create({
          data: {
            leaid: pd.district.leaid,
            status: "pending",
            triggeredBy: user.email ?? user.id,
            batchId,
          },
        })
      )
    );

    // Run all scans inline (sequentially to avoid overwhelming the DB/API)
    for (const scan of scans) {
      await runScan(scan.id);
    }

    return NextResponse.json({
      batchId,
      totalDistricts,
      scansCreated: scans.length,
      skipped,
    });
  } catch (error) {
    console.error("Error triggering bulk vacancy scan:", error);
    return NextResponse.json(
      { error: "Failed to trigger bulk vacancy scan" },
      { status: 500 }
    );
  }
}
