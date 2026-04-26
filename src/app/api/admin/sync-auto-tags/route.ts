import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import {
  ensureAutoTagsExist,
  syncAllMissingRenewalOppTags,
} from "@/features/shared/lib/auto-tags";

export const dynamic = "force-dynamic";

// POST /api/admin/sync-auto-tags
// Recomputes the "Missing Renewal Opp" tag across all districts. Idempotent.
// No new mutations — safe to run from the admin console or a cron.
export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureAutoTagsExist();
    const tagged = await syncAllMissingRenewalOppTags();
    return NextResponse.json({ tagged });
  } catch (error) {
    console.error("Error syncing auto-tags:", error);
    return NextResponse.json(
      { error: "Failed to sync auto-tags" },
      { status: 500 },
    );
  }
}
