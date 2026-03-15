// Gmail Sync Engine
// Pulls emails from Gmail, matches senders/recipients to contacts/districts,
// and creates Activity records with junction rows for matched contacts.
//
// Flow: Gmail API → extract headers → parse emails → match to Contacts →
// upsert Activity (dedup via gmailMessageId) → create ActivityDistrict + ActivityContact rows
// → update lastSyncAt and historyId in integration metadata

import prisma from "@/lib/prisma";
import { google } from "googleapis";
import { decrypt, encrypt } from "@/features/integrations/lib/encryption";
import {
  refreshGmailToken,
  isTokenExpired,
} from "@/features/integrations/lib/google-gmail";

// ===== Types =====

export interface GmailSyncResult {
  messagesProcessed: number;
  newMessages: number;
  updatedMessages: number;
  contactMatches: number;
  errors: string[];
}

interface ContactMatchResult {
  contactId: number;
  contactEmail: string;
  districtLeaid: string;
}

interface ParsedGmailMessage {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  date: string;
  historyId: string | undefined;
  isInbound: boolean;
}

// ===== Email Parsing =====
// Extracts individual email addresses from RFC 5322 header values
// e.g. "Jane Doe <jane@school.org>, bob@district.edu" → ["jane@school.org", "bob@district.edu"]

const EMAIL_REGEX = /[\w.+-]+@[\w.-]+\.\w+/gi;

export function parseEmailAddresses(headerValue: string): string[] {
  if (!headerValue) return [];
  const matches = headerValue.match(EMAIL_REGEX);
  return matches ? [...new Set(matches.map((e) => e.toLowerCase()))] : [];
}

// ===== Contact Matching =====
// Matches email addresses from headers against Contact.email in the database

export async function matchEmailToContacts(
  emails: string[]
): Promise<ContactMatchResult[]> {
  if (emails.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true, email: true, leaid: true },
  });

  return contacts
    .filter(
      (c): c is typeof c & { email: string; leaid: string } =>
        c.email != null && c.leaid != null
    )
    .map((c) => ({
      contactId: c.id,
      contactEmail: c.email,
      districtLeaid: c.leaid,
    }));
}

// ===== Token Management =====
// Gets a valid (non-expired) access token, refreshing if needed

async function getValidGmailToken(integration: {
  id: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}): Promise<string> {
  let accessToken = decrypt(integration.accessToken);

  if (
    integration.tokenExpiresAt &&
    isTokenExpired(integration.tokenExpiresAt)
  ) {
    const refreshToken = integration.refreshToken
      ? decrypt(integration.refreshToken)
      : null;
    if (!refreshToken) throw new Error("No refresh token available");

    const refreshed = await refreshGmailToken(refreshToken);

    // Persist the new access token (encrypted)
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

  return accessToken;
}

// ===== Message Fetching =====
// Fetches message IDs from Gmail, either a full 90-day backfill or incremental via historyId

async function fetchMessageIds(
  gmail: ReturnType<typeof google.gmail>,
  historyId: string | null
): Promise<{ messageIds: string[]; isIncremental: boolean }> {
  // Incremental sync: use history API to get only new messages since last sync
  if (historyId) {
    try {
      const messageIds: string[] = [];
      let pageToken: string | undefined;

      do {
        const response = await gmail.users.history.list({
          userId: "me",
          startHistoryId: historyId,
          historyTypes: ["messageAdded"],
          pageToken,
        });

        const histories = response.data.history || [];
        for (const h of histories) {
          for (const added of h.messagesAdded || []) {
            if (added.message?.id) {
              messageIds.push(added.message.id);
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);

      return { messageIds: [...new Set(messageIds)], isIncremental: true };
    } catch (err) {
      // If historyId is too old or invalid, fall back to full sync
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("404") || message.includes("historyId")) {
        // Fall through to full sync below
      } else {
        throw err;
      }
    }
  }

  // Full sync: fetch messages from the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const dateString = `${ninetyDaysAgo.getFullYear()}/${String(ninetyDaysAgo.getMonth() + 1).padStart(2, "0")}/${String(ninetyDaysAgo.getDate()).padStart(2, "0")}`;

  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: `after:${dateString}`,
      maxResults: 100,
      pageToken,
    });

    const messages = response.data.messages || [];
    for (const m of messages) {
      if (m.id) messageIds.push(m.id);
    }

    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return { messageIds, isIncremental: false };
}

// ===== Message Details =====
// Fetches metadata headers for a single message

async function fetchMessageDetails(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string,
  userEmail: string
): Promise<ParsedGmailMessage> {
  const msg = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "metadata",
    metadataHeaders: ["From", "To", "Cc", "Subject", "Date"],
  });

  const headers = msg.data.payload?.headers || [];
  const from = headers.find((h) => h.name === "From")?.value || "";
  const to = headers.find((h) => h.name === "To")?.value || "";
  const cc = headers.find((h) => h.name === "Cc")?.value || "";
  const subject = headers.find((h) => h.name === "Subject")?.value || "";
  const date = headers.find((h) => h.name === "Date")?.value || "";

  // Determine direction: if the user's email appears in From, it's outbound
  const fromAddresses = parseEmailAddresses(from);
  const isInbound = !fromAddresses.some(
    (addr) => addr.toLowerCase() === userEmail.toLowerCase()
  );

  return {
    messageId,
    subject,
    from,
    to,
    cc,
    date,
    historyId: msg.data.historyId ?? undefined,
    isInbound,
  };
}

