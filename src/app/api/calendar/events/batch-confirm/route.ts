// POST /api/calendar/events/batch-confirm — Confirms all high-confidence pending events
// Creates Activities for each one using the smart suggestions
// Returns the count of confirmed events and their new activity IDs

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { batchConfirmHighConfidence } from "@/features/calendar/lib/sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await batchConfirmHighConfidence(user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Batch confirm error:", error);
    return NextResponse.json(
      { error: "Failed to batch confirm events" },
      { status: 500 }
    );
  }
}
