// Read-only diagnosis: why did FY27 open pipeline drop over the last 14 days?
// Reconstructs transitions from opportunities.stage_history; all other signals
// (amount changes, schoolYr changes) are invisible in the current schema and
// are flagged as "data gap" in the output.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FY27_SCHOOL_YR = "2026-27";
const WINDOW_DAYS = 14;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000);

const OPEN_STAGE_NUMBERS = new Set(["0", "1", "2", "3", "4", "5"]);
// weighted_pipeline uses these per the metadata file
const STAGE_WEIGHTS = { "0": 0.05, "1": 0.10, "2": 0.25, "3": 0.50, "4": 0.75, "5": 0.90 };

// stage strings look like "3 - Contract Out" or "Closed Won" / "Closed Lost"
function stageBucket(stage) {
  if (!stage) return "unknown";
  const s = stage.toString().trim();
  const head = s.split(/\s*-\s*/)[0];
  if (OPEN_STAGE_NUMBERS.has(head)) return `open_${head}`;
  if (/closed\s*won/i.test(s)) return "closed_won";
  if (/closed\s*lost/i.test(s)) return "closed_lost";
  if (/cancel/i.test(s)) return "cancelled";
  if (/expir/i.test(s)) return "expired";
  return "other";
}
function isOpenBucket(b) { return b.startsWith("open_"); }

