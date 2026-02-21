// Calendar Sync Engine
// Pulls events from Google Calendar, matches attendees to contacts/districts/plans,
// and stages them in the CalendarEvent table for rep review
//
// This is the core "smart matching" logic that makes the Calendar Inbox feel intelligent.
// The flow: Google Calendar → filter external attendees → match emails to Contacts →
// look up Districts → find Plans → stage with suggestions and confidence levels

import prisma from "@/lib/prisma";
import {
  fetchCalendarEvents,
  filterExternalAttendees,
  getValidAccessToken,
  type CalendarEventAttendee,
} from "@/features/calendar/lib/google";

// ===== Types =====

export interface SyncResult {
  eventsProcessed: number;
  newEvents: number;
  updatedEvents: number;
  cancelledEvents: number;
  errors: string[];
}

interface ContactMatch {
  contactId: number;
  contactName: string;
  contactTitle: string | null;
  contactEmail: string;
  districtLeaid: string;
  districtName: string;
}

interface SmartMatchResult {
  confidence: "high" | "medium" | "low" | "none";
  suggestedActivityType: string | null;
  suggestedDistrictId: string | null;
  suggestedContactIds: number[];
  suggestedPlanId: string | null;
  matchedContacts: ContactMatch[];
}

// ===== Activity Type Auto-Detection =====
// Guesses the activity type based on event title keywords and attendee count
// Reps can always override this when they confirm the event

function detectActivityType(
  title: string,
  externalAttendeeCount: number
): string {
  const lower = title.toLowerCase();

  // Keyword-based detection takes priority over attendee count
  if (lower.includes("demo") || lower.includes("demonstration")) return "demo";
  if (lower.includes("proposal")) return "proposal_review";
  if (
    lower.includes("check-in") ||
    lower.includes("check in") ||
    lower.includes("checkin")
  )
    return "customer_check_in";
  if (lower.includes("discovery") || lower.includes("intro")) return "discovery_call";
  if (lower.includes("conference") || lower.includes("summit")) return "conference";
  if (lower.includes("trade show") || lower.includes("tradeshow")) return "trade_show";
  if (lower.includes("school visit") || lower.includes("site visit")) return "school_visit_day";

  // Fall back to attendee count heuristic
  if (externalAttendeeCount === 1) return "discovery_call";
  if (externalAttendeeCount <= 3) return "customer_check_in";
  return "demo"; // 4+ external attendees → likely a demo or group meeting
}

// ===== Smart Matching =====
// Matches attendee emails against the Contact table to suggest district/plan associations
// This is what makes "Calendar Inbox" feel smart — the app recognizes who reps are meeting with

