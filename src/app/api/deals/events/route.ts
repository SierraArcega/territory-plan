import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/deals/events?from=ISO&to=ISO[&ownerId=...|all][&state=CA,NY]
//
// Returns deal-state-change events ("OPP_EVENTS") within the requested window
// for the redesigned Activities surface (Month strip, Week pinned row,
// Schedule Pipeline events section).
//
// Event kinds:
//   created   — opportunity.createdAt falls inside [from, to]
//   won       — opportunity transitioned to a "Closed Won" stage in window
//   lost      — opportunity transitioned to a "Closed Lost" stage in window
//   progressed— stage changed between two snapshots in window, neither closed
//
// Strategy: opportunity_snapshots is a once-per-week capture, so we approximate
// a state-change feed by diffing the most-recent-before-window snapshot
// against snapshots inside the window. Wave 6 may refine this against
// stage_history when it lands; the response shape stays stable.

const CLOSED_WON_RX = /closed[_ ]won/i;
const CLOSED_LOST_RX = /closed[_ ]lost/i;

function isClosedWon(stage: string | null) {
  return stage != null && CLOSED_WON_RX.test(stage);
}
function isClosedLost(stage: string | null) {
  return stage != null && CLOSED_LOST_RX.test(stage);
}

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fromRaw = searchParams.get("from");
  const toRaw = searchParams.get("to");
  if (!fromRaw || !toRaw) {
    return NextResponse.json(
      { error: "from and to query params required (ISO date strings)" },
      { status: 400 }
    );
  }
  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return NextResponse.json({ error: "from/to must be valid ISO dates" }, { status: 400 });
  }

  const ownerParam = searchParams.get("ownerId"); // "all" | userId | null (defaults to current)
  const stateAbbrevs = (searchParams.get("state") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Derive the salesRep filter — opportunities are linked to reps by uuid.
  let salesRepFilter: { in: string[] } | string | null = null;
  if (ownerParam === "all") {
    salesRepFilter = null;
  } else if (ownerParam) {
    salesRepFilter = ownerParam;
  } else {
    salesRepFilter = user.id;
  }

  // ---------- "created" events: opportunity.createdAt inside window ----------
  const createdOpps = await prisma.opportunity.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(salesRepFilter && typeof salesRepFilter === "string"
        ? { salesRepId: salesRepFilter }
        : {}),
      ...(stateAbbrevs.length > 0
        ? { district: { is: { stateAbbrev: { in: stateAbbrevs } } } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      stage: true,
      createdAt: true,
      netBookingAmount: true,
      districtLeaId: true,
      districtName: true,
      salesRepId: true,
    },
    take: 500,
  });

  // ---------- snapshot-diff events ----------
  // Pull all snapshots inside the window plus, per opp, the most recent
  // snapshot strictly before the window. The "before" snapshot anchors the
  // diff so we can tell what changed.
  const snapsInWindow = await prisma.opportunitySnapshot.findMany({
    where: {
      snapshotDate: { gte: from, lte: to },
      ...(salesRepFilter && typeof salesRepFilter === "string"
        ? { salesRepId: salesRepFilter }
        : {}),
    },
    select: {
      opportunityId: true,
      stage: true,
      capturedAt: true,
      snapshotDate: true,
      netBookingAmount: true,
      salesRepId: true,
      districtLeaId: true,
    },
    orderBy: { capturedAt: "asc" },
  });

  const oppIds = [...new Set(snapsInWindow.map((s) => s.opportunityId))];

  // Latest snapshot strictly before the window for each opp — anchors the
  // diff. N findFirst queries is fine for typical opp counts; if this grows
  // hot, swap for a single DISTINCT ON raw query.
  type PriorRow = { opportunityId: string; stage: string | null };
  const priorRows: PriorRow[] = oppIds.length
    ? await Promise.all(
        oppIds.map(async (oppId) => {
          const prior = await prisma.opportunitySnapshot.findFirst({
            where: { opportunityId: oppId, snapshotDate: { lt: from } },
            orderBy: { snapshotDate: "desc" },
            select: { opportunityId: true, stage: true },
          });
          return prior ?? { opportunityId: oppId, stage: null };
        })
      )
    : [];
  const priorByOpp = new Map(priorRows.map((p) => [p.opportunityId, p.stage]));

  // Also need opp-level metadata (name, district, etc.) for the response.
  const oppMeta = oppIds.length
    ? await prisma.opportunity.findMany({
        where: { id: { in: oppIds } },
        select: {
          id: true,
          name: true,
          districtLeaId: true,
          districtName: true,
          district: { select: { stateAbbrev: true } },
        },
      })
    : [];
  const oppMetaById = new Map(oppMeta.map((o) => [o.id, o]));

  type OutEvent = {
    id: string;
    opportunityId: string;
    opportunityName: string | null;
    kind: "won" | "lost" | "created" | "progressed";
    occurredAt: string;
    amount: number | null;
    stage: string | null;
    districtLeaid: string | null;
    districtName: string | null;
    salesRepId: string | null;
  };

  const events: OutEvent[] = [];

  // Created events — state filter is already applied by the createdOpps query.
  for (const opp of createdOpps) {
    events.push({
      id: `created:${opp.id}`,
      opportunityId: opp.id,
      opportunityName: opp.name,
      kind: "created",
      occurredAt: opp.createdAt!.toISOString(),
      amount: opp.netBookingAmount ? Number(opp.netBookingAmount) : null,
      stage: opp.stage,
      districtLeaid: opp.districtLeaId,
      districtName: opp.districtName,
      salesRepId: opp.salesRepId,
    });
  }

  // Snapshot-diff events — compare prior stage against each in-window snapshot
  // for the same opp, in chronological order. First detected transition wins;
  // we don't currently emit multiple progress steps inside one window.
  const snapsByOpp = new Map<string, typeof snapsInWindow>();
  for (const s of snapsInWindow) {
    const arr = snapsByOpp.get(s.opportunityId) ?? [];
    arr.push(s);
    snapsByOpp.set(s.opportunityId, arr);
  }

  for (const [oppId, snaps] of snapsByOpp.entries()) {
    const meta = oppMetaById.get(oppId);
    if (
      stateAbbrevs.length > 0 &&
      meta?.district?.stateAbbrev &&
      !stateAbbrevs.includes(meta.district.stateAbbrev)
    ) {
      continue;
    }

    let prevStage = priorByOpp.get(oppId) ?? null;
    let emitted: OutEvent | null = null;

    for (const snap of snaps) {
      const curStage = snap.stage;
      const stageChanged = (prevStage ?? null) !== (curStage ?? null);

      if (!stageChanged) {
        prevStage = curStage;
        continue;
      }

      let kind: OutEvent["kind"] | null = null;
      if (isClosedWon(curStage) && !isClosedWon(prevStage)) {
        kind = "won";
      } else if (isClosedLost(curStage) && !isClosedLost(prevStage)) {
        kind = "lost";
      } else if (!isClosedWon(curStage) && !isClosedLost(curStage)) {
        kind = "progressed";
      }

      if (kind) {
        emitted = {
          id: `${kind}:${oppId}:${snap.snapshotDate.toISOString().slice(0, 10)}`,
          opportunityId: oppId,
          opportunityName: meta?.name ?? null,
          kind,
          occurredAt: snap.capturedAt.toISOString(),
          amount: snap.netBookingAmount ? Number(snap.netBookingAmount) : null,
          stage: curStage,
          districtLeaid: snap.districtLeaId ?? meta?.districtLeaId ?? null,
          districtName: meta?.districtName ?? null,
          salesRepId: snap.salesRepId,
        };
        // Won/Lost are terminal — stop scanning. Progressed keeps scanning so
        // a later won/lost in the same window still surfaces.
        if (kind === "won" || kind === "lost") break;
      }
      prevStage = curStage;
    }

    if (emitted) events.push(emitted);
  }

  // Sort by time, newest first. Cap to 500.
  events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const sliced = events.slice(0, 500);

  return NextResponse.json({
    events: sliced,
    total: sliced.length,
  });
}
