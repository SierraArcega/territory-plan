/**
 * GET /api/signals
 *
 * Signals summary — one row per in-scope district with per-type counts
 * (vacancies / news / RFPs) and the newest signal date across those types.
 *
 * Feeds the district-grouped accordion tree of the Signals view. Returns the
 * FULL set of in-scope districts (no server pagination) so the client can
 * search/filter the whole list locally; the per-district item rows are fetched
 * lazily from `GET /api/signals/[leaid]`.
 *
 * Query params:
 *   planId  — territory plan id; resolves leaids from territory_plan_districts.
 *   leaids  — CSV of leaids (list / explicit scope). One of planId|leaids REQUIRED.
 *   types   — CSV subset of vac,news,rfp (default all). Off types are omitted
 *             from counts + newest entirely.
 *   since   — 7d | 30d | 90d | all (default 30d). Lower bound on each source's
 *             chronological date.
 *
 * Response: { districts: SignalSummaryDistrict[], total }
 *   - districts sorted by newestSignalAt DESC NULLS LAST, then name ASC.
 *   - 0-signal in-scope districts still appear (zeroed counts, null newest).
 *
 * Mirrors /api/views/data: auth-guarded, raw parameterized SQL over the
 * readonly pool, camelCased response.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import prisma from "@/lib/prisma";
import {
  parseTypes,
  parseWindow,
  sinceCutoff,
  DATE_EXPR,
  NEWS_CONFIDENCE_LEVELS,
} from "@/lib/signals/sql";

export const dynamic = "force-dynamic";

interface SignalCounts {
  vac: number;
  news: number;
  rfp: number;
}

interface SignalSummaryDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  counts: SignalCounts;
  newestSignalAt: string | null;
}

/** Per-source grouped rollup row shape. */
interface RollupRow {
  leaid: string;
  cnt: string | number | bigint;
  newest: Date | null;
}

interface DistrictRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
}

