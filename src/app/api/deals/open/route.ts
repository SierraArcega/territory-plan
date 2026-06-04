import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { getOpenDeals } from "@/features/deals/lib/open-deals";

export const dynamic = "force-dynamic";

// GET /api/deals/open[?ownerId=...|all][&state=CA,NY][&limit=N]
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ownerParam = searchParams.get("ownerId");
  const stateAbbrevs = (searchParams.get("state") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const limit = parseInt(searchParams.get("limit") ?? "200", 10) || 200;

  const deals = await getOpenDeals(prisma, {
    ownerId: ownerParam === "all" ? "all" : ownerParam || user.id,
    stateAbbrevs,
    limit,
  });
  return NextResponse.json({ deals, total: deals.length });
}
