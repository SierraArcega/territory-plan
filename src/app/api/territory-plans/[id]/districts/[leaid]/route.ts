import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncAutoTagsForDistrict } from "@/lib/autoTags";

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
      revenueTarget: planDistrict.revenueTarget ? Number(planDistrict.revenueTarget) : null,
      pipelineTarget: planDistrict.pipelineTarget ? Number(planDistrict.pipelineTarget) : null,
      notes: planDistrict.notes,
      targetServices: planDistrict.targetServices.map((ts) => ({
        id: ts.service.id,
        name: ts.service.name,
        slug: ts.service.slug,
        color: ts.service.color,
      })),
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
    const { revenueTarget, pipelineTarget, notes, serviceIds } = body;

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
    if (revenueTarget !== undefined) updateData.revenueTarget = revenueTarget;
    if (pipelineTarget !== undefined) updateData.pipelineTarget = pipelineTarget;
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
    if (serviceIds !== undefined && Array.isArray(serviceIds)) {
      // Delete existing service assignments
      await prisma.territoryPlanDistrictService.deleteMany({
        where: { planId, districtLeaid: leaid },
      });

      // Create new service assignments
      if (serviceIds.length > 0) {
        await prisma.territoryPlanDistrictService.createMany({
          data: serviceIds.map((serviceId: number) => ({
            planId,
            districtLeaid: leaid,
            serviceId,
          })),
        });
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

      return NextResponse.json({
        planId,
        leaid: updatedPlanDistrict.districtLeaid,
        addedAt: updatedPlanDistrict.addedAt.toISOString(),
        name: updatedPlanDistrict.district.name,
        stateAbbrev: updatedPlanDistrict.district.stateAbbrev,
        enrollment: updatedPlanDistrict.district.enrollment,
        revenueTarget: updatedPlanDistrict.revenueTarget ? Number(updatedPlanDistrict.revenueTarget) : null,
        pipelineTarget: updatedPlanDistrict.pipelineTarget ? Number(updatedPlanDistrict.pipelineTarget) : null,
        notes: updatedPlanDistrict.notes,
        targetServices: refreshed?.targetServices.map((ts) => ({
          id: ts.service.id,
          name: ts.service.name,
          slug: ts.service.slug,
          color: ts.service.color,
        })) ?? [],
      });
    }

    return NextResponse.json({
      planId,
      leaid: updatedPlanDistrict.districtLeaid,
      addedAt: updatedPlanDistrict.addedAt.toISOString(),
      name: updatedPlanDistrict.district.name,
      stateAbbrev: updatedPlanDistrict.district.stateAbbrev,
      enrollment: updatedPlanDistrict.district.enrollment,
      revenueTarget: updatedPlanDistrict.revenueTarget ? Number(updatedPlanDistrict.revenueTarget) : null,
      pipelineTarget: updatedPlanDistrict.pipelineTarget ? Number(updatedPlanDistrict.pipelineTarget) : null,
      notes: updatedPlanDistrict.notes,
      targetServices: updatedPlanDistrict.targetServices.map((ts) => ({
        id: ts.service.id,
        name: ts.service.name,
        slug: ts.service.slug,
        color: ts.service.color,
      })),
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing district from plan:", error);
    return NextResponse.json(
      { error: "Failed to remove district from plan" },
      { status: 500 }
    );
  }
}
