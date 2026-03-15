import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeGmailCode } from "@/features/integrations/lib/google-gmail";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?integrationError=access_denied&service=gmail`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?integrationError=no_code&service=gmail`);
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.redirect(`${origin}/login`);

    // Verify CSRF state
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
        if (stateData.userId !== user.id) {
          return NextResponse.redirect(`${origin}/?integrationError=state_mismatch&service=gmail`);
        }
      } catch {
        console.warn("Gmail callback: could not parse state token");
      }
    }

    const redirectUri = `${origin}/api/integrations/gmail/callback`;
    const tokens = await exchangeGmailCode(code, redirectUri);

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "gmail" } },
      update: {
        accountEmail: tokens.email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: ["gmail.readonly", "gmail.send", "userinfo.email"],
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        service: "gmail",
        accountEmail: tokens.email,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: ["gmail.readonly", "gmail.send", "userinfo.email"],
        status: "connected",
        syncEnabled: true,
      },
    });

    return NextResponse.redirect(`${origin}/?tab=profile&gmailConnected=true`);
  } catch (err) {
    console.error("Gmail callback error:", err);
    return NextResponse.redirect(`${origin}/?integrationError=token_exchange_failed&service=gmail`);
  }
}
