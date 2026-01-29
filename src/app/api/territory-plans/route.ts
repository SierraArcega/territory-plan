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
      },
    });

    const result = plans.map((plan) => ({
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
    }));

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
    const { name, description, owner, color, status, startDate, endDate } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
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
    const validStatuses = ["draft", "active", "archived"];
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
        owner: owner?.trim() || null,
        color: color || "#403770",
        status: status || "active",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        userId: user.id,
      },
    });

    return NextResponse.json(
      {
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
        districtCount: 0,
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
