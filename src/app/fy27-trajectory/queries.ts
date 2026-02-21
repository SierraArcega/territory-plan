import prisma from "@/lib/prisma";

// Convert Decimal/BigInt/null → number
function n(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

/* ─── Public types ─────────────────────────────────────────────── */

export interface TrajectoryData {
  kpis: {
    combinedFy27Target: number;
    fy27Pipeline: number;
    fy26CombinedRevenue: number;
    activeCustomers: number;
    planCount: number;
    totalDistrictsInPlans: number;
  };
  revenueTrajectory: Array<{
    year: string;
    fm: number;
    ek12: number;
    combined: number;
    isForecast?: boolean;
  }>;
  plans: Array<{
    id: string;
    name: string;
    districtCount: number;
    renewalRollup: number;
    expansionRollup: number;
    winbackRollup: number;
    newBusinessRollup: number;
    totalTarget: number;
  }>;
  topAccounts: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    totalTarget: number;
    renewalTarget: number;
    expansionTarget: number;
    winbackTarget: number;
    newBusinessTarget: number;
    fy27Pipeline: number;
    fy26Invoicing: number;
    fy26Ek12: number;
    combinedFy26: number;
    enrollment: number | null;
    tags: string[];
  }>;
  targetBreakdown: {
    fm: { renewal: number; expansion: number; winback: number; newBiz: number; total: number; districts: number };
    ek12: { renewal: number; expansion: number; winback: number; newBiz: number; total: number; districts: number };
    both: { renewal: number; expansion: number; winback: number; newBiz: number; total: number; districts: number };
    untagged: { renewal: number; expansion: number; winback: number; newBiz: number; total: number; districts: number };
  };
  churnSummary: {
    churnedCount: number;
    churnedDollars: number;
    contractedCount: number;
    contractedDollars: number;
  };
  churned: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    lostRevenue: number;
    lostFm: number;
    lostEk12: number;
    fy27Pipeline: number;
    source: string;
    tags: string[];
  }>;
  contracted: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    fy25Combined: number;
    fy26Combined: number;
    contraction: number;
    fy27Pipeline: number;
    source: string;
    tags: string[];
  }>;
  growth: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    fy27Pipeline: number;
    fy26Invoicing: number;
    fy25Invoicing: number;
    enrollment: number | null;
    type: string;
    tags: string[];
  }>;
  bookingsGap: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    fy26Bookings: number;
    fy26Invoicing: number;
    gapAmount: number;
    gapPercent: number;
  }>;
}

/* ─── Tag lookup helper ─────────────────────────────────────────── */

async function getTagsForDistricts(
  leaids: string[]
): Promise<Map<string, string[]>> {
  if (leaids.length === 0) return new Map();
  const rows = await prisma.districtTag.findMany({
    where: { districtLeaid: { in: leaids } },
    include: { tag: { select: { name: true } } },
  });
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!map.has(r.districtLeaid)) map.set(r.districtLeaid, []);
    map.get(r.districtLeaid)!.push(r.tag.name);
  }
  return map;
}

/* ─── Raw query row shapes ──────────────────────────────────────── */

interface PlanTotalsRow {
  plan_count: bigint;
  unique_districts: bigint;
  grand_total: unknown;
}
interface TopAccountRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
  renewal_target: unknown;
  expansion_target: unknown;
  winback_target: unknown;
  new_business_target: unknown;
  total_target: unknown;
  fy27_pipeline: unknown;
  fy26_invoicing: unknown;
  ek12_fy26: unknown;
  enrollment: number | null;
}
interface TargetBreakdownRow {
  source: string;
  district_count: bigint;
  renewal: unknown;
  expansion: unknown;
  winback: unknown;
  new_biz: unknown;
  total: unknown;
}
interface ChurnStatsRow {
  total_churned: bigint;
  total_churn_dollars: unknown;
  total_contracted: bigint;
  total_contraction_dollars: unknown;
}
interface ChurnedRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
  fm_fy25: unknown;
  ek12_fy25: unknown;
  fy27_pipeline: unknown;
}
interface ContractedRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
  fm_fy25: unknown;
  fm_fy26: unknown;
  ek12_fy25: unknown;
  ek12_fy26: unknown;
  contraction: unknown;
  fy27_pipeline: unknown;
}
interface GrowthRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
  fy27_pipeline: unknown;
  fy26_invoicing: unknown;
  fy25_invoicing: unknown;
  enrollment: number | null;
  is_customer: boolean;
}
interface BookingsGapRow {
  leaid: string;
  name: string;
  state_abbrev: string | null;
  fy26_bookings: unknown;
  fy26_invoicing: unknown;
  gap_amount: unknown;
  gap_percent: unknown;
}

