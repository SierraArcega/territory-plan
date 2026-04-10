import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getUser, isAdmin } from "@/lib/supabase/server";
import { decrypt } from "@/features/integrations/lib/encryption";
import { getValidAccessToken } from "@/features/calendar/lib/google";

export const dynamic = "force-dynamic";

interface AttendeeResult {
  email: string;
  displayName: string | null;
  responseStatus: string;
  matchedDistrict: { leaid: string; name: string } | null;
  existingContact: { id: number; name: string } | null;
}

// GET /api/activities/[id]/calendar-attendees
// Fetch Google Calendar event attendees and match to districts/contacts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch activity and verify ownership
    const activity = await prisma.activity.findUnique({
      where: { id },
      select: {
        id: true,
        googleEventId: true,
        createdByUserId: true,
      },
    });

    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    if (activity.createdByUserId && activity.createdByUserId !== user.id) {
      if (!(await isAdmin(user.id))) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
    }

    // No Google event linked — return empty
    if (!activity.googleEventId) {
      return NextResponse.json({ attendees: [] });
    }

    // Get user's Google Calendar integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
    });

    if (!integration || !integration.syncEnabled || integration.status !== "connected") {
      return NextResponse.json({ attendees: [] });
    }

    // Decrypt tokens and get valid access token
    const decryptedAccessToken = decrypt(integration.accessToken);
    const decryptedRefreshToken = integration.refreshToken
      ? decrypt(integration.refreshToken)
      : "";

    const tokenResult = await getValidAccessToken({
      accessToken: decryptedAccessToken,
      refreshToken: decryptedRefreshToken,
      tokenExpiresAt: integration.tokenExpiresAt!,
    });

    if (!tokenResult) {
      // Token refresh failed
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: { status: "error" },
      });
      return NextResponse.json({ attendees: [] });
    }

    // Save refreshed token if it changed
    if (tokenResult.accessToken !== decryptedAccessToken) {
      const { encrypt } = await import("@/features/integrations/lib/encryption");
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(tokenResult.accessToken),
          tokenExpiresAt: tokenResult.expiresAt,
          status: "connected",
        },
      });
    }

    // Fetch event from Google Calendar
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CALENDAR_CLIENT_ID,
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    );
    oauth2Client.setCredentials({ access_token: tokenResult.accessToken });
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const eventResponse = await calendar.events.get({
      calendarId: "primary",
      eventId: activity.googleEventId,
    });

    const rawAttendees = eventResponse.data.attendees || [];

    // Get company domain from integration metadata for filtering internal emails
    const metadata = integration.metadata as Record<string, unknown> | null;
    const companyDomain = (metadata?.companyDomain as string) || "";

    // Filter to external attendees only
    const externalAttendees = rawAttendees.filter((a) => {
      if (a.self) return false;
      if (!a.email) return false;
      if (companyDomain) {
        const domain = a.email.split("@")[1]?.toLowerCase();
        if (domain === companyDomain.toLowerCase()) return false;
      }
      return true;
    });

    // For each external attendee, match to districts and contacts
    const attendeeResults: AttendeeResult[] = await Promise.all(
      externalAttendees.map(async (attendee) => {
        const email = attendee.email!;
        const domain = email.split("@")[1]?.toLowerCase() || "";

        // Look up district by domain matching against websiteUrl
        let matchedDistrict: AttendeeResult["matchedDistrict"] = null;
        if (domain) {
          const district = await prisma.district.findFirst({
            where: {
              websiteUrl: { contains: domain, mode: "insensitive" },
            },
            select: { leaid: true, name: true },
          });
          if (district) {
            matchedDistrict = { leaid: district.leaid, name: district.name };
          }
        }

        // Check if this email already exists as a contact
        let existingContact: AttendeeResult["existingContact"] = null;
        const contact = await prisma.contact.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
          select: { id: true, name: true },
        });
        if (contact) {
          existingContact = { id: contact.id, name: contact.name };
        }

        return {
          email,
          displayName: attendee.displayName || null,
          responseStatus: attendee.responseStatus || "needsAction",
          matchedDistrict,
          existingContact,
        };
      })
    );

    return NextResponse.json({ attendees: attendeeResults });
  } catch (error) {
    console.error("Error fetching calendar attendees:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar attendees" },
      { status: 500 }
    );
  }
}
