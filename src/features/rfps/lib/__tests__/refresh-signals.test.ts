import { describe, it, expect } from "vitest";
import { Pool } from "pg";
import { config } from "dotenv";
import { refreshRfpSignals } from "../refresh-signals";

// Load .env and .env.local so DATABASE_URL is available in the test process.
// Vitest's built-in env loading only exposes VITE_-prefixed vars to process.env
// for non-browser code; real server vars need explicit dotenv loading.
config(); // .env
config({ path: ".env.local", override: true }); // .env.local overrides

// Use the same connection string as Prisma. Tests run in a transaction
// that ROLLBACKs at the end so they don't leak fixtures.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withTx<T>(
  fn: (
    q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>
  ) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(async (sql, params) => client.query(sql, params));
    await client.query("ROLLBACK");
    return out;
  } catch (e) {
    // Rollback on error so the connection is returned clean
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Helper: insert a district with required NOT NULL fields
async function insertDistrict(
  q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  leaid: string,
  name: string,
  icpTier?: string
) {
  await q(
    `INSERT INTO districts (leaid, name, state_fips, state_abbrev, updated_at, icp_tier)
     VALUES ($1, $2, $3, $4, now(), $5)`,
    [leaid, name, "01", "AL", icpTier ?? null]
  );
}

// Helper: insert an RFP with required NOT NULL fields
async function insertRfp(
  q: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  externalId: string,
  agencyKey: number,
  leaid: string | null
) {
  await q(
    `INSERT INTO rfps (external_id, version_key, title, agency_key, agency_name, state_abbrev, leaid, captured_date, updated_at, raw_payload)
     VALUES ($1, $1, $2, $3, $4, $5, $6, now(), now(), '{}'::jsonb)`,
    [externalId, "T", agencyKey, "Test Agency", "AL", leaid]
  );
}

describe("refreshRfpSignals", () => {
  it("sets 'active' when an open opportunity exists at the district", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST001", "Test District 1");
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name) VALUES ($1, $2, $3, $4)`,
        ["test-opp-1", "TEST001", "2 - Presentation", "Open Deal"]
      );
      await insertRfp(q, "test-rfp-1", 999_001, "TEST001");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-1'`
      );
      expect(rows[0].district_pipeline_state).toBe("active");
    });
  });

  it("sets 'recently_won' when a closed-won opportunity is within 18 months and no active deal", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST002", "Test District 2");
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-2", "TEST002", "Closed Won", "Won Deal", "2025-08-01"]
      );
      await insertRfp(q, "test-rfp-2", 999_002, "TEST002");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-2'`
      );
      expect(rows[0].district_pipeline_state).toBe("recently_won");
    });
  });

  it("recognizes text-stage closed-won synonyms", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST003", "Test District 3");
      // 'Active' is a closed-won synonym per district_opportunity_actuals matview
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-3", "TEST003", "Active", "Won Deal", "2025-08-01"]
      );
      await insertRfp(q, "test-rfp-3", 999_003, "TEST003");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-3'`
      );
      expect(rows[0].district_pipeline_state).toBe("recently_won");
    });
  });

  it("sets 'recently_lost' when a closed-lost is within 12 months and nothing more recent", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST004", "Test District 4");
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-4", "TEST004", "Closed Lost", "Lost Deal", "2025-09-01"]
      );
      await insertRfp(q, "test-rfp-4", 999_004, "TEST004");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-4'`
      );
      expect(rows[0].district_pipeline_state).toBe("recently_lost");
    });
  });

  it("active wins over closed-won — both at the same district", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST005", "Test District 5");
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name, close_date) VALUES ($1, $2, $3, $4, $5)`,
        ["test-opp-5a", "TEST005", "Closed Won", "Won 2024", "2024-09-01"]
      );
      await q(
        `INSERT INTO opportunities (id, district_lea_id, stage, name) VALUES ($1, $2, $3, $4)`,
        ["test-opp-5b", "TEST005", "3 - Proposal", "Open 2026"]
      );
      await insertRfp(q, "test-rfp-5", 999_005, "TEST005");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-5'`
      );
      expect(rows[0].district_pipeline_state).toBe("active");
    });
  });

  it("sets 'top_icp' for Tier 1 / Tier 2 districts with no opps", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST006", "Top Tier", "Tier 1");
      await insertRfp(q, "test-rfp-6", 999_006, "TEST006");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-6'`
      );
      expect(rows[0].district_pipeline_state).toBe("top_icp");
    });
  });

  it("sets 'cold' for non-top-tier districts with no opps", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST007", "Cold District", "Tier 4");
      await insertRfp(q, "test-rfp-7", 999_007, "TEST007");

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state FROM rfps WHERE external_id='test-rfp-7'`
      );
      expect(rows[0].district_pipeline_state).toBe("cold");
    });
  });

  it("leaves district_pipeline_state NULL when leaid is NULL", async () => {
    await withTx(async (q) => {
      await insertRfp(q, "test-rfp-8", 999_008, null);

      await refreshRfpSignals(q);

      const { rows } = await q(
        `SELECT district_pipeline_state, signals_refreshed_at FROM rfps WHERE external_id='test-rfp-8'`
      );
      expect(rows[0].district_pipeline_state).toBeNull();
      expect(rows[0].signals_refreshed_at).toBeNull();
    });
  });

  it("sets signals_refreshed_at on every updated RFP", async () => {
    await withTx(async (q) => {
      await insertDistrict(q, "TEST009", "Test 9");
      await insertRfp(q, "test-rfp-9", 999_009, "TEST009");

      const before = new Date();
      await refreshRfpSignals(q);
      const after = new Date();

      const { rows } = await q(
        `SELECT signals_refreshed_at FROM rfps WHERE external_id='test-rfp-9'`
      );
      const ts = new Date(rows[0].signals_refreshed_at);
      expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime() - 2000);
      expect(ts.getTime()).toBeLessThanOrEqual(after.getTime() + 2000);
    });
  });
});
