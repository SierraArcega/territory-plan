import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Any table whose name hints at a snapshot / history / audit
const tables = await prisma.$queryRaw`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and (
      table_name ilike '%snapshot%'
      or table_name ilike '%history%'
      or table_name ilike '%audit%'
      or table_name ilike '%backup%'
      or table_name ilike 'opp%_hist%'
      or table_name ilike 'opp%_snap%'
    )
  order by table_name
`;
console.log("Tables matching snapshot/history/audit/backup patterns:");
console.log(tables);

// Any opportunity-related rows with a different created date pattern?
// (sanity: count distinct synced_at days to see if we have multiple sync generations)
const syncs = await prisma.$queryRaw`
  select date_trunc('day', synced_at) as day, count(*)::int as n
  from opportunities
  where synced_at is not null
  group by 1 order by 1
`;
console.log("\nOpportunity sync days (all fiscal years):");
for (const r of syncs) {
  console.log(`  ${r.day.toISOString().slice(0,10)}  n=${r.n}`);
}
await prisma.$disconnect();
