/**
 * One-shot migration: split NYC DOE's 309 children into three groups.
 *
 * Before:   NYC DOE (3620580) → 32 CSDs + District 75 + 276 charters = 309
 * After:    NYC DOE (3620580) → 32 CSDs only
 *           NYC Charter Schools (3600000, new pseudo) → 276 charters
 *           District 75 (3600135) → top-level (parent_leaid = NULL)
 *
 * Why: "NYC DOE" as a plan target should mean the 32 Geographic Community
 * School Districts — the administrative subdivisions that tile the 5
 * boroughs. Lumping in 276 charters (which aren't NYC-DOE-administered in
 * practice) plus District 75 (a citywide special-ed overlay) bloats the
 * auto-migrate "Expand to N districts" into 309-row selections that
 * aren't what sales reps mean when they say "I want NYC."
 *
 * The pseudo-rollup for charters is a first-class rollup in the same data
 * model: a row in `districts` with no geometry, no point_location, and
 * parent_leaid = NULL. Users who want charter coverage can search for
 * "NYC Charter Schools" and get the 276 via the same DistrictCard rollup
 * strip used for NYC DOE.
 *
 * Idempotent: re-running produces the same state. Safe to run multiple
 * times. After running, REFRESH MATERIALIZED VIEW district_map_features
 * (the tile pipeline caches leaid-level metadata via the matview).
 *
 * Run: `npx tsx prisma/seed-nyc-charter-pseudo.ts`
 */
import prisma from "@/lib/prisma";

const PSEUDO_CHARTER_LEAID = "3600000";
const NYC_DOE_LEAID = "3620580";
const DISTRICT_75_LEAID = "3600135";

async function main() {
  // 1) Upsert the NYC Charter Schools pseudo-district
  await prisma.$executeRaw`
    INSERT INTO districts (leaid, name, state_fips, state_abbrev, account_type, created_at, updated_at)
    VALUES (${PSEUDO_CHARTER_LEAID}, 'NYC Charter Schools', '36', 'NY', 'district', NOW(), NOW())
    ON CONFLICT (leaid) DO UPDATE
    SET name = EXCLUDED.name, state_abbrev = EXCLUDED.state_abbrev, updated_at = NOW();
  `;
  console.log(`Upserted pseudo-district ${PSEUDO_CHARTER_LEAID} (NYC Charter Schools)`);

  // 2) Re-parent the 276 charters from NYC DOE → charter pseudo-parent
  //    Identification: under NYC DOE, but NOT a Geographic District, NOT District 75.
  const reparented = await prisma.$executeRaw`
    UPDATE districts
    SET parent_leaid = ${PSEUDO_CHARTER_LEAID}, updated_at = NOW()
    WHERE parent_leaid = ${NYC_DOE_LEAID}
      AND name NOT ILIKE '%GEOGRAPHIC DISTRICT%'
      AND leaid <> ${DISTRICT_75_LEAID};
  `;
  console.log(`Re-parented ${reparented} charter districts to ${PSEUDO_CHARTER_LEAID}`);

  // 3) Demote District 75 from NYC DOE child to top-level
  const demoted = await prisma.$executeRaw`
    UPDATE districts
    SET parent_leaid = NULL, updated_at = NOW()
    WHERE leaid = ${DISTRICT_75_LEAID};
  `;
  console.log(`Demoted District 75 (${DISTRICT_75_LEAID}) to top-level: ${demoted} row`);

  // 4) Verify final counts
  const doe = await prisma.$queryRaw<{n: bigint}[]>`
    SELECT COUNT(*)::bigint AS n FROM districts WHERE parent_leaid = ${NYC_DOE_LEAID};
  `;
  const charters = await prisma.$queryRaw<{n: bigint}[]>`
    SELECT COUNT(*)::bigint AS n FROM districts WHERE parent_leaid = ${PSEUDO_CHARTER_LEAID};
  `;
  const d75 = await prisma.$queryRaw<{parent_leaid: string | null}[]>`
    SELECT parent_leaid FROM districts WHERE leaid = ${DISTRICT_75_LEAID};
  `;

  console.log("\nFinal state:");
  console.log(`  NYC DOE (${NYC_DOE_LEAID}) children:        ${Number(doe[0].n)} (expect 32)`);
  console.log(`  NYC Charters (${PSEUDO_CHARTER_LEAID}) children: ${Number(charters[0].n)} (expect 276)`);
  console.log(`  District 75 parent_leaid:          ${d75[0]?.parent_leaid ?? "NULL"} (expect NULL)`);

  if (Number(doe[0].n) !== 32 || Number(charters[0].n) !== 276 || d75[0]?.parent_leaid !== null) {
    console.error("\n⚠️  Counts don't match expectations — inspect data before refreshing matview");
    process.exit(1);
  }

  console.log("\n✓ Counts match. Next step: REFRESH MATERIALIZED VIEW district_map_features;");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
