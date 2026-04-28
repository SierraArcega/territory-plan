import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/deals/events?from=ISO&to=ISO[&ownerId=...|all][&state=CA,NY]
//
// Returns deal-state-change events ("OPP_EVENTS") within the requested window
// for the redesigned Activities surface (Month strip, Week pinned row,
// Schedule Pipeline events section).
//
// Event kinds and their date sources:
//   created    — opportunity.createdAt falls inside [from, to]
//   closing    — opportunity.closeDate falls inside [from, to] AND the deal
//                is still open (stage is not Closed Won/Lost)
//   won        — stage_history entry transitions to "Closed Won" with
//                changed_at inside the window
//   lost       — stage_history entry transitions to "Closed Lost" with
//                changed_at inside the window
//   progressed — any other stage transition with changed_at inside the window;
//                the very first stage_history entry (initial state) is skipped
//                because the "created" event already covers that moment

const CLOSED_WON_RX = /closed[_ ]won/i;
const CLOSED_LOST_RX = /closed[_ ]lost/i;

// opportunity.created_at is unreliable for deals created before this date —
// the field was overwritten with bulk-import timestamps during migration, so
// pre-cutoff rows would all cluster on a few import days instead of their
// real creation dates. Suppress 'created' events for any opp whose createdAt
// falls before this cutoff.
const CREATED_EVENT_CUTOFF = new Date("2026-04-15T00:00:00Z");

function isClosedWon(stage: string | null) {
  return stage != null && CLOSED_WON_RX.test(stage);
}
function isClosedLost(stage: string | null) {
  return stage != null && CLOSED_LOST_RX.test(stage);
}

interface StageHistoryEntry {
  stage: string;
  changed_at: string;
}

