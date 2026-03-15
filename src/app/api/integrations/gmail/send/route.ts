// POST /api/integrations/gmail/send — Send an email via the user's connected Gmail account
// Creates an Activity record linked to the contact/district if provided
// Returns: { success: true, activityId: string }

import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { decrypt, encrypt } from "@/features/integrations/lib/encryption";
import {
  refreshGmailToken,
  isTokenExpired,
} from "@/features/integrations/lib/google-gmail";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, subject, body: emailBody, districtLeaid, contactId } = body as {
      to: string;
      subject: string;
      body: string;
      districtLeaid?: string;
      contactId?: number;
    };

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, body" },
        { status: 400 }
      );
    }

    // Step 1: Get the user's Gmail integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "gmail" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Gmail is not connected" },
        { status: 400 }
      );
    }

    // Step 2: Get a valid access token (refreshing if expired)
    let accessToken = decrypt(integration.accessToken);

    if (
      integration.tokenExpiresAt &&
      isTokenExpired(integration.tokenExpiresAt)
    ) {
      const refreshToken = integration.refreshToken
        ? decrypt(integration.refreshToken)
        : null;
      if (!refreshToken) {
        return NextResponse.json(
          { error: "Gmail token expired and no refresh token available" },
          { status: 400 }
        );
      }

      const refreshed = await refreshGmailToken(refreshToken);
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
          status: "connected",
        },
      });
      accessToken = refreshed.accessToken;
    }

    // Step 3: Construct RFC 2822 MIME message
    const fromEmail = integration.accountEmail || user.email || "";
    const messageParts = [
      `From: ${fromEmail}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      emailBody,
    ];
    const rawMessage = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Step 4: Send via Gmail API
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // Step 5: Create an Activity record for the sent email
    const activity = await prisma.activity.create({
      data: {
        type: "email_sent",
        title: subject,
        source: "gmail_sync",
        gmailMessageId: sent.data.id || undefined,
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link to district if provided
    if (districtLeaid) {
      await prisma.activityDistrict.create({
        data: {
          activityId: activity.id,
          districtLeaid,
        },
      });
    }

    // Link to contact if provided
    if (contactId) {
      await prisma.activityContact.create({
        data: {
          activityId: activity.id,
          contactId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      activityId: activity.id,
    });
  } catch (error) {
    console.error("Gmail send error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
