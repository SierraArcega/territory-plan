/**
 * Data Migration: Map free-text owner strings to UserProfile IDs
 *
 * For each District with a non-null `owner`, attempt to match to a UserProfile
 * by normalized fullName and set `ownerId`.
 *
 * For each State with a non-null `territoryOwner`, attempt to match and set
 * `territoryOwnerId`.
 *
 * Usage: npx tsx scripts/migrate-owner-strings.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

async function main() {
  // 1. Fetch all UserProfile records and build lookup map
  const users = await prisma.userProfile.findMany({
    select: { id: true, fullName: true, email: true },
  });

  const nameToId = new Map<string, string>();
  for (const user of users) {
    if (user.fullName) {
      nameToId.set(normalize(user.fullName), user.id);
    }
    // Also map by email prefix as fallback
    const emailPrefix = user.email.split("@")[0].replace(/[._-]/g, " ");
    if (!nameToId.has(normalize(emailPrefix))) {
      nameToId.set(normalize(emailPrefix), user.id);
    }
  }

  console.log(`Found ${users.length} users. Name map has ${nameToId.size} entries.`);

  // 2. Migrate District owners
  const districts = await prisma.district.findMany({
    where: { owner: { not: null }, ownerId: null },
    select: { leaid: true, owner: true },
  });

  let districtMatched = 0;
  let districtUnmatched = 0;
  const unmatchedDistrictOwners = new Set<string>();

  for (const district of districts) {
    if (!district.owner) continue;
    const userId = nameToId.get(normalize(district.owner));
    if (userId) {
      await prisma.district.update({
        where: { leaid: district.leaid },
        data: { ownerId: userId },
      });
      districtMatched++;
    } else {
      unmatchedDistrictOwners.add(district.owner);
      districtUnmatched++;
    }
  }

  console.log(`\nDistricts: ${districtMatched} matched, ${districtUnmatched} unmatched`);
  if (unmatchedDistrictOwners.size > 0) {
    console.log("Unmatched district owners:", [...unmatchedDistrictOwners]);
  }

  // 3. Migrate State territory owners
  const states = await prisma.state.findMany({
    where: { territoryOwner: { not: null }, territoryOwnerId: null },
    select: { abbrev: true, territoryOwner: true },
  });

  let stateMatched = 0;
  let stateUnmatched = 0;
  const unmatchedStateOwners = new Set<string>();

  for (const state of states) {
    if (!state.territoryOwner) continue;
    const userId = nameToId.get(normalize(state.territoryOwner));
    if (userId) {
      await prisma.state.update({
        where: { abbrev: state.abbrev },
        data: { territoryOwnerId: userId },
      });
      stateMatched++;
    } else {
      unmatchedStateOwners.add(state.territoryOwner);
      stateUnmatched++;
    }
  }

  console.log(`States: ${stateMatched} matched, ${stateUnmatched} unmatched`);
  if (unmatchedStateOwners.size > 0) {
    console.log("Unmatched state owners:", [...unmatchedStateOwners]);
  }

  console.log("\nMigration complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
