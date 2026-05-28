import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { loadRecentConversations } from "@/features/copilot/lib/recent-conversations";

export const dynamic = "force-dynamic";

// GET /api/copilot/conversations — recent threads for the home state's "Recent".
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversations = await loadRecentConversations(prisma, user.id, 5);
  return NextResponse.json({ conversations });
}
