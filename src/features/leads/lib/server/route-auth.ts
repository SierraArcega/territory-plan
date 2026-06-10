import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isAdmin } from "@/lib/supabase/server";

export type LeadAuthResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * Owner-or-admin guard shared by every /api/leads/[id]/* mutation route
 * (PATCH/DELETE, engagement, opportunity). Mirrors the activities [id]
 * routes: leads with no assigned BDR are treated as anyone's
 * (legacy/unassigned rows).
 */
export async function authorizeLead(leadId: string, userId: string): Promise<LeadAuthResult> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, assignedBdrId: true },
  });
  if (!lead) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Lead not found" }, { status: 404 }),
    };
  }
  if (lead.assignedBdrId && lead.assignedBdrId !== userId && !(await isAdmin(userId))) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authorized to edit this lead" },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}
