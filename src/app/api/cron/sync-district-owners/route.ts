import { NextRequest, NextResponse } from "next/server";
import { syncDistrictOwners } from "@/lib/district-owner-sync";
import { syncDistrictCollaborators } from "@/lib/district-collaborator-sync";

export const dynamic = "force-dynamic";

// GET /api/cron/sync-district-owners
// Fills district owners from live opp pipeline (fill-empty-only), then
// reconciles auto-collaborators. Scheduled hourly, after the external Railway
// opp sync. See district-owner-sync.ts and district-collaborator-sync.ts.
export async function GET(request: NextRequest) {
  const CRON_SECRET = process.env.CRON_SECRET;
  const { searchParams } = new URL(request.url);
  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    searchParams.get("secret");

  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Owners first so collaborator exclusion sees fresh owners.
  const { filled, districts } = await syncDistrictOwners();
  const collaborators = await syncDistrictCollaborators();

  return NextResponse.json({ filled, districts, collaborators });
}
