import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function describe(table) {
  const cols = await prisma.$queryRaw`
    select column_name, data_type from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by ordinal_position
  `;
  console.log(`\n== ${table} ==`);
  for (const c of cols) console.log(`  ${c.column_name.padEnd(28)} ${c.data_type}`);
}

async function sample(table, where = "") {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `select * from ${table} ${where} order by 1 desc limit 5`
    );
    console.log(`\nLatest 5 from ${table}:`);
    for (const r of rows) console.log(JSON.stringify(r, null, 2).slice(0, 500));
  } catch (e) {
    console.log(`  (sample failed: ${e.message})`);
  }
}

for (const t of ["data_refresh_logs", "sync_state"]) {
  await describe(t);
  await sample(t);
}

await prisma.$disconnect();
