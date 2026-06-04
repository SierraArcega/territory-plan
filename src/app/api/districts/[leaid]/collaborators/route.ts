import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface MemberRow {
  user_id: string;
  source: string;
  added_at: Date;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

function serialize(r: MemberRow) {
  return {
    userId: r.user_id,
    source: r.source,
    addedAt: r.added_at.toISOString(),
    user: { id: r.user_id, fullName: r.full_name, email: r.email, avatarUrl: r.avatar_url },
  };
}

// GET /api/districts/[leaid]/collaborators — list collaborators (auto + manual)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  const { leaid } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRaw<MemberRow[]>`
    SELECT dc.user_id, dc.source, dc.added_at, up.full_name, up.email, up.avatar_url
    FROM district_collaborators dc
    JOIN user_profiles up ON up.id = dc.user_id
    WHERE dc.district_leaid = ${leaid}
    ORDER BY up.full_name NULLS LAST, dc.added_at
  `;
  return NextResponse.json({ collaborators: rows.map(serialize) });
}

// POST /api/districts/[leaid]/collaborators — add a manual collaborator.
// Body: { userId? } (defaults to the current user). Upgrades an existing auto
// row to source='manual' so the sync won't remove it.
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
    INSERT INTO district_collaborators (district_leaid, user_id, source)
    VALUES (${leaid}, ${userId}::uuid, 'manual')
    ON CONFLICT (district_leaid, user_id) DO UPDATE SET source = 'manual'
  `;

  const rows = await prisma.$queryRaw<MemberRow[]>`
    SELECT dc.user_id, dc.source, dc.added_at, up.full_name, up.email, up.avatar_url
    FROM district_collaborators dc
    JOIN user_profiles up ON up.id = dc.user_id
    WHERE dc.district_leaid = ${leaid} AND dc.user_id = ${userId}::uuid
  `;
  return NextResponse.json({ collaborator: rows[0] ? serialize(rows[0]) : null }, { status: 201 });
}
