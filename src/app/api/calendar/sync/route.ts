// POST /api/calendar/sync — Triggers a calendar sync for the current user
// Pulls events from Google Calendar, runs smart matching, and stages them
// Returns a summary of what was synced (new/updated/cancelled event counts)

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { syncCalendarEvents } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncCalendarEvents(user.id);

    // If there were fatal errors (no connection, token failure), return 400
    if (result.errors.length > 0 && result.eventsProcessed === 0) {
      return NextResponse.json(
        { error: result.errors[0], details: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Calendar sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync calendar" },
      { status: 500 }
    );
  }
}
