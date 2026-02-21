import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncAutoTagsForDistrict } from "@/lib/autoTags";
import { syncPlanRollups } from "@/lib/plan-rollup-sync";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id]/districts/[leaid] - Get district detail with targets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id: planId, leaid } = await params;

    const planDistrict = await prisma.territoryPlanDistrict.findUnique({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
            enrollment: true,
          },
        },
        targetServices: {
          include: {
            service: {
              select: { id: true, name: true, slug: true, color: true },
            },
          },
        },
      },
    });

    if (!planDistrict) {
      return NextResponse.json(
        { error: "District not found in this plan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      planId,
      leaid: planDistrict.districtLeaid,
      addedAt: planDistrict.addedAt.toISOString(),
      name: planDistrict.district.name,
      stateAbbrev: planDistrict.district.stateAbbrev,
      enrollment: planDistrict.district.enrollment,
      renewalTarget: planDistrict.renewalTarget ? Number(planDistrict.renewalTarget) : null,
      winbackTarget: planDistrict.winbackTarget ? Number(planDistrict.winbackTarget) : null,
      expansionTarget: planDistrict.expansionTarget ? Number(planDistrict.expansionTarget) : null,
      newBusinessTarget: planDistrict.newBusinessTarget ? Number(planDistrict.newBusinessTarget) : null,
      notes: planDistrict.notes,
      returnServices: planDistrict.targetServices
        .filter((ts) => ts.category === "return_services")
        .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
      newServices: planDistrict.targetServices
        .filter((ts) => ts.category === "new_services")
        .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
    });
  } catch (error) {
    console.error("Error fetching district from plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch district from plan" },
      { status: 500 }
    );
  }
}

// PUT /api/territory-plans/[id]/districts/[leaid] - Update district targets, notes, and services
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id: planId, leaid } = await params;
    const body = await request.json();
    const { renewalTarget, winbackTarget, expansionTarget, newBusinessTarget, notes, returnServiceIds, newServiceIds } = body;

    // Check if the relationship exists
    const existing = await prisma.territoryPlanDistrict.findUnique({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "District not found in this plan" },
        { status: 404 }
      );
    }

    // Update targets and notes
    const updateData: Record<string, unknown> = {};
    if (renewalTarget !== undefined) updateData.renewalTarget = renewalTarget;
    if (winbackTarget !== undefined) updateData.winbackTarget = winbackTarget;
    if (expansionTarget !== undefined) updateData.expansionTarget = expansionTarget;
    if (newBusinessTarget !== undefined) updateData.newBusinessTarget = newBusinessTarget;
    if (notes !== undefined) updateData.notes = notes;

    const updatedPlanDistrict = await prisma.territoryPlanDistrict.update({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
      data: updateData,
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
            enrollment: true,
          },
        },
        targetServices: {
          include: {
            service: {
              select: { id: true, name: true, slug: true, color: true },
            },
          },
        },
      },
    });

    // Handle service assignments if provided
    if (returnServiceIds !== undefined || newServiceIds !== undefined) {
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

      // Re-fetch to get updated services
      const refreshed = await prisma.territoryPlanDistrict.findUnique({
        where: {
          planId_districtLeaid: {
            planId,
            districtLeaid: leaid,
          },
        },
        include: {
          targetServices: {
            include: {
              service: {
                select: { id: true, name: true, slug: true, color: true },
              },
            },
          },
        },
      });

      await syncPlanRollups(planId);

      return NextResponse.json({
        planId,
        leaid: updatedPlanDistrict.districtLeaid,
        addedAt: updatedPlanDistrict.addedAt.toISOString(),
        name: updatedPlanDistrict.district.name,
        stateAbbrev: updatedPlanDistrict.district.stateAbbrev,
        enrollment: updatedPlanDistrict.district.enrollment,
        renewalTarget: updatedPlanDistrict.renewalTarget ? Number(updatedPlanDistrict.renewalTarget) : null,
        winbackTarget: updatedPlanDistrict.winbackTarget ? Number(updatedPlanDistrict.winbackTarget) : null,
        expansionTarget: updatedPlanDistrict.expansionTarget ? Number(updatedPlanDistrict.expansionTarget) : null,
        newBusinessTarget: updatedPlanDistrict.newBusinessTarget ? Number(updatedPlanDistrict.newBusinessTarget) : null,
        notes: updatedPlanDistrict.notes,
        returnServices: refreshed?.targetServices
          .filter((ts) => ts.category === "return_services")
          .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })) ?? [],
        newServices: refreshed?.targetServices
          .filter((ts) => ts.category === "new_services")
          .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })) ?? [],
      });
    }

    await syncPlanRollups(planId);

    return NextResponse.json({
      planId,
      leaid: updatedPlanDistrict.districtLeaid,
      addedAt: updatedPlanDistrict.addedAt.toISOString(),
      name: updatedPlanDistrict.district.name,
      stateAbbrev: updatedPlanDistrict.district.stateAbbrev,
      enrollment: updatedPlanDistrict.district.enrollment,
      renewalTarget: updatedPlanDistrict.renewalTarget ? Number(updatedPlanDistrict.renewalTarget) : null,
      winbackTarget: updatedPlanDistrict.winbackTarget ? Number(updatedPlanDistrict.winbackTarget) : null,
      expansionTarget: updatedPlanDistrict.expansionTarget ? Number(updatedPlanDistrict.expansionTarget) : null,
      newBusinessTarget: updatedPlanDistrict.newBusinessTarget ? Number(updatedPlanDistrict.newBusinessTarget) : null,
      notes: updatedPlanDistrict.notes,
      returnServices: updatedPlanDistrict.targetServices
        .filter((ts) => ts.category === "return_services")
        .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
      newServices: updatedPlanDistrict.targetServices
        .filter((ts) => ts.category === "new_services")
        .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
    });
  } catch (error) {
    console.error("Error updating district in plan:", error);
    return NextResponse.json(
      { error: "Failed to update district in plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/territory-plans/[id]/districts/[leaid] - Remove a district from a plan
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; leaid: string }> }
) {
  try {
    const { id: planId, leaid } = await params;

    // Check if the relationship exists
    const existing = await prisma.territoryPlanDistrict.findUnique({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "District not found in this plan" },
        { status: 404 }
      );
    }

    await prisma.territoryPlanDistrict.delete({
      where: {
        planId_districtLeaid: {
          planId,
          districtLeaid: leaid,
        },
      },
    });

    // Sync auto-tags after removal (may affect Prospect tag)
    await syncAutoTagsForDistrict(leaid);

    await syncPlanRollups(planId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing district from plan:", error);
    return NextResponse.json(
      { error: "Failed to remove district from plan" },
      { status: 500 }
    );
  }
}
