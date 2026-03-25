/**
 * Test data factory functions for E2E tests.
 *
 * All IDs are deterministic and prefixed with "e2e-" for easy identification
 * and reliable cleanup. These functions use Prisma directly to seed the test DB.
 */

import { PrismaClient } from "@prisma/client";

// Use DIRECT_URL to bypass Supabase connection pooler limits.
// The pooled DATABASE_URL has a max client limit that gets exhausted
// when Playwright runs multiple workers in parallel.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
});

// ─── Test user — uses the real authenticated user's profile ─────────────────
// The E2E tests authenticate as a real user via Google OAuth.
// We associate test data with this user rather than creating a fake profile.

export const TEST_USER_ID = "768f4535-0272-4503-a002-57e832bf1cc1"; // sierra.arcega@fullmindlearning.com

// ─── Deterministic test IDs (for data we CREATE during tests) ────────────────

export const TEST_PLAN_ID = "e2e00000-0000-0000-0000-000000000002";
export const TEST_ACTIVITY_ID = "e2e00000-0000-0000-0000-000000000003";
export const TEST_TASK_ID = "e2e00000-0000-0000-0000-000000000004";
export const TEST_INTEGRATION_ID = "e2e00000-0000-0000-0000-000000000005";
export const TEST_ACTIVITY_SYNCED_ID = "e2e00000-0000-0000-0000-000000000006";
export const TEST_OPPORTUNITY_ID = "e2e-OPP-001";
export const TEST_DISTRICT_LEAID = "9999901";

// ─── Known test data values ──────────────────────────────────────────────────

export const TEST_PLAN_NAME = "E2E Test Plan";
export const TEST_ACTIVITY_TITLE = "E2E Test Activity";
export const TEST_TASK_TITLE = "E2E Test Task";

// ─── Seed result type ────────────────────────────────────────────────────────

export interface SeedResult {
  profile: Awaited<ReturnType<typeof seedUserProfile>>;
  plan: Awaited<ReturnType<typeof seedPlan>>;
  integration: Awaited<ReturnType<typeof seedUserIntegration>>;
  activity: Awaited<ReturnType<typeof seedActivity>>;
  task: Awaited<ReturnType<typeof seedTask>>;
}

// ─── Factory functions ───────────────────────────────────────────────────────

/** Returns the existing UserProfile for the authenticated test user.
 *  We do NOT create a new profile — the real user already exists from OAuth. */
export async function seedUserProfile() {
  const profile = await prisma.userProfile.findUniqueOrThrow({
    where: { id: TEST_USER_ID },
  });
  return profile;
}

/** Creates a territory plan owned by the test user */
export async function seedPlan() {
  return prisma.territoryPlan.upsert({
    where: { id: TEST_PLAN_ID },
    update: {},
    create: {
      id: TEST_PLAN_ID,
      name: TEST_PLAN_NAME,
      ownerId: TEST_USER_ID,
      userId: TEST_USER_ID,
      color: "#403770",
      status: "active",
      fiscalYear: new Date().getFullYear(),
    },
  });
}

/** Creates a UserIntegration record for Google Calendar.
 *  Gracefully skips if user_integrations table hasn't been migrated yet. */
export async function seedUserIntegration(
  overrides: {
    syncDirection?: "one_way" | "two_way";
    syncEnabled?: boolean;
    syncedActivityTypes?: string[];
  } = {}
) {
  // Use a dummy encrypted token — the app will try to decrypt it but that's OK
  // because we mock the Google Calendar API at the network level
  const fakeEncryptedToken = "e2e-fake-iv:e2e-fake-tag:e2e-fake-cipher";

  try {
    return await prisma.userIntegration.upsert({
      where: { id: TEST_INTEGRATION_ID },
      update: {
        syncEnabled: overrides.syncEnabled ?? true,
        metadata: {
          syncDirection: overrides.syncDirection ?? "two_way",
          syncedActivityTypes: overrides.syncedActivityTypes ?? [],
          companyDomain: "fullmind.test",
          reminderMinutes: 15,
          secondReminderMinutes: null,
        },
      },
      create: {
        id: TEST_INTEGRATION_ID,
        userId: TEST_USER_ID,
        service: "google_calendar",
        accountEmail: "e2e-test@gmail.com",
        accountName: "E2E Test User",
        accessToken: fakeEncryptedToken,
        refreshToken: fakeEncryptedToken,
        tokenExpiresAt: new Date(Date.now() + 3600_000),
        scopes: ["https://www.googleapis.com/auth/calendar"],
        syncEnabled: overrides.syncEnabled ?? true,
        status: "connected",
        metadata: {
          syncDirection: overrides.syncDirection ?? "two_way",
          syncedActivityTypes: overrides.syncedActivityTypes ?? [],
          companyDomain: "fullmind.test",
          reminderMinutes: 15,
          secondReminderMinutes: null,
        },
      },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2021") {
      console.warn("⚠ user_integrations table not yet migrated — skipping seed");
      return null;
    }
    throw error;
  }
}

/** Creates a test activity */
export async function seedActivity(
  overrides: {
    id?: string;
    title?: string;
    type?: string;
    source?: string;
    googleEventId?: string;
    status?: string;
  } = {}
) {
  const id = overrides.id ?? TEST_ACTIVITY_ID;
  return prisma.activity.upsert({
    where: { id },
    update: {},
    create: {
      id,
      type: overrides.type ?? "program_check_in",
      title: overrides.title ?? TEST_ACTIVITY_TITLE,
      status: overrides.status ?? "planned",
      source: overrides.source ?? "manual",
      googleEventId: overrides.googleEventId ?? null,
      startDate: new Date(),
      createdByUserId: TEST_USER_ID,
    },
  });
}

/** Creates a test task, optionally linked to an activity */
export async function seedTask(
  overrides: {
    id?: string;
    title?: string;
    status?: string;
    activityId?: string;
  } = {}
) {
  const id = overrides.id ?? TEST_TASK_ID;
  return prisma.task.upsert({
    where: { id },
    update: {},
    create: {
      id,
      title: overrides.title ?? TEST_TASK_TITLE,
      status: overrides.status ?? "todo",
      priority: "medium",
      position: 0,
      createdByUserId: TEST_USER_ID,
      ...(overrides.activityId
        ? {
            activities: {
              create: { activityId: overrides.activityId },
            },
          }
        : {}),
    },
  });
}

/** Creates a test opportunity for linking */
export async function seedOpportunity(
  overrides: {
    id?: string;
    name?: string;
    stage?: string;
    netBookingAmount?: number;
    districtName?: string;
  } = {}
) {
  const id = overrides.id ?? TEST_OPPORTUNITY_ID;
  return prisma.opportunity.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: overrides.name ?? "E2E Test Opportunity",
      stage: overrides.stage ?? "Proposal",
      netBookingAmount: overrides.netBookingAmount ?? 45000,
      districtName: overrides.districtName ?? "E2E Test District",
    },
  });
}

