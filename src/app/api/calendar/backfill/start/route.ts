// POST /api/calendar/backfill/start — Kicks off the first-connect backfill pass
// Sets the user-chosen timeMin window on CalendarConnection, runs a single
// sync, and returns the sync result plus the total pending count so the
// wizard can show progress.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { syncCalendarEvents } from "@/features/calendar/lib/sync";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = new Set([7, 30, 60, 90]);

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const days = (body as { days?: unknown })?.days;
    if (typeof days !== "number" || !ALLOWED_DAYS.has(days)) {
      return NextResponse.json(
        { error: "Invalid days — must be 7, 30, 60, or 90" },
        { status: 400 }
      );
    }

    const backfillStartDate = new Date(Date.now() - days * 86_400_000);

    // Ensure the connection exists before we attempt a sync. If the user
    // never completed OAuth (or the row was deleted), bail early with 404 so
    // the UI can prompt them to reconnect.
    const existing = await prisma.calendarConnection.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Not connected" },
        { status: 404 }
      );
    }

    await prisma.calendarConnection.update({
      where: { userId: user.id },
      data: {
        backfillStartDate,
        backfillCompletedAt: null,
        backfillWindowDays: days, // drives forward window on every subsequent sync
      },
    });

    const syncResult = await syncCalendarEvents(user.id);
    const pendingCount = await prisma.calendarEvent.count({
      where: { userId: user.id, status: "pending" },
    });

    return NextResponse.json({ ...syncResult, pendingCount });
  } catch (error) {
    console.error("Calendar backfill start error:", error);
    return NextResponse.json(
      { error: "Failed to start calendar backfill" },
      { status: 500 }
    );
  }
}
