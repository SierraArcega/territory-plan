import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { hideBodySchema } from "@/lib/saved-views/schema";

export const dynamic = "force-dynamic";

/**
 * POST /api/territory-plans/[id]/hide
 *
 * Per-user hide toggle for a TerritoryPlan. Idempotent — { hidden: true }
 * upserts a row in territory_plan_hidden; { hidden: false } removes it.
 *
 * Distinct from PATCH /api/territory-plans/[id] with status='archived',
 * which is a team-wide state. Hiding is purely a sidebar UX affordance —
 * the plan remains visible to everyone else.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id } = await params;

  // Confirm the plan exists. Without this, an attacker could probe valid
  // plan IDs by toggling hidden flags on non-existent rows.
  const plan = await prisma.territoryPlan.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = hideBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body — expected { hidden: boolean }" },
      { status: 400 },
    );
  }

  if (parsed.data.hidden) {
    await prisma.territoryPlanHidden.upsert({
      where: { planId_userId: { planId: id, userId: user.id } },
      create: { planId: id, userId: user.id },
      update: {},
    });
  } else {
    await prisma.territoryPlanHidden.deleteMany({
      where: { planId: id, userId: user.id },
    });
  }

  return NextResponse.json({ ok: true, hidden: parsed.data.hidden });
}
