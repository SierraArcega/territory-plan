// GET /api/calendar/connect — Redirects the rep to Google's OAuth consent screen
// The rep clicks "Connect Google Calendar" → hits this endpoint → gets sent to Google
// After approving, Google sends them back to /api/calendar/callback

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/google-calendar";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build the redirect URI from the current request origin
    // This works in both local dev (localhost:3000) and production (territory-plan.vercel.app)
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/calendar/callback`;

    // Generate a random state token for CSRF protection
    // We include the user ID so the callback can verify the right user is completing the flow
    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        nonce: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64url");

    const authUrl = getAuthUrl(redirectUri, state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Calendar connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate calendar connection" },
      { status: 500 }
    );
  }
}
