import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/territory-plans - List all plans with district counts (team view)
export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const plans = await prisma.territoryPlan.findMany({
      where: {},
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { districts: true },
        },
        user: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
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
    const { name, description, owner, color, status, fiscalYear, startDate, endDate } = body;

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
        fiscalYear,
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
        fiscalYear: plan.fiscalYear,
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
