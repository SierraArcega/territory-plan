import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface SyncStateRow {
  key: string;
  value: string;
}

interface MaxSyncedRow {
  last_synced: Date | null;
  total: bigint;
}

// GET /api/admin/sync/health — Railway sync health status
export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const [syncStateRows, oppStats, sessionStats, unmatchedStats] =
      await Promise.all([
        prisma.$queryRaw<SyncStateRow[]>`SELECT key, value FROM sync_state`,
        prisma.$queryRaw<MaxSyncedRow[]>`SELECT MAX(synced_at) as last_synced, COUNT(*) as total FROM opportunities`,
        prisma.$queryRaw<MaxSyncedRow[]>`SELECT MAX(synced_at) as last_synced, COUNT(*) as total FROM sessions`,
        prisma.$queryRaw<MaxSyncedRow[]>`SELECT MAX(synced_at) as last_synced, COUNT(*) as total FROM unmatched_opportunities WHERE resolved = false`,
      ]);

    const syncState: Record<string, string> = {};
    for (const row of syncStateRows) {
      syncState[row.key] = row.value;
    }

    const lastSyncAt = syncState.last_synced_at || null;
    const hoursAgo = lastSyncAt
      ? (Date.now() - new Date(lastSyncAt).getTime()) / (1000 * 60 * 60)
      : null;

    let health: "green" | "yellow" | "red";
    if (hoursAgo === null) {
      health = "red";
    } else if (hoursAgo < 2) {
      health = "green";
    } else if (hoursAgo < 6) {
      health = "yellow";
    } else {
      health = "red";
    }

    return NextResponse.json({
      lastSyncAt,
      health,
      hoursAgo: hoursAgo !== null ? Math.round(hoursAgo * 10) / 10 : null,
      opportunities: {
        lastSynced: oppStats[0]?.last_synced ?? null,
        total: Number(oppStats[0]?.total ?? 0),
      },
      sessions: {
        lastSynced: sessionStats[0]?.last_synced ?? null,
        total: Number(sessionStats[0]?.total ?? 0),
      },
      unmatched: {
        lastSynced: unmatchedStats[0]?.last_synced ?? null,
        total: Number(unmatchedStats[0]?.total ?? 0),
      },
    });
  } catch (error) {
    console.error("Error fetching sync health:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync health" },
      { status: 500 }
    );
  }
}
