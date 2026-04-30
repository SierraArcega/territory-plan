// FY27 pipeline diagnosis v2 — uses stage_history.changed_at (the real SF
// timestamp) instead of created_at (polluted by migrations).
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
function $(n) { return `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`; }

// Pull all FY27 opps with their stage_history
const opps = await prisma.$queryRaw`
  select id, district_name, sales_rep_name, stage,
         net_booking_amount::float as amount,
         created_at, synced_at, stage_history
  from opportunities
  where school_yr = '2026-27'
`;

console.log(`=== FY27 Pipeline Diagnosis (v2, using stage_history.changed_at) ===`);
console.log(`Window: last ${WINDOW_DAYS} days (since ${windowStart.toISOString().slice(0, 10)})\n`);

// Classify each opp by what happened in the window
const leaving = [];   // was open, now closed/lost/expired — transitioned in window
const entering = [];  // wasn't open, now is — transitioned in window
const advancing = []; // was open, still open, moved stage in window
const idle = [];      // no transition in window

for (const o of opps) {
  const hist = Array.isArray(o.stage_history) ? o.stage_history : [];
  const sorted = [...hist]
    .filter((h) => h && h.changed_at)
    .sort((a, b) => a.changed_at.localeCompare(b.changed_at));

  // Reconstruct stage as of just before the window
  let preWindowStage = null;
  let inWindowTransitions = [];
  for (const h of sorted) {
    const t = new Date(h.changed_at);
    if (isNaN(t.getTime())) continue;
    if (t < windowStart) preWindowStage = h.stage;
    else inWindowTransitions.push({ stage: h.stage, when: t });
  }

  if (inWindowTransitions.length === 0) { idle.push(o); continue; }
  const fromBucket = bucket(preWindowStage);
  const toBucket = bucket(inWindowTransitions[inWindowTransitions.length - 1].stage);

  const entry = {
    id: o.id,
    district: o.district_name,
    rep: o.sales_rep_name,
    amount: o.amount || 0,
    fromStage: preWindowStage,
    toStage: inWindowTransitions[inWindowTransitions.length - 1].stage,
    fromBucket, toBucket,
    when: inWindowTransitions[inWindowTransitions.length - 1].when,
  };

  if (isOpen(fromBucket) && !isOpen(toBucket)) leaving.push(entry);
  else if (!isOpen(fromBucket) && isOpen(toBucket)) entering.push(entry);
  else if (isOpen(fromBucket) && isOpen(toBucket) && fromBucket !== toBucket) advancing.push(entry);
}

// Build a net-change picture
let leftOpenAmt = 0, enteredOpenAmt = 0;
const byExitBucket = {};
for (const l of leaving) { leftOpenAmt += l.amount; byExitBucket[l.toBucket] = (byExitBucket[l.toBucket] || 0) + l.amount; }
for (const e of entering) enteredOpenAmt += e.amount;

console.log(`Transitions in the last ${WINDOW_DAYS} days:`);
console.log(`  left open pipeline:     ${leaving.length} deals, ${$(leftOpenAmt)}`);
for (const [b, v] of Object.entries(byExitBucket)) console.log(`      → ${b.padEnd(15)} ${$(v)}`);
console.log(`  entered open pipeline:  ${entering.length} deals, ${$(enteredOpenAmt)}  (usually = newly created or revived)`);
console.log(`  advanced stages:        ${advancing.length} deals, ${$(advancing.reduce((s, x) => s + x.amount, 0))}`);
console.log(`  idle (no transition):   ${idle.length} deals`);
console.log(`  NET change in open pipeline from transitions: ${$(enteredOpenAmt - leftOpenAmt)} (sign = gain/loss)`);

if (leaving.length > 0) {
  console.log(`\nTop 10 deals that LEFT open pipeline this window:`);
  leaving.sort((a, b) => b.amount - a.amount).slice(0, 10).forEach((x) => {
    console.log(`  ${$(x.amount).padStart(10)}  ${x.fromBucket}→${x.toBucket.padEnd(12)}  ${(x.district || "?").slice(0, 40).padEnd(40)}  ${x.rep || "—"}  [${x.when.toISOString().slice(0,10)}]`);
  });
}

// Same reconstruction for the PRIOR 14-day window (to see 2-weeks-in-a-row trend)
console.log(`\n--- Prior window (14 days before that, ${new Date(windowStart.getTime() - WINDOW_DAYS*86400000).toISOString().slice(0,10)} → ${windowStart.toISOString().slice(0,10)}) ---`);
const priorStart = new Date(windowStart.getTime() - WINDOW_DAYS * 86400000);
let pLeavingN = 0, pLeavingAmt = 0, pEnteringN = 0, pEnteringAmt = 0;
const pByExit = {};
for (const o of opps) {
  const hist = Array.isArray(o.stage_history) ? o.stage_history : [];
  const sorted = [...hist].filter((h) => h && h.changed_at).sort((a, b) => a.changed_at.localeCompare(b.changed_at));
  let pre = null, transitionsInPrior = [];
  for (const h of sorted) {
    const t = new Date(h.changed_at);
    if (isNaN(t.getTime())) continue;
    if (t < priorStart) pre = h.stage;
    else if (t >= priorStart && t < windowStart) transitionsInPrior.push(h);
  }
  if (transitionsInPrior.length === 0) continue;
  const from = bucket(pre), to = bucket(transitionsInPrior[transitionsInPrior.length - 1].stage);
  if (isOpen(from) && !isOpen(to)) { pLeavingN++; pLeavingAmt += o.amount || 0; pByExit[to] = (pByExit[to] || 0) + (o.amount || 0); }
  if (!isOpen(from) && isOpen(to)) { pEnteringN++; pEnteringAmt += o.amount || 0; }
}
console.log(`  left open pipeline:     ${pLeavingN} deals, ${$(pLeavingAmt)}`);
for (const [b, v] of Object.entries(pByExit)) console.log(`      → ${b.padEnd(15)} ${$(v)}`);
console.log(`  entered open pipeline:  ${pEnteringN} deals, ${$(pEnteringAmt)}`);
console.log(`  NET: ${$(pEnteringAmt - pLeavingAmt)}`);

console.log(`\n--- Comparison: two windows in a row ---`);
console.log(`           ${"entries".padStart(10)}  ${"amt in".padStart(12)}  ${"exits".padStart(10)}  ${"amt out".padStart(12)}  ${"net".padStart(12)}`);
console.log(`  recent:  ${String(entering.length).padStart(10)}  ${$(enteredOpenAmt).padStart(12)}  ${String(leaving.length).padStart(10)}  ${$(leftOpenAmt).padStart(12)}  ${$(enteredOpenAmt - leftOpenAmt).padStart(12)}`);
console.log(`  prior:   ${String(pEnteringN).padStart(10)}  ${$(pEnteringAmt).padStart(12)}  ${String(pLeavingN).padStart(10)}  ${$(pLeavingAmt).padStart(12)}  ${$(pEnteringAmt - pLeavingAmt).padStart(12)}`);

await prisma.$disconnect();
