import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// DELETE /api/districts/[leaid]/watchers/[userId] — stop watching
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string; userId: string }> },
) {
  const { leaid, userId } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await prisma.$executeRaw`
    DELETE FROM district_watchers
    WHERE district_leaid = ${leaid} AND user_id = ${userId}::uuid
  `;
  return NextResponse.json({ removed: deleted });
}
