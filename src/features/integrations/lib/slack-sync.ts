// Slack Sync Engine
// Pulls messages from Slack channels, matches channels to districts in the user's
// territory plans, and creates Activity records with junction rows for matched districts.
//
// Flow: Slack API → list channels → fetch history → match channel to districts →
// upsert Activity (dedup via slackChannelId + slackMessageTs) → create ActivityDistrict rows
// → update lastSyncAt

import prisma from "@/lib/prisma";
import { decrypt } from "@/features/integrations/lib/encryption";

// ===== Types =====

export interface SlackSyncResult {
  messagesProcessed: number;
  newMessages: number;
  updatedMessages: number;
  districtMatches: number;
  channelsProcessed: number;
  errors: string[];
}

interface SlackChannel {
  id: string;
  name: string;
  topic: { value: string };
}

interface SlackMessage {
  ts: string;
  text: string;
  thread_ts?: string;
}

interface DistrictMatch {
  leaid: string;
  name: string;
}

// ===== Channel-to-District Matching =====
// Compares normalized channel name/topic against district names from the user's
// territory plans. Hyphens and underscores are treated as spaces.

export function matchChannelToDistrict(
  channelName: string,
  channelTopic: string,
  districts: DistrictMatch[]
): DistrictMatch | null {
  if (districts.length === 0) return null;

  const normalizedChannel = channelName.toLowerCase().replace(/[-_]/g, " ");
  const normalizedTopic = channelTopic.toLowerCase().replace(/[-_]/g, " ");

  return (
    districts.find((d) => {
      const districtNorm = d.name.toLowerCase();
      return (
        normalizedChannel.includes(districtNorm) ||
        districtNorm.includes(normalizedChannel) ||
        (normalizedTopic && normalizedTopic.includes(districtNorm))
      );
    }) ?? null
  );
}

// ===== Text Helpers =====

export function truncateMessage(
  text: string | null | undefined,
  maxLength: number
): string {
  if (!text) return "(No message text)";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

// ===== Slack API Helpers =====

async function fetchSlackChannels(
  accessToken: string
): Promise<{ channels: SlackChannel[]; error?: string }> {
  const res = await fetch("https://slack.com/api/conversations.list", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      types: "public_channel,private_channel",
      limit: "200",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    return { channels: [], error: data.error };
  }

  return { channels: data.channels || [] };
}

async function fetchChannelHistory(
  accessToken: string,
  channelId: string,
  oldestTimestamp: string
): Promise<{ messages: SlackMessage[]; error?: string }> {
  const res = await fetch("https://slack.com/api/conversations.history", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      channel: channelId,
      limit: "50",
      oldest: oldestTimestamp,
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    return { messages: [], error: data.error };
  }

  return { messages: data.messages || [] };
}

// ===== Core Sync Function =====
// Main entry point — call this to pull Slack messages and create Activity records

export async function syncSlackMessages(
  userId: string
): Promise<SlackSyncResult> {
  const result: SlackSyncResult = {
    messagesProcessed: 0,
    newMessages: 0,
    updatedMessages: 0,
    districtMatches: 0,
    channelsProcessed: 0,
    errors: [],
  };

  // Step 1: Get the user's Slack integration and validate
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_service: { userId, service: "slack" } },
  });

  if (!integration) {
    result.errors.push("No Slack connection found");
    return result;
  }

  if (!integration.syncEnabled) {
    result.errors.push("Slack sync is disabled");
    return result;
  }

  // Step 2: Decrypt the access token
  let accessToken: string;
  try {
    accessToken = decrypt(integration.accessToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.userIntegration.update({
      where: { id: integration.id },
      data: { status: "error" },
    });
    result.errors.push(
      `Failed to decrypt Slack token: ${message} — user may need to reconnect`
    );
    return result;
  }

  // Step 3: Fetch joined channels
  const { channels, error: channelsError } =
    await fetchSlackChannels(accessToken);
  if (channelsError) {
    result.errors.push(
      `Slack conversations.list failed: ${channelsError}`
    );
    return result;
  }

  // Step 4: Load the user's territory plan districts for matching
  const territoryDistricts = await prisma.territoryPlanDistrict.findMany({
    where: { plan: { ownerId: userId } },
    include: { district: { select: { leaid: true, name: true } } },
  });

  const districtList: DistrictMatch[] = territoryDistricts.map((td) => ({
    leaid: td.district.leaid,
    name: td.district.name,
  }));

  // Deduplicate districts (user may have the same district across multiple plans)
  const seenLeaids = new Set<string>();
  const uniqueDistricts = districtList.filter((d) => {
    if (seenLeaids.has(d.leaid)) return false;
    seenLeaids.add(d.leaid);
    return true;
  });

  // Determine the "oldest" timestamp for fetching history
  // If lastSyncAt exists, use it for incremental sync; otherwise go back 90 days
  const oldestDate =
    integration.lastSyncAt ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const oldestTimestamp = String(oldestDate.getTime() / 1000);

  // Step 5: For each channel, fetch history and process messages
  for (const channel of channels) {
    result.channelsProcessed++;

    const { messages, error: historyError } = await fetchChannelHistory(
      accessToken,
      channel.id,
      oldestTimestamp
    );

    if (historyError) {
      result.errors.push(
        `Error fetching history for #${channel.name}: ${historyError}`
      );
      continue;
    }

    // Match this channel to a district
    const matchedDistrict = matchChannelToDistrict(
      channel.name,
      channel.topic?.value || "",
      uniqueDistricts
    );

    // Step 6: Process each message
    for (const message of messages) {
      result.messagesProcessed++;

      try {
        const messageDate = new Date(parseFloat(message.ts) * 1000);

        const activity = await prisma.activity.upsert({
          where: {
            slackChannelId_slackMessageTs: {
              slackChannelId: channel.id,
              slackMessageTs: message.ts,
            },
          },
          update: {},
          create: {
            type: "slack_message",
            title: truncateMessage(message.text, 100),
            source: "slack_sync",
            slackChannelId: channel.id,
            slackMessageTs: message.ts,
            integrationMeta: {
              channelName: channel.name,
              threadTs: message.thread_ts || null,
              permalink: null,
            },
            startDate: messageDate,
            status: "completed",
            createdByUserId: userId,
          },
        });

        // Determine if this was a new or updated record
        const isNew =
          Math.abs(
            activity.createdAt.getTime() - activity.updatedAt.getTime()
          ) < 1000;
        if (isNew) {
          result.newMessages++;
        } else {
          result.updatedMessages++;
        }

        // Create ActivityDistrict junction if a district matched
        if (matchedDistrict) {
          await prisma.activityDistrict.upsert({
            where: {
              activityId_districtLeaid: {
                activityId: activity.id,
                districtLeaid: matchedDistrict.leaid,
              },
            },
            update: {},
            create: {
              activityId: activity.id,
              districtLeaid: matchedDistrict.leaid,
            },
          });
          result.districtMatches++;
        }
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "Unknown error";
        result.errors.push(
          `Error processing message ${message.ts} in #${channel.name}: ${errMessage}`
        );
      }
    }
  }

  // Step 7: Update lastSyncAt
  await prisma.userIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return result;
}
