// POST /api/calendar/backfill/complete — Marks the first-connect backfill wizard finished
// Sets backfillCompletedAt in the calendar integration metadata so HomeView
// stops reopening the setup modal on subsequent mounts.

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

    const existing = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      select: { id: true, metadata: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not connected" }, { status: 404 });
    }

    const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    await prisma.userIntegration.update({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      data: {
        metadata: {
          ...existingMetadata,
          backfillCompletedAt: new Date().toISOString(),
        },
      },
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
