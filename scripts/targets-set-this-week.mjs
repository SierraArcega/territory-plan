// What "targets" were set or touched this week? Two places hold targets:
//   1. user_goals      — per-rep per-FY quota (earnings, take rate, 4 category targets, etc.)
//   2. territory_plan_districts — per-district targets (renewal/winback/expansion/new-biz)
// UserGoal has created_at + updated_at, so we can distinguish brand-new from edits.
// TerritoryPlanDistrict has only added_at (no updated_at) — target edits post-add are
// indistinguishable from any other edit. Flagged at the bottom.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DAYS = 7;
const since = new Date(Date.now() - DAYS * 86400000);
const $ = (n) => n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const pad = (s, n) => { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padEnd(n); };
const padL = (s, n) => { s = String(s ?? "—"); return s.length > n ? s.slice(0, n) : s.padStart(n); };

// ── UserGoal: new this week (created_at within window) ──────────────────
const newGoals = await prisma.$queryRaw`
  select g.*, u.full_name, u.email
  from user_goals g
  left join user_profiles u on u.id = g.user_id
  where g.created_at >= ${since}
  order by g.created_at desc
`;
// ── UserGoal: edited this week (updated_at within window, but created before) ──
const editedGoals = await prisma.$queryRaw`
  select g.*, u.full_name, u.email
  from user_goals g
  left join user_profiles u on u.id = g.user_id
  where g.updated_at >= ${since}
    and g.created_at < ${since}
  order by g.updated_at desc
`;

// ── TerritoryPlanDistrict: new pairings this week (target set at add-time) ──
const newPlanDistricts = await prisma.$queryRaw`
  select tpd.*, p.name as plan_name, p.fiscal_year,
         u.full_name as owner_name, d.name as district_name, d.state_abbrev
  from territory_plan_districts tpd
  join territory_plans p on p.id = tpd.plan_id
  left join user_profiles u on u.id = p.owner_id
  left join districts d on d.leaid = tpd.district_leaid
  where tpd.added_at >= ${since}
    and (tpd.renewal_target is not null
      or tpd.winback_target is not null
      or tpd.expansion_target is not null
      or tpd.new_business_target is not null)
  order by tpd.added_at desc
`;

// ── Territory plans: created or updated this week ──────────────────────
const newPlans = await prisma.$queryRaw`
  select p.*, u.full_name as owner_name
  from territory_plans p
  left join user_profiles u on u.id = p.owner_id
  where p.created_at >= ${since}
  order by p.created_at desc
`;
const updatedPlans = await prisma.$queryRaw`
  select p.id, p.name, p.fiscal_year, p.status,
         p.renewal_rollup::float as renewal_rollup,
         p.expansion_rollup::float as expansion_rollup,
         p.winback_rollup::float as winback_rollup,
         p.new_business_rollup::float as new_business_rollup,
         p.updated_at, p.created_at,
         u.full_name as owner_name
  from territory_plans p
  left join user_profiles u on u.id = p.owner_id
  where p.updated_at >= ${since} and p.created_at < ${since}
  order by p.updated_at desc
`;

console.log(`=== Targets set or touched in the last ${DAYS} days (since ${since.toISOString().slice(0,10)}) ===\n`);

console.log(`── user_goals: NEW this week (${newGoals.length}) ──`);
if (newGoals.length === 0) console.log("  (none)");
for (const g of newGoals) {
  console.log(
    `  ${pad(g.full_name || g.email || g.user_id, 28)}  FY${String(g.fiscal_year).slice(-2)}  ` +
    `earn=${padL($(g.earnings_target), 10)}  take=${padL($(g.take_target), 10)}  ` +
    `renew=${padL($(g.renewal_target), 10)}  winback=${padL($(g.winback_target), 10)}  ` +
    `expand=${padL($(g.expansion_target), 10)}  newbiz=${padL($(g.new_business_target), 10)}  ` +
    `newDist=${padL(g.new_districts_target ?? "—", 4)}  [${g.created_at.toISOString().slice(0,10)}]`
  );
}

