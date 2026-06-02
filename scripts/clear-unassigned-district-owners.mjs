// Clear district owners EXCEPT the ones assigned via the reviewed CSV.
//
// The "keep" set = every district that the review CSV assigned a real owner to
// (FINAL OWNER non-blank and not "Unassigned"), matched to a leaid the same way
// scripts/apply-district-owners.mjs does (full numeric signature, with a
// name+state fallback for rows whose live target/pipeline drifted).
//
// Every district NOT in the keep set that currently has owner_id set will have
// owner_id cleared to NULL. Backs up cleared rows, runs in a transaction.
//
// Run:  node --env-file=.env scripts/clear-unassigned-district-owners.mjs "<csv path>"            (dry run)
//       node --env-file=.env scripts/clear-unassigned-district-owners.mjs "<csv path>" --commit

import pg from "pg";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FY_START_SCHOOL_YR = "2023-24";
const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2];
const COMMIT = process.argv.includes("--commit");
if (!csvPath) { console.error("Usage: node clear-unassigned-district-owners.mjs <csv path> [--commit]"); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const Q = String.fromCharCode(34);

function parseCsvLine(l) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === Q) { if (q && l[i + 1] === Q) { cur += Q; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
function num(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function sig(name, state, wonN, wonVal, lostN, lostVal, targetVal, pipeline) {
  return [
    (name || "").trim().toLowerCase(), (state || "").trim().toUpperCase(),
    num(wonN), Math.round(num(wonVal)), num(lostN), Math.round(num(lostVal)),
    Math.round(num(targetVal)) ? "Y" : "", Math.round(num(targetVal)), Math.round(num(pipeline)),
  ].join("|");
}

const RESOLVE = `COALESCE(
  (SELECT u.id FROM user_profiles u WHERE u.id = o.sales_rep_id),
  (SELECT u2.id FROM user_profiles u2 WHERE lower(u2.email) = lower(o.sales_rep_email) LIMIT 1))`;

async function main() {
  const client = await pool.connect();
  try {
    // rebuild per-leaid signature for in-scope districts (mirror apply script)
    const closed = await client.query(
      `SELECT district_lea_id lea, count(*) FILTER (WHERE stage=$1) won_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage=$1),0)::float8 won_val,
         count(*) FILTER (WHERE stage=$2) lost_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage=$2),0)::float8 lost_val
       FROM opportunities WHERE stage IN ($1,$2) AND school_yr>=$3 AND district_lea_id IS NOT NULL GROUP BY 1`,
      ["Closed Won", "Closed Lost", FY_START_SCHOOL_YR]);
    const open = await client.query(
      `SELECT o.district_lea_id lea, COALESCE(SUM(o.net_booking_amount),0)::float8 pipeline
       FROM opportunities o WHERE o.stage IS NOT NULL AND o.stage NOT IN ($1,$2) AND o.district_lea_id IS NOT NULL GROUP BY 1`,
      ["Closed Won", "Closed Lost"]);
    const targets = await client.query(
      `SELECT district_leaid lea, COALESCE(SUM(COALESCE(renewal_target,0)+COALESCE(winback_target,0)+COALESCE(expansion_target,0)+COALESCE(new_business_target,0)),0)::float8 target_val
       FROM territory_plan_districts WHERE renewal_target IS NOT NULL OR winback_target IS NOT NULL OR expansion_target IS NOT NULL OR new_business_target IS NOT NULL GROUP BY 1`);
    const meta = await client.query(`SELECT leaid, name, state_abbrev, owner_id FROM districts`);

    const d = new Map();
    const g = (lea) => { if (!d.has(lea)) d.set(lea, { lea }); return d.get(lea); };
    for (const r of closed.rows) Object.assign(g(r.lea), r);
    for (const r of open.rows) g(r.lea).pipeline = r.pipeline;
    for (const r of targets.rows) g(r.lea).target_val = r.target_val;
    const metaById = new Map(meta.rows.map((r) => [r.leaid, r]));
    const inScope = new Set([...closed.rows.map((r) => r.lea), ...targets.rows.map((r) => r.lea)]);

    const bySig = new Map(), byNameState = new Map();
    for (const lea of inScope) {
      const r = g(lea), md = metaById.get(lea) || {};
      const s = sig(md.name, md.state_abbrev, r.won_n, r.won_val, r.lost_n, r.lost_val, r.target_val, r.pipeline);
      (bySig.get(s) || bySig.set(s, []).get(s)).push(lea);
      const ns = `${(md.name || "").trim().toLowerCase()}|${(md.state_abbrev || "").trim().toUpperCase()}`;
      (byNameState.get(ns) || byNameState.set(ns, []).get(ns)).push(lea);
    }

    // build keep set from CSV rows with a real owner
    const lines = readFileSync(csvPath, "utf8").split(/\r?\n/).filter((l) => l.length);
    const h = parseCsvLine(lines[0]); const col = (n) => h.indexOf(n);
    const ci = { district: col("District"), state: col("State"), wonN: col("ClosedWon #"), wonVal: col("ClosedWon $"),
      lostN: col("ClosedLost #"), lostVal: col("ClosedLost $"), targetVal: col("Target $"), pipeline: col("Open Pipeline $"), finalOwner: col("FINAL OWNER") };

    const keep = new Set();
    let realOwnerRows = 0;
    for (const line of lines.slice(1)) {
      const r = parseCsvLine(line);
      const owner = (r[ci.finalOwner] || "").trim();
      if (!owner || owner.toLowerCase() === "unassigned") continue;
      realOwnerRows++;
      const s = sig(r[ci.district], r[ci.state], r[ci.wonN], r[ci.wonVal], r[ci.lostN], r[ci.lostVal], r[ci.targetVal], r[ci.pipeline]);
      let leas = bySig.get(s) || [];
      if (leas.length === 0) {
        const ns = `${(r[ci.district] || "").trim().toLowerCase()}|${(r[ci.state] || "").trim().toUpperCase()}`;
        leas = byNameState.get(ns) || [];
      }
      if (leas.length === 1) keep.add(leas[0]);
    }

    // districts to clear: owner set AND not in keep
    const toClear = meta.rows.filter((m) => m.owner_id && !keep.has(m.leaid));
    const ownedTotal = meta.rows.filter((m) => m.owner_id).length;

    console.log(`CSV rows with a real owner:   ${realOwnerRows}`);
    console.log(`Keep set (leaids to retain):  ${keep.size}`);
    console.log(`Districts currently owned:     ${ownedTotal}`);
    console.log(`-> will CLEAR owner on:        ${toClear.length}`);
    console.log(`-> will RETAIN owner on:       ${ownedTotal - toClear.length}`);

    // backup + change log
    const up = await client.query(`SELECT id, full_name FROM user_profiles`);
    const nameById = new Map(up.rows.map((u) => [u.id, u.full_name]));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = join(__dirname, "exports"); mkdirSync(dir, { recursive: true });
    const logPath = join(dir, `clear-owners-${stamp}.csv`);
    writeFileSync(logPath, ["leaid,district,state,cleared_owner",
      ...toClear.map((m) => [m.leaid, m.name, m.state_abbrev, nameById.get(m.owner_id) || m.owner_id]
        .map((v) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : v ?? "")).join(","))].join("\n"));
    console.log(`\nChange log (every district to be cleared): ${logPath}`);

    // distribution of who is being cleared
    const byOwner = {};
    for (const m of toClear) { const n = nameById.get(m.owner_id) || "(unknown id)"; byOwner[n] = (byOwner[n] || 0) + 1; }
    console.log("\nCleared owners by rep:");
    Object.entries(byOwner).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(24)} ${n}`));

    if (!COMMIT) { console.log("\nDRY RUN — no DB writes. Re-run with --commit to clear."); return; }

    await client.query("BEGIN");
    const res = await client.query(
      `UPDATE districts SET owner_id = NULL WHERE owner_id IS NOT NULL AND NOT (leaid = ANY($1::text[]))`,
      [[...keep]]);
    if (res.rowCount !== toClear.length) { await client.query("ROLLBACK"); throw new Error(`Aborted: cleared ${res.rowCount} != expected ${toClear.length}. Rolled back.`); }
    await client.query("COMMIT");
    console.log(`\nCleared owner on ${res.rowCount} districts. Retained ${keep.size > 0 ? ownedTotal - toClear.length : 0}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
