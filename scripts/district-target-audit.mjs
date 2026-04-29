import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// 1. Confirm what columns actually exist on territory_plan_districts
const cols = await prisma.$queryRaw`
  select column_name, data_type, is_nullable
  from information_schema.columns
  where table_schema = 'public' and table_name = 'territory_plan_districts'
  order by ordinal_position
`;
console.log("territory_plan_districts columns (live DB):");
for (const c of cols) console.log(`  ${c.column_name.padEnd(24)}  ${c.data_type.padEnd(28)}  ${c.is_nullable === "YES" ? "null-ok" : "not-null"}`);

// 2. Is there an updated_at or equivalent we could use?
const hasUpdatedAt = cols.some((c) => c.column_name === "updated_at" || c.column_name === "target_updated_at");
console.log(`\nHas updated_at-style column: ${hasUpdatedAt}`);

// 3. Full historical audit — every plan-district pairing with a target, across all time
const rows = await prisma.$queryRaw`
  select date_trunc('week', tpd.added_at) as wk,
         count(*)::int as n_pairings,
         count(*) filter (where tpd.renewal_target is not null)::int as n_renewal,
         count(*) filter (where tpd.expansion_target is not null)::int as n_expansion,
         count(*) filter (where tpd.winback_target is not null)::int as n_winback,
         count(*) filter (where tpd.new_business_target is not null)::int as n_newbiz,
         coalesce(sum(tpd.renewal_target),0)::float as sum_renewal,
         coalesce(sum(tpd.expansion_target),0)::float as sum_expansion,
         coalesce(sum(tpd.winback_target),0)::float as sum_winback,
         coalesce(sum(tpd.new_business_target),0)::float as sum_newbiz
  from territory_plan_districts tpd
  where tpd.renewal_target is not null
     or tpd.expansion_target is not null
     or tpd.winback_target is not null
     or tpd.new_business_target is not null
  group by 1
  order by 1 desc
  limit 20
`;
console.log("\nPlan-district target-setting activity by week (non-null targets only, most recent 20 weeks):");
console.log(`  ${"week starting".padEnd(14)}  ${"n pairs".padStart(8)}  ${"renewal$".padStart(14)}  ${"expand$".padStart(12)}  ${"winback$".padStart(12)}  ${"newbiz$".padStart(12)}`);
const $ = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
for (const r of rows) {
  console.log(
    `  ${r.wk.toISOString().slice(0,10).padEnd(14)}  ${String(r.n_pairings).padStart(8)}  ${$(r.sum_renewal).padStart(14)}  ${$(r.sum_expansion).padStart(12)}  ${$(r.sum_winback).padStart(12)}  ${$(r.sum_newbiz).padStart(12)}`
  );
}

// 4. All-time aggregate — what's the total targeted $ sitting in the table right now?
const totals = await prisma.$queryRaw`
  select count(*)::int as n_pairings,
         count(distinct plan_id)::int as n_plans,
         coalesce(sum(renewal_target),0)::float as total_renewal,
         coalesce(sum(expansion_target),0)::float as total_expansion,
         coalesce(sum(winback_target),0)::float as total_winback,
         coalesce(sum(new_business_target),0)::float as total_newbiz,
         min(added_at) as first_added,
         max(added_at) as last_added
  from territory_plan_districts
  where renewal_target is not null or expansion_target is not null
     or winback_target is not null or new_business_target is not null
`;
console.log("\nAll-time totals (plan-district targets that have any non-null value):");
console.log(totals[0]);

// 5. Sanity check: for existing pairings, do the target dollar values look
// suspicious (round numbers concentrated around specific dates)? That's one
// way to reverse-engineer "bulk target-setting events" even without updated_at.
const byDay = await prisma.$queryRaw`
  select date_trunc('day', added_at) as day,
         count(*)::int as n_added,
         count(distinct plan_id)::int as n_plans
  from territory_plan_districts
  where renewal_target is not null or expansion_target is not null
     or winback_target is not null or new_business_target is not null
  group by 1
  order by n_added desc
  limit 15
`;
console.log("\nTop 15 days by # of plan-district pairings added WITH a target (bulk target-setting signal):");
for (const r of byDay) {
  console.log(`  ${r.day.toISOString().slice(0,10)}  n=${String(r.n_added).padStart(4)}  across ${r.n_plans} plans`);
}

await prisma.$disconnect();
