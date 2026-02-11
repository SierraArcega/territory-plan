// GET /api/calendar/callback — Handles the OAuth redirect from Google
// After the rep approves calendar access, Google redirects here with an auth code
// We exchange the code for tokens and store them in CalendarConnection

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // If the user denied access, redirect back with a message
  if (error) {
    return NextResponse.redirect(
      `${origin}/?tab=profile&calendarError=access_denied`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/?tab=profile&calendarError=no_code`
    );
  }

  try {
    const user = await getUser();
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
          return NextResponse.redirect(
            `${origin}/?tab=profile&calendarError=state_mismatch`
          );
        }
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

    // Redirect back to the app with a success indicator
    return NextResponse.redirect(
      `${origin}/?tab=activities&calendarConnected=true`
    );
  } catch (err) {
    console.error("Calendar callback error:", err);
    return NextResponse.redirect(
      `${origin}/?tab=profile&calendarError=token_exchange_failed`
    );
  }
}
