import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import { authorizeLead } from "@/features/leads/lib/server/route-auth";
import {
  logEngagement,
  serializeLead,
  type LogEngagementInput,
} from "@/features/leads/lib/server/lead-service";

export const dynamic = "force-dynamic";

// POST /api/leads/[id]/engagement — log an engagement outcome (Outcome modal):
// a REAL activities row + contact/district/school junctions (never owned by
// the lead), a score increment, and an optional validated status transition —
// one transaction via the lead service. Illegal transitions return 422; a
// disqualifying transition without a reason returns 400.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: LogEngagementInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const auth = await authorizeLead(id, user.id);
    if (!auth.ok) return auth.response;

    const { activity, lead } = await logEngagement(id, body, user.id);
    return NextResponse.json({ activityId: activity.id, lead: serializeLead(lead) });
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error logging lead engagement:", error);
    return NextResponse.json({ error: "Failed to log engagement" }, { status: 500 });
  }
}
