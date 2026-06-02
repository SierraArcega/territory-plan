import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface WatcherRow {
  user_id: string;
  added_at: Date;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

function serialize(r: WatcherRow) {
  return {
    userId: r.user_id,
    addedAt: r.added_at.toISOString(),
    user: { id: r.user_id, fullName: r.full_name, email: r.email, avatarUrl: r.avatar_url },
  };
}

// GET /api/districts/[leaid]/watchers — list watchers
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<WatcherRow[]>`
    SELECT dw.user_id, dw.added_at, up.full_name, up.email, up.avatar_url
    FROM district_watchers dw
    JOIN user_profiles up ON up.id = dw.user_id
    WHERE dw.district_leaid = ${leaid}
    ORDER BY up.full_name NULLS LAST, dw.added_at
  `;
  return NextResponse.json({ watchers: rows.map(serialize) });
}

// POST /api/districts/[leaid]/watchers — add a watcher.
// Body: { userId? } (defaults to the current user, i.e. "watch this district").
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const userId: string = body?.userId ?? user.id;

  const district = await prisma.district.findUnique({ where: { leaid }, select: { leaid: true } });
  if (!district) return NextResponse.json({ error: "District not found" }, { status: 404 });

  await prisma.$executeRaw`
    INSERT INTO district_watchers (district_leaid, user_id)
    VALUES (${leaid}, ${userId}::uuid)
    ON CONFLICT (district_leaid, user_id) DO NOTHING
  `;

  const rows = await prisma.$queryRaw<WatcherRow[]>`
    SELECT dw.user_id, dw.added_at, up.full_name, up.email, up.avatar_url
    FROM district_watchers dw
    JOIN user_profiles up ON up.id = dw.user_id
    WHERE dw.district_leaid = ${leaid} AND dw.user_id = ${userId}::uuid
  `;
  return NextResponse.json({ watcher: rows[0] ? serialize(rows[0]) : null }, { status: 201 });
}
