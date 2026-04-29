import { Pool } from "pg";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

config();

const OPEN_STAGES = [
  "0 - Meeting Booked",
  "1 - Discovery",
  "2 - Presentation",
  "3 - Proposal",
  "4 - Negotiation",
  "5 - Commitment",
];

const COLS = [
  "rank",
  "leaid",
  "district",
  "state",
  "total_revenue",
  "completed_revenue",
  "scheduled_revenue",
  "services",
  "fy26_won_opps",
  "fy26_won_booking",
  "fy27_won_opps",
  "fy27_won_booking",
  "pipeline_opp_count",
  "pipeline_booking",
  "pipeline_min",
  "pipeline_max",
  "fy27_pipe_opps",
  "fy27_pipe_booking",
  "next_activity_title",
  "next_activity_type",
  "next_activity_status",
  "next_activity_date",
  "last_activity_title",
  "last_activity_date",
  "last_closer",
  "last_close_date",
  "last_opp_name",
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

  const r = await pool.query(
    `
    WITH top40 AS (
      SELECT df.leaid, df.total_revenue::float AS total_revenue
      FROM district_financials df
      WHERE df.vendor='fullmind' AND df.fiscal_year='FY26'
      ORDER BY df.total_revenue DESC NULLS LAST
      LIMIT 40
    ),
    opps_norm AS (
      SELECT o.*, COALESCE(o.district_lea_id, NULLIF(TRIM(o.district_nces_id), '')) AS eff_leaid
      FROM opportunities o
    ),
    opp_services AS (
      SELECT o.eff_leaid AS leaid, jsonb_array_elements_text(o.service_types::jsonb) AS service
      FROM opps_norm o JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.school_yr='2025-26'
        AND o.stage IN ('Closed Won','Complete - Full Length','Complete - Early Cancellation','Position Purchased','Active')
        AND o.service_types::text <> '[]'
    ),
    sub_services AS (
      SELECT o.eff_leaid AS leaid, s.product_type AS service
      FROM subscriptions s
      JOIN opps_norm o ON o.id = s.opportunity_id
      JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.school_yr='2025-26' AND s.product_type IS NOT NULL AND s.product_type NOT IN ('Fee','Credit')
    ),
    services_agg AS (
      SELECT leaid, string_agg(DISTINCT NULLIF(service,'n/a'), ', ' ORDER BY NULLIF(service,'n/a')) AS services
      FROM (SELECT * FROM opp_services UNION SELECT * FROM sub_services) u GROUP BY leaid
    ),
    pipeline_fy26 AS (
      SELECT o.eff_leaid AS leaid, COUNT(*) AS opp_count,
        COALESCE(SUM(o.net_booking_amount),0)::float AS booking,
        COALESCE(SUM(o.minimum_purchase_amount),0)::float AS pmin,
        COALESCE(SUM(o.maximum_budget),0)::float AS pmax
      FROM opps_norm o JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.stage = ANY($1)
      GROUP BY o.eff_leaid
    ),
    pipeline_fy27 AS (
      SELECT o.eff_leaid AS leaid, COUNT(*) AS opp_count,
        COALESCE(SUM(o.net_booking_amount),0)::float AS booking
      FROM opps_norm o JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.stage = ANY($1) AND o.school_yr='2026-27'
      GROUP BY o.eff_leaid
    ),
    won_fy26 AS (
      SELECT o.eff_leaid AS leaid, COUNT(*) AS opp_count,
        COALESCE(SUM(o.net_booking_amount),0)::float AS booking
      FROM opps_norm o JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.stage='Closed Won' AND o.school_yr='2025-26'
      GROUP BY o.eff_leaid
    ),
    won_fy27 AS (
      SELECT o.eff_leaid AS leaid, COUNT(*) AS opp_count,
        COALESCE(SUM(o.net_booking_amount),0)::float AS booking
      FROM opps_norm o JOIN top40 t ON t.leaid = o.eff_leaid
      WHERE o.stage='Closed Won' AND o.school_yr='2026-27'
      GROUP BY o.eff_leaid
    )
    SELECT t.leaid, d.name, d.state_abbrev, t.total_revenue,
      df.completed_revenue::float AS completed_revenue,
      df.scheduled_revenue::float AS scheduled_revenue,
      next_act.title AS next_activity_title, next_act.type AS next_activity_type,
      next_act.status AS next_activity_status, next_act.next_date AS next_activity_date,
      last_act.title AS last_activity_title, last_act.last_date AS last_activity_date,
      last_won.sales_rep_name AS last_closer, last_won.close_date AS last_close_date, last_won.name AS last_opp_name,
      services_agg.services,
      COALESCE(p.opp_count,0) AS pipeline_opp_count,
      COALESCE(p.booking,0) AS pipeline_booking,
      COALESCE(p.pmin,0) AS pipeline_min,
      COALESCE(p.pmax,0) AS pipeline_max,
      COALESCE(p27.opp_count,0) AS fy27_pipe_opps,
      COALESCE(p27.booking,0) AS fy27_pipe_booking,
      COALESCE(w26.opp_count,0) AS fy26_won_opps,
      COALESCE(w26.booking,0) AS fy26_won_booking,
      COALESCE(w27.opp_count,0) AS fy27_won_opps,
      COALESCE(w27.booking,0) AS fy27_won_booking
    FROM top40 t
    LEFT JOIN districts d ON d.leaid = t.leaid
    LEFT JOIN district_financials df ON df.leaid=t.leaid AND df.vendor='fullmind' AND df.fiscal_year='FY26'
    LEFT JOIN LATERAL (
      SELECT a.title, a.type, a.status, COALESCE(ad.visit_date,a.start_date) AS next_date
      FROM activity_districts ad JOIN activities a ON a.id=ad.activity_id
      WHERE ad.district_leaid=t.leaid
        AND a.status IN ('planned','requested','planning','in_progress')
        AND COALESCE(ad.visit_date,a.start_date) >= CURRENT_DATE
      ORDER BY COALESCE(ad.visit_date,a.start_date) ASC LIMIT 1
    ) next_act ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.title, COALESCE(ad.visit_date,a.start_date) AS last_date
      FROM activity_districts ad JOIN activities a ON a.id=ad.activity_id
      WHERE ad.district_leaid=t.leaid
        AND COALESCE(ad.visit_date,a.start_date) < CURRENT_DATE
      ORDER BY COALESCE(ad.visit_date,a.start_date) DESC LIMIT 1
    ) last_act ON TRUE
    LEFT JOIN LATERAL (
      SELECT o.sales_rep_name, o.close_date, o.name
      FROM opps_norm o
      WHERE o.eff_leaid=t.leaid AND o.stage='Closed Won' AND o.close_date IS NOT NULL
      ORDER BY o.close_date DESC LIMIT 1
    ) last_won ON TRUE
    LEFT JOIN services_agg ON services_agg.leaid=t.leaid
    LEFT JOIN pipeline_fy26 p ON p.leaid=t.leaid
    LEFT JOIN pipeline_fy27 p27 ON p27.leaid=t.leaid
    LEFT JOIN won_fy26 w26 ON w26.leaid=t.leaid
    LEFT JOIN won_fy27 w27 ON w27.leaid=t.leaid
    ORDER BY t.total_revenue DESC
  `,
    [OPEN_STAGES],
  );

  const lines: string[] = [COLS.join(",")];
  r.rows.forEach((row, i) => {
    const out: Record<string, unknown> = {
      rank: i + 1,
      leaid: row.leaid,
      district: row.name,
      state: row.state_abbrev,
      total_revenue: row.total_revenue,
      completed_revenue: row.completed_revenue,
      scheduled_revenue: row.scheduled_revenue,
      services: row.services,
      fy26_won_opps: row.fy26_won_opps,
      fy26_won_booking: row.fy26_won_booking,
      fy27_won_opps: row.fy27_won_opps,
      fy27_won_booking: row.fy27_won_booking,
      pipeline_opp_count: row.pipeline_opp_count,
      pipeline_booking: row.pipeline_booking,
      pipeline_min: row.pipeline_min,
      pipeline_max: row.pipeline_max,
      fy27_pipe_opps: row.fy27_pipe_opps,
      fy27_pipe_booking: row.fy27_pipe_booking,
      next_activity_title: row.next_activity_title,
      next_activity_type: row.next_activity_type,
      next_activity_status: row.next_activity_status,
      next_activity_date: row.next_activity_date,
      last_activity_title: row.last_activity_title,
      last_activity_date: row.last_activity_date,
      last_closer: row.last_closer,
      last_close_date: row.last_close_date,
      last_opp_name: row.last_opp_name,
    };
    lines.push(COLS.map((c) => esc(out[c])).join(","));
  });

  const outPath = join(process.cwd(), "exports", "top-40-customers-fy26.csv");
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`Wrote ${r.rows.length} rows to ${outPath}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