console.log(`\n── user_goals: EDITED this week (${editedGoals.length}) ──`);
if (editedGoals.length === 0) console.log("  (none)");
for (const g of editedGoals) {
  console.log(
    `  ${pad(g.full_name || g.email || g.user_id, 28)}  FY${String(g.fiscal_year).slice(-2)}  ` +
    `earn=${padL($(g.earnings_target), 10)}  take=${padL($(g.take_target), 10)}  ` +
    `renew=${padL($(g.renewal_target), 10)}  winback=${padL($(g.winback_target), 10)}  ` +
    `expand=${padL($(g.expansion_target), 10)}  newbiz=${padL($(g.new_business_target), 10)}  ` +
    `[updated ${g.updated_at.toISOString().slice(0,10)}]`
  );
}

console.log(`\n── territory_plans: NEW this week (${newPlans.length}) ──`);
if (newPlans.length === 0) console.log("  (none)");
for (const p of newPlans) {
  console.log(`  FY${String(p.fiscal_year).slice(-2)}  ${pad(p.name, 40)}  ${pad(p.owner_name, 22)}  [${p.created_at.toISOString().slice(0,10)}]  status=${p.status}`);
}

console.log(`\n── territory_plans: UPDATED this week (${updatedPlans.length}) ──`);
if (updatedPlans.length === 0) console.log("  (none)");
for (const p of updatedPlans) {
  const total = (p.renewal_rollup||0) + (p.expansion_rollup||0) + (p.winback_rollup||0) + (p.new_business_rollup||0);
  console.log(
    `  FY${String(p.fiscal_year).slice(-2)}  ${pad(p.name, 40)}  ${pad(p.owner_name, 22)}  ` +
    `rollup=${padL($(total), 12)}  [updated ${p.updated_at.toISOString().slice(0,10)}]`
  );
}

console.log(`\n── territory_plan_districts: NEW pairings with targets this week (${newPlanDistricts.length}) ──`);
if (newPlanDistricts.length === 0) console.log("  (none)");
for (const r of newPlanDistricts.slice(0, 30)) {
  console.log(
    `  ${pad(r.plan_name, 24)}  ${pad(r.district_name, 32)} ${r.state_abbrev || "?"}  ` +
    `renew=${padL($(r.renewal_target), 10)}  expand=${padL($(r.expansion_target), 10)}  ` +
    `winback=${padL($(r.winback_target), 10)}  newbiz=${padL($(r.new_business_target), 10)}  ` +
    `[${r.added_at.toISOString().slice(0,10)}]`
  );
}
if (newPlanDistricts.length > 30) console.log(`  … ${newPlanDistricts.length - 30} more`);

// Aggregate totals of new-target dollars injected this week
const sum = (arr, f) => arr.reduce((s, r) => s + Number(f(r) || 0), 0);
const goalsTotal = sum(newGoals.concat(editedGoals), (g) =>
  (Number(g.renewal_target)||0) + (Number(g.winback_target)||0) + (Number(g.expansion_target)||0) + (Number(g.new_business_target)||0)
);
const planDistrictsTotal = sum(newPlanDistricts, (r) =>
  (Number(r.renewal_target)||0) + (Number(r.winback_target)||0) + (Number(r.expansion_target)||0) + (Number(r.new_business_target)||0)
);
console.log(`\n── Totals ──`);
console.log(`  user_goals new+edited: ${goalsTotal ? $(goalsTotal) : "$0"} across ${newGoals.length + editedGoals.length} rows`);
console.log(`  plan-district target dollars added this week: ${$(planDistrictsTotal)} across ${newPlanDistricts.length} pairings`);

console.log(`\n── Data gap ──`);
console.log(`  • territory_plan_districts has no updated_at column, so we CANNOT see`);
console.log(`    whether an existing pairing had its targets edited this week — only`);
console.log(`    brand-new pairings show up here. Same audit gap as opp min-commit.`);
console.log(`  • For user_goals, 'edited' means any column on the row changed; we can't`);
console.log(`    show which specific target moved from what to what.`);

await prisma.$disconnect();
