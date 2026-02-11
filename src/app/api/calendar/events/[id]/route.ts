// POST /api/calendar/events/[id] — Confirm a calendar event (creates an Activity)
// PATCH /api/calendar/events/[id] — Dismiss a calendar event
//
// Confirm accepts optional overrides (activity type, title, plan/district/contact associations)
// so the rep can tweak suggestions before confirming. If no overrides, uses the smart suggestions.

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { confirmCalendarEvent, dismissCalendarEvent } from "@/lib/calendar-sync";

export const dynamic = "force-dynamic";

// POST — Confirm event → create Activity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Optional overrides — rep can adjust suggestions before confirming
    const overrides = {
      activityType: body.activityType || undefined,
      title: body.title || undefined,
      planIds: body.planIds || undefined,
      districtLeaids: body.districtLeaids || undefined,
      contactIds: body.contactIds || undefined,
      notes: body.notes || undefined,
    };

    const result = await confirmCalendarEvent(user.id, id, overrides);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm event";
    console.error("Calendar event confirm error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH — Dismiss event (hide from inbox)
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await dismissCalendarEvent(user.id, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to dismiss event";
    console.error("Calendar event dismiss error:", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
