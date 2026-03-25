/**
 * Database fixture — provides seed/cleanup helpers for E2E tests.
 *
 * Each test gets a fresh `db` fixture that:
 *   - Offers seedTestData() to insert test records
 *   - Automatically cleans up all e2e-prefixed records after the test
 *
 * Uses Prisma client directly against the same database as the app.
 */

import { test as base } from "@playwright/test";
import {
  seedUserProfile,
  seedPlan,
  seedActivity,
  seedTask,
  seedUserIntegration,
  TEST_USER_ID,
  TEST_PLAN_ID,
  TEST_ACTIVITY_ID,
  TEST_TASK_ID,
  TEST_INTEGRATION_ID,
  cleanupAllTestData,
  type SeedResult,
} from "../helpers/seed-data";

export interface DbFixture {
  /** Seed all standard test data (user profile, plan, integration, activity, task) */
  seedTestData: () => Promise<SeedResult>;
  /** Seed only a user profile */
  seedUserProfile: typeof seedUserProfile;
  /** Seed a territory plan */
  seedPlan: typeof seedPlan;
  /** Seed an activity */
  seedActivity: typeof seedActivity;
  /** Seed a task */
  seedTask: typeof seedTask;
  /** Seed a UserIntegration (calendar connection) */
  seedUserIntegration: typeof seedUserIntegration;
  /** Clean up all e2e test data */
  cleanup: typeof cleanupAllTestData;
  /** Known test IDs for assertions */
  ids: {
    userId: string;
    planId: string;
    activityId: string;
    taskId: string;
    integrationId: string;
  };
}

export const test = base.extend<{ db: DbFixture }>({
  db: async ({}, use) => {
    const fixture: DbFixture = {
      seedTestData: async () => {
        const profile = await seedUserProfile();
        const plan = await seedPlan();
        const integration = await seedUserIntegration();
        const activity = await seedActivity();
        const task = await seedTask();
        return { profile, plan, integration, activity, task };
      },
      seedUserProfile,
      seedPlan,
      seedActivity,
      seedTask,
      seedUserIntegration,
      cleanup: cleanupAllTestData,
      ids: {
        userId: TEST_USER_ID,
        planId: TEST_PLAN_ID,
        activityId: TEST_ACTIVITY_ID,
        taskId: TEST_TASK_ID,
        integrationId: TEST_INTEGRATION_ID,
      },
    };

    // Provide the fixture to the test
    await use(fixture);

    // Cleanup after each test
    await cleanupAllTestData();
  },
});

export { expect } from "@playwright/test";
