import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    searchParams.get("secret");

  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.reportDraft.deleteMany({
    where: { lastTouchedAt: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: count });
}
