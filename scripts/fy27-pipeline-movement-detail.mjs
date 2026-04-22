// Detailed FY27 pipeline movement for the last 14 days, and a current
// min-commit distribution by stage. We do NOT have historical min-commit
// values — that's a data gap flagged at the end of the report.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const WINDOW_DAYS = 14;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000);

const OPEN = new Set(["0", "1", "2", "3", "4", "5"]);
function bucket(stage) {
  if (!stage) return "unknown";
  const head = stage.toString().trim().split(/\s*-\s*/)[0];
  if (OPEN.has(head)) return `open_${head}`;
  if (/closed\s*won/i.test(stage)) return "closed_won";
  if (/closed\s*lost/i.test(stage)) return "closed_lost";
  if (/cancel/i.test(stage)) return "cancelled";
  if (/expir/i.test(stage)) return "expired";
  return "other";
}
function isOpen(b) { return b.startsWith("open_"); }
function stageNum(stage) {
  if (!stage) return -1;
  const head = stage.toString().trim().split(/\s*-\s*/)[0];
  if (OPEN.has(head)) return Number(head);
  return -1;
}
function $(n) { return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }
function pad(s, n) { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padEnd(n); }
function padL(s, n) { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padStart(n); }

const opps = await prisma.$queryRaw`
  select id, district_name, sales_rep_name, stage,
         net_booking_amount::float as net_booking,
         minimum_purchase_amount::float as min_commit,
         maximum_budget::float as max_budget,
         stage_history
  from opportunities
  where school_yr = '2026-27'
`;

// ── Classify every opp by transition class in the last 14 days ──────────
const classes = { entered: [], advanced: [], regressed: [], lost: [], won: [], idle_open: [], idle_closed: [] };

for (const o of opps) {
  const hist = Array.isArray(o.stage_history) ? o.stage_history : [];
  const sorted = [...hist]
    .filter((h) => h && h.changed_at)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at));

  let preStage = null;
  const inWindow = [];
  for (const h of sorted) {
    const t = new Date(h.changed_at);
    if (isNaN(t.getTime())) continue;
    if (t < windowStart) preStage = h.stage;
    else inWindow.push({ stage: h.stage, when: t });
  }

  const nowBucket = bucket(o.stage);
  if (inWindow.length === 0) {
    (isOpen(nowBucket) ? classes.idle_open : classes.idle_closed).push(o);
    continue;
  }
  const endStage = inWindow[inWindow.length - 1].stage;
  const fromB = bucket(preStage);
  const toB = bucket(endStage);
  const entry = {
    ...o,
    fromStage: preStage,
    toStage: endStage,
    fromBucket: fromB,
    toBucket: toB,
    whenIso: inWindow[inWindow.length - 1].when.toISOString().slice(0, 10),
    transitionCount: inWindow.length,
  };

  if (toB === "closed_lost") classes.lost.push(entry);
  else if (toB === "closed_won") classes.won.push(entry);
  else if (!isOpen(fromB) && isOpen(toB)) classes.entered.push(entry);
  else if (isOpen(fromB) && isOpen(toB)) {
    if (stageNum(endStage) > stageNum(preStage)) classes.advanced.push(entry);
    else if (stageNum(endStage) < stageNum(preStage)) classes.regressed.push(entry);
    else classes.idle_open.push(o);
  } else classes.idle_open.push(o);
}

function section(title, rows, includeJourney = false) {
  console.log(`\n── ${title} (${rows.length} deals, ${$(rows.reduce((s, x) => s + (x.net_booking || 0), 0))} net booking, ${$(rows.reduce((s, x) => s + (x.min_commit || 0), 0))} min-commit sum) ──`);
  if (rows.length === 0) return;
  rows.sort((a, b) => (b.net_booking || 0) - (a.net_booking || 0));
  const top = rows.slice(0, 15);
  console.log(`  ${pad("district", 36)}  ${pad("rep", 22)}  ${padL("net $", 10)}  ${padL("min $", 10)}  ${pad("from→to", 28)}  when`);
  for (const r of top) {
    const journey = includeJourney
      ? `${r.fromStage || "—"} → ${r.toStage || "—"}`
      : `${r.fromBucket}→${r.toBucket}`;
    console.log(
      `  ${pad(r.district_name, 36)}  ${pad(r.sales_rep_name, 22)}  ${padL($(r.net_booking), 10)}  ${padL($(r.min_commit), 10)}  ${pad(journey, 28)}  ${r.whenIso ?? "—"}`
    );
  }
  if (rows.length > top.length) console.log(`  … ${rows.length - top.length} more`);
}

console.log(`=== FY27 Pipeline Movement Detail — last ${WINDOW_DAYS} days (since ${windowStart.toISOString().slice(0,10)}) ===`);

