// Generate a manual-review CSV of districts for owner assignment.
//
// Scope: every district that EITHER had a Closed Won/Lost opp since FY24
// (school_yr >= 2023-24) OR carries a per-district target in any territory plan.
//
// For each district we surface closed-opp history + value, current target $,
// current open pipeline, the existing owner, and a SUGGESTED owner:
//   1. open opp present -> resolved open-opp rep (or "CONFLICT: A / B")
//   2. else            -> rep on the most recent closed (won/lost) opp
//   3. else            -> current owner (target-only districts)
//
// Rep resolution: a valid sales_rep_id wins; otherwise fall back to matching
// sales_rep_email -> user_profiles (handles orphan rep IDs).
//
// Run: node --env-file=.env scripts/export-district-owner-review.mjs

import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FY_START_SCHOOL_YR = "2023-24"; // FY24
const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const RESOLVE = `COALESCE(
  (SELECT u.id FROM user_profiles u WHERE u.id = o.sales_rep_id),
  (SELECT u2.id FROM user_profiles u2 WHERE lower(u2.email) = lower(o.sales_rep_email) LIMIT 1)
)`;

const csvCell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function main() {
  const client = await pool.connect();
  try {
    // 1. Closed opp aggregates per district (FY24+).
    const closed = await client.query(
      `SELECT district_lea_id lea,
         count(*) FILTER (WHERE stage = $1) won_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage = $1), 0)::float8 won_val,
         count(*) FILTER (WHERE stage = $2) lost_n,
         COALESCE(SUM(net_booking_amount) FILTER (WHERE stage = $2), 0)::float8 lost_val
       FROM opportunities
       WHERE stage IN ($1,$2) AND school_yr >= $3 AND district_lea_id IS NOT NULL
       GROUP BY 1`,
      ["Closed Won", "Closed Lost", FY_START_SCHOOL_YR]
    );

    // 2. Rep on the most recent closed (won/lost) opp per district (FY24+).
    const lastClosed = await client.query(
      `SELECT DISTINCT ON (o.district_lea_id) o.district_lea_id lea,
         up.full_name rep_name
       FROM opportunities o
       LEFT JOIN user_profiles up ON up.id = ${RESOLVE}
       WHERE o.stage IN ($1,$2) AND o.school_yr >= $3 AND o.district_lea_id IS NOT NULL
       ORDER BY o.district_lea_id, o.close_date DESC NULLS LAST`,
      ["Closed Won", "Closed Lost", FY_START_SCHOOL_YR]
    );

    // 3. Open pipeline per district + resolved reps (for suggestion + conflict).
    const open = await client.query(
      `SELECT o.district_lea_id lea,
         COALESCE(SUM(o.net_booking_amount),0)::float8 pipeline,
         array_agg(DISTINCT up.full_name) reps
       FROM opportunities o
       LEFT JOIN user_profiles up ON up.id = ${RESOLVE}
       WHERE o.stage IS NOT NULL AND o.stage NOT IN ($1,$2) AND o.district_lea_id IS NOT NULL
       GROUP BY 1`,
      ["Closed Won", "Closed Lost"]
    );

    // 4. Targets per district (summed across plan rows) + who is targeting it
    //    (the owner(s) of the territory plan(s) the target lives in).
    const targets = await client.query(
      `SELECT tpd.district_leaid lea,
         COALESCE(SUM(COALESCE(tpd.renewal_target,0)+COALESCE(tpd.winback_target,0)+COALESCE(tpd.expansion_target,0)+COALESCE(tpd.new_business_target,0)),0)::float8 target_val,
         array_remove(array_agg(DISTINCT up.full_name), NULL) targeted_by
       FROM territory_plan_districts tpd
       JOIN territory_plans tp ON tp.id = tpd.plan_id
       LEFT JOIN user_profiles up ON up.id = tp.owner_id
       WHERE tpd.renewal_target IS NOT NULL OR tpd.winback_target IS NOT NULL OR tpd.expansion_target IS NOT NULL OR tpd.new_business_target IS NOT NULL
       GROUP BY 1`
    );

    // 5. District names/states + current owner.
    const meta = await client.query(
      `SELECT d.leaid, d.name, d.state_abbrev, up.full_name owner_name
       FROM districts d LEFT JOIN user_profiles up ON up.id = d.owner_id`
    );

    // ---- assemble ----
    const m = new Map(); // lea -> row
    const get = (lea) => {
      if (!m.has(lea)) m.set(lea, { lea });
      return m.get(lea);
    };
    for (const r of closed.rows) Object.assign(get(r.lea), { won_n: r.won_n, won_val: r.won_val, lost_n: r.lost_n, lost_val: r.lost_val });
    for (const r of lastClosed.rows) (get(r.lea).last_closed_rep = r.rep_name);
    for (const r of open.rows) Object.assign(get(r.lea), { open_pipeline: r.pipeline, open_reps: (r.reps || []).filter(Boolean) });
    for (const r of targets.rows) Object.assign(get(r.lea), { target_val: r.target_val, targeted_by: (r.targeted_by || []).filter(Boolean) });
    const metaById = new Map(meta.rows.map((r) => [r.leaid, r]));

    // include only districts in scope: closed FY24+ OR has target
    const inScope = new Set([...closed.rows.map((r) => r.lea), ...targets.rows.map((r) => r.lea)]);

    const rows = [];
    for (const lea of inScope) {
      const r = get(lea);
      const md = metaById.get(lea) || {};
      const openReps = r.open_reps || [];
      const targetedBy = r.targeted_by || [];
      let suggested = "";
      let basis = "";
      if (openReps.length === 1) {
        suggested = openReps[0];
        basis = "open opp";
      } else if (openReps.length > 1) {
        suggested = `CONFLICT: ${openReps.join(" / ")}`;
        basis = "open conflict";
      } else if (r.last_closed_rep) {
        suggested = r.last_closed_rep;
        basis = "last closed";
      } else if (targetedBy.length === 1) {
        suggested = targetedBy[0];
        basis = "targeted by";
      } else if (targetedBy.length > 1) {
        suggested = `CONFLICT: ${targetedBy.join(" / ")}`;
        basis = "target conflict";
      } else if (md.owner_name) {
        suggested = md.owner_name;
        basis = "current owner";
      } else {
        basis = "none";
      }
      rows.push({
        district: md.name || "(unknown)",
        state: md.state_abbrev || "",
        won_n: r.won_n || 0,
        won_val: Math.round(r.won_val || 0),
        lost_n: r.lost_n || 0,
        lost_val: Math.round(r.lost_val || 0),
        has_target: r.target_val ? "Y" : "",
        target_val: Math.round(r.target_val || 0),
        targeted_by: targetedBy.join(" / "),
        open_pipeline: Math.round(r.open_pipeline || 0),
        current_owner: md.owner_name || "",
        suggested_owner: suggested,
        basis,
      });
    }

    // sort: conflicts first, then by won_val desc so biggest accounts are reviewed first
    rows.sort((a, b) => (b.basis === "open conflict") - (a.basis === "open conflict") || b.won_val - a.won_val);

    const header = [
      "District", "State", "ClosedWon #", "ClosedWon $", "ClosedLost #", "ClosedLost $",
      "Has Target", "Target $", "Targeted By", "Open Pipeline $", "Current Owner", "Suggested Owner", "Basis", "FINAL OWNER",
    ];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push([
        r.district, r.state, r.won_n, r.won_val, r.lost_n, r.lost_val,
        r.has_target, r.target_val, r.targeted_by, r.open_pipeline, r.current_owner, r.suggested_owner, r.basis, "",
      ].map(csvCell).join(","));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const dir = join(__dirname, "exports");
    mkdirSync(dir, { recursive: true });
    const out = join(dir, `district-owner-review-${stamp}.csv`);
    writeFileSync(out, lines.join("\n"));

    const conflicts = rows.filter((r) => r.basis === "open conflict").length;
    console.log(`Wrote ${rows.length} districts to ${out}`);
    console.log(`  open-opp suggestions: ${rows.filter((r) => r.basis === "open opp").length}`);
    console.log(`  open conflicts:       ${conflicts}`);
    console.log(`  last-closed fallback: ${rows.filter((r) => r.basis === "last closed").length}`);
    console.log(`  targeted-by:          ${rows.filter((r) => r.basis === "targeted by").length}`);
    console.log(`  target conflicts:     ${rows.filter((r) => r.basis === "target conflict").length}`);
    console.log(`  current-owner only:   ${rows.filter((r) => r.basis === "current owner").length}`);
    console.log(`  no suggestion:        ${rows.filter((r) => r.basis === "none").length}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
