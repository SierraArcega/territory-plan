// Does stage_history preserve pre-migration transitions, or does it start at import time?
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const rows = await prisma.$queryRaw`
  select
    count(*)::int as total,
    count(*) filter (where jsonb_array_length(stage_history::jsonb) > 0)::int as with_history,
    count(*) filter (where jsonb_array_length(stage_history::jsonb) > 1)::int as with_multi,
    min(created_at) as earliest_created,
    max(created_at) as latest_created,
    min(synced_at) as earliest_synced,
    max(synced_at) as latest_synced
  from opportunities
  where school_yr = '2026-27'
`;
console.log("FY27 opp row-level timestamps:");
console.log(rows[0]);

const oldest = await prisma.$queryRaw`
  select id, district_name, stage,
         (select min((h->>'timestamp')::timestamptz)
            from jsonb_array_elements(stage_history::jsonb) h) as oldest_history_ts,
         (select max((h->>'timestamp')::timestamptz)
            from jsonb_array_elements(stage_history::jsonb) h) as newest_history_ts,
         jsonb_array_length(stage_history::jsonb) as hist_len
  from opportunities
  where school_yr = '2026-27'
    and jsonb_array_length(stage_history::jsonb) > 0
  order by (select min((h->>'timestamp')::timestamptz)
             from jsonb_array_elements(stage_history::jsonb) h) asc
  limit 5
`;
console.log("\n5 FY27 opps with the earliest stage_history entry:");
for (const r of oldest) {
  console.log(
    `  ${r.id.slice(0, 8)}  ${(r.district_name || "?").slice(0, 30).padEnd(30)}  ` +
    `hist_len=${r.hist_len}  oldest=${r.oldest_history_ts?.toISOString?.() || r.oldest_history_ts}  newest=${r.newest_history_ts?.toISOString?.() || r.newest_history_ts}  now=${r.stage}`
  );
}

const histLenDist = await prisma.$queryRaw`
  select jsonb_array_length(stage_history::jsonb) as len, count(*)::int as n
  from opportunities
  where school_yr = '2026-27'
  group by 1
  order by 1
`;
console.log("\nstage_history length distribution for FY27:");
for (const r of histLenDist) console.log(`  len=${r.len}  n=${r.n}`);

await prisma.$disconnect();
