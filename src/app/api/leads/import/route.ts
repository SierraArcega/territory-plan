import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import {
  MAX_IMPORT_ROWS,
  resolveLeadRows,
  summarizeLeadResolutions,
  applyLeadImport,
  type LeadImportRow,
} from "@/features/leads/lib/server/lead-import";

export const dynamic = "force-dynamic";

// POST /api/leads/import — bulk-create leads from client-parsed CSV rows
// (JSON, ≤500/batch). `?dryRun=1` returns the full resolution plan (per-row
// contact/school/district resolution with willCreate + viaNces flags) WITHOUT
// writing — the wet run consumes the same resolution code path.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { rows?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "invalid_rows" }, { status: 400 });
    }
    if (body.rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: "too_many_rows", max: MAX_IMPORT_ROWS },
        { status: 400 },
      );
    }
    const rows = body.rows as LeadImportRow[];

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "1";

    const resolutions = await resolveLeadRows(rows, user.id);
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        rows: resolutions,
        summary: summarizeLeadResolutions(resolutions),
      });
    }

    const result = await applyLeadImport(rows, resolutions, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error importing leads:", error);
    return NextResponse.json({ error: "Failed to import leads" }, { status: 500 });
  }
}
