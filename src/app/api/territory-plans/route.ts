import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans - List all plans with district counts (scoped to user)
export async function GET() {
  try {
    const user = await getUser();

    // Build where clause - if user is authenticated, filter by their userId
    // If not authenticated (shouldn't happen with middleware), return empty
    const whereClause = user ? { userId: user.id } : { userId: "none" };

    const plans = await prisma.territoryPlan.findMany({
      where: whereClause,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { districts: true },
        },
        districts: {
          select: {
            district: {
              select: { enrollment: true, stateAbbrev: true },
            },
          },
        },
        taskLinks: {
          select: {
            task: {
              select: { status: true },
            },
          },
        },
        ownerUser: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
        states: {
          select: {
            state: { select: { fips: true, abbrev: true, name: true } },
          },
        },
        collaborators: {
          select: {
            user: { select: { id: true, fullName: true, avatarUrl: true } },
          },
        },
      },
    });

    const result = plans.map((plan) => {
      const totalEnrollment = plan.districts.reduce(
        (sum, d) => sum + (d.district.enrollment ?? 0),
        0
      );
      const taskCount = plan.taskLinks.length;
      const completedTaskCount = plan.taskLinks.filter(
        (tl) => tl.task.status === "done"
      ).length;

      return {
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
        totalEnrollment,
        stateCount: plan.states.length,
        states: plan.states.map((ps) => ({
          fips: ps.state.fips,
          abbrev: ps.state.abbrev,
          name: ps.state.name,
        })),
        collaborators: plan.collaborators.map((pc) => ({
          id: pc.user.id,
          fullName: pc.user.fullName,
          avatarUrl: pc.user.avatarUrl,
        })),
        taskCount,
        completedTaskCount,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching territory plans:", error);
    return NextResponse.json(
      { error: "Failed to fetch territory plans" },
      { status: 500 }
    );
  }
}

// POST /api/territory-plans - Create a new plan (associated with current user)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, description, ownerId, color, status, fiscalYear, startDate, endDate, stateFips, collaboratorIds } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // Validate fiscal year is required and valid
    if (!fiscalYear || typeof fiscalYear !== "number" || fiscalYear < 2024 || fiscalYear > 2030) {
      return NextResponse.json(
        { error: "fiscalYear is required and must be between 2024 and 2030" },
        { status: 400 }
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

    const plan = await prisma.territoryPlan.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId: ownerId || null,
        color: color || "#403770",
        status: status || "planning",
        fiscalYear,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId: user.id,
        ...(Array.isArray(stateFips) && stateFips.length > 0 && {
          states: {
            createMany: {
              data: stateFips.map((fips: string) => ({ stateFips: fips })),
              skipDuplicates: true,
            },
          },
        }),
        ...(Array.isArray(collaboratorIds) && collaboratorIds.length > 0 && {
          collaborators: {
            createMany: {
              data: collaboratorIds.map((uid: string) => ({ userId: uid })),
              skipDuplicates: true,
            },
          },
        }),
      },
      include: {
        ownerUser: { select: { id: true, fullName: true, avatarUrl: true } },
        states: { select: { state: { select: { fips: true, abbrev: true, name: true } } } },
        collaborators: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      },
    });

    return NextResponse.json(
      {
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
        districtCount: 0,
        totalEnrollment: 0,
        stateCount: plan.states.length,
        states: plan.states.map((ps) => ({ fips: ps.state.fips, abbrev: ps.state.abbrev, name: ps.state.name })),
        collaborators: plan.collaborators.map((pc) => ({ id: pc.user.id, fullName: pc.user.fullName, avatarUrl: pc.user.avatarUrl })),
        taskCount: 0,
        completedTaskCount: 0,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating territory plan:", error);
    return NextResponse.json(
      { error: "Failed to create territory plan" },
      { status: 500 }
    );
  }
}
