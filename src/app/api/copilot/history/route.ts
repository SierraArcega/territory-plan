import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { loadCopilotHistory } from "@/features/copilot/lib/conversation";

export const dynamic = "force-dynamic";

/**
 * GET /api/copilot/history?conversationId=…
 *
 * Read-only replay of a prior copilot conversation for the panel. Scoped to the
 * authenticated user, so a conversationId from another user returns nothing.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const conversationId =
    new URL(request.url).searchParams.get("conversationId") ?? undefined;
  const messages = await loadCopilotHistory(conversationId, user.id);
  return NextResponse.json({ conversationId: conversationId ?? null, messages });
}
