// FY27 pipeline broken down by customer history (Return / New / Winback),
// plus week-over-week changes against the most recent prior snapshot.
//
// Usage: node --env-file=.env scripts/fy27-pipeline-by-customer-history.mjs
// Output: fy27-pipeline-by-customer-history.csv (overwrites existing)

import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "node:fs";

const prisma = new PrismaClient();

const FY27 = "2026-27";
const FY26 = "2025-26";

function num(v) { return Number(v ?? 0); }
function fmt(n) { return num(n).toFixed(2); }
function pct(part, whole) {
  const w = num(whole);
  if (!w) return "0%";
  return `${((num(part) / w) * 100).toFixed(1)}%`;
}

// ── Customer history: which districts booked when ──────────────────────────
// Customer key = opportunities.district_lea_id, with admin-resolved leaid
// from unmatched_opportunities filling in for opps that didn't auto-match.
async function customerHistory() {
  const rows = await prisma.$queryRaw`
    select coalesce(o.district_lea_id, u.resolved_district_leaid) as leaid,
           o.school_yr
    from opportunities o
    left join unmatched_opportunities u
      on u.id = o.id and u.resolved = true
    where o.stage ilike '%closed%won%'
      and o.school_yr is not null
  `;
  const fy26 = new Set();
  const preFy26 = new Set();
  for (const r of rows) {
    if (!r.leaid) continue;
    if (r.school_yr === FY26) fy26.add(r.leaid);
    else if (r.school_yr < FY26) preFy26.add(r.leaid);
  }
  return { fy26, preFy26 };
}

function segmentFor(leaid, hist) {
  if (!leaid) return "New";
  if (hist.fy26.has(leaid)) return "Return";
  if (hist.preFy26.has(leaid)) return "Winback";
  return "New";
}

// ── Current FY27 pipeline (live, not snapshot) ─────────────────────────────
async function fy27Now() {
  return prisma.$queryRaw`
    select o.id,
           coalesce(o.district_lea_id, u.resolved_district_leaid) as district_lea_id,
           o.district_name, o.sales_rep_name, o.stage,
           o.net_booking_amount::float as net_booking,
           o.minimum_purchase_amount::float as min_commit,
           o.maximum_budget::float as max_budget
    from opportunities o
    left join unmatched_opportunities u
      on u.id = o.id and u.resolved = true
    where o.school_yr = ${FY27}
  `;
}

// ── Snapshot pair for WoW (latest two distinct snapshot dates) ─────────────
async function snapshotPair() {
  const dates = await prisma.$queryRaw`
    select snapshot_date::text as d
    from opportunity_snapshots
    where school_yr = ${FY27}
    group by snapshot_date
    order by snapshot_date desc
    limit 2
  `;
  if (dates.length < 2) return null;
  const [curr, prev] = dates.map((r) => r.d);

  const rows = await prisma.$queryRaw`
    select s.snapshot_date::text as d, s.opportunity_id, s.stage,
           s.net_booking_amount::float as net_booking,
           s.minimum_purchase_amount::float as min_commit,
           s.maximum_budget::float as max_budget,
           coalesce(s.district_lea_id, u.resolved_district_leaid) as district_lea_id
    from opportunity_snapshots s
    left join unmatched_opportunities u
      on u.id = s.opportunity_id and u.resolved = true
    where s.school_yr = ${FY27}
      and s.snapshot_date in (${curr}::date, ${prev}::date)
  `;

  const byOppCurr = new Map();
  const byOppPrev = new Map();
  for (const r of rows) {
    const map = r.d === curr ? byOppCurr : byOppPrev;
    map.set(r.opportunity_id, r);
  }

  const ids = new Set([...byOppCurr.keys(), ...byOppPrev.keys()]);
  const metaRows = await prisma.opportunity.findMany({
    where: { id: { in: Array.from(ids) } },
    select: { id: true, districtName: true, salesRepName: true },
  });
  const metaById = new Map(metaRows.map((m) => [m.id, m]));

  return { curr, prev, byOppCurr, byOppPrev, metaById };
}

