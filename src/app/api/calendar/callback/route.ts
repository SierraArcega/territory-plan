// GET /api/calendar/callback — Handles the OAuth redirect from Google
// After the rep approves calendar access, Google redirects here with an auth code
// We exchange the code for tokens and store them in CalendarConnection

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { syncCalendarEvents } from "@/lib/calendar-sync";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  console.log("[calendar-callback] hit — params:", { code: code ? "present" : "missing", state: state ? "present" : "missing", error, origin });

  // If the user denied access, redirect back with a message
  if (error) {
    console.log("[calendar-callback] → error from Google:", error);
    return NextResponse.redirect(
      `${origin}/?calendarError=access_denied`
    );
  }

  if (!code) {
    console.log("[calendar-callback] → no code param");
    return NextResponse.redirect(
      `${origin}/?calendarError=no_code`
    );
  }

  try {
    const user = await getUser();
    console.log("[calendar-callback] getUser:", user ? user.id : "null");
    if (!user) {
      return NextResponse.redirect(`${origin}/login`);
    }

    // Verify the state token matches the user who started the flow (CSRF protection)
    if (state) {
      try {
        const stateData = JSON.parse(
          Buffer.from(state, "base64url").toString()
        );
        if (stateData.userId !== user.id) {
          console.log("[calendar-callback] → state mismatch:", { stateUserId: stateData.userId, sessionUserId: user.id });
          return NextResponse.redirect(
            `${origin}/?calendarError=state_mismatch`
          );
        }
      } catch {
        // State parsing failed — proceed anyway since we have auth from Supabase session
        console.warn("Calendar callback: could not parse state token");
      }
    }

    // Exchange the auth code for access + refresh tokens
    const redirectUri = `${origin}/api/calendar/callback`;
    console.log("[calendar-callback] exchanging code, redirectUri:", redirectUri);
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    console.log("[calendar-callback] token exchange succeeded, email:", tokens.email);

    // Extract the company domain from the user's email
    // This is used to filter out internal attendees when syncing calendar events
    const userEmail = user.email || "";
    const companyDomain = userEmail.split("@")[1] || "";

    // Upsert the calendar connection — one per user
    // If the user re-connects, we update the existing connection with new tokens
    await prisma.calendarConnection.upsert({
      where: { userId: user.id },
      update: {
        googleAccountEmail: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        companyDomain,
        status: "connected",
        syncEnabled: true,
      },
      create: {
        userId: user.id,
        googleAccountEmail: tokens.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        companyDomain,
        status: "connected",
        syncEnabled: true,
      },
    });

    // Auto-sync calendar events so the inbox is populated immediately
    try {
      await syncCalendarEvents(user.id);
    } catch (syncErr) {
      // Non-fatal — the user can manually sync later
      console.error("Auto-sync after connection failed:", syncErr);
    }

    // Redirect back to the app with a success indicator
    console.log("[calendar-callback] → SUCCESS, redirecting to activities");
    return NextResponse.redirect(
      `${origin}/?tab=activities&calendarConnected=true`
    );
  } catch (err) {
    console.error("[calendar-callback] → FAILED. Error:", err);
    return NextResponse.redirect(
      `${origin}/?calendarError=token_exchange_failed`
    );
  }
}
