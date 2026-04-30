import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 1. Any triggers that might be writing an audit log on opportunities?
const triggers = await prisma.$queryRaw`
  select event_object_table as table_name, trigger_name, event_manipulation, action_statement
  from information_schema.triggers
  where trigger_schema = 'public'
  order by event_object_table, trigger_name
`;
console.log("All triggers in public schema:");
if (triggers.length === 0) console.log("  (none)");
for (const t of triggers) {
  console.log(`  ${t.table_name}.${t.trigger_name} [${t.event_manipulation}]`);
  console.log(`    ${t.action_statement?.slice(0, 200)}`);
}

// 2. Any extension-installed audit tables (pgaudit, pg_audit, supa_audit)?
const extensions = await prisma.$queryRaw`
  select extname, extversion from pg_extension
  where extname ilike '%audit%' or extname ilike '%history%'
`;
console.log("\nAudit/history-related extensions:");
console.log(extensions);

// 3. Any tables at all with column names suggesting before/after change tracking
const changeCols = await prisma.$queryRaw`
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
    and (column_name ilike '%old_%' or column_name ilike '%prev_%'
         or column_name ilike '%before%' or column_name ilike '%change%')
  order by table_name
`;
console.log("\nColumns that smell like change tracking:");
if (changeCols.length === 0) console.log("  (none)");
for (const c of changeCols) console.log(`  ${c.table_name}.${c.column_name}`);

// 4. Full list of public tables — in case a change log lives under a name
// I wouldn't have guessed
const allTables = await prisma.$queryRaw`
  select table_name from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`;
console.log(`\nAll ${allTables.length} tables in public schema (scan for anything I missed):`);
for (const t of allTables) console.log(`  ${t.table_name}`);

await prisma.$disconnect();
