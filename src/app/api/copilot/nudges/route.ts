import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { buildCopilotNudges } from "@/features/copilot/lib/nudges-service";

export const dynamic = "force-dynamic";

// GET /api/copilot/nudges — proactive "Worth your attention" items for the rep.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const nudges = await buildCopilotNudges(user.id, prisma, new Date());
    return NextResponse.json({ nudges });
  } catch (error) {
    console.error("[copilot/nudges] failed", error);
    return NextResponse.json({ nudges: [] });
  }
}
