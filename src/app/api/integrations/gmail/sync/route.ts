// POST /api/integrations/gmail/sync — Triggers Gmail sync for the current user
// Pulls emails from Gmail, matches senders to contacts, and creates Activity records
// Returns: { messagesProcessed, newMessages, updatedMessages, contactMatches, errors }

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { syncGmailMessages } from "@/features/integrations/lib/gmail-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await syncGmailMessages(user.id);

    // If there were fatal errors (no connection, token failure), return 400
    if (result.errors.length > 0 && result.messagesProcessed === 0) {
      return NextResponse.json(
        { error: result.errors[0], details: result },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Gmail sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync Gmail" },
      { status: 500 }
    );
  }
}