function fmt(n) {
  if (n == null) return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function dollars(n) { return `$${fmt(n)}`; }

function weightedFor(stage, amount) {
  const head = (stage || "").toString().trim().split(/\s*-\s*/)[0];
  const w = STAGE_WEIGHTS[head];
  return w ? Number(amount || 0) * w : 0;
}

// ─────────────────────────────────────────────────────────────────────────

async function totalsNow() {
  const rows = await prisma.$queryRaw`
    select stage, count(*)::int as n, sum(net_booking_amount)::float as amt
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
    group by stage
    order by stage
  `;
  let openN = 0, openAmt = 0, closedWonN = 0, closedWonAmt = 0, closedLostN = 0, closedLostAmt = 0;
  let weighted = 0;
  const stageBreakdown = [];
  for (const r of rows) {
    const b = stageBucket(r.stage);
    stageBreakdown.push({ stage: r.stage, bucket: b, n: r.n, amt: r.amt || 0 });
    if (isOpenBucket(b)) {
      openN += r.n;
      openAmt += r.amt || 0;
      weighted += weightedFor(r.stage, r.amt || 0);
    } else if (b === "closed_won") { closedWonN += r.n; closedWonAmt += r.amt || 0; }
    else if (b === "closed_lost") { closedLostN += r.n; closedLostAmt += r.amt || 0; }
  }
  return { openN, openAmt, closedWonN, closedWonAmt, closedLostN, closedLostAmt, weighted, stageBreakdown };
}

async function transitionsInWindow() {
  // All FY27 opps whose stage_history has an entry within the window.
  // We walk the history and pick the last transition that occurred inside the window.
  const rows = await prisma.$queryRaw`
    select id, district_name, sales_rep_name, state, stage, net_booking_amount,
           stage_history
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and stage_history::jsonb @? ${"$[*] ? (@.timestamp >= \"" + windowStart.toISOString() + "\")"}::jsonpath
  `;
  const transitions = [];
  for (const r of rows) {
    const hist = Array.isArray(r.stage_history) ? r.stage_history : [];
    const sorted = [...hist].sort((a, b) => (a.timestamp || "").localeCompare(b.timestamp || ""));
    // find last pre-window stage (from) and the first in-window stage (to)
    let from = null, to = null, when = null;
    for (const h of sorted) {
      if (!h.timestamp) continue;
      const t = new Date(h.timestamp);
      if (Number.isNaN(t.getTime())) continue;
      if (t < windowStart) from = h.stage;
      else if (t >= windowStart && !to) { to = h.stage; when = t; }
    }
    if (!to) continue;
    transitions.push({
      id: r.id,
      district: r.district_name,
      rep: r.sales_rep_name,
      state: r.state,
      amount: Number(r.net_booking_amount || 0),
      fromBucket: stageBucket(from),
      toBucket: stageBucket(to),
      fromStage: from,
      toStage: to,
      when,
      currentStage: r.stage,
    });
  }
  return transitions;
}

async function inflowInWindow() {
  const rows = await prisma.$queryRaw`
    select stage, count(*)::int as n, sum(net_booking_amount)::float as amt
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and created_at >= ${windowStart}
    group by stage
    order by n desc
  `;
  let totalN = 0, totalAmt = 0;
  for (const r of rows) { totalN += r.n; totalAmt += r.amt || 0; }
  return { totalN, totalAmt, byStage: rows };
}

async function priorWindowInflow() {
  const priorStart = new Date(windowStart.getTime() - WINDOW_DAYS * 86400000);
  const rows = await prisma.$queryRaw`
    select count(*)::int as n, sum(net_booking_amount)::float as amt
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and created_at >= ${priorStart}
      and created_at < ${windowStart}
  `;
  return { n: rows[0].n || 0, amt: rows[0].amt || 0 };
}

async function competitorPipelineFY27() {
  const rows = await prisma.$queryRaw`
    select vendor, sum(open_pipeline)::float as open_pipeline,
           sum(weighted_pipeline)::float as weighted,
           sum(open_pipeline_opp_count)::int as opp_count
    from district_financials
    where fiscal_year = 'FY27'
    group by vendor
    order by open_pipeline desc nulls last
  `;
  return rows;
}

async function timeInStage() {
  // For currently-open FY27 opps, compute time since the most recent
  // pre-today stage entry to see which opps are stalling.
  const rows = await prisma.$queryRaw`
    select stage, count(*)::int as n,
           avg(extract(epoch from (now() - coalesce(
             (select max((h->>'timestamp')::timestamptz)
                from jsonb_array_elements(stage_history::jsonb) h
                where (h->>'timestamp')::timestamptz <= now()),
             created_at, now()
           )))/86400)::float as avg_days
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and stage not ilike '%closed%' and stage not ilike '%cancel%' and stage not ilike '%expir%'
    group by stage
    order by stage
  `;
  return rows;
}

async function topDistricts() {
  // Top FY27 open pipeline districts right now (concentration check)
  const rows = await prisma.$queryRaw`
    select district_name, sales_rep_name, count(*)::int as n,
           sum(net_booking_amount)::float as amt
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and stage not ilike '%closed%' and stage not ilike '%cancel%' and stage not ilike '%expir%'
    group by district_name, sales_rep_name
    order by amt desc nulls last
    limit 10
  `;
  return rows;
}

async function byRep() {
  const rows = await prisma.$queryRaw`
    select sales_rep_name, count(*)::int as n,
           sum(net_booking_amount)::float as amt
    from opportunities
    where school_yr = ${FY27_SCHOOL_YR}
      and stage not ilike '%closed%' and stage not ilike '%cancel%' and stage not ilike '%expir%'
    group by sales_rep_name
    order by amt desc nulls last
    limit 15
  `;
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────

function printTransitions(t) {
  const leaving = t.filter((x) => isOpenBucket(x.fromBucket) && !isOpenBucket(x.toBucket));
  const entering = t.filter((x) => !isOpenBucket(x.fromBucket) && isOpenBucket(x.toBucket));
  const advancing = t.filter((x) => isOpenBucket(x.fromBucket) && isOpenBucket(x.toBucket) && x.fromBucket !== x.toBucket);

  console.log(`\nTransitions in last ${WINDOW_DAYS} days (from stage_history):`);
  console.log(`  left open pipeline: ${leaving.length} deals, ${dollars(leaving.reduce((s, x) => s + x.amount, 0))}`);
  const byExit = {};
  for (const x of leaving) byExit[x.toBucket] = (byExit[x.toBucket] || 0) + x.amount;
  for (const [b, v] of Object.entries(byExit)) console.log(`      → ${b}: ${dollars(v)}`);
  console.log(`  entered open pipeline: ${entering.length} deals, ${dollars(entering.reduce((s, x) => s + x.amount, 0))}`);
  console.log(`  advanced stages (still open): ${advancing.length} deals, ${dollars(advancing.reduce((s, x) => s + x.amount, 0))}`);

  if (leaving.length > 0) {
    console.log(`\n  Top 10 deals that left open pipeline:`);
    leaving
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .forEach((x) => {
        console.log(
          `    ${dollars(x.amount).padStart(10)}  ${x.toBucket.padEnd(12)}  ${(x.district || "?").slice(0, 40).padEnd(40)}  ${x.rep || "—"}`
        );
      });
  }
}

async function main() {
  console.log(`\n=== FY27 Pipeline Diagnosis ===`);
  console.log(`school_yr = '${FY27_SCHOOL_YR}'   window = last ${WINDOW_DAYS} days (since ${windowStart.toISOString().slice(0, 10)})\n`);

  const t = await totalsNow();
  console.log(`Current FY27 totals:`);
  console.log(`  open pipeline:       ${t.openN} deals, ${dollars(t.openAmt)}`);
  console.log(`  weighted pipeline:   ${dollars(t.weighted)}`);
  console.log(`  closed-won bookings: ${t.closedWonN} deals, ${dollars(t.closedWonAmt)}`);
  console.log(`  closed-lost:         ${t.closedLostN} deals, ${dollars(t.closedLostAmt)}`);
  console.log(`  stage breakdown:`);
  for (const r of t.stageBreakdown) {
    console.log(`    ${(r.stage || "?").slice(0, 30).padEnd(30)} ${String(r.n).padStart(5)}  ${dollars(r.amt).padStart(12)}  [${r.bucket}]`);
  }

  const inflow = await inflowInWindow();
  const prior = await priorWindowInflow();
  console.log(`\nNew FY27 opps created in last ${WINDOW_DAYS} days: ${inflow.totalN} deals, ${dollars(inflow.totalAmt)}`);
  console.log(`  prior ${WINDOW_DAYS}-day window:                    ${prior.n} deals, ${dollars(prior.amt)}`);
  console.log(`  Δ inflow vs prior window:                   ${(inflow.totalN - prior.n >= 0 ? "+" : "")}${inflow.totalN - prior.n} deals, ${(inflow.totalAmt - prior.amt >= 0 ? "+" : "")}${dollars(inflow.totalAmt - prior.amt)}`);

  const transitions = await transitionsInWindow();
  printTransitions(transitions);

  console.log(`\nTime-in-current-stage (open FY27 deals):`);
  const tis = await timeInStage();
  for (const r of tis) {
    console.log(`  ${(r.stage || "?").slice(0, 30).padEnd(30)} ${String(r.n).padStart(5)} deals, avg ${Math.round(r.avg_days ?? 0)} days in stage`);
  }

  console.log(`\nTop 10 FY27 open-pipeline districts (concentration check):`);
  const top = await topDistricts();
  for (const r of top) {
    console.log(`  ${dollars(r.amt).padStart(10)}  ${(r.district_name || "?").slice(0, 40).padEnd(40)}  ${r.sales_rep_name || "—"}`);
  }

  console.log(`\nFY27 open pipeline by rep (top 15):`);
  const reps = await byRep();
  for (const r of reps) {
    console.log(`  ${dollars(r.amt).padStart(10)}  ${String(r.n).padStart(4)} deals  ${r.sales_rep_name || "—"}`);
  }

  console.log(`\nCompetitor FY27 pipeline (district_financials):`);
  const comp = await competitorPipelineFY27();
  if (comp.length === 0) console.log("  no rows (FY27 data not yet loaded for any vendor)");
  for (const r of comp) {
    console.log(
      `  ${(r.vendor || "?").padEnd(16)} open=${dollars(r.open_pipeline).padStart(12)}  weighted=${dollars(r.weighted).padStart(12)}  opps=${r.opp_count ?? "—"}`
    );
  }

  console.log(`\n--- Data gaps (things we CANNOT see) ---`);
  console.log(`  • No history of schoolYr changes (a deal pushed FY27 → FY28 looks like a drop here)`);
  console.log(`  • No history of netBookingAmount changes (a deal scoped down shows silently as a smaller current number)`);
  console.log(`  • No daily snapshots of district_financials (so no true week-over-week chart)`);
  console.log(`  • stage_history records {stage, timestamp} only — not the amount or rep at that moment`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
