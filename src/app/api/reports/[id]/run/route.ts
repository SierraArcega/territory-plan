import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const report = await prisma.savedReport.findUnique({ where: { id: Number(id) } });
  if (!report || report.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!report.sql) {
    return NextResponse.json({ error: "Report has no SQL" }, { status: 400 });
  }

  const startedAt = Date.now();
  try {
    const res = await readonlyPool.query(report.sql);
    await prisma.savedReport.update({
      where: { id: report.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });
    return NextResponse.json({
      summary: report.summary,
      columns: res.fields?.map((f: { name: string }) => f.name) ?? [],
      rows: res.rows ?? [],
      rowCount: res.rowCount ?? 0,
      executionTimeMs: Date.now() - startedAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
