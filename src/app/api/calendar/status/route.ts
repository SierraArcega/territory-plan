// GET /api/calendar/status — Returns the current calendar connection status
// Used by the UI to show "Connected as jane@gmail.com" or "Connect Calendar" CTA

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const connection = await prisma.calendarConnection.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        googleAccountEmail: true,
        companyDomain: true,
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
        createdAt: true,
      },
    });

    if (!connection) {
      return NextResponse.json({ connected: false, connection: null });
    }

    // Also get the count of pending calendar events for badge display
    const pendingCount = await prisma.calendarEvent.count({
      where: {
        userId: user.id,
        status: "pending",
      },
    });

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        googleAccountEmail: connection.googleAccountEmail,
        companyDomain: connection.companyDomain,
        syncEnabled: connection.syncEnabled,
        lastSyncAt: connection.lastSyncAt?.toISOString() || null,
        status: connection.status,
        createdAt: connection.createdAt.toISOString(),
      },
      pendingCount,
    });
  } catch (error) {
    console.error("Calendar status error:", error);
    return NextResponse.json(
      { error: "Failed to get calendar status" },
      { status: 500 }
    );
  }
}

// PATCH /api/calendar/status — Update calendar connection settings
// Currently supports toggling sync on/off and updating company domain
export async function PATCH(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { syncEnabled, companyDomain } = body;

    const connection = await prisma.calendarConnection.findUnique({
      where: { userId: user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof syncEnabled === "boolean") updateData.syncEnabled = syncEnabled;
    if (typeof companyDomain === "string") updateData.companyDomain = companyDomain;

    const updated = await prisma.calendarConnection.update({
      where: { userId: user.id },
      data: updateData,
      select: {
        id: true,
        googleAccountEmail: true,
        companyDomain: true,
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
      },
    });

    return NextResponse.json({ connection: updated });
  } catch (error) {
    console.error("Calendar status update error:", error);
    return NextResponse.json(
      { error: "Failed to update calendar settings" },
      { status: 500 }
    );
  }
}
