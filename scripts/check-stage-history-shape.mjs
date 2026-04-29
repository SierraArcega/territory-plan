import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const samples = await prisma.$queryRaw`
  select id, stage, jsonb_array_length(stage_history::jsonb) as n,
         stage_history::text as sh_text
  from opportunities
  where school_yr = '2026-27' and jsonb_array_length(stage_history::jsonb) >= 2
  limit 3
`;
console.log("3 sample stage_history values (FY27, with >= 2 entries):");
for (const s of samples) {
  console.log(`\nid=${s.id}  current stage=${s.stage}  entries=${s.n}`);
  console.log("  " + s.sh_text);
}

// createdAt distribution for FY27 — shows whether the migration batch-stamped
// rows (spike on one day) or preserved SF-native dates (smooth over time).
const byMonth = await prisma.$queryRaw`
  select date_trunc('month', created_at) as month, count(*)::int as n,
         sum(net_booking_amount)::float as amt
  from opportunities
  where school_yr = '2026-27'
  group by 1
  order by 1
`;
console.log("\nFY27 created_at distribution by month:");
for (const r of byMonth) {
  console.log(`  ${r.month.toISOString().slice(0,7)}  n=${String(r.n).padStart(4)}  $${Math.round(r.amt||0).toLocaleString()}`);
}

const byWeek = await prisma.$queryRaw`
  select date_trunc('week', created_at) as wk, count(*)::int as n,
         sum(net_booking_amount)::float as amt
  from opportunities
  where school_yr = '2026-27' and created_at >= now() - interval '120 days'
  group by 1
  order by 1
`;
console.log("\nFY27 created_at distribution by week (last 120 days):");
for (const r of byWeek) {
  console.log(`  ${r.wk.toISOString().slice(0,10)}  n=${String(r.n).padStart(4)}  $${Math.round(r.amt||0).toLocaleString()}`);
}

await prisma.$disconnect();
