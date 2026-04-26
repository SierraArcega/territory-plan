import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { executeQuery } from "@/features/reports/lib/execute-query";
import type { QueryParams } from "@/features/reports/lib/types";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function parseId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// POST /api/ai/query/reports/[id]/run — replay a saved report's params
// against the readonly pool. No Claude call. Updates lastRunAt + runCount.
export async function POST(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: idRaw } = await params;
  const id = parseId(idRaw);
  if (id === null) {
    return NextResponse.json({ error: "Invalid report id" }, { status: 400 });
  }

  const report = await prisma.savedReport.findUnique({
    where: { id },
    select: { id: true, title: true, params: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!report.params) {
    return NextResponse.json(
      { error: "This report has no saved params to replay" },
      { status: 409 },
    );
  }

  const outcome = await executeQuery({
    params: report.params as unknown as QueryParams,
    userId: user.id,
    question: `[saved report] ${report.title}`,
  });

  switch (outcome.kind) {
    case "ok":
      // Bookkeeping on success — non-blocking.
      void prisma.savedReport
        .update({
          where: { id },
          data: { lastRunAt: new Date(), runCount: { increment: 1 } },
        })
        .catch(() => undefined);
      return NextResponse.json(outcome.result);
    case "invalid_params":
      return NextResponse.json(
        {
          error:
            "This saved report's params no longer match the current schema. Open the report, edit the builder, and re-save.",
          details: outcome.errors,
        },
        { status: 409 },
      );
    case "error":
      return NextResponse.json(
        { error: outcome.message, details: outcome.details },
        { status: outcome.status },
      );
  }
}
