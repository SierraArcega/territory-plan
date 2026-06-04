import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { formatActionLogEntry } from "@/features/copilot/lib/action-log";

export const dynamic = "force-dynamic";

/**
 * GET /api/copilot/actions
 *
 * The rep's recent copilot-executed writes (the audit log), newest first,
 * scoped to the authenticated user. Labels are derived server-side and never
 * include raw ids.
 */
export async function GET(): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await prisma.copilotActionLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      objectType: true,
      operation: true,
      status: true,
      beforeJson: true,
      afterJson: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ entries: rows.map(formatActionLogEntry) });
}
