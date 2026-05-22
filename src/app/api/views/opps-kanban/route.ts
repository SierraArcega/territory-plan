import { NextRequest, NextResponse } from "next/server";
import { readonlyPool } from "@/lib/db-readonly";
import { getUser } from "@/lib/supabase/server";
import {
  OPP_STAGE_COLUMNS,
  OPP_KANBAN_STAGES,
} from "@/features/views/lib/opp-stage-columns";
import {
  getGlobalCustomerLabels,
  rankLabelString,
} from "@/app/api/views/data/global-customer-labels";
import { compileFilterTree, validateFilterTree } from "@/lib/saved-views/sql-compiler";
import { filterAndSchema } from "@/lib/saved-views/schema";
import type { FilterNode } from "@/lib/saved-views/filter-tree";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

interface KanbanCard {
  id: string;
  name: string | null;
  districtName: string | null;
  contractType: string | null;
  netBookingAmount: number | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  closeDate: string | null;
  salesRepName: string | null;
  detailsLink: string | null;
  rankLabel: string;
}

interface KanbanColumn {
  id: string;
  label: string;
  count: number;
  totalBookings: number;
  cards: KanbanCard[];
  hasMore: boolean;
}

/** A plan district with no opportunities this fiscal year. */
interface TargetedCard {
  leaid: string;
  name: string | null;
  target: number;
  rankLabel: string;
}

interface Targeted {
  count: number;
  totalTarget: number;
  cards: TargetedCard[];
  hasMore: boolean;
}

interface TargetedRow {
  leaid: string;
  name: string | null;
  target: string;
}

interface CardRow {
  id: string;
  stage: string;
  name: string | null;
  district_name: string | null;
  contract_type: string | null;
  net_booking_amount: string | null;
  minimum_purchase_amount: string | null;
  maximum_budget: string | null;
  close_date: Date | string | null;
  sales_rep_name: string | null;
  details_link: string | null;
  district_lea_id: string | null;
  state: string | null;
}

/** Decimal columns arrive as strings from pg — coerce to number or null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** close_date (timestamptz) → ISO string, or null if missing/unparseable. */
function toISO(v: Date | string | null): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

interface SortEntry { id: string; dir: "asc" | "desc" }

/** Lower sorts first: ranked customers by rank number, then win_back, then new. */
function rankSortKey(g: { rank: number | null; label: string } | undefined): number {
  if (g?.label === "rank" && g.rank != null) return g.rank;
  if (g?.label === "win_back") return 1_000_000;
  return 2_000_000;
}

function cmpRows(a: CardRow, b: CardRow, e: SortEntry): number {
  const get = (r: CardRow): number | string | null => {
    switch (e.id) {
      case "net_booking_amount": return num(r.net_booking_amount);
      case "close_date": return r.close_date ? new Date(r.close_date).getTime() : null;
      case "state": return r.state;
      case "contract_type": return r.contract_type;
      default: return null;
    }
  };
  const av = get(a), bv = get(b);
  if (av == null && bv == null) return 0;
  if (av == null) return 1;
  if (bv == null) return -1;
  let c = av < bv ? -1 : av > bv ? 1 : 0;
  if (e.dir === "desc") c = -c;
  return c;
}

function emptyColumns(): KanbanColumn[] {
  return OPP_STAGE_COLUMNS.map((c) => ({
    id: c.id,
    label: c.label,
    count: 0,
    totalBookings: 0,
    cards: [],
    hasMore: false,
  }));
}

