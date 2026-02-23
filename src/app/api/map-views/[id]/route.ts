import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/map-views/[id] - Get a single map view including full state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const view = await prisma.mapView.findFirst({
      where: {
        id,
        OR: [{ ownerId: user.id }, { isShared: true }],
      },
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    if (!view) {
      return NextResponse.json(
        { error: "Map view not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error fetching map view:", error);
    return NextResponse.json(
      { error: "Failed to fetch map view" },
      { status: 500 }
    );
  }
}

// PATCH /api/map-views/[id] - Update a map view (owner only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await prisma.mapView.findFirst({
      where: { id, ownerId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Map view not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, description, isShared, state } = body;

    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
      if (name.trim().length > 200) {
        return NextResponse.json(
          { error: "name must be 200 characters or fewer" },
          { status: 400 }
        );
      }
    }

    // Build update data - only include fields that are present
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isShared !== undefined) updateData.isShared = isShared;
    if (state !== undefined) updateData.state = state;

    const view = await prisma.mapView.update({
      where: { id },
      data: updateData,
      include: {
        owner: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(view);
  } catch (error) {
    console.error("Error updating map view:", error);
    return NextResponse.json(
      { error: "Failed to update map view" },
      { status: 500 }
    );
  }
}

// DELETE /api/map-views/[id] - Delete a map view (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Verify ownership
    const existing = await prisma.mapView.findFirst({
      where: { id, ownerId: user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Map view not found" },
        { status: 404 }
      );
    }

    await prisma.mapView.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting map view:", error);
    return NextResponse.json(
      { error: "Failed to delete map view" },
      { status: 500 }
    );
  }
}
