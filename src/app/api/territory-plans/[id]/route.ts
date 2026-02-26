import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id] - Get a single plan with its districts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Team shares visibility across plans (matches list endpoint)
    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        districts: {
          include: {
            district: {
              select: {
                name: true,
                stateAbbrev: true,
                enrollment: true,
                owner: true,
                districtTags: {
                  select: {
                    tag: { select: { id: true, name: true, color: true } },
                  },
                },
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
          orderBy: { addedAt: "desc" },
        },
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
        collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      owner: plan.ownerUser
        ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
        : null,
      states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
      collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
      color: plan.color,
      status: plan.status,
      fiscalYear: plan.fiscalYear,
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      districts: plan.districts.map((pd) => ({
        leaid: pd.districtLeaid,
        addedAt: pd.addedAt.toISOString(),
        name: pd.district.name,
        stateAbbrev: pd.district.stateAbbrev,
        enrollment: pd.district.enrollment,
        owner: pd.district.owner ?? null,
        renewalTarget: pd.renewalTarget ? Number(pd.renewalTarget) : null,
        winbackTarget: pd.winbackTarget ? Number(pd.winbackTarget) : null,
        expansionTarget: pd.expansionTarget ? Number(pd.expansionTarget) : null,
        newBusinessTarget: pd.newBusinessTarget ? Number(pd.newBusinessTarget) : null,
        notes: pd.notes,
        returnServices: pd.targetServices
          .filter((ts) => ts.category === "return_services")
          .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
        newServices: pd.targetServices
          .filter((ts) => ts.category === "new_services")
          .map((ts) => ({ id: ts.service.id, name: ts.service.name, slug: ts.service.slug, color: ts.service.color })),
        tags: pd.district.districtTags.map((dt) => ({
          id: dt.tag.id,
          name: dt.tag.name,
          color: dt.tag.color,
        })),
      })),
    });
  } catch (error) {
    console.error("Error fetching territory plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch territory plan" },
      { status: 500 }
    );
  }
}

// PUT /api/territory-plans/[id] - Update plan metadata (user-scoped)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    const body = await request.json();
    const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;

    // Check if plan exists and belongs to user
    const existing = await prisma.territoryPlan.findUnique({
      where: { id, userId: user?.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return NextResponse.json(
        { error: "color must be a valid hex color (e.g., #403770)" },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ["planning", "working", "stale", "archived"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate fiscal year if provided
    if (fiscalYear !== undefined && (typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030)) {
      return NextResponse.json(
        { error: "fiscalYear must be between 2024 and 2030" },
        { status: 400 }
      );
    }

    // Build update data - only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (ownerId !== undefined) updateData.ownerId = ownerId || null;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;
    if (fiscalYear !== undefined) updateData.fiscalYear = fiscalYear;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const plan = await prisma.$transaction(async (tx) => {
      // Update scalar fields
      await tx.territoryPlan.update({
        where: { id },
        data: updateData,
      });

      // Replace states if provided
      if (stateFips !== undefined) {
        await tx.territoryPlanState.deleteMany({ where: { planId: id } });
        if (Array.isArray(stateFips) && stateFips.length > 0) {
          await tx.territoryPlanState.createMany({
            data: stateFips.map((fips: string) => ({ planId: id, stateFips: fips })),
            skipDuplicates: true,
          });
        }
      }

      // Replace collaborators if provided
      if (collaboratorIds !== undefined) {
        await tx.territoryPlanCollaborator.deleteMany({ where: { planId: id } });
        if (Array.isArray(collaboratorIds) && collaboratorIds.length > 0) {
          await tx.territoryPlanCollaborator.createMany({
            data: collaboratorIds.map((uid: string) => ({ planId: id, userId: uid })),
            skipDuplicates: true,
          });
        }
      }

      // Re-fetch with relations
      return tx.territoryPlan.findUniqueOrThrow({
        where: { id },
        include: {
          _count: { select: { districts: true } },
          ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
          states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
          collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        },
      });
    });

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      owner: plan.ownerUser
        ? { id: plan.ownerUser.id, fullName: plan.ownerUser.fullName, avatarUrl: plan.ownerUser.avatarUrl }
        : null,
      color: plan.color,
      status: plan.status,
      fiscalYear: plan.fiscalYear,
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      districtCount: plan._count.districts,
      states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
      collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
    });
  } catch (error) {
    console.error("Error updating territory plan:", error);
    return NextResponse.json(
      { error: "Failed to update territory plan" },
      { status: 500 }
    );
  }
}

// DELETE /api/territory-plans/[id] - Delete a plan (user-scoped)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    // Check if plan exists and belongs to user
    const existing = await prisma.territoryPlan.findUnique({
      where: { id, userId: user?.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Delete will cascade to TerritoryPlanDistrict due to onDelete: Cascade
    await prisma.territoryPlan.delete({
      where: { id, userId: user?.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting territory plan:", error);
    return NextResponse.json(
      { error: "Failed to delete territory plan" },
      { status: 500 }
    );
  }
}
