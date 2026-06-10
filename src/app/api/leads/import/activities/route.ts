import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isServiceError } from "@/features/shared/lib/service-error";
import {
  MAX_IMPORT_ROWS,
  resolveActivityRows,
  summarizeActivityResolutions,
  applyActivityImport,
  type ActivityImportRow,
} from "@/features/leads/lib/server/lead-import";

export const dynamic = "force-dynamic";

// POST /api/leads/import/activities — bulk-import engagement activity rows
// (client-parsed CSV as JSON, ≤500/batch). Per row: contact matched by email
// (duplicates → most recent + warning), school resolved by NCES (graceful when
// unresolved), district from the school's leaid (stub created when missing).
// Rows whose contact has an active lead increment that lead's score; the rest
// are retained on the records only. `?dryRun=1` returns the resolution plan
// without writing; dry and wet runs share one resolution code path.
//
// Summary feeds the toast: "N events imported · X to active leads · Y retained
// on records".
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
    const rows = body.rows as ActivityImportRow[];

    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "1";

    const resolutions = await resolveActivityRows(rows);
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        rows: resolutions,
        summary: summarizeActivityResolutions(resolutions),
      });
    }

    const result = await applyActivityImport(rows, resolutions, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (isServiceError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error importing lead activities:", error);
    return NextResponse.json({ error: "Failed to import activities" }, { status: 500 });
  }
}