// ── Aggregations ───────────────────────────────────────────────────────────
function summaryBySegment(opps, hist) {
  const seg = { Return: row(), New: row(), Winback: row() };
  function row() {
    return { opps: 0, minB: 0, netB: 0, maxB: 0, cwCount: 0, cwMinB: 0 };
  }
  for (const o of opps) {
    const s = segmentFor(o.district_lea_id, hist);
    const r = seg[s];
    r.opps += 1;
    r.minB += num(o.min_commit);
    r.netB += num(o.net_booking);
    r.maxB += num(o.max_budget);
    if (/closed\s*won/i.test(o.stage || "")) {
      r.cwCount += 1;
      r.cwMinB += num(o.min_commit);
    }
  }
  return seg;
}

function stageBySegment(opps, hist) {
  const map = new Map(); // key = `${stage}||${segment}`
  for (const o of opps) {
    const s = segmentFor(o.district_lea_id, hist);
    const stage = o.stage || "(unknown)";
    const k = `${stage}||${s}`;
    if (!map.has(k)) map.set(k, { stage, segment: s, opps: 0, minB: 0, netB: 0, maxB: 0 });
    const r = map.get(k);
    r.opps += 1;
    r.minB += num(o.min_commit);
    r.netB += num(o.net_booking);
    r.maxB += num(o.max_budget);
  }
  return Array.from(map.values());
}

// Stage ordering: numeric stages first (0..5), then Closed Won, then others.
function stageOrder(stage) {
  const head = (stage || "").trim().split(/\s*-\s*/)[0];
  if (/^\d+$/.test(head)) return Number(head);
  if (/closed\s*won/i.test(stage)) return 100;
  if (/closed\s*lost/i.test(stage)) return 101;
  return 200;
}

const SEG_ORDER = { Return: 0, New: 1, Winback: 2 };

// ── WoW changers ───────────────────────────────────────────────────────────
function classifyChanges(snap, hist) {
  const { byOppCurr, byOppPrev, metaById } = snap;
  const newOpps = []; // in curr, not in prev
  const removed = []; // in prev, not in curr (rare — more likely school_yr changed)
  const stageChanges = []; // same opp, different stage
  const amountChanges = []; // same opp, same stage, different net_booking
  const advancedToWon = []; // closed_won in curr that wasn't in prev

  for (const [id, c] of byOppCurr) {
    const p = byOppPrev.get(id);
    const meta = metaById.get(id) || {};
    const district = meta.districtName || "?";
    const rep = meta.salesRepName || "—";
    const segment = segmentFor(c.district_lea_id, hist);

    if (!p) {
      newOpps.push({ id, district, rep, segment, stage: c.stage, netB: num(c.net_booking) });
      continue;
    }
    if (c.stage !== p.stage) {
      stageChanges.push({
        id, district, rep, segment,
        from: p.stage, to: c.stage,
        netBPrev: num(p.net_booking), netBCurr: num(c.net_booking),
      });
      if (/closed\s*won/i.test(c.stage || "") && !/closed\s*won/i.test(p.stage || "")) {
        advancedToWon.push({ id, district, rep, segment, from: p.stage, netB: num(c.net_booking) });
      }
    } else {
      const dn = num(c.net_booking) - num(p.net_booking);
      if (Math.abs(dn) > 0.5) {
        amountChanges.push({
          id, district, rep, segment, stage: c.stage,
          netBPrev: num(p.net_booking), netBCurr: num(c.net_booking), delta: dn,
        });
      }
    }
  }
  for (const [id, p] of byOppPrev) {
    if (!byOppCurr.has(id)) {
      const meta = metaById.get(id) || {};
      removed.push({
        id,
        district: meta.districtName || "?",
        rep: meta.salesRepName || "—",
        segment: segmentFor(p.district_lea_id, hist),
        stage: p.stage,
        netB: num(p.net_booking),
      });
    }
  }
  return { newOpps, removed, stageChanges, amountChanges, advancedToWon };
}

