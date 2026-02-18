import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncAutoTagsForDistrict } from "@/lib/autoTags";
import {
  type FilterDef,
  buildWhereClause,
  DISTRICT_FIELD_MAP,
} from "@/lib/explore-filters";

export const dynamic = "force-dynamic";

// POST /api/territory-plans/[id]/districts - Add district(s) to a plan
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const body = await request.json();
    const { leaids, filters, renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, notes, returnServiceIds, newServiceIds } = body;

    // Resolve district leaids from either explicit list or server-side filters
    let districtLeaids: string[];
    const hasFilters = Array.isArray(filters) && filters.length > 0;

    if (hasFilters) {
      const where = buildWhereClause(filters as FilterDef[], DISTRICT_FIELD_MAP);
      const districts = await prisma.district.findMany({
        where,
        select: { leaid: true },
      });
      districtLeaids = districts.map((d) => d.leaid);
    } else if (typeof leaids === "string") {
      districtLeaids = [leaids];
    } else if (Array.isArray(leaids)) {
      districtLeaids = leaids;
    } else {
      return NextResponse.json(
        { error: "Either leaids or filters must be provided" },
        { status: 400 }
      );
    }

    if (districtLeaids.length === 0) {
      return NextResponse.json(
        { error: "No matching districts found" },
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

    // Verify all districts exist (skip when resolved from filters — already from DB)
    if (!hasFilters) {
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
    }

    // Add districts to plan (skipDuplicates handles if already added)
    // If adding a single district with targets, use create; otherwise use createMany
    let addedCount = 0;

    if (districtLeaids.length === 1 && (renewalTarget || winbackTarget || expansionTarget || newBusinessTarget || notes || returnServiceIds || newServiceIds)) {
      // Single district with targets - use upsert to handle duplicates gracefully
      const leaid = districtLeaids[0];
      await prisma.territoryPlanDistrict.upsert({
        where: {
          planId_districtLeaid: { planId, districtLeaid: leaid },
        },
        create: {
          planId,
          districtLeaid: leaid,
          renewalTarget: renewalTarget ?? null,
          winbackTarget: winbackTarget ?? null,
          expansionTarget: expansionTarget ?? null,
          newBusinessTarget: newBusinessTarget ?? null,
          notes: notes ?? null,
        },
        update: {
          renewalTarget: renewalTarget ?? undefined,
          winbackTarget: winbackTarget ?? undefined,
          expansionTarget: expansionTarget ?? undefined,
          newBusinessTarget: newBusinessTarget ?? undefined,
          notes: notes ?? undefined,
        },
      });
      addedCount = 1;

      // Handle service assignments if provided
      if (returnServiceIds || newServiceIds) {
        await prisma.territoryPlanDistrictService.deleteMany({
          where: { planId, districtLeaid: leaid },
        });

        const serviceRecords: Array<{ planId: string; districtLeaid: string; serviceId: number; category: "return_services" | "new_services" }> = [];

        if (returnServiceIds && returnServiceIds.length > 0) {
          for (const serviceId of returnServiceIds) {
            serviceRecords.push({ planId, districtLeaid: leaid, serviceId, category: "return_services" });
          }
        }
        if (newServiceIds && newServiceIds.length > 0) {
          for (const serviceId of newServiceIds) {
            serviceRecords.push({ planId, districtLeaid: leaid, serviceId, category: "new_services" });
          }
        }

        if (serviceRecords.length > 0) {
          await prisma.territoryPlanDistrictService.createMany({ data: serviceRecords });
        }
      }
    } else {
      // Multiple districts or no targets - use createMany
      const result = await prisma.territoryPlanDistrict.createMany({
        data: districtLeaids.map((leaid) => ({
          planId,
          districtLeaid: leaid,
        })),
        skipDuplicates: true,
      });
      addedCount = result.count;
    }

    // Sync auto-tags for all added districts
    await Promise.all(
      districtLeaids.map((leaid) => syncAutoTagsForDistrict(leaid))
    );

    return NextResponse.json(
      {
        added: addedCount,
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