function emptyTargeted(): Targeted {
  return { count: 0, totalTarget: 0, cards: [], hasMore: false };
}

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const schoolYr = params.get("schoolYr") ?? "";
  const planId = params.get("planId");
  const leaids = (params.get("leaids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const rawLimit = Number(params.get("limit"));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  if (!schoolYr) {
    return NextResponse.json({ error: "schoolYr is required" }, { status: 400 });
  }

  if (leaids.length === 0) {
    return NextResponse.json({
      schoolYr,
      columns: emptyColumns(),
      targeted: emptyTargeted(),
    });
  }

  // Parse + validate filters
  const filtersRaw = params.get("filters");
  const sortRaw = params.get("sort");

  let filterTree: FilterNode = { kind: "and", children: [] };
  if (filtersRaw) {
    let parsed: unknown;
    try { parsed = JSON.parse(filtersRaw); } catch {
      return NextResponse.json({ error: "Invalid filters JSON" }, { status: 400 });
    }
    const ok = filterAndSchema.safeParse(parsed);
    if (!ok.success) return NextResponse.json({ error: "Invalid filters" }, { status: 400 });
    filterTree = ok.data as FilterNode;
    const fieldErr = validateFilterTree("opps", filterTree);
    if (fieldErr) return NextResponse.json({ error: fieldErr }, { status: 400 });
  }

  let sort: SortEntry[] = [];
  if (sortRaw) {
    try {
      const arr = JSON.parse(sortRaw);
      if (Array.isArray(arr)) {
        sort = arr.filter((e): e is SortEntry => e && typeof e.id === "string" && (e.dir === "asc" || e.dir === "desc"));
      }
    } catch {
      return NextResponse.json({ error: "Invalid sort JSON" }, { status: 400 });
    }
  }

  const rankBuckets = (params.get("rankBuckets") ?? "")
    .split(",").map((s) => s.trim())
    .filter((s): s is "rank" | "win_back" | "new" => s === "rank" || s === "win_back" || s === "new");
  const rankSortRaw = params.get("rankSort");
  const rankSort: "asc" | "desc" | null =
    rankSortRaw === "asc" || rankSortRaw === "desc" ? rankSortRaw : null;

  const stages = [...OPP_KANBAN_STAGES];
  const baseParams: unknown[] = [leaids, schoolYr, stages];
  const compiled = compileFilterTree("opps", filterTree, "o", baseParams.length);
  if (!compiled.ok) return NextResponse.json({ error: compiled.error }, { status: 400 });
  const filterWhere = compiled.whereSql && compiled.whereSql !== "TRUE" ? ` AND ${compiled.whereSql}` : "";
  const fetchParams = [...baseParams, ...compiled.params];

  const [cardResult, targetedResult, labels] = await Promise.all([
    readonlyPool.query<CardRow>(
      `SELECT o.id, o.stage, o.name, o.district_name, o.contract_type,
              o.net_booking_amount, o.minimum_purchase_amount, o.maximum_budget,
              o.close_date, o.sales_rep_name, o.details_link, o.district_lea_id, o.state
         FROM opportunities o
        WHERE o.district_lea_id = ANY($1)
          AND o.school_yr = $2
          AND o.stage = ANY($3)${filterWhere}
        LIMIT 5000`,
      fetchParams,
    ),
    planId
      ? readonlyPool.query<TargetedRow>(
          `SELECT tpd.district_leaid AS leaid,
                  d.name AS name,
                  COALESCE(tpd.renewal_target, 0)
                    + COALESCE(tpd.winback_target, 0)
                    + COALESCE(tpd.expansion_target, 0)
                    + COALESCE(tpd.new_business_target, 0) AS target
             FROM territory_plan_districts tpd
             JOIN districts d ON d.leaid = tpd.district_leaid
            WHERE tpd.plan_id = $1
              AND NOT EXISTS (
                SELECT 1 FROM opportunities o
                 WHERE o.district_lea_id = tpd.district_leaid
                   AND o.school_yr = $2
              )
            ORDER BY target DESC, d.name ASC`,
          [planId, schoolYr],
        )
      : Promise.resolve({ rows: [] as TargetedRow[] }),
    getGlobalCustomerLabels(),
  ]);

  const bucketOf = (leaid: string | null): string => labels.get(leaid ?? "")?.label ?? "new";
  const visibleRows = rankBuckets.length === 0
    ? cardResult.rows
    : cardResult.rows.filter((r) => rankBuckets.includes(bucketOf(r.district_lea_id)));

  const rowsByStage = new Map<string, CardRow[]>();
  for (const r of visibleRows) {
    const list = rowsByStage.get(r.stage) ?? [];
    list.push(r);
    rowsByStage.set(r.stage, list);
  }

  const toCard = (r: CardRow): KanbanCard => ({
    id: r.id,
    name: r.name,
    districtName: r.district_name,
    contractType: r.contract_type,
    netBookingAmount: num(r.net_booking_amount),
    minimumPurchaseAmount: num(r.minimum_purchase_amount),
    maximumBudget: num(r.maximum_budget),
    closeDate: toISO(r.close_date),
    salesRepName: r.sales_rep_name,
    detailsLink: r.details_link,
    rankLabel: rankLabelString(labels.get(r.district_lea_id ?? "")),
  });

  const columns: KanbanColumn[] = OPP_STAGE_COLUMNS.map((c) => {
    const rows = rowsByStage.get(c.stage) ?? [];
    const total = rows.reduce((s, r) => s + (num(r.net_booking_amount) ?? 0), 0);
    const byRank = (a: CardRow, b: CardRow) => {
      const ka = rankSortKey(labels.get(a.district_lea_id ?? ""));
      const kb = rankSortKey(labels.get(b.district_lea_id ?? ""));
      const d = ka === kb ? 0 : ka < kb ? -1 : 1;
      return rankSort === "desc" ? -d : d;
    };
    const sorted = [...rows].sort((a, b) => {
      if (rankSort) { const d = byRank(a, b); if (d !== 0) return d; }
      for (const e of sort) { const d = cmpRows(a, b, e); if (d !== 0) return d; }
      if (sort.length === 0 && !rankSort) {
        const ca = cmpRows(a, b, { id: "close_date", dir: "asc" });
        if (ca !== 0) return ca;
        return cmpRows(a, b, { id: "net_booking_amount", dir: "desc" });
      }
      return 0;
    });
    return { id: c.id, label: c.label, count: rows.length, totalBookings: total, cards: sorted.slice(0, limit).map(toCard), hasMore: rows.length > limit };
  });

  const targetedAll: TargetedCard[] = targetedResult.rows.map((r) => ({
    leaid: r.leaid,
    name: r.name,
    target: Number(r.target) || 0,
    rankLabel: rankLabelString(labels.get(r.leaid)),
  }));
  const targetedFiltered = rankBuckets.length === 0
    ? targetedAll
    : targetedAll.filter((t) => rankBuckets.includes(labels.get(t.leaid)?.label ?? "new"));
  if (rankSort) {
    targetedFiltered.sort((a, b) => {
      const ka = rankSortKey(labels.get(a.leaid));
      const kb = rankSortKey(labels.get(b.leaid));
      const d = ka === kb ? 0 : ka < kb ? -1 : 1;
      return rankSort === "desc" ? -d : d;
    });
  }
  const targeted: Targeted = {
    count: targetedFiltered.length,
    totalTarget: targetedFiltered.reduce((sum, t) => sum + t.target, 0),
    cards: targetedFiltered.slice(0, limit),
    hasMore: targetedFiltered.length > limit,
  };

  return NextResponse.json({ schoolYr, columns, targeted });
}
