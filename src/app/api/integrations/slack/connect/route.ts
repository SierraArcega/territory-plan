import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getSlackAuthUrl } from "@/features/integrations/lib/slack-oauth";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/integrations/slack/callback`;

    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        nonce: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64url");

    return NextResponse.redirect(getSlackAuthUrl(redirectUri, state));
  } catch (error) {
    console.error("Slack connect error:", error);
    return NextResponse.json({ error: "Failed to initiate Slack connection" }, { status: 500 });
  }
}
