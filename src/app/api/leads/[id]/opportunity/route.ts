import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import { authorizeLead } from "@/features/leads/lib/server/route-auth";
import {
  linkOpportunity,
  serializeLead,
  type LinkOpportunityInput,
} from "@/features/leads/lib/server/lead-service";

export const dynamic = "force-dynamic";

// POST /api/leads/[id]/opportunity — link an opportunity to a lead (Link
// opportunity modal): pass `opportunityId` to link an existing OPEN opp
// (closed opps are rejected with 400), or name/amount/closeDate to create a
// fresh Stage 0 ("0 - Meeting Booked") opportunity via the lead service.
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

    let body: LinkOpportunityInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const auth = await authorizeLead(id, user.id);
    if (!auth.ok) return auth.response;

    const lead = await linkOpportunity(id, body, user.id);
    return NextResponse.json(serializeLead(lead));
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error linking opportunity to lead:", error);
    return NextResponse.json({ error: "Failed to link opportunity" }, { status: 500 });
  }
}
