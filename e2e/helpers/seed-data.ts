/**
 * Test data factory functions for E2E tests.
 *
 * All IDs are deterministic and prefixed with "e2e-" for easy identification
 * and reliable cleanup. These functions use Prisma directly to seed the test DB.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Deterministic test IDs ───────────────────────────────────────────────────

export const TEST_USER_ID = "e2e00000-0000-0000-0000-000000000001";
export const TEST_PLAN_ID = "e2e00000-0000-0000-0000-000000000002";
export const TEST_ACTIVITY_ID = "e2e00000-0000-0000-0000-000000000003";
export const TEST_TASK_ID = "e2e00000-0000-0000-0000-000000000004";
export const TEST_INTEGRATION_ID = "e2e00000-0000-0000-0000-000000000005";
export const TEST_ACTIVITY_SYNCED_ID = "e2e00000-0000-0000-0000-000000000006";

// ─── Known test data values ──────────────────────────────────────────────────

export const TEST_USER_EMAIL = "e2e-test@fullmind.test";
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

/** Creates or upserts a UserProfile for the test user */
export async function seedUserProfile() {
  return prisma.userProfile.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      fullName: "E2E Test User",
      role: "rep",
      hasCompletedSetup: true,
    },
  });
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

/** Creates a UserIntegration record for Google Calendar */
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

  return prisma.userIntegration.upsert({
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

/** Removes all test data created by seed functions (identified by known test IDs) */
export async function cleanupAllTestData() {
  try {
    await prisma.$transaction([
      // Delete junction tables first (foreign key constraints)
      prisma.taskActivity.deleteMany({
        where: { taskId: { in: ALL_TEST_IDS } },
      }),
      prisma.taskPlan.deleteMany({
        where: { taskId: { in: ALL_TEST_IDS } },
      }),
      prisma.taskDistrict.deleteMany({
        where: { taskId: { in: ALL_TEST_IDS } },
      }),
      prisma.taskContact.deleteMany({
        where: { taskId: { in: ALL_TEST_IDS } },
      }),
      prisma.activityPlan.deleteMany({
        where: { activityId: { in: ALL_TEST_IDS } },
      }),
      prisma.activityDistrict.deleteMany({
        where: { activityId: { in: ALL_TEST_IDS } },
      }),
      prisma.activityContact.deleteMany({
        where: { activityId: { in: ALL_TEST_IDS } },
      }),
      prisma.activityState.deleteMany({
        where: { activityId: { in: ALL_TEST_IDS } },
      }),
      // Delete main records
      prisma.task.deleteMany({
        where: { id: { in: ALL_TEST_IDS } },
      }),
      prisma.activity.deleteMany({
        where: { id: { in: ALL_TEST_IDS } },
      }),
      prisma.userIntegration.deleteMany({
        where: { id: { in: ALL_TEST_IDS } },
      }),
      prisma.territoryPlan.deleteMany({
        where: { id: { in: ALL_TEST_IDS } },
      }),
      // UserProfile last (other records reference it)
      prisma.userProfile.deleteMany({
        where: { id: { in: ALL_TEST_IDS } },
      }),
    ]);
  } catch (error) {
    console.error("E2E cleanup error:", error);
  } finally {
    await prisma.$disconnect();
  }
}
