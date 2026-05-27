import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/map-views - List views the user can access (own + shared)
export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const views = await prisma.mapView.findMany({
      where: {
        OR: [{ ownerId: user.id }, { isShared: true }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        isShared: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(views);
  } catch (error) {
    console.error("Error fetching map views:", error);
    return NextResponse.json(
      { error: "Failed to fetch map views" },
      { status: 500 }
    );
  }
}

// POST /api/map-views - Create a new map view
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
    const { name, description, isShared, state } = body;

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    if (name.trim().length > 200) {
      return NextResponse.json(
        { error: "name must be 200 characters or fewer" },
        { status: 400 }
      );
    }

    // Validate state
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return NextResponse.json(
        { error: "state is required and must be an object" },
        { status: 400 }
      );
    }

    const view = await prisma.mapView.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        isShared: isShared ?? false,
        state,
        ownerId: user.id,
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    console.error("Error creating map view:", error);
    return NextResponse.json(
      { error: "Failed to create map view" },
      { status: 500 }
    );
  }
}