/** Creates a test district */
export async function seedDistrict(
  overrides: {
    leaid?: string;
    name?: string;
    websiteUrl?: string;
  } = {}
) {
  const leaid = overrides.leaid ?? TEST_DISTRICT_LEAID;
  return prisma.district.upsert({
    where: { leaid },
    update: {},
    create: {
      leaid,
      name: overrides.name ?? "E2E Test District",
      websiteUrl: overrides.websiteUrl ?? "https://www.e2e-test-district.k12.us",
      stateFips: "99",
      stateAbbrev: "TS",
      enrollment: 5000,
    },
  });
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

// All known test IDs that may be created during tests
const ALL_TEST_IDS = [
  TEST_USER_ID,
  TEST_PLAN_ID,
  TEST_ACTIVITY_ID,
  TEST_TASK_ID,
  TEST_INTEGRATION_ID,
  TEST_ACTIVITY_SYNCED_ID,
  // Additional IDs that tests may create
  "e2e00000-0000-0000-0000-000000000099",
];

// Non-UUID IDs that need separate cleanup
const ALL_TEST_OPPORTUNITY_IDS = [TEST_OPPORTUNITY_ID];
const ALL_TEST_DISTRICT_LEAIDS = [TEST_DISTRICT_LEAID];

/** Removes all test data created by seed functions (identified by known test IDs).
 *  Each delete runs individually so a missing table doesn't abort the whole cleanup. */
export async function cleanupAllTestData() {
  const safeDelete = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      // P2021 = table doesn't exist (migration not deployed)
      if (prismaError.code !== "P2021") {
        console.error("E2E cleanup error:", error);
      }
    }
  };

  // Delete junction tables first (foreign key constraints)
  await safeDelete(() =>
    prisma.activityOpportunity.deleteMany({ where: { activityId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activityOpportunity.deleteMany({ where: { opportunityId: { in: ALL_TEST_OPPORTUNITY_IDS } } })
  );
  await safeDelete(() =>
    prisma.taskActivity.deleteMany({ where: { taskId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.taskPlan.deleteMany({ where: { taskId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.taskDistrict.deleteMany({ where: { taskId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.taskContact.deleteMany({ where: { taskId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activityPlan.deleteMany({ where: { activityId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activityDistrict.deleteMany({ where: { activityId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activityContact.deleteMany({ where: { activityId: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activityState.deleteMany({ where: { activityId: { in: ALL_TEST_IDS } } })
  );

  // Delete main records
  await safeDelete(() =>
    prisma.task.deleteMany({ where: { id: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.activity.deleteMany({ where: { id: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.userIntegration.deleteMany({ where: { id: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.territoryPlan.deleteMany({ where: { id: { in: ALL_TEST_IDS } } })
  );
  await safeDelete(() =>
    prisma.opportunity.deleteMany({ where: { id: { in: ALL_TEST_OPPORTUNITY_IDS } } })
  );
  // District cleanup — only delete our synthetic test district (safe because leaid is unique)
  await safeDelete(() =>
    prisma.district.deleteMany({ where: { leaid: { in: ALL_TEST_DISTRICT_LEAIDS } } })
  );

  // NOTE: We do NOT delete the UserProfile — it's the real authenticated user.
  // Only test-created data (plans, activities, tasks, integrations) is cleaned up.

  await prisma.$disconnect();
}
