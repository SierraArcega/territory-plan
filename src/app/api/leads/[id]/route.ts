import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import { authorizeLead } from "@/features/leads/lib/server/route-auth";
import {
  transitionLead,
  serializeLead,
  LEAD_INCLUDE,
  LEAD_TYPES,
  type LeadWithRelations,
} from "@/features/leads/lib/server/lead-service";

export const dynamic = "force-dynamic";

// PATCH /api/leads/[id] — field edits + lifecycle transitions.
// Transitions are validated server-side by the lead service; an illegal
// transition returns 422.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: {
      status?: string;
      reason?: string | null;
      meetingAt?: string | null;
      leadType?: string | null;
      sequence?: string | null;
      marketingOwner?: string | null;
      assignedBdrId?: string | null;
      schoolNcessch?: string | null;
      score?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const auth = await authorizeLead(id, user.id);
    if (!auth.ok) return auth.response;

    // ---- Field edits (applied before any transition) ----
    const data: Prisma.LeadUncheckedUpdateInput = {};
    if (body.leadType !== undefined) {
      if (body.leadType !== null && !(LEAD_TYPES as readonly string[]).includes(body.leadType)) {
        return NextResponse.json({ error: "invalid_lead_type" }, { status: 400 });
      }
      data.leadType = body.leadType;
    }
    if (body.sequence !== undefined) {
      data.sequence = body.sequence?.trim() || null;
    }
    if (body.marketingOwner !== undefined) {
      data.marketingOwner = body.marketingOwner?.trim() || null;
    }
    if (body.assignedBdrId !== undefined) {
      if (body.assignedBdrId !== null) {
        const bdr = await prisma.userProfile.findUnique({
          where: { id: body.assignedBdrId },
          select: { id: true },
        });
        if (!bdr) {
          return NextResponse.json({ error: "invalid_bdr" }, { status: 400 });
        }
        // Routing an unassigned NEW lead starts the acceptance SLA — reset
        // the clock to now (assignedAt otherwise keeps its creation default).
        const current = await prisma.lead.findUnique({
          where: { id },
          select: { assignedBdrId: true, status: true },
        });
        if (current && current.assignedBdrId === null && current.status === "new") {
          data.assignedAt = new Date();
        }
      }
      data.assignedBdrId = body.assignedBdrId;
    }
    if (body.schoolNcessch !== undefined) {
      if (body.schoolNcessch !== null) {
        const school = await prisma.school.findUnique({
          where: { ncessch: body.schoolNcessch },
          select: { ncessch: true },
        });
        if (!school) {
          return NextResponse.json({ error: "school_not_found" }, { status: 400 });
        }
      }
      data.schoolNcessch = body.schoolNcessch;
    }
    if (body.score !== undefined) {
      if (!Number.isInteger(body.score) || body.score < 0) {
        return NextResponse.json({ error: "invalid_score" }, { status: 400 });
      }
      data.score = body.score;
    }
    const hasTransition = body.status !== undefined;
    // meetingAt rides along with a meeting_scheduled transition (handled by the
    // service); standalone it's a field edit (e.g. rescheduling in-stage).
    if (body.meetingAt !== undefined && !hasTransition) {
      if (body.meetingAt === null) {
        data.meetingAt = null;
      } else {
        const meetingAt = new Date(body.meetingAt);
        if (typeof body.meetingAt !== "string" || Number.isNaN(meetingAt.getTime())) {
          return NextResponse.json({ error: "invalid_meeting_at" }, { status: 400 });
        }
        data.meetingAt = meetingAt;
      }
    }

    const hasFieldEdits = Object.keys(data).length > 0;
    if (!hasFieldEdits && !hasTransition) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    let updated: LeadWithRelations | null = null;
    if (hasFieldEdits) {
      updated = await prisma.lead.update({ where: { id }, data, include: LEAD_INCLUDE });
    }
    if (hasTransition) {
      updated = await transitionLead(
        id,
        { status: body.status, reason: body.reason, meetingAt: body.meetingAt },
        user.id,
      );
    }

    return NextResponse.json(serializeLead(updated!));
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating lead:", error);
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 });
  }
}

// DELETE /api/leads/[id] — removes the lead + its lifecycle events (cascade).
// Engagement activities live on the contact/school/district records and are
// untouched by design.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await authorizeLead(id, user.id);
    if (!auth.ok) return auth.response;

    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting lead:", error);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }
}
