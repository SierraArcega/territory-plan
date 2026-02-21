/**
 * Generates a static markdown document version of the FY27 Sales Trajectory Dashboard.
 * Run: npx tsx scripts/generate-fy27-trajectory-doc.ts
 */
import { Client } from "pg";
import { config } from "dotenv";
import { writeFileSync } from "fs";

config();

function fmtDollar(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtCompact(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
}

function n(v: any): number {
  return v != null ? Number(v) : 0;
}

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const lines: string[] = [];
  const push = (...args: string[]) => lines.push(...args);

  // ─── 1. Portfolio Summary ──────────────────────────────────────
  const summary = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE is_customer = true) as total_customers,
      SUM(fy25_net_invoicing) as total_fy25_invoicing,
      SUM(fy26_net_invoicing) as total_fy26_invoicing,
      SUM(fy26_closed_won_net_booking) as total_fy26_bookings,
      SUM(fy27_open_pipeline) as total_fy27_pipeline
    FROM districts
  `);

  const ek12Rev = await client.query(`
    SELECT fiscal_year, SUM(total_spend) as spend
    FROM competitor_spend
    WHERE competitor = 'Elevate K12'
    GROUP BY fiscal_year
    ORDER BY fiscal_year
  `);

  const planTotals = await client.query(`
    SELECT
      COUNT(DISTINCT tp.id) as plan_count,
      COUNT(DISTINCT tpd.district_leaid) as unique_districts,
      SUM(COALESCE(tpd.renewal_target, 0)) as total_renewal,
      SUM(COALESCE(tpd.expansion_target, 0)) as total_expansion,
      SUM(COALESCE(tpd.winback_target, 0)) as total_winback,
      SUM(COALESCE(tpd.new_business_target, 0)) as total_new_biz,
      SUM(COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
          COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) as grand_total
    FROM territory_plans tp
    JOIN territory_plan_districts tpd ON tpd.plan_id = tp.id
    WHERE tp.fiscal_year = 2027
  `);

  const s = summary.rows[0];
  const pt = planTotals.rows[0];
  const ek12Map: Record<string, number> = {};
  for (const r of ek12Rev.rows) ek12Map[r.fiscal_year] = n(r.spend);

  const fy25 = n(s.total_fy25_invoicing);
  const fy26 = n(s.total_fy26_invoicing);
  const fy27Pipeline = n(s.total_fy27_pipeline);
  const ek12FY24 = ek12Map["FY24"] ?? 0;
  const ek12FY25 = ek12Map["FY25"] ?? 0;
  const ek12FY26 = ek12Map["FY26"] ?? 0;
  const grandTotal = n(pt.grand_total);

  push(
    `# Fullmind x Elevate K12 — FY27 Sales Trajectory`,
    ``,
    `**Date:** ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}  `,
    `**Prepared by:** Sierra Holstad  `,
    `**Status:** Confidential — Board & Executive Review`,
    ``,
    `---`,
    ``,
    `## Executive Summary`,
    ``,
    `Fullmind and Elevate K12 are merging. This document presents the combined FY27 sales`,
    `opportunity — territory plan targets, revenue trajectory, churn risk, growth opportunities,`,
    `bookings-to-invoicing gaps, and a 90-day integration plan.`,
    ``,
    `---`,
    ``,
    `## 1. Hero KPIs`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Combined FY27 Target** | **${fmtCompact(grandTotal)}** |`,
    `| **FY27 Pipeline** | **${fmtCompact(fy27Pipeline)}** |`,
    `| **FY26 Combined Revenue** (FM + EK12) | **${fmtCompact(fy26 + ek12FY26)}** |`,
    `| **Active Customers** | **${n(s.total_customers).toLocaleString()}** |`,
    `| **Territory Plans** | **${n(pt.plan_count)}** covering **${n(pt.unique_districts).toLocaleString()}** districts |`,
    ``,
    `### Target Breakdown`,
    ``,
    `| Category | Amount |`,
    `|----------|--------|`,
    `| Renewal | ${fmtDollar(n(pt.total_renewal))} |`,
    `| Expansion | ${fmtDollar(n(pt.total_expansion))} |`,
    `| Winback | ${fmtDollar(n(pt.total_winback))} |`,
    `| New Business | ${fmtDollar(n(pt.total_new_biz))} |`,
    `| **Grand Total** | **${fmtDollar(grandTotal)}** |`,
    ``,
    `---`,
    ``,
    `## 2. Combined Revenue Trajectory`,
    ``,
    `| Fiscal Year | Fullmind | Elevate K12 | Combined |`,
    `|-------------|----------|-------------|----------|`,
    `| FY24 | — | ${fmtDollar(ek12FY24)} | ${fmtDollar(ek12FY24)} |`,
    `| FY25 | ${fmtDollar(fy25)} | ${fmtDollar(ek12FY25)} | ${fmtDollar(fy25 + ek12FY25)} |`,
    `| FY26 | ${fmtDollar(fy26)} | ${fmtDollar(ek12FY26)} | ${fmtDollar(fy26 + ek12FY26)} |`,
    `| FY27 (Pipeline) | ${fmtDollar(fy27Pipeline)} | TBD | ${fmtDollar(fy27Pipeline)} |`,
    ``,
    `> **Note:** FY27 shows pipeline (forecast). No FY24 Fullmind data available. EK12 FY27 targets are included in the combined territory plan targets above.`,
    ``
  );

  // ─── 3. Territory Plans ────────────────────────────────────────
  const plans = await client.query(`
    SELECT
      tp.name,
      tp.district_count,
      tp.renewal_rollup,
      tp.expansion_rollup,
      tp.winback_rollup,
      tp.new_business_rollup,
      (COALESCE(tp.renewal_rollup, 0) + COALESCE(tp.expansion_rollup, 0) +
       COALESCE(tp.winback_rollup, 0) + COALESCE(tp.new_business_rollup, 0)) as total_target
    FROM territory_plans tp
    WHERE tp.fiscal_year = 2027
    ORDER BY (COALESCE(tp.renewal_rollup, 0) + COALESCE(tp.expansion_rollup, 0) +
       COALESCE(tp.winback_rollup, 0) + COALESCE(tp.new_business_rollup, 0)) DESC
  `);

  push(
    `---`,
    ``,
    `## 3. FY27 Territory Plans (${plans.rows.length})`,
    ``,
    `| Plan | Districts | Renewal | Expansion | Winback | New Biz | Total | Owner |`,
    `|------|-----------|---------|-----------|---------|---------|-------|-------|`
  );

  for (const p of plans.rows) {
    const total = n(p.total_target);
    push(
      `| ${p.name} | ${p.district_count} | ${n(p.renewal_rollup) > 0 ? fmtDollar(n(p.renewal_rollup)) : "—"} | ${n(p.expansion_rollup) > 0 ? fmtDollar(n(p.expansion_rollup)) : "—"} | ${n(p.winback_rollup) > 0 ? fmtDollar(n(p.winback_rollup)) : "—"} | ${n(p.new_business_rollup) > 0 ? fmtDollar(n(p.new_business_rollup)) : "—"} | **${fmtDollar(total)}** | Sierra |`
    );
  }
  push(``);

  // ─── 4. Top Accounts ───────────────────────────────────────────
  const topAccounts = await client.query(`
    SELECT
      tpd.district_leaid as leaid,
      d.name, d.state_abbrev,
      SUM(COALESCE(tpd.renewal_target, 0)) as renewal_target,
      SUM(COALESCE(tpd.expansion_target, 0)) as expansion_target,
      SUM(COALESCE(tpd.winback_target, 0)) as winback_target,
      SUM(COALESCE(tpd.new_business_target, 0)) as new_business_target,
      SUM(COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
          COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) as total_target,
      COALESCE(d.fy27_open_pipeline, 0) as fy27_pipeline,
      COALESCE(d.fy26_net_invoicing, 0) as fy26_invoicing,
      d.enrollment
    FROM territory_plan_districts tpd
    JOIN territory_plans tp ON tp.id = tpd.plan_id
    JOIN districts d ON d.leaid = tpd.district_leaid
    WHERE tp.fiscal_year = 2027
    GROUP BY tpd.district_leaid, d.name, d.state_abbrev,
             d.fy27_open_pipeline, d.fy26_net_invoicing, d.enrollment
    ORDER BY total_target DESC
    LIMIT 25
  `);

  // Get tags for top accounts
  const topLeaids = topAccounts.rows.map((r: any) => `'${r.leaid}'`).join(",");
  const topTags = topLeaids
    ? await client.query(`
        SELECT dt.district_leaid, t.name
        FROM district_tags dt
        JOIN tags t ON dt.tag_id = t.id
        WHERE dt.district_leaid IN (${topLeaids})
          AND t.name NOT IN ('City', 'Suburb', 'Town', 'Rural')
      `)
    : { rows: [] };

  const tagMap: Record<string, string[]> = {};
  for (const t of topTags.rows) {
    if (!tagMap[t.district_leaid]) tagMap[t.district_leaid] = [];
    tagMap[t.district_leaid].push(t.name);
  }

  push(
    `---`,
    ``,
    `## 4. Top 25 Accounts by FY27 Target`,
    ``,
    `| # | Account | State | Tags | Total Target | FY27 Pipeline | FY26 Invoicing | Enrollment |`,
    `|---|---------|-------|------|-------------|---------------|---------------|------------|`
  );

  topAccounts.rows.forEach((a: any, i: number) => {
    const tags = (tagMap[a.leaid] ?? []).slice(0, 2).join(", ");
    push(
      `| ${i + 1} | ${a.name} | ${a.state_abbrev ?? ""} | ${tags} | **${fmtDollar(n(a.total_target))}** | ${n(a.fy27_pipeline) > 0 ? fmtDollar(n(a.fy27_pipeline)) : "—"} | ${n(a.fy26_invoicing) > 0 ? fmtDollar(n(a.fy26_invoicing)) : "—"} | ${n(a.enrollment).toLocaleString()} |`
    );
  });
  push(``);

  // ─── 5. Churn & Contraction Risk ──────────────────────────────
  const churnStats = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) = 0) as total_churned,
      SUM(fy25_net_invoicing) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) = 0) as total_churn_dollars,
      COUNT(*) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) > 0 AND fy26_net_invoicing < fy25_net_invoicing) as total_contracted,
      SUM(fy25_net_invoicing - fy26_net_invoicing) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) > 0 AND fy26_net_invoicing < fy25_net_invoicing) as total_contraction_dollars
    FROM districts
    WHERE COALESCE(fy25_net_invoicing, 0) > 0
      AND (COALESCE(fy26_net_invoicing, 0) = 0 OR fy26_net_invoicing < fy25_net_invoicing)
  `);

  const cs = churnStats.rows[0];
  const churnedCount = n(cs.total_churned);
  const churnedDollars = n(cs.total_churn_dollars);
  const contractedCount = n(cs.total_contracted);
  const contractedDollars = n(cs.total_contraction_dollars);

  push(
    `---`,
    ``,
    `## 5. Churn & Contraction Risk`,
    ``,
    `| Category | Accounts | Revenue Impact |`,
    `|----------|----------|---------------|`,
    `| Churned (FY25 revenue, $0 FY26) | ${churnedCount} | ${fmtCompact(churnedDollars)} lost |`,
    `| Contracted (FY26 < FY25) | ${contractedCount} | ${fmtCompact(contractedDollars)} decline |`,
    `| **Total At Risk** | **${churnedCount + contractedCount}** | **${fmtCompact(churnedDollars + contractedDollars)}** |`,
    ``
  );

  const churned = await client.query(`
    SELECT d.leaid, d.name, d.state_abbrev,
      COALESCE(d.fy25_net_invoicing, 0) as fy25_invoicing,
      COALESCE(d.fy27_open_pipeline, 0) as fy27_pipeline
    FROM districts d
    WHERE COALESCE(d.fy25_net_invoicing, 0) > 0
      AND COALESCE(d.fy26_net_invoicing, 0) = 0
    ORDER BY COALESCE(d.fy25_net_invoicing, 0) DESC
    LIMIT 15
  `);

  push(
    `### Top Churned Accounts`,
    ``,
    `| Account | State | Lost Revenue | FY27 Pipeline | Risk |`,
    `|---------|-------|-------------|--------------|------|`
  );

  for (const c of churned.rows) {
    const pipeline = n(c.fy27_pipeline);
    push(
      `| ${c.name} | ${c.state_abbrev ?? ""} | ${fmtDollar(n(c.fy25_invoicing))} | ${pipeline > 0 ? fmtDollar(pipeline) : "—"} | ${pipeline === 0 ? "**No pipeline**" : "Recovery possible"} |`
    );
  }
  push(``);

  const contracted = await client.query(`
    SELECT d.leaid, d.name, d.state_abbrev,
      COALESCE(d.fy25_net_invoicing, 0) as fy25_invoicing,
      COALESCE(d.fy26_net_invoicing, 0) as fy26_invoicing,
      COALESCE(d.fy25_net_invoicing, 0) - COALESCE(d.fy26_net_invoicing, 0) as contraction,
      COALESCE(d.fy27_open_pipeline, 0) as fy27_pipeline
    FROM districts d
    WHERE COALESCE(d.fy26_net_invoicing, 0) > 0
      AND COALESCE(d.fy26_net_invoicing, 0) < COALESCE(d.fy25_net_invoicing, 0)
    ORDER BY (COALESCE(d.fy25_net_invoicing, 0) - COALESCE(d.fy26_net_invoicing, 0)) DESC
    LIMIT 15
  `);

  push(
    `### Top Contracted Accounts`,
    ``,
    `| Account | State | FY25 | FY26 | Decline | FY27 Pipeline |`,
    `|---------|-------|------|------|---------|--------------|`
  );

  for (const c of contracted.rows) {
    push(
      `| ${c.name} | ${c.state_abbrev ?? ""} | ${fmtDollar(n(c.fy25_invoicing))} | ${fmtDollar(n(c.fy26_invoicing))} | -${fmtDollar(n(c.contraction))} | ${n(c.fy27_pipeline) > 0 ? fmtDollar(n(c.fy27_pipeline)) : "—"} |`
    );
  }
  push(``);

  // ─── 6. Growth Opportunities ───────────────────────────────────
  const growth = await client.query(`
    SELECT d.leaid, d.name, d.state_abbrev,
      COALESCE(d.fy27_open_pipeline, 0) as fy27_pipeline,
      COALESCE(d.fy26_net_invoicing, 0) as fy26_invoicing,
      COALESCE(d.fy25_net_invoicing, 0) as fy25_invoicing,
      d.enrollment, d.is_customer
    FROM districts d
    WHERE COALESCE(d.fy27_open_pipeline, 0) > 0
    ORDER BY d.fy27_open_pipeline DESC
    LIMIT 25
  `);

  // Get tags for growth
  const growthLeaids = growth.rows.map((r: any) => `'${r.leaid}'`).join(",");
  const growthTags = growthLeaids
    ? await client.query(`
        SELECT dt.district_leaid, t.name
        FROM district_tags dt
        JOIN tags t ON dt.tag_id = t.id
        WHERE dt.district_leaid IN (${growthLeaids})
          AND t.name NOT IN ('City', 'Suburb', 'Town', 'Rural')
      `)
    : { rows: [] };

  const growthTagMap: Record<string, string[]> = {};
  for (const t of growthTags.rows) {
    if (!growthTagMap[t.district_leaid]) growthTagMap[t.district_leaid] = [];
    growthTagMap[t.district_leaid].push(t.name);
  }

  push(
    `---`,
    ``,
    `## 6. Growth Opportunities (Top 25 by FY27 Pipeline)`,
    ``,
    `| # | Account | State | Type | FY27 Pipeline | FY26 Invoicing | Enrollment |`,
    `|---|---------|-------|------|--------------|---------------|------------|`
  );

  growth.rows.forEach((g: any, i: number) => {
    const tags = growthTagMap[g.leaid] ?? [];
    const isEK12 = tags.some((t: string) => t.startsWith("EK12"));
    const type = isEK12 ? "EK12" : g.is_customer ? "EXISTING" : "NEW BIZ";
    push(
      `| ${i + 1} | ${g.name} | ${g.state_abbrev ?? ""} | ${type} | **${fmtDollar(n(g.fy27_pipeline))}** | ${n(g.fy26_invoicing) > 0 ? fmtDollar(n(g.fy26_invoicing)) : "—"} | ${n(g.enrollment).toLocaleString()} |`
    );
  });
  push(``);

  // ─── 7. Bookings-to-Invoicing Gap ─────────────────────────────
  const gap = await client.query(`
    SELECT d.leaid, d.name, d.state_abbrev,
      COALESCE(d.fy26_closed_won_net_booking, 0) as fy26_bookings,
      COALESCE(d.fy26_net_invoicing, 0) as fy26_invoicing,
      COALESCE(d.fy26_closed_won_net_booking, 0) - COALESCE(d.fy26_net_invoicing, 0) as gap_amount,
      CASE WHEN COALESCE(d.fy26_net_invoicing, 0) > 0
        THEN ROUND(((COALESCE(d.fy26_closed_won_net_booking, 0) - COALESCE(d.fy26_net_invoicing, 0))
                    / d.fy26_net_invoicing * 100)::numeric, 1)
        ELSE 100
      END as gap_percent
    FROM districts d
    WHERE COALESCE(d.fy26_closed_won_net_booking, 0)
          > COALESCE(d.fy26_net_invoicing, 0) * 1.2
    ORDER BY (COALESCE(d.fy26_closed_won_net_booking, 0) - COALESCE(d.fy26_net_invoicing, 0)) DESC
  `);

  push(
    `---`,
    ``,
    `## 7. Bookings-to-Invoicing Gap (Pilot Candidates)`,
    ``,
    `Districts where FY26 closed-won bookings exceed FY26 invoicing by 20%+.`,
    `These deals were signed but not fully delivered — pilot candidates to close the gap before FY27 starts in June.`,
    ``,
    `| District | State | FY26 Bookings | FY26 Invoicing | Gap | Gap % |`,
    `|----------|-------|--------------|---------------|-----|-------|`
  );

  for (const b of gap.rows) {
    push(
      `| ${b.name} | ${b.state_abbrev ?? ""} | ${fmtDollar(n(b.fy26_bookings))} | ${fmtDollar(n(b.fy26_invoicing))} | ${fmtDollar(n(b.gap_amount))} | +${n(b.gap_percent).toFixed(0)}% |`
    );
  }
  push(``);

  // ─── 8. 90-Day Integration Plan ───────────────────────────────
  push(
    `---`,
    ``,
    `## 8. 90-Day Integration Plan`,
    ``,
    `### Phase 1: Days 1-30 — Map the Landscape`,
    ``,
    `- Assign territories across 50 states — divide customer book between FM and EK12 reps by state clusters`,
    `- Consolidate duplicate territory plans into unified FY27 plan set`,
    `- Merge EK12 customer book into Fullmind CRM (map EK12 accounts to NCES district IDs)`,
    `- Identify top 25 at-risk accounts for immediate retention outreach`,
    `- Build unified KPI dashboard for weekly board reporting`,
    ``,
    `### Phase 2: Days 31-60 — Protect & Accelerate`,
    ``,
    `- Lock renewals with existing customers — target 90%+ renewal rate across combined book`,
    `- Activate FY27 pipeline — move deals from discovery to proposal stage`,
    `- Launch service pilots for bookings-gap accounts (close delivery gap before June FY27 start)`,
    `- EK12 customer introductions: pair Fullmind service team with existing EK12 relationships`,
    `- Cross-sell play: introduce EK12 customers to Fullmind's broader service catalog`,
    ``,
    `### Phase 3: Days 61-90 — Show Momentum`,
    ``,
    `- Close first wave of FY27 deals — $5M combined pipeline conversion target`,
    `- Churn-warning outreach to all zero-pipeline churned accounts (${fmtCompact(churnedDollars)} recovery opportunity)`,
    `- Board-ready dashboard showing combined revenue trajectory and FY27 forecast confidence`,
    `- Territory assignment strategy finalized: state-cluster model with shared major accounts`,
    `- Weekly deal review cadence established across combined sales org`,
    ``,
    `### Territory Assignment Strategy: Divide & Conquer`,
    ``,
    `**Approach:**`,
    `- Group states into 4-6 territory clusters based on customer density and opportunity`,
    `- Assign primary rep per cluster — owns all accounts in the region`,
    `- Shared coverage for top-25 accounts that span multiple clusters`,
    `- EK12 reps keep existing relationships during 90-day transition`,
    ``,
    `**Success Metrics:**`,
    `- 100% territory coverage within 30 days`,
    `- Zero accounts without a named owner by Day 45`,
    `- Renewal rate >= 90% across combined book`,
    `- $5M FY27 pipeline converted by Day 90`,
    ``,
    `---`,
    ``,
    `*Fullmind x Elevate K12 — FY27 Sales Trajectory — Confidential*`
  );

  // Write the file
  const output = lines.join("\n");
  const outPath = "Docs/FY27-Sales-Trajectory.md";
  writeFileSync(outPath, output, "utf8");
  console.log(`Generated: ${outPath} (${lines.length} lines)`);

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
