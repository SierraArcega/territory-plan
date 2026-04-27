import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/deals/open[?ownerId=...|all][&state=CA,NY][&limit=N]
//
// Returns currently-open opportunities for the redesigned Activities surface
// (Upcoming rail "Open deals" sub-section, OppDrawer, OverdueDealRow). Open
// is defined as "stage is set and is not Closed Won/Lost"; null/empty stages
// are excluded so we don't surface stale syncing artifacts.

const CLOSED_RX = /closed[_ ](won|lost)/i;

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ownerParam = searchParams.get("ownerId"); // "all" | userId | null (defaults to current)
  const stateAbbrevs = (searchParams.get("state") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200", 10) || 200, 1000);

  const ownerWhere =
    ownerParam === "all"
      ? {}
      : ownerParam
      ? { salesRepId: ownerParam }
      : { salesRepId: user.id };

  const opps = await prisma.opportunity.findMany({
    where: {
      ...ownerWhere,
      stage: { not: null },
      ...(stateAbbrevs.length > 0
        ? { district: { is: { stateAbbrev: { in: stateAbbrevs } } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      stage: true,
      netBookingAmount: true,
      closeDate: true,
      districtLeaId: true,
      districtName: true,
      salesRepId: true,
    },
    orderBy: [{ closeDate: { sort: "asc", nulls: "last" } }],
    take: limit * 2, // overshoot then trim after closed-stage filter
  });

  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  const open = opps
    .filter((o) => !(o.stage && CLOSED_RX.test(o.stage)))
    .slice(0, limit)
    .map((o) => {
      const daysToClose =
        o.closeDate != null
          ? Math.round((o.closeDate.getTime() - now) / ONE_DAY_MS)
          : null;
      return {
        id: o.id,
        name: o.name,
        stage: o.stage,
        amount: o.netBookingAmount ? Number(o.netBookingAmount) : null,
        closeDate: o.closeDate?.toISOString() ?? null,
        districtLeaid: o.districtLeaId,
        districtName: o.districtName,
        salesRepId: o.salesRepId,
        daysToClose,
      };
    });

  return NextResponse.json({
    deals: open,
    total: open.length,
  });
}