function isStageHistoryEntry(v: unknown): v is StageHistoryEntry {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { stage?: unknown }).stage === "string" &&
    typeof (v as { changed_at?: unknown }).changed_at === "string"
  );
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

  // Resolve the rep being filtered to {id, email}. Newly-synced Salesforce
  // opps come in with sales_rep_email populated but sales_rep_id NULL — the
  // UUID backfill is async — so we OR-match on both columns to keep brand-new
  // deals visible in Your-pipeline scope.
  let targetUser: { id: string; email: string | null } | null = null;
  if (ownerParam === "all") {
    targetUser = null;
  } else if (!ownerParam || ownerParam === user.id) {
    targetUser = { id: user.id, email: user.email ?? null };
  } else {
    const profile = await prisma.userProfile.findFirst({
      where: { id: ownerParam },
      select: { id: true, email: true },
    });
    targetUser = profile
      ? { id: profile.id, email: profile.email }
      : { id: ownerParam, email: null };
  }

  const userFilter = targetUser
    ? targetUser.email
      ? {
          OR: [
            { salesRepId: targetUser.id },
            { salesRepEmail: targetUser.email },
          ],
        }
      : { salesRepId: targetUser.id }
    : {};

  // Stage 1 — find candidate opp IDs that could contribute an event in
  // [from, to]. Three orthogonal triggers: createdAt in window, closeDate in
  // window, or any stage_history entry whose changed_at is in window. We do
  // this in raw SQL because Prisma can't filter inside a JSON array of
  // {stage, changed_at}. Without this pre-filter we'd have to load every opp
  // for the rep and walk them all in JS — which both blows past any take
  // limit and silently drops recent rows when the team has more opps than
  // the cap (the bug this query exists to fix).
  const userSqlClause: Prisma.Sql = !targetUser
    ? Prisma.sql`TRUE`
    : targetUser.email
      ? Prisma.sql`(sales_rep_id = ${targetUser.id}::uuid OR sales_rep_email = ${targetUser.email})`
      : Prisma.sql`sales_rep_id = ${targetUser.id}::uuid`;

  const candidateRows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM opportunities
    WHERE ${userSqlClause}
      AND (
        (created_at >= ${from} AND created_at <= ${to})
        OR (close_date >= ${from} AND close_date <= ${to})
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(stage_history) h
          WHERE (h->>'changed_at')::timestamptz >= ${from}
            AND (h->>'changed_at')::timestamptz <= ${to}
        )
      )
    LIMIT 5000
  `);
  const candidateIds = candidateRows.map((r) => r.id);

  const opps =
    candidateIds.length === 0
      ? []
      : await prisma.opportunity.findMany({
          where: {
            id: { in: candidateIds },
            ...(stateAbbrevs.length > 0
              ? { district: { is: { stateAbbrev: { in: stateAbbrevs } } } }
              : {}),
          },
          select: {
            id: true,
            name: true,
            stage: true,
            createdAt: true,
            closeDate: true,
            netBookingAmount: true,
            districtLeaId: true,
            districtName: true,
            salesRepId: true,
            stageHistory: true,
          },
        });

  type OutEvent = {
    id: string;
    opportunityId: string;
    opportunityName: string | null;
    kind: "won" | "lost" | "created" | "progressed" | "closing";
    occurredAt: string;
    amount: number | null;
    stage: string | null;
    districtLeaid: string | null;
    districtName: string | null;
    salesRepId: string | null;
  };

  const events: OutEvent[] = [];

  for (const opp of opps) {
    const amount = opp.netBookingAmount ? Number(opp.netBookingAmount) : null;

    if (
      opp.createdAt &&
      opp.createdAt >= from &&
      opp.createdAt <= to &&
      opp.createdAt >= CREATED_EVENT_CUTOFF
    ) {
      events.push({
        id: `created:${opp.id}`,
        opportunityId: opp.id,
        opportunityName: opp.name,
        kind: "created",
        occurredAt: opp.createdAt.toISOString(),
        amount,
        stage: opp.stage,
        districtLeaid: opp.districtLeaId,
        districtName: opp.districtName,
        salesRepId: opp.salesRepId,
      });
    }

    if (
      opp.closeDate &&
      opp.closeDate >= from &&
      opp.closeDate <= to &&
      !isClosedWon(opp.stage) &&
      !isClosedLost(opp.stage)
    ) {
      // closeDate is conceptually a calendar date (Salesforce stores it as
      // midnight UTC). Pin occurredAt to noon UTC of the same calendar day
      // so the event lands on the intended date in any US timezone — raw
      // midnight UTC would drift to the previous day in PT/MT/CT/ET.
      const closeDay = opp.closeDate.toISOString().slice(0, 10);
      events.push({
        id: `closing:${opp.id}`,
        opportunityId: opp.id,
        opportunityName: opp.name,
        kind: "closing",
        occurredAt: `${closeDay}T12:00:00.000Z`,
        amount,
        stage: opp.stage,
        districtLeaid: opp.districtLeaId,
        districtName: opp.districtName,
        salesRepId: opp.salesRepId,
      });
    }

    const rawHist: unknown[] = Array.isArray(opp.stageHistory)
      ? (opp.stageHistory as unknown[])
      : [];
    const sorted = rawHist
      .filter(isStageHistoryEntry)
      .sort((a, b) => a.changed_at.localeCompare(b.changed_at));

    let prevStage: string | null = null;
    for (const h of sorted) {
      const t = new Date(h.changed_at);
      if (isNaN(t.getTime())) continue;

      if (t < from) {
        prevStage = h.stage;
        continue;
      }
      if (t > to) break;

      const curStage: string | null = h.stage;

      // The first-ever entry is the deal's initial stage, not a transition.
      if (prevStage === null) {
        prevStage = curStage;
        continue;
      }

      if (curStage === prevStage) {
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
        events.push({
          id: `${kind}:${opp.id}:${h.changed_at}`,
          opportunityId: opp.id,
          opportunityName: opp.name,
          kind,
          occurredAt: t.toISOString(),
          amount,
          stage: curStage,
          districtLeaid: opp.districtLeaId,
          districtName: opp.districtName,
          salesRepId: opp.salesRepId,
        });
      }
      prevStage = curStage;
    }
  }

  // Reps often correct stage assignments mid-day, so a single opp can have
  // many stage_history entries on the same day. Surfacing each as its own
  // event spams the calendar; keep only the latest progressed event per
  // (opportunity, day). Won/lost/created/closing are one-per-deal already.
  const latestProgressedByOppDay = new Map<string, OutEvent>();
  const deduped: OutEvent[] = [];
  for (const e of events) {
    if (e.kind !== "progressed") {
      deduped.push(e);
      continue;
    }
    const day = e.occurredAt.slice(0, 10);
    const key = `${e.opportunityId}:${day}`;
    const existing = latestProgressedByOppDay.get(key);
    if (!existing || existing.occurredAt < e.occurredAt) {
      latestProgressedByOppDay.set(key, e);
    }
  }
  for (const e of latestProgressedByOppDay.values()) deduped.push(e);

  deduped.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const sliced = deduped.slice(0, 500);

  return NextResponse.json({
    events: sliced,
    total: sliced.length,
  });
}
