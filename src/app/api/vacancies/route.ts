import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const VALID_STATUSES = ["open", "closed", "expired"] as const;

/**
 * GET /api/vacancies
 *
 * District-scoped vacancy list for the Saved Views vacancies tab + list
 * builder. Filters:
 *   ?leaid=          — single district
 *   ?leaids=a,b,c    — multiple districts (preferred for plan/list scopes)
 *   ?status=         — one of open / closed / expired (default: open)
 *   ?fullmindRelevant=1 — filter to fullmind_relevant only
 *   ?category=       — exact category match
 *   ?limit=N         — default 50, max 200
 *   ?cursor=         — opaque cursor (last_seen_at, id) for pagination
 *
 * One of leaid or leaids MUST be supplied — this endpoint is intentionally
 * NOT a global vacancy dump.
 */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const leaid = sp.get("leaid");
  const leaidsStr = sp.get("leaids");
  const leaids = leaidsStr ? leaidsStr.split(",").map((s) => s.trim()).filter(Boolean) : null;

  if (!leaid && (!leaids || leaids.length === 0)) {
    return NextResponse.json(
      { error: "One of leaid or leaids is required" },
      { status: 400 },
    );
  }

  const status = sp.get("status");
  if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const fullmindRelevant = sp.get("fullmindRelevant") === "1";
  const category = sp.get("category");

  const limitArg = parseInt(sp.get("limit") || String(DEFAULT_LIMIT), 10);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitArg) ? limitArg : DEFAULT_LIMIT));

  const where: Prisma.VacancyWhereInput = {};
  if (leaid) where.leaid = leaid;
  else if (leaids) where.leaid = { in: leaids };
  if (status) where.status = status;
  else where.status = "open"; // default
  if (fullmindRelevant) where.fullmindRelevant = true;
  if (category) where.category = category;

  const vacancies = await prisma.vacancy.findMany({
    where,
    orderBy: [{ datePosted: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      district: { select: { leaid: true, name: true, stateAbbrev: true } },
      school: { select: { ncessch: true, schoolName: true } },
    },
  });

  return NextResponse.json({
    vacancies: vacancies.map((v) => ({
      id: v.id,
      leaid: v.leaid,
      districtName: v.district?.name ?? null,
      stateAbbrev: v.district?.stateAbbrev ?? null,
      status: v.status,
      title: v.title,
      category: v.category,
      schoolNcessch: v.schoolNcessch,
      schoolName: v.school?.schoolName ?? v.schoolName,
      hiringManager: v.hiringManager,
      hiringEmail: v.hiringEmail,
      contactId: v.contactId,
      startDate: v.startDate,
      datePosted: v.datePosted?.toISOString() ?? null,
      fullmindRelevant: v.fullmindRelevant,
      relevanceReason: v.relevanceReason,
      sourceUrl: v.sourceUrl,
      firstSeenAt: v.firstSeenAt.toISOString(),
      lastSeenAt: v.lastSeenAt.toISOString(),
    })),
  });
}
