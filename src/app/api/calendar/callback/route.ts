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
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Extract the company domain from the user's email
    // This is used to filter out internal attendees when syncing calendar events
    const userEmail = user.email || "";
    const companyDomain = userEmail.split("@")[1] || "";

    // Upsert the calendar integration — one per user per service
    // If the user re-connects, we update the existing integration with new tokens
    const encryptedAccessToken = encrypt(tokens.accessToken);
    const encryptedRefreshToken = encrypt(tokens.refreshToken);

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
      update: {
        accountEmail: tokens.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        metadata: { companyDomain },
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

    // Upsert the CalendarConnection row — the sync engine reads connection-level
    // fields (syncDirection, companyDomain, backfillStartDate, etc.) from this
    // table. Without this upsert, first-time users hit "No calendar connection
    // found" on sync. On create, backfillStartDate and backfillCompletedAt are
    // left NULL; the wizard sets them when the user picks a window.
    await prisma.calendarConnection.upsert({
      where: { userId: user.id },
      update: {
        googleAccountEmail: tokens.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        companyDomain,
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        googleAccountEmail: tokens.email,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: tokens.expiresAt,
        companyDomain,
        status: "connected",
        syncEnabled: true,
      },
    });

    // Defer the initial sync. The BackfillSetupModal on HomeView will trigger
    // it via POST /api/calendar/backfill/start once the user picks a window.
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
