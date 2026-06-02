// One-off: delete legacy fulfillment-stage opportunities.
//
// Background: the `opportunities` table mixes the live sales pipeline (numbered
// stages "0 - Meeting Booked" .. "5 - Commitment") with post-sale fulfillment
// records ("Active", "Complete - Full Length", "Position Purchased",
// "Requisition Received", "Return Position Pending", "Position Cancelled",
// "Complete - Early Cancellation"). The fulfillment rows are shadows of deals
// that already closed won (verified: 130/130 share a district+school_yr with a
// Closed Won opp), carry $0 completed/total revenue, but were being counted as
// "open pipeline" by every `stage NOT IN ('Closed Won','Closed Lost')` query —
// inflating the open-pipeline metric by ~$9.4M and creating false owner-
// assignment conflicts.
//
// This script BACKS UP the matched rows to a timestamped JSON file, then deletes
// them inside a transaction, aborting if the deleted count doesn't match the
// backup count.
//
// Run:  node --env-file=.env scripts/delete-legacy-fulfillment-opps.mjs        (dry run, default)
//       node --env-file=.env scripts/delete-legacy-fulfillment-opps.mjs --commit

import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FULFILLMENT_STAGES = [
  "Active",
  "Complete - Full Length",
  "Position Purchased",
  "Requisition Received",
  "Return Position Pending",
  "Position Cancelled",
  "Complete - Early Cancellation",
];

const COMMIT = process.argv.includes("--commit");
const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // 1. Snapshot the full rows we intend to delete.
    const { rows } = await client.query(
      `SELECT * FROM opportunities WHERE stage = ANY($1::text[]) ORDER BY id`,
      [FULFILLMENT_STAGES]
    );

    if (rows.length === 0) {
      console.log("No fulfillment records found — nothing to do.");
      return;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupDir = join(__dirname, "backups");
    mkdirSync(backupDir, { recursive: true });
    const backupPath = join(backupDir, `legacy-fulfillment-opps-${stamp}.json`);
    writeFileSync(
      backupPath,
      JSON.stringify(
        { exportedAt: new Date().toISOString(), stages: FULFILLMENT_STAGES, count: rows.length, rows },
        null,
        2
      )
    );

    // 2. Summary for the operator.
    const byStage = {};
    let bookings = 0;
    for (const r of rows) {
      byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
      bookings += Number(r.net_booking_amount ?? 0);
    }
    const districts = new Set(rows.map((r) => r.district_lea_id)).size;

    console.log(`Matched ${rows.length} fulfillment records across ${districts} districts.`);
    console.log(`Net booking amount carried: $${bookings.toLocaleString()}`);
    console.log("By stage:");
    for (const [s, n] of Object.entries(byStage)) console.log(`  ${s.padEnd(32)} ${n}`);
    console.log(`Backup written: ${backupPath}`);

    if (!COMMIT) {
      console.log("\nDRY RUN — no rows deleted. Re-run with --commit to delete.");
      return;
    }

    // 3. Delete inside a transaction, guarded on count.
    await client.query("BEGIN");
    const del = await client.query(
      `DELETE FROM opportunities WHERE stage = ANY($1::text[]) RETURNING id`,
      [FULFILLMENT_STAGES]
    );
    if (del.rowCount !== rows.length) {
      await client.query("ROLLBACK");
      throw new Error(
        `Aborted: deleted count ${del.rowCount} != backup count ${rows.length}. Rolled back.`
      );
    }
    await client.query("COMMIT");
    console.log(`\nDeleted ${del.rowCount} rows. Backup at ${backupPath}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
