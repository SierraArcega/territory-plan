import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/features/integrations/lib/slack-oauth";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/?integrationError=access_denied&service=slack`);
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/?integrationError=no_code&service=slack`);
  }

  try {
    const user = await getUser();
    if (!user) return NextResponse.redirect(`${origin}/login`);

    // Verify CSRF state
    if (state) {
      try {
        const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
        if (stateData.userId !== user.id) {
          return NextResponse.redirect(`${origin}/?integrationError=state_mismatch&service=slack`);
        }
      } catch {
        console.warn("Slack callback: could not parse state token");
      }
    }

    const redirectUri = `${origin}/api/integrations/slack/callback`;
    const tokens = await exchangeSlackCode(code, redirectUri);

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "slack" } },
      update: {
        accountEmail: tokens.authedUserEmail || null,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: null,
        tokenExpiresAt: null,
        scopes: ["channels:read", "channels:history", "chat:write", "users:read", "users:read.email"],
        metadata: {
          teamId: tokens.teamId,
          teamName: tokens.teamName,
          botUserId: tokens.botUserId,
        },
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        service: "slack",
        accountEmail: tokens.authedUserEmail || null,
        accessToken: encrypt(tokens.accessToken),
        refreshToken: null,
        tokenExpiresAt: null,
        scopes: ["channels:read", "channels:history", "chat:write", "users:read", "users:read.email"],
        metadata: {
          teamId: tokens.teamId,
          teamName: tokens.teamName,
          botUserId: tokens.botUserId,
        },
        status: "connected",
        syncEnabled: true,
      },
    });

    return NextResponse.redirect(`${origin}/?tab=profile&slackConnected=true`);
  } catch (err) {
    console.error("Slack callback error:", err);
    return NextResponse.redirect(`${origin}/?integrationError=token_exchange_failed&service=slack`);
  }
}
