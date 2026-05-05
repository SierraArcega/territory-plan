import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ agencyKey: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { agencyKey: agencyKeyStr } = await params;
  const agencyKey = Number(agencyKeyStr);
  if (!Number.isInteger(agencyKey) || agencyKey <= 0) {
    return NextResponse.json({ error: "agencyKey must be a positive integer" }, { status: 400 });
  }

  const cascadedCount = await prisma.$transaction(async (tx) => {
    await tx.agencyDistrictMap.delete({ where: { agencyKey } }).catch(() => null);
    const r = await tx.rfp.updateMany({
      where: { agencyKey },
      data: { leaid: null },
    });
    return r.count;
  });

  return NextResponse.json({ removedRfpLeaidCount: cascadedCount });
}
