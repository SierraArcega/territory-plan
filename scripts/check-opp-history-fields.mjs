import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 1. Every column on opportunities, with data type — so we can spot any JSON
// column that might hold field history
const cols = await prisma.$queryRaw`
  select column_name, data_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'opportunities'
  order by ordinal_position
`;
console.log("opportunities columns:");
for (const c of cols) console.log(`  ${c.column_name.padEnd(32)}  ${c.data_type}`);

// 2. Every table that references opportunity_id
const refs = await prisma.$queryRaw`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and column_name in ('opportunity_id', 'opp_id', 'sf_opportunity_id')
  order by table_name
`;
console.log("\nTables referencing opportunity_id:");
for (const r of refs) console.log(`  ${r.table_name}.${r.column_name}`);

// 3. Sample a stage_history that has many entries; show FULL json so we see
// every key, in case amount or min_commit is hiding in there
const rich = await prisma.$queryRaw`
  select id, district_name, stage,
         jsonb_array_length(stage_history::jsonb) as n,
         stage_history::text as sh
  from opportunities
  where jsonb_array_length(stage_history::jsonb) >= 5
  limit 2
`;
console.log("\nLong stage_history samples (to expose any amount-tracking keys):");
for (const r of rich) {
  console.log(`\n${r.id} ${r.district_name} (current=${r.stage}, entries=${r.n})`);
  console.log(r.sh);
}

// 4. Are there any columns on opportunities whose data_type is jsonb?
const jsonCols = cols.filter(c => c.data_type === 'jsonb' || c.data_type === 'json');
console.log("\nJSON columns on opportunities (searchable for amount history):");
for (const c of jsonCols) console.log(`  ${c.column_name}`);

await prisma.$disconnect();
