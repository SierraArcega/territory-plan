// One-time reconciliation toward a single ownership source of truth (owner_id).
//
// Backfills districts.owner_id from the legacy CRM districts.sales_executive_id
// ONLY where owner_id is currently NULL (the "SE-only" districts). Districts
// where both are set keep their existing owner_id (owner wins — reviewed
// 2026-06-04). Idempotent: re-running is a no-op once gaps are filled.
//
// Run: node --env-file=.env scripts/reconcile-owner-from-sales-exec.mjs
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const counts = async () =>
  (
    await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE owner_id IS NOT NULL) AS has_owner,
        COUNT(*) FILTER (WHERE sales_executive_id IS NOT NULL) AS has_se,
        COUNT(*) FILTER (WHERE owner_id IS NULL AND sales_executive_id IS NOT NULL) AS se_only
      FROM districts
    `)
  ).rows[0];

try {
  const before = await counts();
  console.log("before:", before);

  const res = await pool.query(`
    UPDATE districts
    SET owner_id = sales_executive_id
    WHERE owner_id IS NULL AND sales_executive_id IS NOT NULL
  `);
  console.log(`backfilled owner_id on ${res.rowCount} districts`);

  const after = await counts();
  console.log("after:", after);
} catch (e) {
  console.error("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
