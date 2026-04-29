import { Pool } from "pg";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

config();

const COLS = [
  "activity_title",
  "activity_type",
  "activity_status",
  "start_date",
  "end_date",
  "created_by",
  "created_at",
  "districts",
  "states",
  "plans",
  "attendees",
  "contact_count",
  "opportunity_count",
  "expense_line_count",
  "total_expenses_usd",
  "min_line_amount",
  "max_line_amount",
  "outcome_type",
  "rating",
  "outcome",
  "notes",
] as const;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  });

  const r = await pool.query(`
    WITH expense_agg AS (
      SELECT activity_id,
             COUNT(*)                   AS line_count,
             SUM(amount)::float         AS total_amount,
             MIN(amount)::float         AS min_amount,
             MAX(amount)::float         AS max_amount
      FROM activity_expenses
      GROUP BY activity_id
    ),
    district_agg AS (
      SELECT ad.activity_id,
             string_agg(d.name, ', ' ORDER BY d.name) AS districts
      FROM activity_districts ad
      JOIN districts d ON d.leaid = ad.district_leaid
      GROUP BY ad.activity_id
    ),
    state_agg AS (
      SELECT "as".activity_id,
             string_agg(s.abbrev, ', ' ORDER BY s.abbrev) AS states
      FROM activity_states "as"
      JOIN states s ON s.fips = "as".state_fips
      GROUP BY "as".activity_id
    ),
    plan_agg AS (
      SELECT ap.activity_id,
             string_agg(tp.name, ', ' ORDER BY tp.name) AS plans
      FROM activity_plans ap
      JOIN territory_plans tp ON tp.id = ap.plan_id
      GROUP BY ap.activity_id
    ),
    attendee_agg AS (
      SELECT aa.activity_id,
             string_agg(COALESCE(up.full_name, up.email), ', ' ORDER BY COALESCE(up.full_name, up.email)) AS attendees
      FROM activity_attendees aa
      JOIN user_profiles up ON up.id = aa.user_id
      GROUP BY aa.activity_id
    ),
    contact_agg AS (
      SELECT activity_id, COUNT(*) AS n FROM activity_contacts GROUP BY activity_id
    ),
    opp_agg AS (
      SELECT activity_id, COUNT(*) AS n FROM activity_opportunities GROUP BY activity_id
    )
    SELECT
      a.title,
      a.type,
      a.status,
      a.start_date,
      a.end_date,
      a.outcome,
      a.outcome_type,
      a.rating,
      a.notes,
      a.created_at,
      COALESCE(creator.full_name, creator.email) AS created_by,
      d.districts,
      st.states,
      p.plans,
      att.attendees,
      COALESCE(c.n, 0)        AS contact_count,
      COALESCE(op.n, 0)       AS opportunity_count,
      e.line_count            AS expense_line_count,
      e.total_amount          AS total_amount,
      e.min_amount            AS min_amount,
      e.max_amount            AS max_amount
    FROM activities a
    LEFT JOIN expense_agg e     ON e.activity_id = a.id
    LEFT JOIN user_profiles creator ON creator.id = a.created_by_user_id
    LEFT JOIN district_agg d    ON d.activity_id = a.id
    LEFT JOIN state_agg st      ON st.activity_id = a.id
    LEFT JOIN plan_agg p        ON p.activity_id = a.id
    LEFT JOIN attendee_agg att  ON att.activity_id = a.id
    LEFT JOIN contact_agg c     ON c.activity_id = a.id
    LEFT JOIN opp_agg op        ON op.activity_id = a.id
    ORDER BY e.total_amount DESC NULLS LAST, a.start_date DESC NULLS LAST
  `);

  const lines: string[] = [COLS.join(",")];
  r.rows.forEach((row) => {
    const out: Record<string, unknown> = {
      activity_title: row.title,
      activity_type: row.type,
      activity_status: row.status,
      start_date: row.start_date,
      end_date: row.end_date,
      created_by: row.created_by,
      created_at: row.created_at,
      districts: row.districts,
      states: row.states,
      plans: row.plans,
      attendees: row.attendees,
      contact_count: row.contact_count,
      opportunity_count: row.opportunity_count,
      expense_line_count: row.expense_line_count ?? 0,
      total_expenses_usd: row.total_amount ?? 0,
      min_line_amount: row.min_amount,
      max_line_amount: row.max_amount,
      outcome_type: row.outcome_type,
      rating: row.rating,
      outcome: row.outcome,
      notes: row.notes,
    };
    lines.push(COLS.map((c) => esc(out[c])).join(","));
  });

  const outPath = join(process.cwd(), "exports", "expenses-by-activity.csv");
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`Wrote ${r.rows.length} rows to ${outPath}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
