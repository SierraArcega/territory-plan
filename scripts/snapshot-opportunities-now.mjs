// One-off: take today's opportunity snapshot immediately, rather than waiting
// for next Monday's cron. Idempotent — running twice on the same day
// overwrites the existing snapshot for each opp.
//
// Prereq: migration 20260420_add_audit_log_and_snapshots must be applied first.
//         `npx prisma migrate deploy`
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const today = new Date();
today.setUTCHours(0, 0, 0, 0);

const SCHOOL_YEARS = ["2024-25", "2025-26", "2026-27", "2027-28"];

console.log(`Snapshotting opportunities for ${today.toISOString().slice(0, 10)}…`);

const opps = await prisma.opportunity.findMany({
  where: { schoolYr: { in: SCHOOL_YEARS } },
  select: {
    id: true,
    stage: true,
    netBookingAmount: true,
    minimumPurchaseAmount: true,
    maximumBudget: true,
    schoolYr: true,
    salesRepId: true,
    districtLeaId: true,
    closeDate: true,
    expiration: true,
  },
});

console.log(`  fetched ${opps.length} opps across ${SCHOOL_YEARS.join(", ")}`);

const CHUNK = 500;
const startedAt = Date.now();

for (let i = 0; i < opps.length; i += CHUNK) {
  const chunk = opps.slice(i, i + CHUNK);
  await prisma.$transaction(
    chunk.map((o) =>
      prisma.opportunitySnapshot.upsert({
        where: { opportunityId_snapshotDate: { opportunityId: o.id, snapshotDate: today } },
        create: {
          opportunityId: o.id,
          snapshotDate: today,
          stage: o.stage,
          netBookingAmount: o.netBookingAmount,
          minimumPurchaseAmount: o.minimumPurchaseAmount,
          maximumBudget: o.maximumBudget,
          schoolYr: o.schoolYr,
          salesRepId: o.salesRepId,
          districtLeaId: o.districtLeaId,
          closeDate: o.closeDate,
          expiration: o.expiration,
        },
        update: {
          stage: o.stage,
          netBookingAmount: o.netBookingAmount,
          minimumPurchaseAmount: o.minimumPurchaseAmount,
          maximumBudget: o.maximumBudget,
          schoolYr: o.schoolYr,
          salesRepId: o.salesRepId,
          districtLeaId: o.districtLeaId,
          closeDate: o.closeDate,
          expiration: o.expiration,
          capturedAt: new Date(),
        },
      })
    )
  );
  process.stdout.write(`  wrote ${Math.min(i + CHUNK, opps.length)}/${opps.length}\r`);
}

// Verify
const counts = await prisma.$queryRaw`
  select school_yr, count(*)::int as n, sum(net_booking_amount)::float as open_plus_closed_amt
  from opportunity_snapshots
  where snapshot_date = ${today}
  group by 1 order by 1
`;
console.log(`\n\nSnapshot complete in ${((Date.now() - startedAt) / 1000).toFixed(1)}s:`);
for (const r of counts) {
  console.log(`  ${r.school_yr}  n=${String(r.n).padStart(4)}  sum net_booking=$${Math.round(r.open_plus_closed_amt || 0).toLocaleString()}`);
}

await prisma.$disconnect();
