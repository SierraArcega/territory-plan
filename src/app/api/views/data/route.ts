/**
 * GET /api/views/data
 *
 * Unified read endpoint for all six saved-view grids:
 *   districts | contacts | opps | vacancies | news | rfps
 *
 * Query params:
 *   source    — required. One of the six sources above.
 *   leaids    — optional CSV of leaids to scope results. Empty string → return
 *               empty immediately. Omit → no district scope.
 *   listId    — optional. Load a SavedList and merge its filterTree into the query.
 *   filters   — optional JSON-encoded FilterNode to AND on top of listId filters.
 *   sort      — repeatable `<fieldId>:<asc|desc>` (e.g. sort=name:asc&sort=enrollment:desc).
 *   limit     — default 50, max 200.
 *   offset    — default 0.
 *
 * Note (v1 limitation): leaids scoping is not applied when source=news. News
 * articles join to districts through the news_article_districts join table,
 * which requires a non-trivial sub-select. This is documented here and can be
 * added in a follow-up.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import prisma from "@/lib/prisma";
import { filterAndSchema, filterNodeSchema } from "@/lib/saved-views/schema";
import {
  compileFilterTree,
  buildOrderBy,
  SOURCE_FIELDS,
  SOURCE_TABLES,
} from "@/lib/saved-views/sql-compiler";
import { SAVED_LIST_SOURCES } from "@/lib/saved-views/filter-tree";
import type { FilterNode, SavedListSource } from "@/lib/saved-views/filter-tree";
import { fiscalYearToSchoolYear } from "@/lib/opportunity-actuals";

export const dynamic = "force-dynamic";

/** All valid source names as a Set for O(1) lookup. */
const VALID_SOURCES = new Set<string>(SAVED_LIST_SOURCES);

/**
 * Regex-defended identifier quoter (mirrors the one inside sql-compiler.ts).
 * Only allows [a-z_][a-z0-9_]* — identifiers come from the SOURCE_TABLES
 * registry, not user input, but we double-check before emitting.
 */
