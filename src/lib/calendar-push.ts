// Calendar Push — Pushes activity changes to Google Calendar
// Used by the activity create/update/delete API routes to keep the calendar in sync
//
// Push is best-effort: if it fails (e.g., token expired, quota exceeded),
// we log the error but don't fail the activity operation. The activity is the
// source of truth; the calendar event is a convenience mirror.

import prisma from "@/lib/prisma";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getValidAccessToken,
} from "@/lib/google-calendar";

// Helper to get a valid access token for a user's calendar connection
// Returns null if no connection, sync disabled, or token refresh fails
async function getCalendarAccess(userId: string): Promise<{
  accessToken: string;
  connectionId: string;
} | null> {
  const connection = await prisma.calendarConnection.findUnique({
    where: { userId },
  });

  if (!connection || !connection.syncEnabled || connection.status !== "connected") {
    return null;
  }

  const tokenResult = await getValidAccessToken({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    tokenExpiresAt: connection.tokenExpiresAt,
  });

  if (!tokenResult) {
    // Token refresh failed — mark connection as errored
    await prisma.calendarConnection.update({
      where: { userId },
      data: { status: "error" },
    });
    return null;
  }

  // Save refreshed token if it changed
  if (tokenResult.accessToken !== connection.accessToken) {
    await prisma.calendarConnection.update({
      where: { userId },
      data: {
        accessToken: tokenResult.accessToken,
        tokenExpiresAt: tokenResult.expiresAt,
        status: "connected",
      },
    });
  }

  return {
    accessToken: tokenResult.accessToken,
    connectionId: connection.id,
  };
}

// Push a newly created activity to Google Calendar
// Only pushes if the activity has a startDate (can't create a calendar event without a time)
export async function pushActivityToCalendar(
  userId: string,
  activityId: string
): Promise<void> {
  try {
    const access = await getCalendarAccess(userId);
    if (!access) return;

    // Get the activity with its contacts for attendee emails
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        title: true,
        notes: true,
        startDate: true,
        endDate: true,
        googleEventId: true,
        source: true,
        contacts: {
          select: {
            contact: {
              select: { email: true },
            },
          },
        },
      },
    });

    if (!activity || !activity.startDate) return;

    // Don't push if the activity was created from a calendar sync
    // (it already exists on the calendar — pushing would create a duplicate)
    if (activity.source === "calendar_sync" && activity.googleEventId) return;

    // Don't push if it already has a Google event ID (already synced)
    if (activity.googleEventId) return;

    // Collect attendee emails from linked contacts
    const attendeeEmails = activity.contacts
      .map((c) => c.contact.email)
      .filter((email): email is string => !!email);

    // Create the Google Calendar event
    const googleEventId = await createCalendarEvent(access.accessToken, {
      title: activity.title,
      description: activity.notes || undefined,
      startTime: activity.startDate,
      endTime: activity.endDate || activity.startDate, // Same time if no end date
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    });

    // Store the Google event ID on the activity for future syncs
    await prisma.activity.update({
      where: { id: activityId },
      data: { googleEventId },
    });
  } catch (error) {
    // Best-effort: log but don't fail the activity operation
    console.error(`[Calendar Push] Failed to push activity ${activityId}:`, error);
  }
}

// Update an existing Google Calendar event when an activity is modified
export async function updateActivityOnCalendar(
  userId: string,
  activityId: string
): Promise<void> {
  try {
    const access = await getCalendarAccess(userId);
    if (!access) return;

    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        title: true,
        notes: true,
        startDate: true,
        endDate: true,
        googleEventId: true,
        contacts: {
          select: {
            contact: {
              select: { email: true },
            },
          },
        },
      },
    });

    // Only update if the activity has a linked Google event
    if (!activity || !activity.googleEventId) return;

    const attendeeEmails = activity.contacts
      .map((c) => c.contact.email)
      .filter((email): email is string => !!email);

    await updateCalendarEvent(access.accessToken, activity.googleEventId, {
      title: activity.title,
      description: activity.notes || undefined,
      startTime: activity.startDate || undefined,
      endTime: activity.endDate || activity.startDate || undefined,
      attendeeEmails: attendeeEmails.length > 0 ? attendeeEmails : undefined,
    });
  } catch (error) {
    console.error(`[Calendar Push] Failed to update activity ${activityId}:`, error);
  }
}

// Delete a Google Calendar event when an activity is deleted
export async function deleteActivityFromCalendar(
  userId: string,
  activityId: string,
  googleEventId: string
): Promise<void> {
  try {
    const access = await getCalendarAccess(userId);
    if (!access) return;

    await deleteCalendarEvent(access.accessToken, googleEventId);
  } catch (error) {
    console.error(`[Calendar Push] Failed to delete calendar event for activity ${activityId}:`, error);
  }
}
