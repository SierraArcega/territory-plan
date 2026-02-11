// POST /api/calendar/disconnect — Removes the Google Calendar connection
// Deletes the stored tokens and all pending calendar events
// Does NOT delete activities that were already created from calendar events

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the connection to delete
    const connection = await prisma.calendarConnection.findUnique({
      where: { userId: user.id },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    // Delete the connection (cascades to CalendarEvent records via onDelete: Cascade)
    await prisma.calendarConnection.delete({
      where: { userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}
