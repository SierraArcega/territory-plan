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

interface AggRow {
  stage: string;
  count: string;
  total: string;
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

  const stages = [...OPP_KANBAN_STAGES];

  // Run aggregate, card, and targeted queries in parallel (plus the cached
  // global rank labels). Keep the readonlyPool array order (agg, cards, targeted)
  // stable — tests assert on call indices.
  //
  // "Targeted" = plan districts with NO opportunity this fiscal year. Only
  // computable when a planId is supplied (targets live on territory_plan_districts).
  // Districts are bounded per plan, so we fetch all matches and slice client-side.
  const [aggResult, cardResult, targetedResult, labels] = await Promise.all([
    readonlyPool.query<AggRow>(
      `SELECT stage,
              COUNT(*) AS count,
              COALESCE(SUM(net_booking_amount), 0) AS total
         FROM opportunities
        WHERE district_lea_id = ANY($1)
          AND school_yr = $2
          AND stage = ANY($3)
        GROUP BY stage`,
      [leaids, schoolYr, stages],
    ),
    readonlyPool.query<CardRow>(
      `SELECT id, stage, name, district_name, contract_type, net_booking_amount,
              minimum_purchase_amount, maximum_budget, close_date, sales_rep_name,
              details_link, district_lea_id
         FROM (
           SELECT o.id, o.stage, o.name, o.district_name, o.contract_type,
                  o.net_booking_amount, o.minimum_purchase_amount, o.maximum_budget,
                  o.close_date, o.sales_rep_name, o.details_link, o.district_lea_id,
                  ROW_NUMBER() OVER (
                    PARTITION BY o.stage
                    ORDER BY o.close_date ASC NULLS LAST, o.net_booking_amount DESC NULLS LAST
                  ) AS rn
             FROM opportunities o
            WHERE o.district_lea_id = ANY($1)
              AND o.school_yr = $2
              AND o.stage = ANY($3)
         ) ranked
        WHERE rn <= $4`,
      [leaids, schoolYr, stages, limit],
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

  const aggByStage = new Map<string, { count: number; total: number }>();
  for (const r of aggResult.rows) {
    aggByStage.set(r.stage, {
      count: Number(r.count) || 0,
      total: Number(r.total) || 0,
    });
  }

  const cardsByStage = new Map<string, KanbanCard[]>();
  for (const r of cardResult.rows) {
    const list = cardsByStage.get(r.stage) ?? [];
    list.push({
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
    cardsByStage.set(r.stage, list);
  }

  const columns: KanbanColumn[] = OPP_STAGE_COLUMNS.map((c) => {
    const agg = aggByStage.get(c.stage) ?? { count: 0, total: 0 };
    const cards = cardsByStage.get(c.stage) ?? [];
    return {
      id: c.id,
      label: c.label,
      count: agg.count,
      totalBookings: agg.total,
      cards,
      hasMore: agg.count > cards.length,
    };
  });

  const targetedAll: TargetedCard[] = targetedResult.rows.map((r) => ({
    leaid: r.leaid,
    name: r.name,
    target: Number(r.target) || 0,
    rankLabel: rankLabelString(labels.get(r.leaid)),
  }));
  const targeted: Targeted = {
    count: targetedAll.length,
    totalTarget: targetedAll.reduce((sum, t) => sum + t.target, 0),
    cards: targetedAll.slice(0, limit),
    hasMore: targetedAll.length > limit,
  };

  return NextResponse.json({ schoolYr, columns, targeted });
}