async function matchAttendeesToContacts(
  userId: string,
  attendees: CalendarEventAttendee[]
): Promise<SmartMatchResult> {
  if (attendees.length === 0) {
    return {
      confidence: "none",
      suggestedActivityType: null,
      suggestedDistrictId: null,
      suggestedContactIds: [],
      suggestedPlanId: null,
      matchedContacts: [],
    };
  }

  // Extract all attendee emails for batch lookup
  const attendeeEmails = attendees.map((a) => a.email.toLowerCase());

  // Step 1: Look up contacts by exact email match
  // This finds contacts that the rep (or their team) has already added to the app
  const matchedContacts = await prisma.contact.findMany({
    where: {
      email: { in: attendeeEmails, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      title: true,
      email: true,
      leaid: true,
      district: {
        select: {
          name: true,
        },
      },
    },
  });

  // If no contacts matched, return low confidence (the event is still worth staging)
  if (matchedContacts.length === 0) {
    return {
      confidence: "low",
      suggestedActivityType: detectActivityType("", attendees.length),
      suggestedDistrictId: null,
      suggestedContactIds: [],
      suggestedPlanId: null,
      matchedContacts: [],
    };
  }

  // Build the contact match results
  const contactMatches: ContactMatch[] = matchedContacts.map((c) => ({
    contactId: c.id,
    contactName: c.name,
    contactTitle: c.title,
    contactEmail: c.email || "",
    districtLeaid: c.leaid,
    districtName: c.district.name,
  }));

  // Use the first matched contact's district as the primary suggestion
  // If multiple contacts from different districts are on the call, we still suggest the first one
  const primaryDistrictId = contactMatches[0].districtLeaid;
  const contactIds = contactMatches.map((c) => c.contactId);

  // Step 2: Find an active territory plan that contains this district
  // This completes the chain: attendee email → contact → district → plan
  const planLink = await prisma.territoryPlanDistrict.findFirst({
    where: {
      districtLeaid: primaryDistrictId,
      plan: {
        status: "working",
        userId: userId,
      },
    },
    select: {
      planId: true,
    },
    orderBy: {
      plan: { updatedAt: "desc" },
    },
  });

  return {
    // High confidence = we matched at least one contact by exact email
    confidence: "high",
    suggestedActivityType: null, // Will be set by the caller using title + attendee count
    suggestedDistrictId: primaryDistrictId,
    suggestedContactIds: contactIds,
    suggestedPlanId: planLink?.planId || null,
    matchedContacts: contactMatches,
  };
}

// ===== Core Sync Function =====
// This is the main entry point — call it to pull events from Google Calendar
// and stage them in the CalendarEvent table with smart matching suggestions

export async function syncCalendarEvents(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    eventsProcessed: 0,
    newEvents: 0,
    updatedEvents: 0,
    cancelledEvents: 0,
    errors: [],
  };

  // Step 1: Get the user's calendar connection and validate tokens
  const connection = await prisma.calendarConnection.findUnique({
    where: { userId },
  });

  if (!connection) {
    result.errors.push("No calendar connection found");
    return result;
  }

  if (!connection.syncEnabled) {
    result.errors.push("Calendar sync is disabled");
    return result;
  }

  // Refresh the access token if it's expired
  const tokenResult = await getValidAccessToken({
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    tokenExpiresAt: connection.tokenExpiresAt,
  });

  if (!tokenResult) {
    // Token refresh failed — mark the connection as errored so the UI can show a reconnect prompt
    await prisma.calendarConnection.update({
      where: { userId },
      data: { status: "error" },
    });
    result.errors.push("Failed to refresh access token — user may need to reconnect");
    return result;
  }

  // If the token was refreshed, save the new one
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

  // Step 2: Fetch events from Google Calendar
  // Window: 7 days in the past + 14 days in the future
  const timeMin = new Date();
  timeMin.setDate(timeMin.getDate() - 7);
  const timeMax = new Date();
  timeMax.setDate(timeMax.getDate() + 14);

  let googleEvents;
  try {
    googleEvents = await fetchCalendarEvents(
      tokenResult.accessToken,
      timeMin,
      timeMax
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(`Failed to fetch calendar events: ${message}`);
    return result;
  }

  // Step 3: Process each event
  const syncTimestamp = new Date();

  for (const event of googleEvents) {
    result.eventsProcessed++;

    try {
      // Filter to only external attendees using the company domain
      const externalAttendees = filterExternalAttendees(
        event.attendees,
        connection.companyDomain
      );

      // Skip events with no external attendees — these are internal meetings
      if (externalAttendees.length === 0) continue;

      // Smart-match attendees to contacts/districts/plans
      const matchResult = await matchAttendeesToContacts(userId, externalAttendees);

      // Auto-detect the activity type from the event title and attendee count
      const suggestedActivityType = detectActivityType(
        event.summary,
        externalAttendees.length
      );

      // Check if this event already exists in our staging table
      const existingEvent = await prisma.calendarEvent.findUnique({
        where: {
          connectionId_googleEventId: {
            connectionId: connection.id,
            googleEventId: event.id,
          },
        },
      });

      if (existingEvent) {
        // Event already staged — update it with latest data from Google
        // But only if the rep hasn't already confirmed or dismissed it
        if (existingEvent.status === "pending") {
          await prisma.calendarEvent.update({
            where: { id: existingEvent.id },
            data: {
              title: event.summary,
              description: event.description,
              startTime: new Date(event.start.dateTime),
              endTime: new Date(event.end.dateTime),
              location: event.location,
              attendees: JSON.parse(JSON.stringify(externalAttendees)),
              suggestedActivityType,
              suggestedDistrictId: matchResult.suggestedDistrictId,
              suggestedContactIds: matchResult.suggestedContactIds,
              suggestedPlanId: matchResult.suggestedPlanId,
              matchConfidence: matchResult.confidence,
              lastSyncedAt: syncTimestamp,
            },
          });
          result.updatedEvents++;
        }
      } else {
        // New event — create a staging record
        await prisma.calendarEvent.create({
          data: {
            userId,
            connectionId: connection.id,
            googleEventId: event.id,
            title: event.summary,
            description: event.description,
            startTime: new Date(event.start.dateTime),
            endTime: new Date(event.end.dateTime),
            location: event.location,
            attendees: JSON.parse(JSON.stringify(externalAttendees)),
            status: "pending",
            suggestedActivityType,
            suggestedDistrictId: matchResult.suggestedDistrictId,
            suggestedContactIds: matchResult.suggestedContactIds,
            suggestedPlanId: matchResult.suggestedPlanId,
            matchConfidence: matchResult.confidence,
            lastSyncedAt: syncTimestamp,
          },
        });
        result.newEvents++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Error processing event "${event.summary}": ${message}`);
    }
  }

  // Step 4: Mark events that were cancelled in Google
  // Find staged events whose googleEventId is no longer in the fetched events
  const fetchedEventIds = new Set(googleEvents.map((e) => e.id));
  const stagedPendingEvents = await prisma.calendarEvent.findMany({
    where: {
      connectionId: connection.id,
      status: "pending",
      // Only check events within our sync window
      startTime: { gte: timeMin, lte: timeMax },
    },
    select: { id: true, googleEventId: true },
  });

  for (const staged of stagedPendingEvents) {
    if (!fetchedEventIds.has(staged.googleEventId)) {
      await prisma.calendarEvent.update({
        where: { id: staged.id },
        data: { status: "cancelled" },
      });
      result.cancelledEvents++;
    }
  }

  // Step 5: Update the last sync timestamp
  await prisma.calendarConnection.update({
    where: { userId },
    data: { lastSyncAt: syncTimestamp },
  });

  return result;
}

// ===== Confirm Calendar Event → Create Activity =====
// When a rep clicks "Confirm" on a calendar event, this creates the Activity
// and links it to the suggested district/contacts/plan

export async function confirmCalendarEvent(
  userId: string,
  calendarEventId: string,
  overrides?: {
    activityType?: string;
    title?: string;
    planIds?: string[];
    districtLeaids?: string[];
    contactIds?: number[];
    notes?: string;
  }
): Promise<{ activityId: string }> {
  // Get the calendar event
  const calEvent = await prisma.calendarEvent.findUnique({
    where: { id: calendarEventId },
  });

  if (!calEvent || calEvent.userId !== userId) {
    throw new Error("Calendar event not found");
  }

  if (calEvent.status !== "pending") {
    throw new Error("Calendar event has already been processed");
  }

  // Determine final values — use overrides if provided, otherwise use suggestions
  const activityType = overrides?.activityType || calEvent.suggestedActivityType || "customer_check_in";
  const title = overrides?.title || calEvent.title;
  const planIds = overrides?.planIds || (calEvent.suggestedPlanId ? [calEvent.suggestedPlanId] : []);
  const districtLeaids = overrides?.districtLeaids || (calEvent.suggestedDistrictId ? [calEvent.suggestedDistrictId] : []);
  const contactIds = overrides?.contactIds || (calEvent.suggestedContactIds as number[] || []);

  // Create the Activity with all associations in a single transaction
  const activity = await prisma.$transaction(async (tx) => {
    // Create the activity
    const newActivity = await tx.activity.create({
      data: {
        type: activityType,
        title,
        notes: overrides?.notes || calEvent.description || null,
        startDate: calEvent.startTime,
        endDate: calEvent.endTime,
        status: calEvent.startTime <= new Date() ? "completed" : "planned",
        createdByUserId: userId,
        googleEventId: calEvent.googleEventId,
        source: "calendar_sync",
      },
    });

    // Link to plans
    if (planIds.length > 0) {
      await tx.activityPlan.createMany({
        data: planIds.map((planId) => ({
          activityId: newActivity.id,
          planId,
        })),
        skipDuplicates: true,
      });
    }

    // Link to districts
    if (districtLeaids.length > 0) {
      await tx.activityDistrict.createMany({
        data: districtLeaids.map((leaid) => ({
          activityId: newActivity.id,
          districtLeaid: leaid,
        })),
        skipDuplicates: true,
      });

      // Auto-derive state associations from districts
      const districts = await tx.district.findMany({
        where: { leaid: { in: districtLeaids } },
        select: { stateFips: true },
      });
      const uniqueStateFips = [...new Set(districts.map((d) => d.stateFips))];
      if (uniqueStateFips.length > 0) {
        await tx.activityState.createMany({
          data: uniqueStateFips.map((fips) => ({
            activityId: newActivity.id,
            stateFips: fips,
            isExplicit: false,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Link to contacts
    if (contactIds.length > 0) {
      await tx.activityContact.createMany({
        data: contactIds.map((contactId) => ({
          activityId: newActivity.id,
          contactId,
        })),
        skipDuplicates: true,
      });
    }

    return newActivity;
  });

  // Mark the calendar event as confirmed and link to the new activity
  await prisma.calendarEvent.update({
    where: { id: calendarEventId },
    data: {
      status: "confirmed",
      activityId: activity.id,
    },
  });

  return { activityId: activity.id };
}

// ===== Dismiss Calendar Event =====
// Hides the event from the inbox without creating an Activity

export async function dismissCalendarEvent(
  userId: string,
  calendarEventId: string
): Promise<void> {
  const calEvent = await prisma.calendarEvent.findUnique({
    where: { id: calendarEventId },
  });

  if (!calEvent || calEvent.userId !== userId) {
    throw new Error("Calendar event not found");
  }

  await prisma.calendarEvent.update({
    where: { id: calendarEventId },
    data: { status: "dismissed" },
  });
}

// ===== Batch Confirm High-Confidence Events =====
// Confirms all pending events with high confidence in one go
// Used by the "Confirm All High-Confidence" batch action button

export async function batchConfirmHighConfidence(
  userId: string
): Promise<{ confirmed: number; activityIds: string[] }> {
  const pendingHighConfidence = await prisma.calendarEvent.findMany({
    where: {
      userId,
      status: "pending",
      matchConfidence: "high",
    },
  });

  const activityIds: string[] = [];

  for (const event of pendingHighConfidence) {
    try {
      const result = await confirmCalendarEvent(userId, event.id);
      activityIds.push(result.activityId);
    } catch (err) {
      // Skip events that fail (e.g., if the googleEventId already exists on an activity)
      console.error(`Batch confirm failed for event ${event.id}:`, err);
    }
  }

  return {
    confirmed: activityIds.length,
    activityIds,
  };
}
