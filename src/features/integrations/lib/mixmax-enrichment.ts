// Mixmax Enrichment Engine
// Post-processing step that runs after Gmail sync.
// Fetches Mixmax sequence data and annotates matching Activity records.
//
// Flow: look up Mixmax integration → decrypt API key →
// fetch active sequences → fetch recipients per sequence →
// match recipient emails against Activity contacts → update Activity with mixmax fields

import prisma from "@/lib/prisma";
import { decrypt } from "@/features/integrations/lib/encryption";

// ===== Types =====

export interface MixmaxEnrichmentResult {
  enriched: number;
  errors: string[];
}

interface MixmaxSequence {
  _id: string;
  name: string;
  stages?: unknown[];
}

interface MixmaxRecipient {
  contact: { email: string };
  currentStage: number;
  status: string;
  metrics?: { opens?: number; clicks?: number };
}

// ===== Mixmax API Helpers =====

const MIXMAX_BASE_URL = "https://api.mixmax.com/v1";

async function fetchMixmaxSequences(apiKey: string): Promise<MixmaxSequence[]> {
  const response = await fetch(`${MIXMAX_BASE_URL}/sequences?archived=false`, {
    headers: {
      "X-API-Token": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Mixmax sequences API returned ${response.status}`
    );
  }

  const data = await response.json();
  return (data.results ?? data) as MixmaxSequence[];
}

async function fetchMixmaxRecipients(
  apiKey: string,
  sequenceId: string
): Promise<MixmaxRecipient[]> {
  const response = await fetch(
    `${MIXMAX_BASE_URL}/sequences/${sequenceId}/recipients`,
    {
      headers: {
        "X-API-Token": apiKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Mixmax recipients API returned ${response.status} for sequence ${sequenceId}`
    );
  }

  const data = await response.json();
  return (data.results ?? data) as MixmaxRecipient[];
}

// ===== Core Enrichment Function =====
// Call this after Gmail sync to annotate Activities with Mixmax sequence data

export async function enrichActivitiesWithMixmax(
  userId: string,
  gmailMessageIds: string[]
): Promise<MixmaxEnrichmentResult> {
  const result: MixmaxEnrichmentResult = { enriched: 0, errors: [] };

  // Step 1: Look up the user's Mixmax integration
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_service: { userId, service: "mixmax" } },
  });

  // No Mixmax integration — not an error, just skip
  if (!integration) {
    return result;
  }

  // Step 2: Bail out early if there are no message IDs to process
  if (gmailMessageIds.length === 0) {
    return result;
  }

  // Step 3: Decrypt the API key
  const apiKey = decrypt(integration.accessToken);

  // Step 4: Load the Activities (with their linked contacts) for the synced messages
  const activities = await prisma.activity.findMany({
    where: { gmailMessageId: { in: gmailMessageIds } },
    select: {
      id: true,
      gmailMessageId: true,
      contacts: {
        select: {
          contact: { select: { email: true } },
        },
      },
    },
  });

  if (activities.length === 0) {
    return result;
  }

  // Build a lookup: contact email (lowercase) → activity id
  // An activity may have multiple contacts; we map each email to the activity.
  const emailToActivity = new Map<string, (typeof activities)[number]>();
  for (const activity of activities) {
    for (const link of activity.contacts) {
      if (link.contact.email) {
        emailToActivity.set(link.contact.email.toLowerCase(), activity);
      }
    }
  }

  // Step 5: Fetch active sequences from Mixmax
  let sequences: MixmaxSequence[];
  try {
    sequences = await fetchMixmaxSequences(apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch Mixmax sequences: ${message}`);
    return result;
  }

  // Step 6: For each sequence, fetch recipients and match against contacts
  for (const sequence of sequences) {
    let recipients: MixmaxRecipient[];
    try {
      recipients = await fetchMixmaxRecipients(apiKey, sequence._id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(
        `Failed to fetch recipients for sequence ${sequence._id}: ${message}`
      );
      continue;
    }

    for (const recipient of recipients) {
      const email = recipient.contact?.email?.toLowerCase();
      if (!email) continue;

      const activity = emailToActivity.get(email);
      if (!activity) continue;

      // Match found — annotate the Activity with Mixmax sequence data
      try {
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            mixmaxSequenceName: sequence.name,
            mixmaxSequenceStep: recipient.currentStage,
            mixmaxSequenceTotal: sequence.stages?.length ?? 0,
            mixmaxStatus: recipient.status,
            mixmaxOpenCount: recipient.metrics?.opens ?? null,
            mixmaxClickCount: recipient.metrics?.clicks ?? null,
          },
        });
        result.enriched++;

        // Remove from map so we don't double-count if another sequence also matches
        emailToActivity.delete(email);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `Failed to update activity ${activity.id} with Mixmax data: ${message}`
        );
      }
    }
  }

  return result;
}
