import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getGmailAuthUrl } from "@/features/integrations/lib/google-gmail";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/api/integrations/gmail/callback`;

    const state = Buffer.from(
      JSON.stringify({
        userId: user.id,
        nonce: crypto.randomBytes(16).toString("hex"),
      })
    ).toString("base64url");

    return NextResponse.redirect(getGmailAuthUrl(redirectUri, state));
  } catch (error) {
    console.error("Gmail connect error:", error);
    return NextResponse.json({ error: "Failed to initiate Gmail connection" }, { status: 500 });
  }
}
