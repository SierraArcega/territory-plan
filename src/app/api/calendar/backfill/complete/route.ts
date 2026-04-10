// POST /api/calendar/backfill/complete — Marks the first-connect backfill wizard finished
// Sets CalendarConnection.backfillCompletedAt to now so HomeView stops
// reopening the setup modal on subsequent mounts.

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

    const existing = await prisma.calendarConnection.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not connected" }, { status: 404 });
    }

    await prisma.calendarConnection.update({
      where: { userId: user.id },
      data: { backfillCompletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar backfill complete error:", error);
    return NextResponse.json(
      { error: "Failed to complete calendar backfill" },
      { status: 500 }
    );
  }
}
