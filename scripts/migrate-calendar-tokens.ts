// One-time data migration: CalendarConnection → UserIntegration
// Run BEFORE the schema migration to copy tokens (encrypting them) into user_integrations.
//
// Usage: npx tsx scripts/migrate-calendar-tokens.ts

import prisma from "../src/lib/prisma";
import { encrypt } from "../src/features/integrations/lib/encryption";

async function main() {
  const connections = await prisma.calendarConnection.findMany();
  console.log(`Found ${connections.length} calendar connections to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const conn of connections) {
    try {
      await prisma.userIntegration.upsert({
        where: {
          userId_service: { userId: conn.userId, service: "google_calendar" },
        },
        update: {
          // If a UserIntegration already exists for this user+service, skip —
          // it was likely created by the new OAuth flow during the transition window
        },
        create: {
          userId: conn.userId,
          service: "google_calendar",
          accountEmail: conn.googleAccountEmail,
          accessToken: encrypt(conn.accessToken),
          refreshToken: encrypt(conn.refreshToken),
          tokenExpiresAt: conn.tokenExpiresAt,
          metadata: { companyDomain: conn.companyDomain },
          syncEnabled: conn.syncEnabled,
          status: conn.status,
          lastSyncAt: conn.lastSyncAt,
        },
      });
      migrated++;
      console.log(`  Migrated: ${conn.googleAccountEmail} (user ${conn.userId})`);
    } catch (err) {
      skipped++;
      console.error(`  SKIPPED: ${conn.googleAccountEmail} — ${err}`);
    }
  }

  console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