function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid identifier: ${name}`);
  }
  return `"${name}"`;
}

/** Wrap a FilterNode in an AND node so we can always merge filters via AND. */
function wrapInAnd(node: FilterNode): FilterNode {
  if (node.kind === "and") return node;
  return { kind: "and", children: [node] };
}

/** Merge two FilterNodes with a top-level AND. */
function mergeFilters(a: FilterNode, b: FilterNode): FilterNode {
  const aChildren = a.kind === "and" ? a.children : [a];
  const bChildren = b.kind === "and" ? b.children : [b];
  return { kind: "and", children: [...aChildren, ...bChildren] };
}

export async function GET(req: NextRequest) {
  // 1. Auth check — always first.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  // 2. Parse and validate source.
  const source = searchParams.get("source");
  if (!source || !VALID_SOURCES.has(source)) {
    return NextResponse.json(
      { error: `Invalid or missing source. Must be one of: ${SAVED_LIST_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }
  const typedSource = source as SavedListSource;

  // 3. Parse leaids — CSV or empty string.
  const leaidsParam = searchParams.get("leaids");
  let leaids: string[] | null = null;
  if (leaidsParam !== null) {
    // Empty string → caller has an empty selection → short-circuit.
    if (leaidsParam.trim() === "") {
      return NextResponse.json({ rows: [], total: 0 }, { status: 200 });
    }
    leaids = leaidsParam.split(",").map((s) => s.trim()).filter(Boolean);
  }

  // 4. Parse limit/offset.
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(isNaN(rawLimit) || rawLimit < 1 ? 50 : rawLimit, 200);
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;

  // 5. Parse and validate sort params.
  const sortRaw = searchParams.getAll("sort");
  const sort: { id: string; dir: "asc" | "desc" }[] = [];
  for (const s of sortRaw) {
    const colonIdx = s.lastIndexOf(":");
    if (colonIdx === -1) {
      return NextResponse.json(
        { error: `Invalid sort format "${s}". Expected <fieldId>:<asc|desc>.` },
        { status: 400 },
      );
    }
    const fieldId = s.slice(0, colonIdx);
    const dir = s.slice(colonIdx + 1);
    if (dir !== "asc" && dir !== "desc") {
      return NextResponse.json(
        { error: `Invalid sort direction "${dir}" in sort "${s}". Must be asc or desc.` },
        { status: 400 },
      );
    }
    // Validate field is in the allowlist for this source.
    const knownFields = SOURCE_FIELDS[typedSource];
    if (!knownFields.find((f) => f.id === fieldId)) {
      return NextResponse.json(
        { error: `Invalid sort field "${fieldId}" — not in SOURCE_FIELDS for source "${source}".` },
        { status: 400 },
      );
    }
    sort.push({ id: fieldId, dir });
  }

  // 6. Parse and validate filters JSON.
  let requestFilter: FilterNode = { kind: "and", children: [] };
  const filtersRaw = searchParams.get("filters");
  if (filtersRaw) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(filtersRaw);
    } catch {
      return NextResponse.json(
        { error: "Invalid filters: could not parse JSON." },
        { status: 400 },
      );
    }
    const result = filterNodeSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: `Invalid filter tree: ${result.error.message}` },
        { status: 400 },
      );
    }
    requestFilter = result.data;
  }

  // 7. Load and validate listId if provided.
  const listId = searchParams.get("listId");
  let listFilter: FilterNode | null = null;
  if (listId) {
    const list = await prisma.savedList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json({ error: "List not found." }, { status: 404 });
    }
    if (list.ownerId !== user.id && !list.shared) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (list.source !== source) {
      return NextResponse.json(
        {
          error: `List source "${list.source}" does not match request source "${source}".`,
        },
        { status: 400 },
      );
    }
    // Validate the stored filterTree shape.
    const treeResult = filterNodeSchema.safeParse(list.filterTree);
    if (!treeResult.success) {
      return NextResponse.json(
        { error: `Stored list filterTree is invalid: ${treeResult.error.message}` },
        { status: 400 },
      );
    }
    listFilter = treeResult.data;
  }

  // 8. Merge filters: listFilter AND requestFilter.
  let combinedFilter: FilterNode;
  if (listFilter && requestFilter) {
    combinedFilter = mergeFilters(listFilter, requestFilter);
  } else {
    combinedFilter = listFilter ?? requestFilter;
  }

  // 8b. Parse planId — used by virtual fields like `has_target` that need
  // a plan context to compile. The compiler binds it as a parameter.
  const planId = searchParams.get("planId") ?? undefined;

  // 9. Compile filter tree → WHERE clause.
  const tableInfo = SOURCE_TABLES[typedSource];
  const alias = "t";
  const compileResult = compileFilterTree(
    typedSource,
    combinedFilter,
    alias,
    0,
    { planId },
  );
  if (!compileResult.ok) {
    return NextResponse.json(
      { error: `Filter compile error: ${compileResult.error}` },
      { status: 400 },
    );
  }

  const params: unknown[] = [...compileResult.params];

  // 10. Build WHERE clause. Start with compiled filter, then append leaids scope.
  const whereClauses: string[] = [compileResult.whereSql];

  if (leaids !== null && leaids.length > 0) {
    if (typedSource === "news" || !tableInfo.districtJoinColumn) {
      // v1 limitation: news articles join to districts through news_article_districts.
      // Leaids scoping for news is not supported in v1 — silently skip.
    } else {
      // Scope by district join column using ANY($N).
      params.push(leaids);
      const paramIdx = params.length;
      const joinCol = quoteIdent(tableInfo.districtJoinColumn);
      whereClauses.push(`${alias}.${joinCol} = ANY($${paramIdx})`);
    }
  }

  const whereFragment = whereClauses.join(" AND ");

  // 11. Build ORDER BY.
  let orderBy = "";
  try {
    orderBy = buildOrderBy(sort, typedSource);
  } catch (err) {
    // buildOrderBy throws on unknown fields — guard (already validated above).
    return NextResponse.json(
      { error: `Sort error: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }

  // 12. Append LIMIT/OFFSET params.
  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  // 13. Compose final SELECT — include a window-function COUNT so we can
  // return the true total row count without a separate query.
  const sql = `
    SELECT ${alias}.*, COUNT(*) OVER() AS __total
    FROM ${quoteIdent(tableInfo.table)} ${alias}
    WHERE ${whereFragment}
    ${orderBy}
    LIMIT $${limitIdx}
    OFFSET $${offsetIdx}
  `.trim();

  // 14. Execute against readonly pool.
  try {
    const result = await readonlyPool.query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].__total) : 0;
    // Strip __total from every row so it doesn't leak to the client.
    let rows: Record<string, unknown>[] = result.rows.map((r) => {
      const { __total, ...rest } = r;
      void __total; // consumed above
      return rest;
    });

    // 15. Plan-context enrichment for the districts grid: attach `target`
    // (sum of the four plan-district target columns) and `weighted_pipeline`
    // (open-pipe weighted value for the plan's fiscal year). Both require a
    // planId; we silently skip when one isn't provided.
    if (typedSource === "districts" && planId && rows.length > 0) {
      const leaids = rows
        .map((r) => (typeof r.leaid === "string" ? r.leaid : null))
        .filter((x): x is string => x !== null);
      if (leaids.length > 0) {
        const enrichment = await fetchDistrictPlanEnrichment(planId, leaids);
        rows = rows.map((r) => {
          const leaid = typeof r.leaid === "string" ? r.leaid : null;
          if (!leaid) return r;
          const e = enrichment.byLeaid.get(leaid);
          return {
            ...r,
            target: e?.target ?? null,
            weighted_pipeline: e?.weightedPipeline ?? null,
            won_min: e?.wonMin ?? null,
            won_max: e?.wonMax ?? null,
          };
        });
      }
    }

    // 16. Normalize row keys to camelCase so frontend accessors match a
    // single convention (Prisma client emits camelCase, but raw `pg` queries
    // return DB column names directly).
    rows = rows.map(camelizeRow);

    return NextResponse.json({ rows, total }, { status: 200 });
  } catch (err: unknown) {
    // Statement timeout — 57014 is the Postgres error code for query_canceled.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "57014"
    ) {
      return NextResponse.json(
        { rows: [], total: 0, truncated: true },
        { status: 200 },
      );
    }
    console.error("[GET /api/views/data] query failed:", err);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}

/**
 * Convert a snake_case key to camelCase. ASCII-only — DB columns are
 * `[a-z_][a-z0-9_]*` so we never need full Unicode handling.
 */
function snakeToCamel(key: string): string {
  if (!key.includes("_")) return key;
  return key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}

/** Camelize every top-level key of a row object. Values pass through. */
function camelizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    out[snakeToCamel(k)] = row[k];
  }
  return out;
}

/**
 * Fetch the plan-scoped target sum and weighted-pipeline value for a given
 * set of district leaids. Returns a Map keyed by leaid. Missing entries
 * simply mean no plan target / no open pipeline for that district.
 *
 * Errors are swallowed — these are enrichment fields, not required to render
 * the grid. The two underlying tables (`territory_plan_districts`,
 * `district_opportunity_actuals`) are loaded in parallel.
 */
interface DistrictEnrichmentEntry {
  target: number | null;
  weightedPipeline: number | null;
  /** Min net_booking_amount across this district's Closed Won deals for
   *  the plan's school year. Null when there are no Closed Won deals. */
  wonMin: number | null;
  /** Max net_booking_amount across this district's Closed Won deals for
   *  the plan's school year. Null when there are no Closed Won deals. */
  wonMax: number | null;
}

async function fetchDistrictPlanEnrichment(
  planId: string,
  leaids: string[],
): Promise<{ byLeaid: Map<string, DistrictEnrichmentEntry> }> {
  const byLeaid = new Map<string, DistrictEnrichmentEntry>();
  const blank = (): DistrictEnrichmentEntry => ({
    target: null,
    weightedPipeline: null,
    wonMin: null,
    wonMax: null,
  });

  // Plan record gives us the fiscal year for the actuals join.
  const plan = await prisma.territoryPlan
    .findUnique({ where: { id: planId }, select: { fiscalYear: true } })
    .catch(() => null);
  if (!plan) return { byLeaid };
  const schoolYr = fiscalYearToSchoolYear(plan.fiscalYear);

  type TargetRow = {
    district_leaid: string;
    target: number | null;
  };
  type PipelineRow = {
    district_lea_id: string;
    weighted_pipeline: number;
  };
  type WonRangeRow = {
    district_lea_id: string;
    won_min: number | null;
    won_max: number | null;
  };

  const [targetRows, pipelineRows, wonRangeRows] = await Promise.all([
    prisma.$queryRaw<TargetRow[]>`
      SELECT district_leaid,
             COALESCE(renewal_target, 0)
               + COALESCE(winback_target, 0)
               + COALESCE(expansion_target, 0)
               + COALESCE(new_business_target, 0) AS target
      FROM territory_plan_districts
      WHERE plan_id = ${planId}
        AND district_leaid = ANY(${leaids})
    `.catch(() => [] as TargetRow[]),
    prisma.$queryRaw<PipelineRow[]>`
      SELECT district_lea_id,
             COALESCE(SUM(weighted_pipeline), 0) AS weighted_pipeline
      FROM district_opportunity_actuals
      WHERE district_lea_id = ANY(${leaids})
        AND school_yr = ${schoolYr}
      GROUP BY district_lea_id
    `.catch(() => [] as PipelineRow[]),
    prisma.$queryRaw<WonRangeRow[]>`
      SELECT district_lea_id,
             MIN(net_booking_amount) AS won_min,
             MAX(net_booking_amount) AS won_max
      FROM opportunities
      WHERE district_lea_id = ANY(${leaids})
        AND school_yr = ${schoolYr}
        AND stage = 'Closed Won'
        AND net_booking_amount IS NOT NULL
      GROUP BY district_lea_id
    `.catch(() => [] as WonRangeRow[]),
  ]);

  for (const r of targetRows) {
    const cur = byLeaid.get(r.district_leaid) ?? blank();
    cur.target = r.target == null ? null : Number(r.target);
    byLeaid.set(r.district_leaid, cur);
  }
  for (const r of pipelineRows) {
    const cur = byLeaid.get(r.district_lea_id) ?? blank();
    cur.weightedPipeline = Number(r.weighted_pipeline);
    byLeaid.set(r.district_lea_id, cur);
  }
  for (const r of wonRangeRows) {
    if (r.won_min == null || r.won_max == null) continue;
    const cur = byLeaid.get(r.district_lea_id) ?? blank();
    cur.wonMin = Number(r.won_min);
    cur.wonMax = Number(r.won_max);
    byLeaid.set(r.district_lea_id, cur);
  }
  return { byLeaid };
}