// Net pipeline impact
const netFromEntered = classes.entered.reduce((s, x) => s + (x.net_booking || 0), 0);
const netFromAdvanced = classes.advanced.reduce((s, x) => s + (x.net_booking || 0), 0);
const netFromRegressed = classes.regressed.reduce((s, x) => s + (x.net_booking || 0), 0);
const netFromLost = classes.lost.reduce((s, x) => s + (x.net_booking || 0), 0);
const netFromWon = classes.won.reduce((s, x) => s + (x.net_booking || 0), 0);

console.log(`\nSummary:`);
console.log(`  entered open pipeline:   ${String(classes.entered.length).padStart(3)} deals, ${$(netFromEntered).padStart(12)}  (= migration/revival or SF-native new)`);
console.log(`  advanced stage:          ${String(classes.advanced.length).padStart(3)} deals, ${$(netFromAdvanced).padStart(12)}  (forward progress, still open)`);
console.log(`  regressed stage:         ${String(classes.regressed.length).padStart(3)} deals, ${$(netFromRegressed).padStart(12)}  (moved backward, still open)`);
console.log(`  closed-lost:             ${String(classes.lost.length).padStart(3)} deals, ${$(netFromLost).padStart(12)}  (left pipeline, book miss)`);
console.log(`  closed-won:              ${String(classes.won.length).padStart(3)} deals, ${$(netFromWon).padStart(12)}  (left pipeline → bookings)`);
console.log(`  idle (no window txn):    ${classes.idle_open.length} open deals + ${classes.idle_closed.length} closed`);

section("Entered pipeline (newly opened / revived)", classes.entered, true);
section("Advanced stage (forward progress)", classes.advanced, true);
section("Regressed stage (stepped backward)", classes.regressed, true);
section("Closed-won (out of pipeline into bookings)", classes.won, true);
section("Closed-lost", classes.lost, true);

// ── Min-commit distribution by stage (current snapshot only) ────────────
console.log(`\n\n── Min-commit distribution by current stage (FY27, open deals only) ──`);
const byStage = new Map();
for (const o of opps) {
  if (!isOpen(bucket(o.stage))) continue;
  if (!byStage.has(o.stage)) byStage.set(o.stage, []);
  byStage.get(o.stage).push(o);
}
console.log(`  ${pad("stage", 30)}  ${padL("n", 4)}  ${padL("n w/min", 8)}  ${padL("avg min $", 12)}  ${padL("median min $", 14)}  ${padL("max min $", 12)}`);
for (const stage of [...byStage.keys()].sort()) {
  const rows = byStage.get(stage);
  const withMin = rows.filter((x) => x.min_commit != null && x.min_commit > 0);
  const vals = withMin.map((x) => x.min_commit).sort((a, b) => a - b);
  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  const median = vals.length ? vals[Math.floor(vals.length / 2)] : 0;
  const max = vals.length ? vals[vals.length - 1] : 0;
  console.log(
    `  ${pad(stage, 30)}  ${padL(rows.length, 4)}  ${padL(withMin.length, 8)}  ${padL($(avg), 12)}  ${padL($(median), 14)}  ${padL($(max), 12)}`
  );
}

// ── net_booking vs min_commit for deals that moved (but weren't lost) ──
console.log(`\n── Deals that moved (NOT closed-lost) — net_booking vs current min_commit ──`);
const moved = [...classes.entered, ...classes.advanced, ...classes.regressed, ...classes.won]
  .filter((x) => x.min_commit != null)
  .sort((a, b) => Math.abs((b.net_booking || 0) - (b.min_commit || 0)) - Math.abs((a.net_booking || 0) - (a.min_commit || 0)));
console.log(`  ${moved.length} deals with a set min_commit; top 20 by |net_booking - min_commit| gap:`);
console.log(`  ${pad("district", 36)}  ${padL("net $", 10)}  ${padL("min $", 10)}  ${padL("gap $", 10)}  ${pad("current stage", 22)}  ${pad("class", 10)}`);
for (const r of moved.slice(0, 20)) {
  const gap = (r.net_booking || 0) - (r.min_commit || 0);
  const cls = classes.entered.includes(r) ? "entered"
    : classes.advanced.includes(r) ? "advanced"
    : classes.regressed.includes(r) ? "regressed"
    : classes.won.includes(r) ? "won" : "—";
  console.log(
    `  ${pad(r.district_name, 36)}  ${padL($(r.net_booking), 10)}  ${padL($(r.min_commit), 10)}  ${padL($(gap), 10)}  ${pad(r.stage, 22)}  ${pad(cls, 10)}`
  );
}

console.log(`\n── Data gap (what this report CANNOT show) ──`);
console.log(`  We store only the current minimum_purchase_amount per opp. There is no`);
console.log(`  change log, no history table, no snapshot file. If a rep changed a min`);
console.log(`  commit from $200K → $50K yesterday, we see $50K now and no trace of the`);
console.log(`  $200K. To answer "did min commits change on open deals," we need to start`);
console.log(`  snapshotting (opp_id, week, stage, net_booking, min_commit, school_yr)`);
console.log(`  going forward. Alternatively, Salesforce's OpportunityFieldHistory object`);
console.log(`  does track this — we'd have to pull it via the SF API.`);

await prisma.$disconnect();
