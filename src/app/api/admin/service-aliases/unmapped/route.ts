import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAdminUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UnmappedRow = {
  alias: string;
  sources: string;
  row_count: number;
  last_seen: Date | null;
};

// GET /api/admin/service-aliases/unmapped — drift list of alias strings
// present in synced sessions/subscriptions that have no service_aliases row yet.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const rows = await prisma.$queryRaw<UnmappedRow[]>`
    SELECT alias, sources, row_count, last_seen
    FROM "unmapped_service_aliases"
  `;

  return NextResponse.json({
    rows: rows.map((r) => ({
      alias: r.alias,
      sources: r.sources,
      rowCount: Number(r.row_count),
      lastSeen: r.last_seen?.toISOString() ?? null,
    })),
  });
}