/* ─── Main data fetcher ─────────────────────────────────────────── */

export async function fetchTrajectoryData(): Promise<TrajectoryData> {
  // Phase 1 — run all main queries in parallel
  const [
    districtAgg,
    customerCount,
    ek12RevenueRaw,
    plansRaw,
    planTotalsRaw,
    topAccountsRaw,
    targetBreakdownRaw,
    churnStatsRaw,
    churnedRaw,
    contractedRaw,
    growthRaw,
    bookingsGapRaw,
  ] = await Promise.all([
    // 1. District aggregates
    prisma.district.aggregate({
      _sum: {
        fy25NetInvoicing: true,
        fy26NetInvoicing: true,
        fy26ClosedWonNetBooking: true,
        fy27OpenPipeline: true,
      },
    }),

    // 2. Active customer count
    prisma.district.count({ where: { isCustomer: true } }),

    // 3. EK12 revenue by FY
    prisma.competitorSpend.groupBy({
      by: ["fiscalYear"],
      where: { competitor: "Elevate K12" },
      _sum: { totalSpend: true },
      orderBy: { fiscalYear: "asc" },
    }),

    // 4. FY27 plans
    prisma.territoryPlan.findMany({
      where: { fiscalYear: 2027 },
      select: {
        id: true,
        name: true,
        districtCount: true,
        renewalRollup: true,
        expansionRollup: true,
        winbackRollup: true,
        newBusinessRollup: true,
      },
    }),

    // 5. Plan totals (aggregate across all FY27 plan districts)
    prisma.$queryRaw<PlanTotalsRow[]>`
      SELECT
        COUNT(DISTINCT tp.id) as plan_count,
        COUNT(DISTINCT tpd.district_leaid) as unique_districts,
        SUM(COALESCE(tpd.renewal_target,0) + COALESCE(tpd.expansion_target,0) +
            COALESCE(tpd.winback_target,0) + COALESCE(tpd.new_business_target,0)) as grand_total
      FROM territory_plans tp
      JOIN territory_plan_districts tpd ON tpd.plan_id = tp.id
      WHERE tp.fiscal_year = 2027
    `,

    // 6. Key accounts (all districts with "Key Account" tag in FY27 plans)
    prisma.$queryRaw<TopAccountRow[]>`
      SELECT
        tpd.district_leaid as leaid, d.name, d.state_abbrev,
        SUM(COALESCE(tpd.renewal_target,0))    as renewal_target,
        SUM(COALESCE(tpd.expansion_target,0))  as expansion_target,
        SUM(COALESCE(tpd.winback_target,0))    as winback_target,
        SUM(COALESCE(tpd.new_business_target,0)) as new_business_target,
        SUM(COALESCE(tpd.renewal_target,0) + COALESCE(tpd.expansion_target,0) +
            COALESCE(tpd.winback_target,0) + COALESCE(tpd.new_business_target,0)) as total_target,
        COALESCE(d.fy27_open_pipeline,0) as fy27_pipeline,
        COALESCE(d.fy26_net_invoicing,0) as fy26_invoicing,
        COALESCE(ek12.fy26_spend, 0) as ek12_fy26,
        d.enrollment
      FROM territory_plan_districts tpd
      JOIN territory_plans tp ON tp.id = tpd.plan_id
      JOIN districts d ON d.leaid = tpd.district_leaid
      LEFT JOIN (
        SELECT leaid, SUM(total_spend) as fy26_spend
        FROM competitor_spend
        WHERE competitor = 'Elevate K12' AND fiscal_year = 'FY26'
        GROUP BY leaid
      ) ek12 ON ek12.leaid = d.leaid
      WHERE tp.fiscal_year = 2027
        AND EXISTS (
          SELECT 1 FROM district_tags dt
          JOIN tags t ON t.id = dt.tag_id
          WHERE dt.district_leaid = tpd.district_leaid
            AND t.name = 'Key Account'
        )
      GROUP BY tpd.district_leaid, d.name, d.state_abbrev,
               d.fy27_open_pipeline, d.fy26_net_invoicing, ek12.fy26_spend, d.enrollment
      ORDER BY total_target DESC
    `,

    // 6b. Target breakdown by FM vs EK12 tag
    prisma.$queryRaw<TargetBreakdownRow[]>`
      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1 FROM district_tags dt JOIN tags t ON t.id = dt.tag_id
            WHERE dt.district_leaid = tpd.district_leaid AND t.name LIKE 'EK12%'
          ) AND EXISTS (
            SELECT 1 FROM district_tags dt JOIN tags t ON t.id = dt.tag_id
            WHERE dt.district_leaid = tpd.district_leaid AND t.name LIKE 'Fullmind%'
          ) THEN 'Both'
          WHEN EXISTS (
            SELECT 1 FROM district_tags dt JOIN tags t ON t.id = dt.tag_id
            WHERE dt.district_leaid = tpd.district_leaid AND t.name LIKE 'EK12%'
          ) THEN 'EK12'
          WHEN EXISTS (
            SELECT 1 FROM district_tags dt JOIN tags t ON t.id = dt.tag_id
            WHERE dt.district_leaid = tpd.district_leaid AND t.name LIKE 'Fullmind%'
          ) THEN 'FM'
          ELSE 'Untagged'
        END as source,
        COUNT(DISTINCT tpd.district_leaid) as district_count,
        SUM(COALESCE(tpd.renewal_target,0)) as renewal,
        SUM(COALESCE(tpd.expansion_target,0)) as expansion,
        SUM(COALESCE(tpd.winback_target,0)) as winback,
        SUM(COALESCE(tpd.new_business_target,0)) as new_biz,
        SUM(COALESCE(tpd.renewal_target,0) + COALESCE(tpd.expansion_target,0) +
            COALESCE(tpd.winback_target,0) + COALESCE(tpd.new_business_target,0)) as total
      FROM territory_plan_districts tpd
      JOIN territory_plans tp ON tp.id = tpd.plan_id
      WHERE tp.fiscal_year = 2027
      GROUP BY 1
      ORDER BY total DESC
    `,

    // 7. Churn/contraction stats (aggregate) — combined FM + EK12
    prisma.$queryRaw<ChurnStatsRow[]>`
      WITH combined AS (
        SELECT d.leaid,
          COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0) as combined_fy25,
          COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0) as combined_fy26
        FROM districts d
        LEFT JOIN (
          SELECT leaid,
            SUM(total_spend) FILTER (WHERE fiscal_year = 'FY25') as fy25_spend,
            SUM(total_spend) FILTER (WHERE fiscal_year = 'FY26') as fy26_spend
          FROM competitor_spend
          WHERE competitor = 'Elevate K12'
          GROUP BY leaid
        ) ek12 ON ek12.leaid = d.leaid
        WHERE (COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0)) > 0
      )
      SELECT
        COUNT(*) FILTER (WHERE combined_fy26 = 0) as total_churned,
        SUM(combined_fy25) FILTER (WHERE combined_fy26 = 0) as total_churn_dollars,
        COUNT(*) FILTER (WHERE combined_fy26 > 0 AND combined_fy26 < combined_fy25) as total_contracted,
        SUM(combined_fy25 - combined_fy26) FILTER (WHERE combined_fy26 > 0 AND combined_fy26 < combined_fy25) as total_contraction_dollars
      FROM combined
    `,

    // 8. Churned districts (combined FY25 > 0, combined FY26 = 0)
    prisma.$queryRaw<ChurnedRow[]>`
      SELECT d.leaid, d.name, d.state_abbrev,
        COALESCE(d.fy25_net_invoicing,0) as fm_fy25,
        COALESCE(ek12.fy25_spend, 0) as ek12_fy25,
        COALESCE(d.fy27_open_pipeline,0) as fy27_pipeline
      FROM districts d
      LEFT JOIN (
        SELECT leaid,
          SUM(total_spend) FILTER (WHERE fiscal_year = 'FY25') as fy25_spend,
          SUM(total_spend) FILTER (WHERE fiscal_year = 'FY26') as fy26_spend
        FROM competitor_spend
        WHERE competitor = 'Elevate K12'
        GROUP BY leaid
      ) ek12 ON ek12.leaid = d.leaid
      WHERE (COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0)) > 0
        AND (COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0)) = 0
      ORDER BY (COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0)) DESC
    `,

    // 9. Contracted districts (combined FY26 > 0 but < combined FY25)
    prisma.$queryRaw<ContractedRow[]>`
      SELECT d.leaid, d.name, d.state_abbrev,
        COALESCE(d.fy25_net_invoicing,0) as fm_fy25,
        COALESCE(d.fy26_net_invoicing,0) as fm_fy26,
        COALESCE(ek12.fy25_spend, 0) as ek12_fy25,
        COALESCE(ek12.fy26_spend, 0) as ek12_fy26,
        (COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0))
          - (COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0)) as contraction,
        COALESCE(d.fy27_open_pipeline,0) as fy27_pipeline
      FROM districts d
      LEFT JOIN (
        SELECT leaid,
          SUM(total_spend) FILTER (WHERE fiscal_year = 'FY25') as fy25_spend,
          SUM(total_spend) FILTER (WHERE fiscal_year = 'FY26') as fy26_spend
        FROM competitor_spend
        WHERE competitor = 'Elevate K12'
        GROUP BY leaid
      ) ek12 ON ek12.leaid = d.leaid
      WHERE (COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0)) > 0
        AND (COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0))
            < (COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0))
      ORDER BY ((COALESCE(d.fy25_net_invoicing,0) + COALESCE(ek12.fy25_spend, 0))
                - (COALESCE(d.fy26_net_invoicing,0) + COALESCE(ek12.fy26_spend, 0))) DESC
    `,

    // 10. Growth opportunities (top 25 by FY27 pipeline)
    prisma.$queryRaw<GrowthRow[]>`
      SELECT d.leaid, d.name, d.state_abbrev,
        COALESCE(d.fy27_open_pipeline,0) as fy27_pipeline,
        COALESCE(d.fy26_net_invoicing,0) as fy26_invoicing,
        COALESCE(d.fy25_net_invoicing,0) as fy25_invoicing,
        d.enrollment, d.is_customer
      FROM districts d
      WHERE COALESCE(d.fy27_open_pipeline,0) > 0
      ORDER BY d.fy27_open_pipeline DESC
      LIMIT 25
    `,

    // 11. Bookings-to-invoicing gap (20%+ gap)
    prisma.$queryRaw<BookingsGapRow[]>`
      SELECT d.leaid, d.name, d.state_abbrev,
        COALESCE(d.fy26_closed_won_net_booking,0) as fy26_bookings,
        COALESCE(d.fy26_net_invoicing,0) as fy26_invoicing,
        COALESCE(d.fy26_closed_won_net_booking,0) - COALESCE(d.fy26_net_invoicing,0) as gap_amount,
        CASE WHEN COALESCE(d.fy26_net_invoicing,0) > 0
          THEN ROUND(((COALESCE(d.fy26_closed_won_net_booking,0) - COALESCE(d.fy26_net_invoicing,0))
                      / d.fy26_net_invoicing * 100)::numeric, 1)
          ELSE 100
        END as gap_percent
      FROM districts d
      WHERE COALESCE(d.fy26_closed_won_net_booking,0)
            > COALESCE(d.fy26_net_invoicing,0) * 1.2
      ORDER BY (COALESCE(d.fy26_closed_won_net_booking,0) - COALESCE(d.fy26_net_invoicing,0)) DESC
    `,
  ]);

  // Phase 2 — fetch tags for all relevant districts
  const allLeaids = new Set<string>();
  for (const a of topAccountsRaw) allLeaids.add(a.leaid);
  for (const c of churnedRaw) allLeaids.add(c.leaid);
  for (const c of contractedRaw) allLeaids.add(c.leaid);
  for (const g of growthRaw) allLeaids.add(g.leaid);
  const tagsMap = await getTagsForDistricts(Array.from(allLeaids));

  // Phase 3 — build revenue trajectory
  const ek12ByFY = new Map<string, number>();
  for (const row of ek12RevenueRaw) {
    ek12ByFY.set(row.fiscalYear, n(row._sum.totalSpend));
  }

  const fy25Inv = n(districtAgg._sum.fy25NetInvoicing);
  const fy26Inv = n(districtAgg._sum.fy26NetInvoicing);
  const fy27Pipe = n(districtAgg._sum.fy27OpenPipeline);
  const ek12FY24 = ek12ByFY.get("FY24") ?? 0;
  const ek12FY25 = ek12ByFY.get("FY25") ?? 0;
  const ek12FY26 = ek12ByFY.get("FY26") ?? 0;

  // Process plans
  const plans = plansRaw
    .map((p) => ({
      id: p.id,
      name: p.name,
      districtCount: p.districtCount,
      renewalRollup: n(p.renewalRollup),
      expansionRollup: n(p.expansionRollup),
      winbackRollup: n(p.winbackRollup),
      newBusinessRollup: n(p.newBusinessRollup),
      totalTarget:
        n(p.renewalRollup) +
        n(p.expansionRollup) +
        n(p.winbackRollup) +
        n(p.newBusinessRollup),
    }))
    .sort((a, b) => b.totalTarget - a.totalTarget);

  // Process target breakdown by source
  const emptyBreakdown = { renewal: 0, expansion: 0, winback: 0, newBiz: 0, total: 0, districts: 0 };
  const bdMap: Record<string, typeof emptyBreakdown> = {};
  for (const row of targetBreakdownRaw) {
    bdMap[row.source] = {
      renewal: n(row.renewal),
      expansion: n(row.expansion),
      winback: n(row.winback),
      newBiz: n(row.new_biz),
      total: n(row.total),
      districts: Number(row.district_count),
    };
  }

  const pt = planTotalsRaw[0];
  const cs = churnStatsRaw[0];

  return {
    kpis: {
      combinedFy27Target: pt ? n(pt.grand_total) : 0,
      fy27Pipeline: fy27Pipe,
      fy26CombinedRevenue: fy26Inv + ek12FY26,
      activeCustomers: customerCount,
      planCount: pt ? Number(pt.plan_count) : 0,
      totalDistrictsInPlans: pt ? Number(pt.unique_districts) : 0,
    },

    revenueTrajectory: [
      { year: "FY24", fm: 0, ek12: ek12FY24, combined: ek12FY24 },
      {
        year: "FY25",
        fm: fy25Inv,
        ek12: ek12FY25,
        combined: fy25Inv + ek12FY25,
      },
      {
        year: "FY26",
        fm: fy26Inv,
        ek12: ek12FY26,
        combined: fy26Inv + ek12FY26,
      },
      {
        year: "FY27",
        fm: fy27Pipe,
        ek12: 0,
        combined: fy27Pipe,
        isForecast: true,
      },
    ],

    plans,

    targetBreakdown: {
      fm: bdMap["FM"] ?? { ...emptyBreakdown },
      ek12: bdMap["EK12"] ?? { ...emptyBreakdown },
      both: bdMap["Both"] ?? { ...emptyBreakdown },
      untagged: bdMap["Untagged"] ?? { ...emptyBreakdown },
    },

    topAccounts: topAccountsRaw.map((a) => ({
      leaid: a.leaid,
      name: a.name,
      stateAbbrev: a.state_abbrev,
      totalTarget: n(a.total_target),
      renewalTarget: n(a.renewal_target),
      expansionTarget: n(a.expansion_target),
      winbackTarget: n(a.winback_target),
      newBusinessTarget: n(a.new_business_target),
      fy27Pipeline: n(a.fy27_pipeline),
      fy26Invoicing: n(a.fy26_invoicing),
      fy26Ek12: n(a.ek12_fy26),
      combinedFy26: n(a.fy26_invoicing) + n(a.ek12_fy26),
      enrollment: a.enrollment,
      tags: tagsMap.get(a.leaid) ?? [],
    })),

    churnSummary: {
      churnedCount: cs ? Number(cs.total_churned) : 0,
      churnedDollars: cs ? n(cs.total_churn_dollars) : 0,
      contractedCount: cs ? Number(cs.total_contracted) : 0,
      contractedDollars: cs ? n(cs.total_contraction_dollars) : 0,
    },

    churned: churnedRaw.map((c) => {
      const fmLost = n(c.fm_fy25);
      const ek12Lost = n(c.ek12_fy25);
      const source = fmLost > 0 && ek12Lost > 0 ? "Both" : ek12Lost > 0 ? "EK12" : "FM";
      return {
        leaid: c.leaid,
        name: c.name,
        stateAbbrev: c.state_abbrev,
        lostRevenue: fmLost + ek12Lost,
        lostFm: fmLost,
        lostEk12: ek12Lost,
        fy27Pipeline: n(c.fy27_pipeline),
        source,
        tags: tagsMap.get(c.leaid) ?? [],
      };
    }),

    contracted: contractedRaw.map((c) => {
      const fmFy25 = n(c.fm_fy25);
      const fmFy26 = n(c.fm_fy26);
      const ek12Fy25 = n(c.ek12_fy25);
      const ek12Fy26 = n(c.ek12_fy26);
      const hasFm = fmFy25 > 0 || fmFy26 > 0;
      const hasEk12 = ek12Fy25 > 0 || ek12Fy26 > 0;
      const source = hasFm && hasEk12 ? "Both" : hasEk12 ? "EK12" : "FM";
      return {
        leaid: c.leaid,
        name: c.name,
        stateAbbrev: c.state_abbrev,
        fy25Combined: fmFy25 + ek12Fy25,
        fy26Combined: fmFy26 + ek12Fy26,
        contraction: n(c.contraction),
        fy27Pipeline: n(c.fy27_pipeline),
        source,
        tags: tagsMap.get(c.leaid) ?? [],
      };
    }),

    growth: growthRaw.map((g) => {
      const tags = tagsMap.get(g.leaid) ?? [];
      const isEK12 = tags.some((t) => t.startsWith("EK12"));
      return {
        leaid: g.leaid,
        name: g.name,
        stateAbbrev: g.state_abbrev,
        fy27Pipeline: n(g.fy27_pipeline),
        fy26Invoicing: n(g.fy26_invoicing),
        fy25Invoicing: n(g.fy25_invoicing),
        enrollment: g.enrollment,
        type: isEK12 ? "EK12" : g.is_customer ? "EXISTING" : "NEW BIZ",
        tags,
      };
    }),

    bookingsGap: bookingsGapRaw.map((b) => ({
      leaid: b.leaid,
      name: b.name,
      stateAbbrev: b.state_abbrev,
      fy26Bookings: n(b.fy26_bookings),
      fy26Invoicing: n(b.fy26_invoicing),
      gapAmount: n(b.gap_amount),
      gapPercent: n(b.gap_percent),
    })),
  };
}
