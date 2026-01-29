import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncAutoTagsForDistrict } from "@/lib/autoTags";

export const dynamic = "force-dynamic";

// POST /api/territory-plans/[id]/districts - Add district(s) to a plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const body = await request.json();
    const { leaids } = body;

    // Validate input - accept either a single leaid or array of leaids
    let districtLeaids: string[];
    if (typeof leaids === "string") {
      districtLeaids = [leaids];
    } else if (Array.isArray(leaids)) {
      districtLeaids = leaids;
    } else {
      return NextResponse.json(
        { error: "leaids must be a string or array of strings" },
        { status: 400 }
      );
    }

    if (districtLeaids.length === 0) {
      return NextResponse.json(
        { error: "At least one leaid is required" },
        { status: 400 }
      );
    }

    // Check if plan exists
    const plan = await prisma.territoryPlan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Verify all districts exist
    const existingDistricts = await prisma.district.findMany({
      where: { leaid: { in: districtLeaids } },
      select: { leaid: true },
    });

    const existingLeaids = new Set(existingDistricts.map((d) => d.leaid));
    const invalidLeaids = districtLeaids.filter((l) => !existingLeaids.has(l));

    if (invalidLeaids.length > 0) {
      return NextResponse.json(
        { error: `Districts not found: ${invalidLeaids.join(", ")}` },
        { status: 400 }
      );
    }

    // Add districts to plan (skipDuplicates handles if already added)
    const result = await prisma.territoryPlanDistrict.createMany({
      data: districtLeaids.map((leaid) => ({
        planId,
        districtLeaid: leaid,
      })),
      skipDuplicates: true,
    });

    // Sync auto-tags for all added districts
    await Promise.all(
      districtLeaids.map((leaid) => syncAutoTagsForDistrict(leaid))
    );

    return NextResponse.json(
      {
        added: result.count,
        planId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding districts to plan:", error);
    return NextResponse.json(
      { error: "Failed to add districts to plan" },
      { status: 500 }
    );
  }
}