export async function GET(req: NextRequest) {
  // 1. Auth — always first.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  // 2. Resolve scope leaids from planId OR leaids CSV (one required).
  const planId = searchParams.get("planId");
  const leaidsParam = searchParams.get("leaids");

  let leaids: string[];
  if (planId) {
    const rows = await prisma.territoryPlanDistrict.findMany({
      where: { planId },
      select: { districtLeaid: true },
    });
    leaids = rows.map((r) => r.districtLeaid);
  } else if (leaidsParam !== null) {
    leaids = leaidsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    return NextResponse.json(
      { error: "Missing scope: provide planId or leaids." },
      { status: 400 },
    );
  }

  // Empty scope → empty result (no district to enumerate).
  if (leaids.length === 0) {
    return NextResponse.json({ districts: [], total: 0 }, { status: 200 });
  }

  // 3. Parse type mask + time window.
  const types = parseTypes(searchParams.get("types"));
  const window = parseWindow(searchParams.get("since"));
  const cutoff = sinceCutoff(window);

  // 4. Build the per-source rollups + district base in parallel.
  //    Each rollup: COUNT(*) + MAX(date) grouped by leaid, scoped by
  //    leaid = ANY($1) and the optional since cutoff. Off types are skipped.
  type Query = Promise<{ rows: RollupRow[] }>;
  const emptyRollup: Query = Promise.resolve({ rows: [] });

  // Vacancies — district key `leaid`, date = COALESCE(date_posted, first_seen_at).
  const vacQuery: Query = types.vac
    ? runRollup(
        `SELECT leaid, COUNT(*) AS cnt, MAX(${DATE_EXPR.vac("v")}) AS newest
         FROM vacancies v
         WHERE leaid = ANY($1)${cutoff ? ` AND ${DATE_EXPR.vac("v")} >= $2` : ""}
         GROUP BY leaid`,
        cutoff ? [leaids, cutoff] : [leaids],
      )
    : emptyRollup;

  // News — district key via news_article_districts.leaid + confidence filter,
  // date = published_at on the joined article.
  const newsQuery: Query = types.news
    ? runRollup(
        `SELECT nad.leaid AS leaid, COUNT(*) AS cnt, MAX(${DATE_EXPR.news("n")}) AS newest
         FROM news_article_districts nad
         JOIN news_articles n ON n.id = nad.article_id
         WHERE nad.leaid = ANY($1)
           AND nad.confidence = ANY($2)${cutoff ? ` AND ${DATE_EXPR.news("n")} >= $3` : ""}
         GROUP BY nad.leaid`,
        cutoff
          ? [leaids, NEWS_CONFIDENCE_LEVELS, cutoff]
          : [leaids, NEWS_CONFIDENCE_LEVELS],
      )
    : emptyRollup;

  // RFPs — district key `leaid` (NULLs excluded by = ANY), date = captured_date.
  const rfpQuery: Query = types.rfp
    ? runRollup(
        `SELECT leaid, COUNT(*) AS cnt, MAX(${DATE_EXPR.rfp("r")}) AS newest
         FROM rfps r
         WHERE leaid = ANY($1)${cutoff ? ` AND ${DATE_EXPR.rfp("r")} >= $2` : ""}
         GROUP BY leaid`,
        cutoff ? [leaids, cutoff] : [leaids],
      )
    : emptyRollup;

  // District name/state — LEFT-join target so 0-signal districts still appear.
  const districtQuery: Promise<{ rows: DistrictRow[] }> = readonlyPool.query(
    `SELECT leaid, name, state_abbrev
     FROM districts
     WHERE leaid = ANY($1)`,
    [leaids],
  );

  try {
    const [vacRes, newsRes, rfpRes, districtRes] = await Promise.all([
      vacQuery,
      newsQuery,
      rfpQuery,
      districtQuery,
    ]);

    // 5. Merge rollups into a per-leaid map.
    const byLeaid = new Map<
      string,
      { counts: SignalCounts; newest: Date | null }
    >();
    const ensure = (leaid: string) => {
      let cur = byLeaid.get(leaid);
      if (!cur) {
        cur = { counts: { vac: 0, news: 0, rfp: 0 }, newest: null };
        byLeaid.set(leaid, cur);
      }
      return cur;
    };
    const newer = (a: Date | null, b: Date | null): Date | null => {
      if (!a) return b;
      if (!b) return a;
      return a.getTime() >= b.getTime() ? a : b;
    };

    for (const r of vacRes.rows) {
      const cur = ensure(r.leaid);
      cur.counts.vac = Number(r.cnt);
      cur.newest = newer(cur.newest, r.newest);
    }
    for (const r of newsRes.rows) {
      const cur = ensure(r.leaid);
      cur.counts.news = Number(r.cnt);
      cur.newest = newer(cur.newest, r.newest);
    }
    for (const r of rfpRes.rows) {
      const cur = ensure(r.leaid);
      cur.counts.rfp = Number(r.cnt);
      cur.newest = newer(cur.newest, r.newest);
    }

    // 6. LEFT JOIN against the district base so every in-scope district appears.
    //    Districts with no row in `districts` (orphan leaid) are skipped — they
    //    have no name to display.
    const districts: SignalSummaryDistrict[] = districtRes.rows.map((d) => {
      const agg = byLeaid.get(d.leaid);
      return {
        leaid: d.leaid,
        name: d.name,
        stateAbbrev: d.state_abbrev,
        counts: agg?.counts ?? { vac: 0, news: 0, rfp: 0 },
        newestSignalAt: agg?.newest ? agg.newest.toISOString() : null,
      };
    });

    // 7. Sort: newestSignalAt DESC NULLS LAST, then name ASC.
    districts.sort((a, b) => {
      if (a.newestSignalAt && b.newestSignalAt) {
        if (a.newestSignalAt !== b.newestSignalAt) {
          return a.newestSignalAt < b.newestSignalAt ? 1 : -1;
        }
      } else if (a.newestSignalAt) {
        return -1;
      } else if (b.newestSignalAt) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      { districts, total: districts.length },
      { status: 200 },
    );
  } catch (err: unknown) {
    // Statement timeout — 57014 is the Postgres code for query_canceled.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "57014"
    ) {
      return NextResponse.json(
        { districts: [], total: 0, truncated: true },
        { status: 200 },
      );
    }
    console.error("[GET /api/signals] query failed:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

/** Run a per-source grouped rollup query against the readonly pool. */
function runRollup(
  sql: string,
  params: unknown[],
): Promise<{ rows: RollupRow[] }> {
  return readonlyPool.query(sql, params);
}
