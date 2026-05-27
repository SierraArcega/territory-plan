import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { createMapView } from "@/features/map/lib/map-view-service";
import { isServiceError } from "@/features/shared/lib/service-error";

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

    const view = await createMapView(
      { name, description, isShared, state },
      user.id,
      prisma,
    );

    return NextResponse.json(view, { status: 201 });
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error creating map view:", error);
    return NextResponse.json(
      { error: "Failed to create map view" },
      { status: 500 }
    );
  }
}
