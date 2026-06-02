// Fix orphan sales_rep_id values on opportunities.
//
// Some opportunities carry a sales_rep_id that doesn't exist in user_profiles
// (a stale/duplicate person ID), even though sales_rep_email points at a valid
// profile. This rewrites each orphan ID to the profile resolved by email, so
// opp-level rep attribution is consistent with the rest of the app.
//
// Backs up (id, old sales_rep_id) for every touched row, then updates inside a
// transaction. Aborts if any orphan can't be resolved by email.
//
// Run:  node --env-file=.env scripts/fix-orphan-rep-ids.mjs           (dry run)
//       node --env-file=.env scripts/fix-orphan-rep-ids.mjs --commit

import pg from "pg";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const COMMIT = process.argv.includes("--commit");
const __dirname = dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Resolve each orphan rep id -> correct profile via email.
    const orphans = await client.query(
      `SELECT o.sales_rep_id AS orphan_id, o.sales_rep_name AS name, o.sales_rep_email AS email,
         count(*)::int AS n,
         (SELECT u.id FROM user_profiles u WHERE lower(u.email) = lower(o.sales_rep_email) LIMIT 1) AS real_id
       FROM opportunities o
       WHERE o.sales_rep_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM user_profiles u WHERE u.id = o.sales_rep_id)
       GROUP BY 1,2,3
       ORDER BY n DESC`
    );

    if (orphans.rows.length === 0) {
      console.log("No orphan sales_rep_ids — nothing to do.");
      return;
    }

    const unresolved = orphans.rows.filter((r) => !r.real_id);
    for (const r of orphans.rows) {
      console.log(`  ${r.orphan_id}  ${(r.name || "-").padEnd(18)} n=${String(r.n).padStart(4)} -> ${r.real_id || "UNRESOLVED"}`);
    }

    // Snapshot the rows we will change (before image).
    const ids = orphans.rows.map((r) => r.orphan_id);
    const snap = await client.query(
      `SELECT id, sales_rep_id, sales_rep_email FROM opportunities WHERE sales_rep_id = ANY($1::uuid[])`,
      [ids]
    );
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = join(__dirname, "backups");
    mkdirSync(dir, { recursive: true });
    const backupPath = join(dir, `orphan-rep-ids-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify({ exportedAt: new Date().toISOString(), mapping: orphans.rows, rows: snap.rows }, null, 2));
    console.log(`\n${snap.rows.length} opportunity rows to update. Backup: ${backupPath}`);

    if (!COMMIT) { console.log("\nDRY RUN — no DB writes. Re-run with --commit to apply."); return; }
    if (unresolved.length) { console.log("\nABORT: some orphans have no email match. Resolve manually first."); return; }

    await client.query("BEGIN");
    let total = 0;
    for (const r of orphans.rows) {
      const res = await client.query(
        `UPDATE opportunities SET sales_rep_id = $1 WHERE sales_rep_id = $2`,
        [r.real_id, r.orphan_id]
      );
      total += res.rowCount;
    }
    if (total !== snap.rows.length) {
      await client.query("ROLLBACK");
      throw new Error(`Aborted: updated ${total} != snapshot ${snap.rows.length}. Rolled back.`);
    }
    await client.query("COMMIT");
    console.log(`\nUpdated ${total} opportunity rows.`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