// ===== Core Sync Function =====
// Main entry point — call this to pull Gmail messages and create Activity records

export async function syncGmailMessages(
  userId: string
): Promise<GmailSyncResult> {
  const result: GmailSyncResult = {
    messagesProcessed: 0,
    newMessages: 0,
    updatedMessages: 0,
    contactMatches: 0,
    errors: [],
  };

  // Step 1: Get the user's Gmail integration and validate
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_service: { userId, service: "gmail" } },
  });

  if (!integration) {
    result.errors.push("No Gmail connection found");
    return result;
  }

  if (!integration.syncEnabled) {
    result.errors.push("Gmail sync is disabled");
    return result;
  }

  // Step 2: Get a valid access token (refreshing if expired)
  let accessToken: string;
  try {
    accessToken = await getValidGmailToken(integration);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: { status: "error" },
    });
    result.errors.push(
      `Failed to get valid Gmail token: ${message} — user may need to reconnect`
    );
    return result;
  }

  // Step 3: Set up Gmail client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Get the user's email for inbound/outbound detection
  const userEmail = integration.accountEmail || "";

  // Extract stored historyId from metadata
  const metadata =
    (integration.metadata as Record<string, unknown>) || {};
  const storedHistoryId = (metadata.historyId as string) || null;

  // Step 4: Fetch message IDs (incremental if historyId exists, full 90-day otherwise)
  let messageIds: string[];
  try {
    const fetchResult = await fetchMessageIds(gmail, storedHistoryId);
    messageIds = fetchResult.messageIds;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    result.errors.push(`Failed to fetch Gmail messages: ${message}`);
    return result;
  }

  // Step 5: Process each message
  let latestHistoryId = storedHistoryId;

  for (const msgId of messageIds) {
    result.messagesProcessed++;

    try {
      // Fetch message metadata
      const parsed = await fetchMessageDetails(gmail, msgId, userEmail);

      // Track the highest historyId for incremental sync
      if (
        parsed.historyId &&
        (!latestHistoryId ||
          BigInt(parsed.historyId) > BigInt(latestHistoryId))
      ) {
        latestHistoryId = parsed.historyId;
      }

      // Collect all email addresses from headers (excluding the user's own)
      const allEmails = [
        ...parseEmailAddresses(parsed.from),
        ...parseEmailAddresses(parsed.to),
        ...parseEmailAddresses(parsed.cc),
      ].filter((e) => e.toLowerCase() !== userEmail.toLowerCase());

      // Match emails to contacts in the database
      const contactMatches = await matchEmailToContacts(allEmails);

      // Skip messages with no contact matches — we only create activities for
      // emails involving known contacts
      if (contactMatches.length === 0) continue;

      result.contactMatches += contactMatches.length;

      // Parse the message date
      const messageDate = parsed.date
        ? new Date(parsed.date)
        : new Date();

      // Upsert the Activity record (dedup on gmailMessageId)
      const activity = await prisma.activity.upsert({
        where: { gmailMessageId: msgId },
        update: {
          title: parsed.subject || "(No subject)",
          updatedAt: new Date(),
        },
        create: {
          type: parsed.isInbound ? "email_received" : "email_sent",
          title: parsed.subject || "(No subject)",
          source: "gmail_sync",
          gmailMessageId: msgId,
          startDate: messageDate,
          status: "completed",
          createdByUserId: userId,
        },
      });

      // Determine if this was a new or updated record
      // If createdAt and updatedAt are very close, it was just created
      const isNew =
        Math.abs(activity.createdAt.getTime() - activity.updatedAt.getTime()) <
        1000;
      if (isNew) {
        result.newMessages++;
      } else {
        result.updatedMessages++;
      }

      // Create junction rows for matched contacts and their districts
      for (const match of contactMatches) {
        await prisma.activityDistrict.upsert({
          where: {
            activityId_districtLeaid: {
              activityId: activity.id,
              districtLeaid: match.districtLeaid,
            },
          },
          update: {},
          create: {
            activityId: activity.id,
            districtLeaid: match.districtLeaid,
          },
        });

        await prisma.activityContact.upsert({
          where: {
            activityId_contactId: {
              activityId: activity.id,
              contactId: match.contactId,
            },
          },
          update: {},
          create: {
            activityId: activity.id,
            contactId: match.contactId,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(
        `Error processing message ${msgId}: ${message}`
      );
    }
  }

  // Step 6: Update lastSyncAt and store historyId for incremental sync
  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: {
      lastSyncAt: new Date(),
      metadata: {
        ...metadata,
        historyId: latestHistoryId,
      },
    },
  });

  return result;
}
