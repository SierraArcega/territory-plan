// POST /api/integrations/slack/sync — Triggers Slack sync for the current user
// Pulls messages from joined Slack channels, matches to districts, and creates Activity records
// Returns: { messagesProcessed, newMessages, updatedMessages, districtMatches, channelsProcessed, errors }

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { syncSlackMessages } from "@/features/integrations/lib/slack-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncSlackMessages(user.id);

    // If there were fatal errors (no connection, token failure), return 400
    if (result.errors.length > 0 && result.messagesProcessed === 0) {
      return NextResponse.json(
        { error: result.errors[0], details: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Slack sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync Slack" },
      { status: 500 }
    );
  }
}
