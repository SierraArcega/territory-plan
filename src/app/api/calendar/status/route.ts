// GET /api/calendar/status — Returns the current calendar connection status
// Used by the UI to show "Connected as jane@gmail.com" or "Connect Calendar" CTA

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { ALL_ACTIVITY_TYPES } from "@/features/activities/types";

const VALID_SYNC_DIRECTIONS = ["one_way", "two_way"] as const;
const VALID_REMINDER_MINUTES = [0, 5, 10, 15, 30, 60, 1440] as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      select: {
        id: true,
        accountEmail: true,
        metadata: true,
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
        syncDirection: true,
        syncedActivityTypes: true,
        reminderMinutes: true,
        secondReminderMinutes: true,
        createdAt: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false, connection: null });
    }

    const metadata = (integration.metadata as Record<string, unknown>) || {};

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
        syncDirection: connection.syncDirection,
        syncedActivityTypes: connection.syncedActivityTypes,
        reminderMinutes: connection.reminderMinutes,
        secondReminderMinutes: connection.secondReminderMinutes,
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
    const { syncEnabled, companyDomain, syncDirection, syncedActivityTypes, reminderMinutes, secondReminderMinutes } = body;

    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof syncEnabled === "boolean") updateData.syncEnabled = syncEnabled;
    if (typeof companyDomain === "string") {
      // Merge companyDomain into existing metadata
      const existingMetadata = (integration.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...existingMetadata, companyDomain };
    }

    // Sync direction validation
    if (syncDirection !== undefined) {
      if (!VALID_SYNC_DIRECTIONS.includes(syncDirection)) {
        return NextResponse.json(
          { error: "syncDirection must be 'one_way' or 'two_way'" },
          { status: 400 }
        );
      }
      updateData.syncDirection = syncDirection;
    }

    // Synced activity types validation
    if (syncedActivityTypes !== undefined) {
      if (!Array.isArray(syncedActivityTypes) || !syncedActivityTypes.every((t: unknown) => typeof t === "string" && ALL_ACTIVITY_TYPES.includes(t as never))) {
        return NextResponse.json(
          { error: "syncedActivityTypes must be an array of valid activity types" },
          { status: 400 }
        );
      }
      updateData.syncedActivityTypes = syncedActivityTypes;
    }

    // Reminder minutes validation
    if (reminderMinutes !== undefined) {
      if (!VALID_REMINDER_MINUTES.includes(reminderMinutes)) {
        return NextResponse.json(
          { error: "reminderMinutes must be one of: 0, 5, 10, 15, 30, 60, 1440" },
          { status: 400 }
        );
      }
      updateData.reminderMinutes = reminderMinutes;
    }

    // Second reminder validation
    if (secondReminderMinutes !== undefined) {
      if (secondReminderMinutes !== null && (secondReminderMinutes === 0 || !VALID_REMINDER_MINUTES.includes(secondReminderMinutes))) {
        return NextResponse.json(
          { error: "secondReminderMinutes must be null or one of: 5, 10, 15, 30, 60, 1440 (0 is not allowed)" },
          { status: 400 }
        );
      }
      if (secondReminderMinutes !== null && secondReminderMinutes === (updateData.reminderMinutes ?? connection.reminderMinutes)) {
        return NextResponse.json(
          { error: "secondReminderMinutes must differ from reminderMinutes" },
          { status: 400 }
        );
      }
      updateData.secondReminderMinutes = secondReminderMinutes;
    }

    const updated = await prisma.calendarConnection.update({
      where: { userId: user.id },
      data: updateData,
      select: {
        id: true,
        accountEmail: true,
        metadata: true,
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
        syncDirection: true,
        syncedActivityTypes: true,
        reminderMinutes: true,
        secondReminderMinutes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      connection: {
        ...updated,
        lastSyncAt: updated.lastSyncAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Calendar status update error:", error);
    return NextResponse.json(
      { error: "Failed to update calendar settings" },
      { status: 500 }
    );
  }
}
