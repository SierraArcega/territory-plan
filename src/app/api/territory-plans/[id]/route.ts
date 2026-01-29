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
      where: { id, userId: user?.id },
      include: {
        districts: {
          include: {
            district: {
              include: {
                districtTags: {
                  include: {
                    tag: true,
                  },
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
    const { name, description, owner, color, status, startDate, endDate } = body;

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
    const validStatuses = ["draft", "active", "archived"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(", ")}` },
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
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const plan = await prisma.territoryPlan.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: { districts: true },
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
      startDate: plan.startDate?.toISOString() ?? null,
      endDate: plan.endDate?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      districtCount: plan._count.districts,
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
