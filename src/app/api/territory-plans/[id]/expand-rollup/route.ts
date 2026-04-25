import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { expandPlanRollups } from "@/features/districts/lib/expandRollups";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/territory-plans/[id]/expand-rollup
 *
 * Idempotent: converts any rollup leaids in the plan to their children and
 * writes a `system_migration` activity log entry per expansion. Returns the
 * expansion result. Intended as the target of the bulk-enrich "Expand to N
 * districts" CTA, but safe to call anytime (it's the same logic T7 runs on
 * plan GET).
 *
 * Body is ignored for compatibility — the caller doesn't need to pass the
 * rollup leaid explicitly; the handler finds any rollups in the plan and
 * expands them all.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const plan = await prisma.territoryPlan.findUnique({ where: { id } });
    if (!plan) {
      return NextResponse.json({ error: "Territory plan not found" }, { status: 404 });
    }

    const result = await expandPlanRollups(id, user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error expanding plan rollup:", error);
    return NextResponse.json({ error: "Failed to expand rollup" }, { status: 500 });
  }
}
