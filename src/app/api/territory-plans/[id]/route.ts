import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans/[id] - Get a single plan with its districts (user-scoped)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();

    const plan = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
        districts: {
          include: {
            district: {
              select: {
                name: true,
                stateAbbrev: true,
                enrollment: true,
                districtTags: {
                  select: {
                    tag: { select: { id: true, name: true, color: true } },
                  },
                  take: 5, // Limit tags per district
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
      owner: plan.owner,
      color: plan.color,
      status: plan.status,
      fiscalYear: plan.fiscalYear,
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      userId: plan.userId,
      ownerUser: plan.user
        ? {
            id: plan.user.id,
            fullName: plan.user.fullName,
            email: plan.user.email,
            avatarUrl: plan.user.avatarUrl,
          }
        : null,
      districts: plan.districts.map((pd) => ({
        leaid: pd.districtLeaid,
        addedAt: pd.addedAt.toISOString(),
        name: pd.district.name,
        stateAbbrev: pd.district.stateAbbrev,
        enrollment: pd.district.enrollment,
        revenueTarget: pd.revenueTarget ? Number(pd.revenueTarget) : null,
        pipelineTarget: pd.pipelineTarget ? Number(pd.pipelineTarget) : null,
        notes: pd.notes,
        targetServices: pd.targetServices.map((ts) => ({
          id: ts.service.id,
          name: ts.service.name,
          slug: ts.service.slug,
          color: ts.service.color,
        })),
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
    const { name, description, owner, color, status, fiscalYear, startDate, endDate } = body;

    // Check if plan exists
    const existing = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.userId !== user?.id) {
      return NextResponse.json(
        {
          error: `This plan belongs to ${existing.user?.fullName || "another user"}. You can only edit your own plans.`,
        },
        { status: 403 }
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
    const validStatuses = ["draft", "active", "archived"];
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
    if (owner !== undefined) updateData.owner = owner?.trim() || null;
    if (color !== undefined) updateData.color = color;
    if (status !== undefined) updateData.status = status;
    if (fiscalYear !== undefined) updateData.fiscalYear = fiscalYear;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const plan = await prisma.territoryPlan.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { districts: true },
        },
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      owner: plan.owner,
      color: plan.color,
      status: plan.status,
      fiscalYear: plan.fiscalYear,
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      districtCount: plan._count.districts,
      userId: plan.userId,
      ownerUser: plan.user
        ? {
            id: plan.user.id,
            fullName: plan.user.fullName,
            email: plan.user.email,
            avatarUrl: plan.user.avatarUrl,
          }
        : null,
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

    // Check if plan exists
    const existing = await prisma.territoryPlan.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Territory plan not found" },
        { status: 404 }
      );
    }

    // Check ownership
    if (existing.userId !== user?.id) {
      return NextResponse.json(
        {
          error: `This plan belongs to ${existing.user?.fullName || "another user"}. You can only edit your own plans.`,
        },
        { status: 403 }
      );
    }

    // Delete will cascade to TerritoryPlanDistrict due to onDelete: Cascade
    await prisma.territoryPlan.delete({
      where: { id },
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
