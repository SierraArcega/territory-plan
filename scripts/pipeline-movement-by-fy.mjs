// Pipeline movement for every fiscal year we track — last 14 days.
// Same methodology as the FY27 report: uses stage_history.changed_at (real SF
// timestamps preserved across migration) rather than created_at (polluted by
// bulk import batches).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const WINDOW_DAYS = 14;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 86400000);

// Fiscal years from scheduler/sync/queries.py::SCHOOL_YEARS. We skip 2024-25
// because it's essentially closed; add back if you want historical comparison.
const FISCAL_YEARS = ["2025-26", "2026-27", "2027-28"];

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
const isOpen = (b) => b.startsWith("open_");
const stageNum = (s) => {
  const h = (s || "").toString().trim().split(/\s*-\s*/)[0];
  return OPEN.has(h) ? Number(h) : -1;
};
const $ = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pad = (s, n) => { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padEnd(n); };
const padL = (s, n) => { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padStart(n); };

function schoolYrLabel(yr) {
  // '2026-27' → 'FY27'
  const tail = yr.split("-")[1];
  return `FY${tail.padStart(2, "0")}`;
}

async function movementFor(schoolYr) {
  const opps = await prisma.$queryRaw`
    select id, district_name, sales_rep_name, stage,
           net_booking_amount::float as amount,
           minimum_purchase_amount::float as min_commit,
           stage_history
    from opportunities
    where school_yr = ${schoolYr}
  `;

  const classes = { entered: [], advanced: [], regressed: [], lost: [], won: [] };
  let currentOpen = { n: 0, amt: 0 };
  let currentWon = { n: 0, amt: 0 };
  let currentLost = { n: 0, amt: 0 };

  for (const o of opps) {
    const b = bucket(o.stage);
    if (isOpen(b)) { currentOpen.n++; currentOpen.amt += o.amount || 0; }
    else if (b === "closed_won") { currentWon.n++; currentWon.amt += o.amount || 0; }
    else if (b === "closed_lost") { currentLost.n++; currentLost.amt += o.amount || 0; }

    const hist = Array.isArray(o.stage_history) ? o.stage_history : [];
    const sorted = [...hist].filter((h) => h && h.changed_at).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    let pre = null;
    const inWindow = [];
    for (const h of sorted) {
      const t = new Date(h.changed_at);
      if (isNaN(t.getTime())) continue;
      if (t < windowStart) pre = h.stage;
      else inWindow.push(h);
    }
    if (inWindow.length === 0) continue;
    const endStage = inWindow[inWindow.length - 1].stage;
    const from = bucket(pre), to = bucket(endStage);
    const entry = { ...o, endStage, pre, from, to };
    if (to === "closed_lost") classes.lost.push(entry);
    else if (to === "closed_won") classes.won.push(entry);
    else if (!isOpen(from) && isOpen(to)) classes.entered.push(entry);
    else if (isOpen(from) && isOpen(to) && stageNum(endStage) > stageNum(pre)) classes.advanced.push(entry);
    else if (isOpen(from) && isOpen(to) && stageNum(endStage) < stageNum(pre)) classes.regressed.push(entry);
  }

  const sumAmt = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
  const netTransitionDelta =
    sumAmt(classes.entered) + sumAmt(classes.advanced) // advanced stays in pipeline, doesn't move the total, but captured for color
    - sumAmt(classes.lost) - sumAmt(classes.won);
  // For "pipeline value change from transitions," only entered minus (lost + won) actually moves the open-pipeline total.
  const pipelineDelta = sumAmt(classes.entered) - sumAmt(classes.lost) - sumAmt(classes.won);

  return {
    schoolYr,
    total: opps.length,
    currentOpen, currentWon, currentLost,
    classes,
    pipelineDelta,
    advancedAmt: sumAmt(classes.advanced),
    regressedAmt: sumAmt(classes.regressed),
  };
}

const results = [];
for (const yr of FISCAL_YEARS) results.push(await movementFor(yr));

console.log(`=== Pipeline movement by fiscal year — last ${WINDOW_DAYS} days (since ${windowStart.toISOString().slice(0, 10)}) ===\n`);

// ── Current state table ─────────────────────────────────────────────────
console.log(`Current state (today):`);
console.log(`  ${pad("FY", 6)}  ${padL("open #", 8)}  ${padL("open $", 14)}  ${padL("won #", 6)}  ${padL("won $", 12)}  ${padL("lost #", 7)}  ${padL("lost $", 12)}`);
for (const r of results) {
  console.log(
    `  ${pad(schoolYrLabel(r.schoolYr), 6)}  ${padL(r.currentOpen.n, 8)}  ${padL($(r.currentOpen.amt), 14)}  ${padL(r.currentWon.n, 6)}  ${padL($(r.currentWon.amt), 12)}  ${padL(r.currentLost.n, 7)}  ${padL($(r.currentLost.amt), 12)}`
  );
}

// ── Window movement table ───────────────────────────────────────────────
console.log(`\nLast ${WINDOW_DAYS}-day movement (transitions from stage_history):`);
console.log(
  `  ${pad("FY", 6)}  ${padL("entered", 12)}  ${padL("advanced", 12)}  ${padL("regressed", 12)}  ${padL("won", 10)}  ${padL("lost", 10)}  ${padL("Δ open $", 14)}`
);
for (const r of results) {
  const enteredStr = `${r.classes.entered.length} (${$(r.classes.entered.reduce((s,x)=>s+(x.amount||0),0))})`;
  const advancedStr = `${r.classes.advanced.length} (${$(r.advancedAmt)})`;
  const regressedStr = `${r.classes.regressed.length} (${$(r.regressedAmt)})`;
  const wonStr = `${r.classes.won.length} (${$(r.classes.won.reduce((s,x)=>s+(x.amount||0),0))})`;
  const lostStr = `${r.classes.lost.length} (${$(r.classes.lost.reduce((s,x)=>s+(x.amount||0),0))})`;
  console.log(
    `  ${pad(schoolYrLabel(r.schoolYr), 6)}  ${padL(enteredStr, 12)}  ${padL(advancedStr, 12)}  ${padL(regressedStr, 12)}  ${padL(wonStr, 10)}  ${padL(lostStr, 10)}  ${padL($(r.pipelineDelta), 14)}`
  );
}

// ── Per-FY detail (top losses only — the signal that matters for the update) ──
for (const r of results) {
  const fy = schoolYrLabel(r.schoolYr);
  const highlights = [
    ...r.classes.lost.filter((x) => (x.amount || 0) >= 100_000).map((x) => ({ ...x, kind: "LOST" })),
    ...r.classes.won.filter((x) => (x.amount || 0) >= 100_000).map((x) => ({ ...x, kind: "WON" })),
    ...r.classes.advanced.filter((x) => (x.amount || 0) >= 500_000).map((x) => ({ ...x, kind: "ADVANCED" })),
  ];
  if (highlights.length === 0) continue;
  console.log(`\n${fy} highlights (deals ≥ $100K lost/won or ≥ $500K advanced):`);
  highlights
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
    .forEach((x) => {
      console.log(
        `  ${x.kind.padEnd(8)}  ${padL($(x.amount), 10)}  ${pad(x.district_name, 40)}  ${pad(x.sales_rep_name, 22)}  ${x.pre || "—"} → ${x.endStage}`
      );
    });
}

await prisma.$disconnect();