// ── CSV emitter ────────────────────────────────────────────────────────────
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
function row(...cols) { return cols.map(csvEscape).join(","); }

function buildCsv({ seg, stages, totalNet, snap, changes }) {
  const out = [];

  // Section 1 — Summary by Customer Segment
  out.push("## Summary by Customer Segment");
  out.push(row("Segment", "Opps", "Sum Min Booking", "Sum Net Booking", "Sum Max Booking",
    "Closed Won Count", "Closed Won Sum Min Commit", "% of Pipeline"));
  for (const name of ["Return", "New", "Winback"]) {
    const r = seg[name];
    const label =
      name === "Return" ? "Return (booked FY26)"
      : name === "New" ? "New (no prior bookings)"
      : "Winback (booked pre-FY26 not FY26)";
    out.push(row(label, r.opps, fmt(r.minB), fmt(r.netB), fmt(r.maxB),
      r.cwCount, fmt(r.cwMinB), pct(r.netB, totalNet)));
  }
  const totalOpps = seg.Return.opps + seg.New.opps + seg.Winback.opps;
  const totalMin = seg.Return.minB + seg.New.minB + seg.Winback.minB;
  const totalMax = seg.Return.maxB + seg.New.maxB + seg.Winback.maxB;
  const totalCw = seg.Return.cwCount + seg.New.cwCount + seg.Winback.cwCount;
  const totalCwMin = seg.Return.cwMinB + seg.New.cwMinB + seg.Winback.cwMinB;
  out.push(row("Total", totalOpps, fmt(totalMin), fmt(totalNet), fmt(totalMax),
    totalCw, fmt(totalCwMin), "100%"));
  out.push("");

  // Section 2 — Stage × Segment
  out.push("## Breakdown by Stage x Segment");
  out.push(row("Stage", "Segment", "Opps", "Sum Min Booking", "Sum Net Booking",
    "Sum Max Booking", "% of Pipeline"));
  const sorted = [...stages].sort((a, b) => {
    const so = stageOrder(a.stage) - stageOrder(b.stage);
    if (so) return so;
    return SEG_ORDER[a.segment] - SEG_ORDER[b.segment];
  });
  for (const r of sorted) {
    out.push(row(r.stage, r.segment, r.opps, fmt(r.minB), fmt(r.netB), fmt(r.maxB),
      pct(r.netB, totalNet)));
  }
  out.push(row("Total", "", totalOpps, fmt(totalMin), fmt(totalNet), fmt(totalMax), "100%"));
  out.push("");

  // Section 3 — WoW changers
  if (!snap) {
    out.push("## Week-over-Week Changes");
    out.push("(only one snapshot date available — no prior snapshot to compare against)");
    out.push("");
    return out.join("\n") + "\n";
  }

  out.push(`## Week-over-Week Changes (${snap.prev} -> ${snap.curr})`);
  out.push("");

  // Subsection: rollup
  out.push("### WoW Rollup by Segment");
  out.push(row("Change Type", "Segment", "Count", "Sum Net Booking Delta"));
  const buckets = [
    ["New opps", changes.newOpps.map((x) => ({ segment: x.segment, delta: x.netB }))],
    ["Closed Won (advanced)", changes.advancedToWon.map((x) => ({ segment: x.segment, delta: x.netB }))],
    ["Stage changed", changes.stageChanges.map((x) => ({ segment: x.segment, delta: x.netBCurr - x.netBPrev }))],
    ["Amount changed (same stage)", changes.amountChanges.map((x) => ({ segment: x.segment, delta: x.delta }))],
    ["Dropped from FY27", changes.removed.map((x) => ({ segment: x.segment, delta: -x.netB }))],
  ];
  for (const [label, items] of buckets) {
    const segMap = { Return: { n: 0, d: 0 }, New: { n: 0, d: 0 }, Winback: { n: 0, d: 0 } };
    for (const it of items) {
      segMap[it.segment].n += 1;
      segMap[it.segment].d += it.delta;
    }
    for (const seg of ["Return", "New", "Winback"]) {
      const r = segMap[seg];
      if (r.n === 0) continue;
      out.push(row(label, seg, r.n, fmt(r.d)));
    }
  }
  out.push("");

  // Subsection: per-deal changers (top 30 by absolute net booking delta)
  out.push("### WoW Per-Deal Changers (top 30 by |Δ net booking|)");
  out.push(row("Change Type", "District", "Rep", "Segment", "From Stage", "To Stage",
    "Prev Net Booking", "Curr Net Booking", "Delta"));
  const all = [
    ...changes.newOpps.map((x) => ({
      type: "New", district: x.district, rep: x.rep, segment: x.segment,
      from: "(none)", to: x.stage, prev: 0, curr: x.netB, delta: x.netB,
    })),
    ...changes.stageChanges.map((x) => ({
      type: "Stage change", district: x.district, rep: x.rep, segment: x.segment,
      from: x.from, to: x.to, prev: x.netBPrev, curr: x.netBCurr,
      delta: x.netBCurr - x.netBPrev,
    })),
    ...changes.amountChanges.map((x) => ({
      type: "Amount", district: x.district, rep: x.rep, segment: x.segment,
      from: x.stage, to: x.stage, prev: x.netBPrev, curr: x.netBCurr, delta: x.delta,
    })),
    ...changes.removed.map((x) => ({
      type: "Dropped", district: x.district, rep: x.rep, segment: x.segment,
      from: x.stage, to: "(gone)", prev: x.netB, curr: 0, delta: -x.netB,
    })),
  ];
  all.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  for (const x of all.slice(0, 30)) {
    out.push(row(x.type, x.district, x.rep, x.segment, x.from, x.to,
      fmt(x.prev), fmt(x.curr), fmt(x.delta)));
  }
  out.push("");

  return out.join("\n") + "\n";
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const hist = await customerHistory();
  const opps = await fy27Now();
  const seg = summaryBySegment(opps, hist);
  const stages = stageBySegment(opps, hist);
  const totalNet = seg.Return.netB + seg.New.netB + seg.Winback.netB;
  const snap = await snapshotPair();
  const changes = snap ? classifyChanges(snap, hist) : null;

  const csv = buildCsv({ seg, stages, totalNet, snap, changes });
  const outPath = "fy27-pipeline-by-customer-history.csv";
  writeFileSync(outPath, csv);

  // Console summary
  console.log(`Wrote ${outPath}`);
  console.log(`FY27 totals: ${seg.Return.opps + seg.New.opps + seg.Winback.opps} opps, $${fmt(totalNet)} sum_net`);
  console.log(`  Return:  ${seg.Return.opps} opps, $${fmt(seg.Return.netB)} (${pct(seg.Return.netB, totalNet)})`);
  console.log(`  New:     ${seg.New.opps} opps, $${fmt(seg.New.netB)} (${pct(seg.New.netB, totalNet)})`);
  console.log(`  Winback: ${seg.Winback.opps} opps, $${fmt(seg.Winback.netB)} (${pct(seg.Winback.netB, totalNet)})`);
  if (snap) {
    console.log(`\nWoW (${snap.prev} -> ${snap.curr}):`);
    console.log(`  new opps:        ${changes.newOpps.length}`);
    console.log(`  advanced to won: ${changes.advancedToWon.length}`);
    console.log(`  stage changes:   ${changes.stageChanges.length}`);
    console.log(`  amount changes:  ${changes.amountChanges.length}`);
    console.log(`  dropped:         ${changes.removed.length}`);
  } else {
    console.log("\nWoW: only one snapshot date available — no comparison possible.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
