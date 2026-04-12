// GET /api/calendar/status — Returns the current calendar connection status
// Used by the UI to show "Connected as jane@gmail.com" or "Connect Calendar" CTA
//
// All calendar settings (companyDomain, syncDirection, syncedActivityTypes,
// reminderMinutes, secondReminderMinutes, backfillStartDate, backfillCompletedAt,
// backfillWindowDays) are stored in user_integrations.metadata as JSON.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { ALL_ACTIVITY_TYPES } from "@/features/activities/types";

const VALID_SYNC_DIRECTIONS = ["one_way", "two_way"] as const;
const VALID_REMINDER_MINUTES = [0, 5, 10, 15, 30, 60, 1440] as const;

type CalendarMetadata = {
  companyDomain?: string;
  syncDirection?: string;
  syncedActivityTypes?: string[];
  reminderMinutes?: number;
  secondReminderMinutes?: number | null;
  backfillStartDate?: string | null;
  backfillCompletedAt?: string | null;
  backfillWindowDays?: number | null;
};

function getCalendarMetadata(integration: { metadata: unknown }): CalendarMetadata {
  return (integration.metadata ?? {}) as CalendarMetadata;
}

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
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
        createdAt: true,
        metadata: true,
      },
    });

    if (!integration) {
      return NextResponse.json({ connected: false, connection: null });
    }

    const meta = getCalendarMetadata(integration);

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
        id: integration.id,
        googleAccountEmail: integration.accountEmail ?? "",
        companyDomain: meta.companyDomain ?? "",
        syncEnabled: integration.syncEnabled,
        lastSyncAt: integration.lastSyncAt?.toISOString() || null,
        status: integration.status,
        syncDirection: meta.syncDirection ?? "two_way",
        syncedActivityTypes: meta.syncedActivityTypes ?? [],
        reminderMinutes: meta.reminderMinutes ?? 15,
        secondReminderMinutes: meta.secondReminderMinutes ?? null,
        createdAt: integration.createdAt.toISOString(),
        backfillStartDate: meta.backfillStartDate ?? null,
        backfillCompletedAt: meta.backfillCompletedAt ?? null,
        backfillWindowDays: meta.backfillWindowDays ?? null,
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

    const existing = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      select: { id: true, metadata: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    const existingMeta = getCalendarMetadata(existing);
    const updatedMeta: CalendarMetadata = { ...existingMeta };

    const integrationUpdate: Record<string, unknown> = {};
    if (typeof syncEnabled === "boolean") integrationUpdate.syncEnabled = syncEnabled;
    if (typeof companyDomain === "string") updatedMeta.companyDomain = companyDomain;

    // Sync direction validation
    if (syncDirection !== undefined) {
      if (!VALID_SYNC_DIRECTIONS.includes(syncDirection)) {
        return NextResponse.json(
          { error: "syncDirection must be 'one_way' or 'two_way'" },
          { status: 400 }
        );
      }
      updatedMeta.syncDirection = syncDirection;
    }

    // Synced activity types validation
    if (syncedActivityTypes !== undefined) {
      if (!Array.isArray(syncedActivityTypes) || !syncedActivityTypes.every((t: unknown) => typeof t === "string" && ALL_ACTIVITY_TYPES.includes(t as never))) {
        return NextResponse.json(
          { error: "syncedActivityTypes must be an array of valid activity types" },
          { status: 400 }
        );
      }
      updatedMeta.syncedActivityTypes = syncedActivityTypes;
    }

    // Reminder minutes validation
    if (reminderMinutes !== undefined) {
      if (!VALID_REMINDER_MINUTES.includes(reminderMinutes)) {
        return NextResponse.json(
          { error: "reminderMinutes must be one of: 0, 5, 10, 15, 30, 60, 1440" },
          { status: 400 }
        );
      }
      updatedMeta.reminderMinutes = reminderMinutes;
    }

    // Second reminder validation
    if (secondReminderMinutes !== undefined) {
      if (secondReminderMinutes !== null && (secondReminderMinutes === 0 || !VALID_REMINDER_MINUTES.includes(secondReminderMinutes))) {
        return NextResponse.json(
          { error: "secondReminderMinutes must be null or one of: 5, 10, 15, 30, 60, 1440 (0 is not allowed)" },
          { status: 400 }
        );
      }
      const effectiveReminder = updatedMeta.reminderMinutes ?? existingMeta.reminderMinutes ?? 15;
      if (secondReminderMinutes !== null && secondReminderMinutes === effectiveReminder) {
        return NextResponse.json(
          { error: "secondReminderMinutes must differ from reminderMinutes" },
          { status: 400 }
        );
      }
      updatedMeta.secondReminderMinutes = secondReminderMinutes;
    }

    integrationUpdate.metadata = updatedMeta;

    const updated = await prisma.userIntegration.update({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      data: integrationUpdate,
      select: {
        id: true,
        accountEmail: true,
        syncEnabled: true,
        lastSyncAt: true,
        status: true,
        createdAt: true,
        metadata: true,
      },
    });

    const updatedFinalMeta = getCalendarMetadata(updated);

    return NextResponse.json({
      connection: {
        id: updated.id,
        googleAccountEmail: updated.accountEmail ?? "",
        companyDomain: updatedFinalMeta.companyDomain ?? "",
        syncEnabled: updated.syncEnabled,
        lastSyncAt: updated.lastSyncAt?.toISOString() || null,
        status: updated.status,
        syncDirection: updatedFinalMeta.syncDirection ?? "two_way",
        syncedActivityTypes: updatedFinalMeta.syncedActivityTypes ?? [],
        reminderMinutes: updatedFinalMeta.reminderMinutes ?? 15,
        secondReminderMinutes: updatedFinalMeta.secondReminderMinutes ?? null,
        createdAt: updated.createdAt.toISOString(),
        backfillStartDate: updatedFinalMeta.backfillStartDate ?? null,
        backfillCompletedAt: updatedFinalMeta.backfillCompletedAt ?? null,
        backfillWindowDays: updatedFinalMeta.backfillWindowDays ?? null,
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
