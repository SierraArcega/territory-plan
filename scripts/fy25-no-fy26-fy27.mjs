import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FY25 = "2024-25";
const FY26 = "2025-26";
const FY27 = "2026-27";

// sanity: what school_yr values exist?
const yrs = await prisma.$queryRaw`
  select school_yr, count(*)::int as n
  from opportunities
  where stage = 'Closed Won'
  group by school_yr order by school_yr
`;
console.log("Closed Won by school_yr:", yrs);

// Districts with FY25 closed-won bookings
const rows = await prisma.$queryRaw`
  with fy25 as (
    select district_lea_id, district_name,
           sum(net_booking_amount)::float as fy25_bookings,
           count(*)::int as fy25_opps
    from opportunities
    where school_yr = ${FY25} and stage = 'Closed Won'
      and district_lea_id is not null
    group by district_lea_id, district_name
  ),
  fy26_27 as (
    select distinct district_lea_id
    from opportunities
    where school_yr in (${FY26}, ${FY27})
      and district_lea_id is not null
  )
  select f.district_lea_id, f.district_name, f.fy25_bookings, f.fy25_opps
  from fy25 f
  left join fy26_27 x on x.district_lea_id = f.district_lea_id
  where x.district_lea_id is null
  order by f.fy25_bookings desc
`;

console.log(`\nDistricts with FY25 bookings but NO FY26/FY27 opportunities: ${rows.length}`);
console.log("Total FY25 bookings at risk:", rows.reduce((s,r)=>s+Number(r.fy25_bookings||0),0).toLocaleString());

const header = ["district_name","fy25_bookings","fy25_opps","leaid"].join("\t");
console.log("\n"+header);
for (const r of rows) {
  console.log([r.district_name ?? "(unknown)", Math.round(r.fy25_bookings), r.fy25_opps, r.district_lea_id].join("\t"));
}
await prisma.$disconnect();
