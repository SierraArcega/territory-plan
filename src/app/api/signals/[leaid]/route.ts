/**
 * GET /api/signals/[leaid]
 *
 * Signals items — one district's merged, reverse-chronological feed of
 * vacancies / news / RFPs. Fetched lazily when a district row in the Signals
 * tree is expanded; server-paginated via limit/offset.
 *
 * Query params:
 *   types   — CSV subset of vac,news,rfp (default all). Off sources are excluded.
 *   since   — 7d | 30d | 90d | all (default 30d). Lower bound on each source's
 *             chronological date.
 *   limit   — default 50, max 100. Page size.
 *   offset  — default 0.
 *
 * Response: { items: SignalItem[], hasMore }
 *   - items: normalized rows { type, id, title, date, secondaryDate?, meta? }
 *     ordered by date DESC across all sources.
 *   - hasMore: whether another page exists (computed via LIMIT limit+1).
 *
 * RFP ids are Int in the DB but serialized as strings here (detail route
 * parseInts them). Mirrors /api/views/data: auth-guarded, raw parameterized
 * SQL over the readonly pool.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import {
  parseTypes,
  parseWindow,
  sinceCutoff,
  DATE_EXPR,
  NEWS_CONFIDENCE_LEVELS,
  type SignalType,
} from "@/lib/signals/sql";

export const dynamic = "force-dynamic";

interface SignalItem {
  type: SignalType;
  id: string;
  title: string;
  date: string;
  secondaryDate?: string | null;
  meta?: string | null;
}

/** Raw UNION row shape from the readonly pool. */
interface ItemRow {
  type: SignalType;
  id: string;
  title: string;
  date: Date;
  secondary_date: Date | null;
  meta: string | null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ leaid: string }> },
) {
  // 1. Auth — always first.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { leaid } = await ctx.params;
  if (!leaid || leaid.trim() === "") {
    return NextResponse.json({ error: "Missing leaid." }, { status: 400 });
  }

  const { searchParams } = req.nextUrl;

  // 2. Parse type mask + time window + pagination.
  const types = parseTypes(searchParams.get("types"));
  const window = parseWindow(searchParams.get("since"));
  const cutoff = sinceCutoff(window);

  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(
    Number.isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit,
    100,
  );
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  // No sources selected → empty page (parseTypes guarantees at least one, but
  // guard anyway so the UNION is never empty).
  if (!types.vac && !types.news && !types.rfp) {
    return NextResponse.json({ items: [], hasMore: false }, { status: 200 });
  }

  // 3. Build params and per-source SELECTs. $1 = leaid; $2 = cutoff (when set);
  //    news confidence + limit/offset appended after.
  const params: unknown[] = [leaid];
  let cutoffIdx: number | null = null;
  if (cutoff) {
    params.push(cutoff);
    cutoffIdx = params.length; // = 2
  }

  const sinceVac = cutoffIdx ? ` AND ${DATE_EXPR.vac("v")} >= $${cutoffIdx}` : "";
  const sinceNews = cutoffIdx
    ? ` AND ${DATE_EXPR.news("n")} >= $${cutoffIdx}`
    : "";
  const sinceRfp = cutoffIdx ? ` AND ${DATE_EXPR.rfp("r")} >= $${cutoffIdx}` : "";

  const selects: string[] = [];

  if (types.vac) {
    // meta = category, falling back to status.
    selects.push(
      `SELECT 'vac'::text AS type,
              v.id AS id,
              v.title AS title,
              ${DATE_EXPR.vac("v")} AS date,
              NULL::timestamp AS secondary_date,
              COALESCE(v.category, v.status) AS meta
       FROM vacancies v
       WHERE v.leaid = $1${sinceVac}`,
    );
  }

  if (types.news) {
    // meta = source. Joined through news_article_districts on the leaid.
    selects.push(
      `SELECT 'news'::text AS type,
              n.id AS id,
              n.title AS title,
              ${DATE_EXPR.news("n")} AS date,
              NULL::timestamp AS secondary_date,
              n.source AS meta
       FROM news_article_districts nad
       JOIN news_articles n ON n.id = nad.article_id
       WHERE nad.leaid = $1
         AND nad.confidence = ANY($${pushConfidence(params)})${sinceNews}`,
    );
  }

  if (types.rfp) {
    // id is Int → cast to text; meta = agency_name; secondaryDate = due_date.
    selects.push(
      `SELECT 'rfp'::text AS type,
              r.id::text AS id,
              r.title AS title,
              ${DATE_EXPR.rfp("r")} AS date,
              r.due_date AS secondary_date,
              r.agency_name AS meta
       FROM rfps r
       WHERE r.leaid = $1${sinceRfp}`,
    );
  }

  // 4. UNION ALL the selected sources, order reverse-chron, fetch limit+1 to
  //    detect hasMore.
  params.push(limit + 1);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT type, id, title, date, secondary_date, meta
    FROM (
      ${selects.join("\n      UNION ALL\n      ")}
    ) merged
    ORDER BY date DESC
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `.trim();

  try {
    const result = await readonlyPool.query<ItemRow>(sql, params);
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const items: SignalItem[] = page.map((r) => ({
      type: r.type,
      id: r.id,
      title: r.title,
      date: r.date.toISOString(),
      secondaryDate: r.secondary_date ? r.secondary_date.toISOString() : null,
      meta: r.meta,
    }));

    return NextResponse.json({ items, hasMore }, { status: 200 });
  } catch (err: unknown) {
    // Statement timeout — 57014 is the Postgres code for query_canceled.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "57014"
    ) {
      return NextResponse.json(
        { items: [], hasMore: false, truncated: true },
        { status: 200 },
      );
    }
    console.error("[GET /api/signals/[leaid]] query failed:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

/**
 * Push the news confidence-level array as the next bound parameter and return
 * its 1-based index. Keeps the news sub-select's `= ANY($N)` numbering correct
 * regardless of whether the `since` cutoff param was added.
 */
function pushConfidence(params: unknown[]): number {
  params.push(NEWS_CONFIDENCE_LEVELS);
  return params.length;
}
