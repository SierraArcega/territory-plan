import { Client } from "pg";
import { config } from "dotenv";

config();

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
  });

  await client.connect();
  console.log("Connected to database\n");

  // ─── 1. FY27 Territory Plans Overview ─────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FY2027 TERRITORY PLANS OVERVIEW");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const plans = await client.query(`
    SELECT
      tp.id,
      tp.name,
      tp.status,
      tp.fiscal_year,
      tp.district_count,
      tp.state_count,
      tp.renewal_rollup,
      tp.expansion_rollup,
      tp.winback_rollup,
      tp.new_business_rollup,
      (COALESCE(tp.renewal_rollup, 0) + COALESCE(tp.expansion_rollup, 0) +
       COALESCE(tp.winback_rollup, 0) + COALESCE(tp.new_business_rollup, 0)) as total_target,
      tp.created_at,
      up.full_name as owner_name,
      up.email as owner_email
    FROM territory_plans tp
    LEFT JOIN user_profiles up ON tp.owner_id = up.id
    WHERE tp.fiscal_year = 2027
    ORDER BY (COALESCE(tp.renewal_rollup, 0) + COALESCE(tp.expansion_rollup, 0) +
       COALESCE(tp.winback_rollup, 0) + COALESCE(tp.new_business_rollup, 0)) DESC
  `);

  if (plans.rows.length === 0) {
    console.log("  No FY2027 territory plans found.\n");
  } else {
    for (const p of plans.rows) {
      console.log(`  Plan: ${p.name}`);
      console.log(`    Owner: ${p.owner_name || 'Unassigned'} (${p.owner_email || 'N/A'})`);
      console.log(`    Status: ${p.status}`);
      console.log(`    Districts: ${p.district_count} across ${p.state_count} states`);
      console.log(`    Renewal Target:      $${Number(p.renewal_rollup || 0).toLocaleString()}`);
      console.log(`    Expansion Target:    $${Number(p.expansion_rollup || 0).toLocaleString()}`);
      console.log(`    Winback Target:      $${Number(p.winback_rollup || 0).toLocaleString()}`);
      console.log(`    New Business Target: $${Number(p.new_business_rollup || 0).toLocaleString()}`);
      console.log(`    TOTAL TARGET:        $${Number(p.total_target || 0).toLocaleString()}`);
      console.log("");
    }
  }

  const planIds = plans.rows.map((p: any) => p.id);

  // ─── 2. All FY27 Plan Districts with Details ─────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TOP ACCOUNTS BY TOTAL TARGET (FY27 Plans)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (planIds.length > 0) {
    const topAccounts = await client.query(`
      SELECT
        d.leaid,
        d.name as district_name,
        d.state_abbrev,
        d.total_enrollment,
        d.is_customer,
        d.fy25_net_invoicing,
        d.fy26_net_invoicing,
        d.fy26_closed_won_net_booking,
        d.fy26_open_pipeline,
        d.fy27_open_pipeline,
        d.fy27_open_pipeline_weighted,
        d.fy27_open_pipeline_opp_count,
        tp.name as plan_name,
        tpd.renewal_target,
        tpd.expansion_target,
        tpd.winback_target,
        tpd.new_business_target,
        (COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
         COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) as total_district_target,
        tpd.notes
      FROM territory_plan_districts tpd
      JOIN territory_plans tp ON tpd.plan_id = tp.id
      JOIN districts d ON tpd.district_leaid = d.leaid
      WHERE tp.fiscal_year = 2027
      ORDER BY (COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
         COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) DESC
      LIMIT 30
    `);

    for (const a of topAccounts.rows) {
      const totalTarget = Number(a.total_district_target || 0);
      console.log(`  ${a.district_name} (${a.state}) — ${a.leaid}`);
      console.log(`    Plan: ${a.plan_name}`);
      console.log(`    Customer: ${a.is_customer ? 'YES' : 'NO'}  |  Enrollment: ${Number(a.total_enrollment || 0).toLocaleString()}`);
      console.log(`    FY25 Invoicing: $${Number(a.fy25_net_invoicing || 0).toLocaleString()}`);
      console.log(`    FY26 Invoicing: $${Number(a.fy26_net_invoicing || 0).toLocaleString()}`);
      console.log(`    FY26 Closed Won: $${Number(a.fy26_closed_won_net_booking || 0).toLocaleString()}`);
      console.log(`    FY27 Pipeline: $${Number(a.fy27_open_pipeline || 0).toLocaleString()} (${a.fy27_open_pipeline_opp_count || 0} opps)`);
      console.log(`    FY27 Weighted: $${Number(a.fy27_open_pipeline_weighted || 0).toLocaleString()}`);
      console.log(`    ── Targets ──`);
      if (Number(a.renewal_target || 0) > 0) console.log(`      Renewal:      $${Number(a.renewal_target).toLocaleString()}`);
      if (Number(a.expansion_target || 0) > 0) console.log(`      Expansion:    $${Number(a.expansion_target).toLocaleString()}`);
      if (Number(a.winback_target || 0) > 0) console.log(`      Winback:      $${Number(a.winback_target).toLocaleString()}`);
      if (Number(a.new_business_target || 0) > 0) console.log(`      New Business: $${Number(a.new_business_target).toLocaleString()}`);
      console.log(`      TOTAL:        $${totalTarget.toLocaleString()}`);
      if (a.notes) console.log(`    Notes: ${a.notes}`);
      console.log("");
    }
  }

  // ─── 3. Churn & Contraction Risk ─────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CHURN & CONTRACTION RISK (Customers with declining revenue)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Customers with FY25 invoicing > FY26 invoicing (declining) or FY25 but no FY26 (churn)
  const churnRisk = await client.query(`
    SELECT
      d.leaid,
      d.name as district_name,
      d.state_abbrev,
      d.total_enrollment,
      d.is_customer,
      d.fy25_net_invoicing,
      d.fy26_net_invoicing,
      d.fy26_closed_won_net_booking,
      d.fy27_open_pipeline,
      d.fy27_open_pipeline_weighted,
      (COALESCE(d.fy26_net_invoicing, 0) - COALESCE(d.fy25_net_invoicing, 0)) as yoy_change,
      CASE
        WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        THEN ROUND(((COALESCE(d.fy26_net_invoicing, 0) - COALESCE(d.fy25_net_invoicing, 0)) / d.fy25_net_invoicing * 100)::numeric, 1)
        ELSE NULL
      END as yoy_pct_change,
      -- Check if this district is in any FY27 plan
      EXISTS (
        SELECT 1 FROM territory_plan_districts tpd
        JOIN territory_plans tp ON tpd.plan_id = tp.id
        WHERE tp.fiscal_year = 2027 AND tpd.district_leaid = d.leaid
      ) as in_fy27_plan
    FROM districts d
    WHERE d.is_customer = true
      AND COALESCE(d.fy25_net_invoicing, 0) > 0
      AND (
        -- Total churn: had FY25 revenue but zero FY26
        COALESCE(d.fy26_net_invoicing, 0) = 0
        OR
        -- Contraction: FY26 < FY25
        COALESCE(d.fy26_net_invoicing, 0) < COALESCE(d.fy25_net_invoicing, 0)
      )
    ORDER BY (COALESCE(d.fy25_net_invoicing, 0) - COALESCE(d.fy26_net_invoicing, 0)) DESC
    LIMIT 25
  `);

  let churned = 0;
  let contracted = 0;
  let totalChurnDollars = 0;
  let totalContractionDollars = 0;

  for (const c of churnRisk.rows) {
    const fy25 = Number(c.fy25_net_invoicing || 0);
    const fy26 = Number(c.fy26_net_invoicing || 0);
    const change = Number(c.yoy_change);
    const isChurn = fy26 === 0;

    if (isChurn) {
      churned++;
      totalChurnDollars += fy25;
    } else {
      contracted++;
      totalContractionDollars += Math.abs(change);
    }

    console.log(`  ${isChurn ? '🔴 CHURNED' : '🟡 CONTRACTED'} — ${c.district_name} (${c.state})`);
    console.log(`    Enrollment: ${Number(c.total_enrollment || 0).toLocaleString()}`);
    console.log(`    FY25: $${fy25.toLocaleString()}  →  FY26: $${fy26.toLocaleString()}  (${c.yoy_pct_change}%)`);
    console.log(`    FY27 Pipeline: $${Number(c.fy27_open_pipeline || 0).toLocaleString()}`);
    console.log(`    In FY27 Plan: ${c.in_fy27_plan ? 'YES' : 'NO'}`);
    console.log("");
  }

  console.log(`  Summary: ${churned} churned ($${totalChurnDollars.toLocaleString()} lost)`);
  console.log(`           ${contracted} contracted ($${totalContractionDollars.toLocaleString()} reduction)\n`);

  // Full churn/contraction counts
  const fullChurnStats = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) = 0) as total_churned,
      SUM(fy25_net_invoicing) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) = 0) as total_churn_dollars,
      COUNT(*) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) > 0 AND fy26_net_invoicing < fy25_net_invoicing) as total_contracted,
      SUM(fy25_net_invoicing - fy26_net_invoicing) FILTER (WHERE COALESCE(fy26_net_invoicing, 0) > 0 AND fy26_net_invoicing < fy25_net_invoicing) as total_contraction_dollars
    FROM districts
    WHERE is_customer = true
      AND COALESCE(fy25_net_invoicing, 0) > 0
      AND (COALESCE(fy26_net_invoicing, 0) = 0 OR fy26_net_invoicing < fy25_net_invoicing)
  `);

  if (fullChurnStats.rows.length > 0) {
    const s = fullChurnStats.rows[0];
    console.log(`  FULL PORTFOLIO CHURN/CONTRACTION:`);
    console.log(`    Total Churned: ${s.total_churned} districts ($${Number(s.total_churn_dollars || 0).toLocaleString()})`);
    console.log(`    Total Contracted: ${s.total_contracted} districts ($${Number(s.total_contraction_dollars || 0).toLocaleString()})\n`);
  }

  // ─── 4. Biggest Growth Opportunities ─────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BIGGEST GROWTH OPPORTUNITIES");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Districts with largest FY27 pipeline
  const growth = await client.query(`
    SELECT
      d.leaid,
      d.name as district_name,
      d.state_abbrev,
      d.total_enrollment,
      d.is_customer,
      d.fy25_net_invoicing,
      d.fy26_net_invoicing,
      d.fy26_closed_won_net_booking,
      d.fy27_open_pipeline,
      d.fy27_open_pipeline_weighted,
      d.fy27_open_pipeline_opp_count,
      -- Check if in any FY27 plan
      EXISTS (
        SELECT 1 FROM territory_plan_districts tpd
        JOIN territory_plans tp ON tpd.plan_id = tp.id
        WHERE tp.fiscal_year = 2027 AND tpd.district_leaid = d.leaid
      ) as in_fy27_plan
    FROM districts d
    WHERE COALESCE(d.fy27_open_pipeline, 0) > 0
    ORDER BY d.fy27_open_pipeline DESC
    LIMIT 25
  `);

  for (const g of growth.rows) {
    const label = g.is_customer ? 'EXISTING' : 'NEW BIZ';
    console.log(`  [${label}] ${g.district_name} (${g.state})`);
    console.log(`    Enrollment: ${Number(g.total_enrollment || 0).toLocaleString()}`);
    console.log(`    FY25 Invoicing: $${Number(g.fy25_net_invoicing || 0).toLocaleString()}`);
    console.log(`    FY26 Invoicing: $${Number(g.fy26_net_invoicing || 0).toLocaleString()}`);
    console.log(`    FY27 Pipeline: $${Number(g.fy27_open_pipeline || 0).toLocaleString()} (${g.fy27_open_pipeline_opp_count} opps, weighted: $${Number(g.fy27_open_pipeline_weighted || 0).toLocaleString()})`);
    console.log(`    In FY27 Plan: ${g.in_fy27_plan ? 'YES' : 'NO'}`);
    console.log("");
  }

  // ─── 5. Expansion accounts: YoY growth ─────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TOP EXPANDING ACCOUNTS (FY25 → FY26 growth)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const expanding = await client.query(`
    SELECT
      d.leaid,
      d.name as district_name,
      d.state_abbrev,
      d.total_enrollment,
      d.fy25_net_invoicing,
      d.fy26_net_invoicing,
      d.fy27_open_pipeline,
      d.fy27_open_pipeline_weighted,
      (COALESCE(d.fy26_net_invoicing, 0) - COALESCE(d.fy25_net_invoicing, 0)) as yoy_growth,
      CASE
        WHEN COALESCE(d.fy25_net_invoicing, 0) > 0
        THEN ROUND(((COALESCE(d.fy26_net_invoicing, 0) - d.fy25_net_invoicing) / d.fy25_net_invoicing * 100)::numeric, 1)
        ELSE NULL
      END as yoy_pct
    FROM districts d
    WHERE d.is_customer = true
      AND COALESCE(d.fy25_net_invoicing, 0) > 0
      AND COALESCE(d.fy26_net_invoicing, 0) > d.fy25_net_invoicing
    ORDER BY (COALESCE(d.fy26_net_invoicing, 0) - COALESCE(d.fy25_net_invoicing, 0)) DESC
    LIMIT 15
  `);

  for (const e of expanding.rows) {
    console.log(`  ${e.district_name} (${e.state})`);
    console.log(`    FY25: $${Number(e.fy25_net_invoicing || 0).toLocaleString()}  →  FY26: $${Number(e.fy26_net_invoicing || 0).toLocaleString()}  (+${e.yoy_pct}%)`);
    console.log(`    Growth: +$${Number(e.yoy_growth || 0).toLocaleString()}`);
    console.log(`    FY27 Pipeline: $${Number(e.fy27_open_pipeline || 0).toLocaleString()}`);
    console.log("");
  }

  // ─── 6. Portfolio Summary ────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PORTFOLIO SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const summary = await client.query(`
    SELECT
      COUNT(*) as total_districts,
      COUNT(*) FILTER (WHERE is_customer = true) as total_customers,
      SUM(fy25_net_invoicing) as total_fy25_invoicing,
      SUM(fy26_net_invoicing) as total_fy26_invoicing,
      SUM(fy26_closed_won_net_booking) as total_fy26_bookings,
      SUM(fy27_open_pipeline) as total_fy27_pipeline,
      SUM(fy27_open_pipeline_weighted) as total_fy27_weighted_pipeline,
      COUNT(*) FILTER (WHERE COALESCE(fy27_open_pipeline, 0) > 0) as districts_with_fy27_pipeline,
      SUM(fy27_open_pipeline_opp_count) as total_fy27_opps
    FROM districts
  `);

  const s = summary.rows[0];
  console.log(`  Total Districts in DB: ${Number(s.total_districts).toLocaleString()}`);
  console.log(`  Total Customers: ${Number(s.total_customers).toLocaleString()}`);
  console.log(`  FY25 Total Invoicing: $${Number(s.total_fy25_invoicing || 0).toLocaleString()}`);
  console.log(`  FY26 Total Invoicing: $${Number(s.total_fy26_invoicing || 0).toLocaleString()}`);
  console.log(`  FY26 Total Bookings: $${Number(s.total_fy26_bookings || 0).toLocaleString()}`);
  console.log(`  FY27 Total Pipeline: $${Number(s.total_fy27_pipeline || 0).toLocaleString()} (${s.total_fy27_opps || 0} opps across ${s.districts_with_fy27_pipeline || 0} districts)`);
  console.log(`  FY27 Weighted Pipeline: $${Number(s.total_fy27_weighted_pipeline || 0).toLocaleString()}\n`);

  // YoY revenue
  const fy25Total = Number(s.total_fy25_invoicing || 0);
  const fy26Total = Number(s.total_fy26_invoicing || 0);
  if (fy25Total > 0) {
    const yoyPct = ((fy26Total - fy25Total) / fy25Total * 100).toFixed(1);
    console.log(`  FY25 → FY26 YoY Revenue Change: ${Number(yoyPct) >= 0 ? '+' : ''}${yoyPct}% ($${(fy26Total - fy25Total).toLocaleString()})\n`);
  }

  // ─── 7. Plan Target Totals ───────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FY27 PLAN TARGET TOTALS (across all plans)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const planTotals = await client.query(`
    SELECT
      COUNT(DISTINCT tp.id) as plan_count,
      COUNT(DISTINCT tpd.district_leaid) as unique_districts,
      SUM(tpd.renewal_target) as total_renewal,
      SUM(tpd.expansion_target) as total_expansion,
      SUM(tpd.winback_target) as total_winback,
      SUM(tpd.new_business_target) as total_new_biz,
      SUM(COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
          COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) as grand_total
    FROM territory_plans tp
    JOIN territory_plan_districts tpd ON tpd.plan_id = tp.id
    WHERE tp.fiscal_year = 2027
  `);

  if (planTotals.rows.length > 0) {
    const t = planTotals.rows[0];
    console.log(`  Plans: ${t.plan_count}  |  Unique Districts: ${t.unique_districts}`);
    console.log(`  Renewal:      $${Number(t.total_renewal || 0).toLocaleString()}`);
    console.log(`  Expansion:    $${Number(t.total_expansion || 0).toLocaleString()}`);
    console.log(`  Winback:      $${Number(t.total_winback || 0).toLocaleString()}`);
    console.log(`  New Business: $${Number(t.total_new_biz || 0).toLocaleString()}`);
    console.log(`  ─────────────────────────────`);
    console.log(`  GRAND TOTAL:  $${Number(t.grand_total || 0).toLocaleString()}\n`);
  }

  // ─── 8. Tags on FY27 plan districts ──────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  AUTO-TAGS ON FY27 PLAN DISTRICTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const tags = await client.query(`
    SELECT
      t.name as tag_name,
      COUNT(*) as district_count,
      t.color
    FROM district_tags dt
    JOIN tags t ON dt.tag_id = t.id
    WHERE dt.district_leaid IN (
      SELECT tpd.district_leaid
      FROM territory_plan_districts tpd
      JOIN territory_plans tp ON tpd.plan_id = tp.id
      WHERE tp.fiscal_year = 2027
    )
    GROUP BY t.name, t.color
    ORDER BY district_count DESC
  `);

  for (const tag of tags.rows) {
    console.log(`  ${tag.tag_name}: ${tag.district_count} districts`);
  }

  // ─── 9. Services targeted in FY27 plans ──────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  SERVICES TARGETED IN FY27 PLANS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const services = await client.query(`
    SELECT
      s.name as service_name,
      tpds.category,
      COUNT(*) as district_count,
      SUM(COALESCE(tpd.renewal_target, 0) + COALESCE(tpd.expansion_target, 0) +
          COALESCE(tpd.winback_target, 0) + COALESCE(tpd.new_business_target, 0)) as associated_target
    FROM territory_plan_district_services tpds
    JOIN services s ON tpds.service_id = s.id
    JOIN territory_plan_districts tpd ON tpds.plan_id = tpd.plan_id AND tpds.district_leaid = tpd.district_leaid
    JOIN territory_plans tp ON tpd.plan_id = tp.id
    WHERE tp.fiscal_year = 2027
    GROUP BY s.name, tpds.category
    ORDER BY district_count DESC
  `);

  for (const svc of services.rows) {
    console.log(`  ${svc.service_name} (${svc.category}): ${svc.district_count} districts — $${Number(svc.associated_target || 0).toLocaleString()}`);
  }

  // ─── 10. New-to-Fullmind prospects with FY27 pipeline ────────────────
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  NEW BUSINESS PROSPECTS (non-customers with FY27 pipeline)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const newBiz = await client.query(`
    SELECT
      d.leaid,
      d.name as district_name,
      d.state_abbrev,
      d.total_enrollment,
      d.fy27_open_pipeline,
      d.fy27_open_pipeline_weighted,
      d.fy27_open_pipeline_opp_count,
      EXISTS (
        SELECT 1 FROM territory_plan_districts tpd
        JOIN territory_plans tp ON tpd.plan_id = tp.id
        WHERE tp.fiscal_year = 2027 AND tpd.district_leaid = d.leaid
      ) as in_fy27_plan
    FROM districts d
    WHERE d.is_customer = false
      AND COALESCE(d.fy27_open_pipeline, 0) > 0
    ORDER BY d.fy27_open_pipeline DESC
    LIMIT 15
  `);

  for (const n of newBiz.rows) {
    console.log(`  ${n.district_name} (${n.state})`);
    console.log(`    Enrollment: ${Number(n.total_enrollment || 0).toLocaleString()}`);
    console.log(`    FY27 Pipeline: $${Number(n.fy27_open_pipeline || 0).toLocaleString()} (${n.fy27_open_pipeline_opp_count} opps)`);
    console.log(`    Weighted: $${Number(n.fy27_open_pipeline_weighted || 0).toLocaleString()}`);
    console.log(`    In FY27 Plan: ${n.in_fy27_plan ? 'YES' : 'NO'}`);
    console.log("");
  }

  // ─── 11. User Goals for FY27 ─────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FY27 USER GOALS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const goals = await client.query(`
    SELECT
      up.full_name,
      up.email,
      ug.earnings_target,
      ug.take_rate_percent,
      ug.renewal_target,
      ug.winback_target,
      ug.expansion_target,
      ug.new_business_target,
      ug.take_target,
      ug.new_districts_target
    FROM user_goals ug
    JOIN user_profiles up ON ug.user_id = up.id
    WHERE ug.fiscal_year = 2027
  `);

  if (goals.rows.length === 0) {
    console.log("  No FY27 user goals set.\n");
  } else {
    for (const g of goals.rows) {
      console.log(`  ${g.full_name} (${g.email})`);
      if (g.earnings_target) console.log(`    Earnings Target: $${Number(g.earnings_target).toLocaleString()}`);
      if (g.renewal_target) console.log(`    Renewal: $${Number(g.renewal_target).toLocaleString()}`);
      if (g.expansion_target) console.log(`    Expansion: $${Number(g.expansion_target).toLocaleString()}`);
      if (g.winback_target) console.log(`    Winback: $${Number(g.winback_target).toLocaleString()}`);
      if (g.new_business_target) console.log(`    New Business: $${Number(g.new_business_target).toLocaleString()}`);
      if (g.new_districts_target) console.log(`    New Districts: ${g.new_districts_target}`);
      console.log("");
    }
  }

  // ─── 12. Competitor Presence in FY27 plan districts ───────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  COMPETITOR SPEND IN FY27 PLAN DISTRICTS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const competitors = await client.query(`
    SELECT
      cs.vendor_name,
      COUNT(DISTINCT cs.district_leaid) as district_count,
      SUM(cs.amount) as total_spend,
      cs.fiscal_year
    FROM competitor_spend cs
    WHERE cs.district_leaid IN (
      SELECT tpd.district_leaid
      FROM territory_plan_districts tpd
      JOIN territory_plans tp ON tpd.plan_id = tp.id
      WHERE tp.fiscal_year = 2027
    )
    GROUP BY cs.vendor_name, cs.fiscal_year
    ORDER BY total_spend DESC
    LIMIT 20
  `);

  for (const c of competitors.rows) {
    console.log(`  ${c.vendor_name} (FY${c.fiscal_year}): ${c.district_count} districts — $${Number(c.total_spend || 0).toLocaleString()}`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  END OF FY27 TRAJECTORY REPORT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  await client.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
