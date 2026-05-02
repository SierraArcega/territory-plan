// GET /api/calendar/callback — Handles the OAuth redirect from Google
// After the rep approves calendar access, Google redirects here with an auth code
// We exchange the code for tokens and store them in UserIntegration (encrypted)

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/features/calendar/lib/google";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // If the user denied access, redirect back with a message
  if (error) {
    console.warn("[calendar-callback] user denied access:", error);
    return NextResponse.redirect(
      `${origin}/?calendarError=access_denied`
    );
  }

  if (!code) {
    console.warn("[calendar-callback] missing code param");
    return NextResponse.redirect(
      `${origin}/?calendarError=no_code`
    );
  }

  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    // Verify the state token matches the user who started the flow (CSRF protection)
    let returnTo = "";
    if (state) {
      try {
        const stateData = JSON.parse(
          Buffer.from(state, "base64url").toString()
        );
        if (stateData.userId !== user.id) {
          console.warn("[calendar-callback] state/user mismatch");
          return NextResponse.redirect(
            `${origin}/?calendarError=state_mismatch`
          );
        }
        returnTo = stateData.returnTo || "";
      } catch {
        // State parsing failed — proceed anyway since we have auth from Supabase session
        console.warn("Calendar callback: could not parse state token");
      }
    }

    // Exchange the auth code for access + refresh tokens
    const redirectUri = `${origin}/api/calendar/callback`;
    let tokens: Awaited<ReturnType<typeof exchangeCodeForTokens>>;
    try {
      tokens = await exchangeCodeForTokens(code, redirectUri);
    } catch (err) {
      console.error("[calendar-callback] OAuth token exchange failed:", err);
      return NextResponse.redirect(
        `${origin}/?calendarError=token_exchange_failed`
      );
    }

    // Extract the company domain from the user's email
    // This is used to filter out internal attendees when syncing calendar events
    const userEmail = user.email || "";
    const companyDomain = userEmail.split("@")[1] || "";

    // Upsert the calendar integration — one per user per service
    // If the user re-connects, we update the existing integration with new tokens.
    // The encrypt() call here will throw if ENCRYPTION_KEY isn't set or is the
    // wrong length — surface that as its own error code so the rep doesn't get
    // a misleading "token exchange failed" message when their env is misconfigured.
    let encryptedAccessToken: string;
    let encryptedRefreshToken: string;
    try {
      encryptedAccessToken = encrypt(tokens.accessToken);
      encryptedRefreshToken = encrypt(tokens.refreshToken);
    } catch (err) {
      console.error("[calendar-callback] encryption failed:", err);
      return NextResponse.redirect(
        `${origin}/?calendarError=encryption_key_missing`
      );
    }

    // On reconnect, fetch any existing metadata so we don't blow away the
    // user's previous backfill settings, sync direction, reminder preferences,
    // etc. Only the OAuth fields (tokens, expiry, accountEmail, status) get
    // overwritten; calendar settings persist across reconnect.
    const existing = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      select: { metadata: true },
    });
    const existingMetadata = (existing?.metadata ?? {}) as Record<string, unknown>;
    const isReconnect = !!existing;

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      update: {
        accountEmail: tokens.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        // Preserve existing metadata (backfill state, sync prefs); update companyDomain
        // in case the user's email domain changed (e.g. they reconnected with a
        // different account).
        metadata: { ...existingMetadata, companyDomain },
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        service: "google_calendar",
        accountEmail: tokens.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        metadata: { companyDomain },
        status: "connected",
        syncEnabled: true,
      },
    });

    // Reconnect path: any rep with an existing integration row is just
    // refreshing their tokens (the backfill wizard, if they want it, is a
    // separate flow on /home). Bounce them back to where they came from and
    // let the client trigger an immediate sync via the ?calendarReconnected=true
    // marker. No home detour.
    if (isReconnect) {
      const safeReturn =
        returnTo && returnTo.startsWith("/") ? returnTo : "/?tab=activities";
      const sep = safeReturn.includes("?") ? "&" : "?";
      return NextResponse.redirect(
        `${origin}${safeReturn}${sep}calendarReconnected=true`
      );
    }

    // True first-time connect (no prior integration row). Land on /home so
    // the BackfillSetupModal can prompt for a backfill window before the
    // first sync runs.
    const fromSettings = returnTo === "settings" ? "&from=settings" : "";
    return NextResponse.redirect(
      `${origin}/?tab=home&calendarJustConnected=true${fromSettings}`
    );
  } catch (err) {
    console.error("[calendar-callback] token exchange failed:", err);
    return NextResponse.redirect(
      `${origin}/?calendarError=token_exchange_failed`
    );
  }
}
