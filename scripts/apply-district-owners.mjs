// Apply district owners from a reviewed CSV (the FINAL OWNER column).
//
// The review CSV identifies districts by name+state plus their numeric opp
// signature (closed won/lost counts+$, target $, open pipeline). Some districts
// share name+state (synthetic duplicates), so we match each CSV row to a leaid
// by the FULL signature, which is unique per district record.
//
// FINAL OWNER = "Unassigned" (case-insensitive) clears the owner (NULL).
//
// Run:  node --env-file=.env scripts/apply-district-owners.mjs "<csv path>"            (dry run)
//       node --env-file=.env scripts/apply-district-owners.mjs "<csv path>" --commit

import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FY_START_SCHOOL_YR = "2023-24";
const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2];
const COMMIT = process.argv.includes("--commit");
if (!csvPath) {
  console.error("Usage: node apply-district-owners.mjs <csv path> [--commit]");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const Q = String.fromCharCode(34);

function parseCsvLine(l) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === Q) { if (q && l[i + 1] === Q) { cur += Q; i++; } else q = !q; }
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

// Strip spreadsheet currency formatting ("$2,171,864.00" -> 2171864).
function num(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// Signature must match the export's rounding/format exactly.
function sig(name, state, wonN, wonVal, lostN, lostVal, targetVal, pipeline) {
  const hasTarget = Math.round(num(targetVal)) ? "Y" : "";
  return [
    (name || "").trim().toLowerCase(),
    (state || "").trim().toUpperCase(),
    num(wonN),
    Math.round(num(wonVal)),
    num(lostN),
    Math.round(num(lostVal)),
    hasTarget,
    Math.round(num(targetVal)),
    Math.round(num(pipeline)),
  ].join("|");
}

const RESOLVE = `COALESCE(
  (SELECT u.id FROM user_profiles u WHERE u.id = o.sales_rep_id),
  (SELECT u2.id FROM user_profiles u2 WHERE lower(u2.email) = lower(o.sales_rep_email) LIMIT 1)
)`;

async function main() {
  const client = await pool.connect();
  try {
    // ---- rebuild per-leaid signature for in-scope districts ----
    const closed = await client.query(
      `SELECT district_lea_id lea,
         count(*) FILTER (WHERE stage=$1) won_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage=$1),0)::float8 won_val,
         count(*) FILTER (WHERE stage=$2) lost_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage=$2),0)::float8 lost_val
       FROM opportunities WHERE stage IN ($1,$2) AND school_yr>=$3 AND district_lea_id IS NOT NULL GROUP BY 1`,
      ["Closed Won", "Closed Lost", FY_START_SCHOOL_YR]
    );
    const open = await client.query(
      `SELECT o.district_lea_id lea, COALESCE(SUM(o.net_booking_amount),0)::float8 pipeline
       FROM opportunities o WHERE o.stage IS NOT NULL AND o.stage NOT IN ($1,$2) AND o.district_lea_id IS NOT NULL GROUP BY 1`,
      ["Closed Won", "Closed Lost"]
    );
    const targets = await client.query(
      `SELECT district_leaid lea,
         COALESCE(SUM(COALESCE(renewal_target,0)+COALESCE(winback_target,0)+COALESCE(expansion_target,0)+COALESCE(new_business_target,0)),0)::float8 target_val
       FROM territory_plan_districts
       WHERE renewal_target IS NOT NULL OR winback_target IS NOT NULL OR expansion_target IS NOT NULL OR new_business_target IS NOT NULL GROUP BY 1`
    );
    const meta = await client.query(`SELECT leaid, name, state_abbrev, owner_id FROM districts`);

    const d = new Map();
    const g = (lea) => { if (!d.has(lea)) d.set(lea, { lea }); return d.get(lea); };
    for (const r of closed.rows) Object.assign(g(r.lea), { won_n: r.won_n, won_val: r.won_val, lost_n: r.lost_n, lost_val: r.lost_val });
    for (const r of open.rows) g(r.lea).pipeline = r.pipeline;
    for (const r of targets.rows) g(r.lea).target_val = r.target_val;
    const metaById = new Map(meta.rows.map((r) => [r.leaid, r]));
    const inScope = new Set([...closed.rows.map((r) => r.lea), ...targets.rows.map((r) => r.lea)]);

    const bySig = new Map();
    const byNameState = new Map(); // fallback for rows whose live target/pipeline drifted since export
    for (const lea of inScope) {
      const r = g(lea);
      const md = metaById.get(lea) || {};
      const s = sig(md.name, md.state_abbrev, r.won_n, r.won_val, r.lost_n, r.lost_val, r.target_val, r.pipeline);
      if (!bySig.has(s)) bySig.set(s, []);
      bySig.get(s).push(lea);
      const ns = `${(md.name || "").trim().toLowerCase()}|${(md.state_abbrev || "").trim().toUpperCase()}`;
      if (!byNameState.has(ns)) byNameState.set(ns, []);
      byNameState.get(ns).push(lea);
    }

    // ---- name -> profile id ----
    const up = await client.query(`SELECT id, full_name FROM user_profiles`);
    const byName = new Map();
    for (const u of up.rows) {
      const k = (u.full_name || "").trim().toLowerCase();
      if (!byName.has(k)) byName.set(k, []);
      byName.get(k).push(u.id);
    }

    // ---- read CSV ----
    const lines = readFileSync(csvPath, "utf8").split(/\r?\n/).filter((l) => l.length);
    const h = parseCsvLine(lines[0]);
    const col = (n) => h.indexOf(n);
    const ci = {
      district: col("District"), state: col("State"),
      wonN: col("ClosedWon #"), wonVal: col("ClosedWon $"),
      lostN: col("ClosedLost #"), lostVal: col("ClosedLost $"),
      targetVal: col("Target $"), pipeline: col("Open Pipeline $"),
      finalOwner: col("FINAL OWNER"),
    };

    const changes = [];
    const problems = { unmatched: [], ambiguous: [], badName: [], dupLea: new Map() };
    let noop = 0, blank = 0;
    const seenLea = new Set();

    for (const line of lines.slice(1)) {
      const r = parseCsvLine(line);
      const ownerRaw = (r[ci.finalOwner] || "").trim();
      const districtLabel = `${(r[ci.district] || "").trim()} (${(r[ci.state] || "").trim()})`;
      if (!ownerRaw) { blank++; continue; }

      const s = sig(r[ci.district], r[ci.state], r[ci.wonN], r[ci.wonVal], r[ci.lostN], r[ci.lostVal], r[ci.targetVal], r[ci.pipeline]);
      let leas = bySig.get(s) || [];
      // Fallback: live target/pipeline may have drifted since export. If the full
      // signature misses, accept a name+state match when it's unambiguous.
      if (leas.length === 0) {
        const ns = `${(r[ci.district] || "").trim().toLowerCase()}|${(r[ci.state] || "").trim().toUpperCase()}`;
        leas = byNameState.get(ns) || [];
      }
      if (leas.length === 0) { problems.unmatched.push(districtLabel); continue; }
      if (leas.length > 1) { problems.ambiguous.push(`${districtLabel} -> ${leas.join(",")}`); continue; }
      const lea = leas[0];
      if (seenLea.has(lea)) { problems.dupLea.set(lea, (problems.dupLea.get(lea) || 1) + 1); }
      seenLea.add(lea);

      // resolve target owner id
      let targetOwner;
      if (ownerRaw.toLowerCase() === "unassigned") targetOwner = null;
      else {
        const ids = byName.get(ownerRaw.toLowerCase()) || [];
        if (ids.length !== 1) { problems.badName.push(`${ownerRaw} (${districtLabel})`); continue; }
        targetOwner = ids[0];
      }

      const cur = metaById.get(lea)?.owner_id ?? null;
      if (cur === targetOwner) { noop++; continue; }
      changes.push({ lea, district: districtLabel, from: cur, to: targetOwner, owner: ownerRaw });
    }

    // ---- report ----
    const nameById = new Map(up.rows.map((u) => [u.id, u.full_name]));
    const fills = changes.filter((c) => c.from === null && c.to !== null).length;
    const reassigns = changes.filter((c) => c.from !== null && c.to !== null).length;
    const clears = changes.filter((c) => c.to === null).length;

    console.log(`CSV rows: ${lines.length - 1}`);
    console.log(`  changes:        ${changes.length}  (fill ${fills}, reassign ${reassigns}, clear/unassign ${clears})`);
    console.log(`  no-op (same):   ${noop}`);
    console.log(`  blank FINAL:    ${blank}`);
    console.log(`  unmatched rows: ${problems.unmatched.length}`);
    console.log(`  ambiguous rows: ${problems.ambiguous.length}`);
    console.log(`  unresolved name:${problems.badName.length}`);
    if (problems.dupLea.size) console.log(`  WARNING duplicate leaid in CSV: ${problems.dupLea.size}`);
    for (const x of problems.unmatched.slice(0, 20)) console.log("    unmatched: " + x);
    for (const x of problems.ambiguous.slice(0, 20)) console.log("    ambiguous: " + x);
    for (const x of problems.badName.slice(0, 20)) console.log("    bad name:  " + x);

    // write a full change log for review
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = join(__dirname, "exports");
    mkdirSync(dir, { recursive: true });
    const logPath = join(dir, `apply-owners-changes-${stamp}.csv`);
    writeFileSync(
      logPath,
      ["leaid,district,from_owner,to_owner",
        ...changes.map((c) => [c.lea, c.district, nameById.get(c.from) || "(none)", c.to ? nameById.get(c.to) : "(unassigned)"]
          .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n")
    );
    console.log(`\nChange log: ${logPath}`);

    if (!COMMIT) { console.log("\nDRY RUN — no DB writes. Re-run with --commit to apply."); return; }
    // "(unknown)" rows point at opp leaids with no district record — unassignable
    // by design, not a data error. Only block on genuine integrity problems.
    const realUnmatched = problems.unmatched.filter((x) => !x.startsWith("(unknown)"));
    if (realUnmatched.length || problems.ambiguous.length || problems.badName.length) {
      console.log("\nABORT: resolve unmatched/ambiguous/bad-name rows before committing.");
      return;
    }

    await client.query("BEGIN");
    for (const c of changes) {
      await client.query(`UPDATE districts SET owner_id = $1 WHERE leaid = $2`, [c.to, c.lea]);
    }
    await client.query("COMMIT");
    console.log(`\nApplied ${changes.length} owner changes.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
