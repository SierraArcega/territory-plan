import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Prisma before any imports that reference it
// ---------------------------------------------------------------------------
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      userIntegration: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      calendarConnection: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      calendarEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      activity: {
        findMany: vi.fn(),
      },
      contact: {
        findMany: vi.fn(),
      },
      territoryPlanDistrict: {
        findFirst: vi.fn(),
      },
    },
  };
});

// Mock the calendar Google helpers. We only care about the three functions
// sync.ts actually calls from this module.
vi.mock("@/features/calendar/lib/google", () => ({
  fetchCalendarEvents: vi.fn(),
  getValidAccessToken: vi.fn(),
  filterExternalAttendees: vi.fn(),
}));

// Mock encryption so we don't need ENCRYPTION_KEY in the test env.
vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

import prisma from "@/lib/prisma";
import {
  fetchCalendarEvents,
  getValidAccessToken,
  filterExternalAttendees,
} from "@/features/calendar/lib/google";
import { syncCalendarEvents } from "../sync";

// ---------------------------------------------------------------------------
// Helpers for building stable mock payloads
// ---------------------------------------------------------------------------
const USER_ID = "user-123";

const DAY_MS = 24 * 60 * 60 * 1000;

function makeIntegration(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-1",
    userId: USER_ID,
    service: "google_calendar",
    accountEmail: "rep@fullmindlearning.com",
    accountName: "Rep",
    accessToken: "enc-access",
    refreshToken: "enc-refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    scopes: [],
    metadata: { companyDomain: "fullmindlearning.com" },
    syncEnabled: true,
    status: "connected",
    lastSyncAt: null,
    ...overrides,
  };
}

function makeConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    userId: USER_ID,
    googleAccountEmail: "rep@fullmindlearning.com",
    accessToken: "enc-access",
    refreshToken: "enc-refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    companyDomain: "fullmindlearning.com",
    syncEnabled: true,
    lastSyncAt: null as Date | null,
    status: "connected",
    syncDirection: "two_way",
    syncedActivityTypes: [],
    reminderMinutes: 15,
    secondReminderMinutes: null,
    backfillStartDate: null as Date | null,
    backfillCompletedAt: null as Date | null,
    backfillWindowDays: null as number | null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeGoogleEvent(id: string, overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - DAY_MS);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    id,
    summary: `Meeting ${id}`,
    description: null,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    location: null,
    status: "confirmed",
    attendees: [
      {
        email: "principal@school.org",
        displayName: "Principal",
        responseStatus: "accepted",
      },
    ],
    ...overrides,
  };
}

function primeValidSyncPath(
  connection: ReturnType<typeof makeConnection>,
  googleEvents: ReturnType<typeof makeGoogleEvent>[]
) {
  vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
    makeIntegration() as never
  );
  vi.mocked(prisma.calendarConnection.findUnique).mockResolvedValue(
    connection as never
  );
  vi.mocked(getValidAccessToken).mockResolvedValue({
    accessToken: "decrypted_enc-access",
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  vi.mocked(fetchCalendarEvents).mockResolvedValue(googleEvents as never);
  // Every event we build has one external attendee, by default.
  vi.mocked(filterExternalAttendees).mockImplementation(
    (attendees) =>
      (attendees ?? []).map((a) => ({
        email: a.email,
        name: a.displayName ?? null,
        responseStatus: a.responseStatus,
      })) as never
  );

  // No pre-existing staged CalendarEvent rows — everything is "new".
  vi.mocked(prisma.calendarEvent.findUnique).mockResolvedValue(null as never);
  vi.mocked(prisma.calendarEvent.create).mockResolvedValue({} as never);
  vi.mocked(prisma.calendarEvent.update).mockResolvedValue({} as never);
  vi.mocked(prisma.calendarEvent.findMany).mockResolvedValue([] as never);

  // Contact matching short-circuits to "no contacts found" — that path is fine
  // for the tests; we're not asserting on smart-match results.
  vi.mocked(prisma.contact.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.territoryPlanDistrict.findFirst).mockResolvedValue(
    null as never
  );

  vi.mocked(prisma.userIntegration.update).mockResolvedValue({} as never);
  vi.mocked(prisma.calendarConnection.update).mockResolvedValue({} as never);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("syncCalendarEvents — window selection", () => {
  // Pin "now" so relative-date assertions are deterministic.
  const NOW = new Date("2026-04-09T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses backfillStartDate as timeMin when backfill is pending", async () => {
    const backfillStart = new Date(NOW.getTime() - 30 * DAY_MS);
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: backfillStart,
        backfillCompletedAt: null,
        lastSyncAt: null,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    expect(fetchCalendarEvents).toHaveBeenCalledTimes(1);
    const [, timeMin, timeMax] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    expect(Math.abs(timeMin.getTime() - backfillStart.getTime())).toBeLessThan(
      1000
    );
    // timeMax = now + 14d
    expect(
      Math.abs(timeMax.getTime() - (NOW.getTime() + 14 * DAY_MS))
    ).toBeLessThan(1000);
  });

  it("uses lastSyncAt - 2d when backfill has completed", async () => {
    const lastSyncAt = new Date(NOW.getTime() - 1 * DAY_MS);
    const backfillStart = new Date(NOW.getTime() - 30 * DAY_MS);
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: backfillStart,
        backfillCompletedAt: new Date(NOW.getTime() - 1 * DAY_MS),
        lastSyncAt,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    const [, timeMin] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    const expected = new Date(lastSyncAt.getTime() - 2 * DAY_MS);
    expect(Math.abs(timeMin.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("uses lastSyncAt - 2d when there is no backfill at all", async () => {
    const lastSyncAt = new Date(NOW.getTime() - 1 * DAY_MS);
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: null,
        backfillCompletedAt: null,
        lastSyncAt,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    const [, timeMin] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    const expected = new Date(NOW.getTime() - 3 * DAY_MS); // lastSyncAt (-1d) - 2d = -3d
    expect(Math.abs(timeMin.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("falls back to now - 7d when there is no backfill and no prior sync", async () => {
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: null,
        backfillCompletedAt: null,
        lastSyncAt: null,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    const [, timeMin] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    const expected = new Date(NOW.getTime() - 7 * DAY_MS);
    expect(Math.abs(timeMin.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("uses backfillWindowDays as the forward horizon (timeMax)", async () => {
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: new Date(NOW.getTime() - 30 * DAY_MS),
        backfillCompletedAt: null,
        backfillWindowDays: 30,
        lastSyncAt: null,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    const [, , timeMax] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    // timeMax = now + backfillWindowDays (30), not the old hardcoded 14
    const expected = new Date(NOW.getTime() + 30 * DAY_MS);
    expect(Math.abs(timeMax.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("falls back to 14-day forward window when backfillWindowDays is null", async () => {
    primeValidSyncPath(
      makeConnection({
        backfillStartDate: null,
        backfillCompletedAt: null,
        backfillWindowDays: null,
        lastSyncAt: null,
      }),
      []
    );
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    const [, , timeMax] = vi.mocked(fetchCalendarEvents).mock.calls[0];
    const expected = new Date(NOW.getTime() + 14 * DAY_MS);
    expect(Math.abs(timeMax.getTime() - expected.getTime())).toBeLessThan(1000);
  });
});

describe("syncCalendarEvents — Activity dedupe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips events that already have a matching Activity.googleEventId", async () => {
    const events = [
      makeGoogleEvent("evt-1"),
      makeGoogleEvent("evt-2"),
      makeGoogleEvent("evt-3"),
    ];
    primeValidSyncPath(makeConnection(), events);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([
      { googleEventId: "evt-2" },
    ] as never);

    const result = await syncCalendarEvents(USER_ID);

    // 3 events fetched, 3 processed, 1 deduped, 2 staged as new.
    expect(prisma.activity.findMany).toHaveBeenCalledWith({
      where: { googleEventId: { in: ["evt-1", "evt-2", "evt-3"] } },
      select: { googleEventId: true },
    });
    expect(result.eventsProcessed).toBe(3);
    expect(prisma.calendarEvent.create).toHaveBeenCalledTimes(2);

    const createdIds = vi
      .mocked(prisma.calendarEvent.create)
      .mock.calls.map((call) => (call[0].data as { googleEventId: string }).googleEventId);
    expect(createdIds).toEqual(["evt-1", "evt-3"]);
  });

  it("stages all events when none are deduped", async () => {
    const events = [
      makeGoogleEvent("evt-1"),
      makeGoogleEvent("evt-2"),
      makeGoogleEvent("evt-3"),
    ];
    primeValidSyncPath(makeConnection(), events);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    const result = await syncCalendarEvents(USER_ID);

    expect(result.eventsProcessed).toBe(3);
    expect(prisma.calendarEvent.create).toHaveBeenCalledTimes(3);
  });

  it("skips the Activity dedupe query when Google returns no events", async () => {
    primeValidSyncPath(makeConnection(), []);

    const result = await syncCalendarEvents(USER_ID);

    expect(prisma.activity.findMany).not.toHaveBeenCalled();
    expect(result.eventsProcessed).toBe(0);
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
  });
});

describe("syncCalendarEvents — lastSyncAt propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates lastSyncAt on both UserIntegration and CalendarConnection", async () => {
    primeValidSyncPath(makeConnection(), []);
    vi.mocked(prisma.activity.findMany).mockResolvedValue([] as never);

    await syncCalendarEvents(USER_ID);

    expect(prisma.userIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_service: { userId: USER_ID, service: "google_calendar" } },
        data: expect.objectContaining({ lastSyncAt: expect.any(Date) }),
      })
    );
    expect(prisma.calendarConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "conn-1" },
        data: expect.objectContaining({ lastSyncAt: expect.any(Date) }),
      })
    );

    const userIntegrationCall = vi
      .mocked(prisma.userIntegration.update)
      .mock.calls.find((call) => "lastSyncAt" in (call[0].data ?? {}));
    const connectionCall = vi
      .mocked(prisma.calendarConnection.update)
      .mock.calls.find((call) => "lastSyncAt" in (call[0].data ?? {}));

    const userTs = (userIntegrationCall?.[0].data as { lastSyncAt: Date })
      .lastSyncAt;
    const connTs = (connectionCall?.[0].data as { lastSyncAt: Date }).lastSyncAt;
    expect(userTs.getTime()).toBe(connTs.getTime());
  });
});

describe("syncCalendarEvents — regression guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("short-circuits for syncDirection === 'one_way' without fetching", async () => {
    vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(
      makeIntegration() as never
    );
    vi.mocked(prisma.calendarConnection.findUnique).mockResolvedValue(
      makeConnection({ syncDirection: "one_way" }) as never
    );

    const result = await syncCalendarEvents(USER_ID);

    expect(fetchCalendarEvents).not.toHaveBeenCalled();
    expect(prisma.activity.findMany).not.toHaveBeenCalled();
    expect(prisma.calendarEvent.create).not.toHaveBeenCalled();
    expect(prisma.userIntegration.update).not.toHaveBeenCalled();
    expect(prisma.calendarConnection.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      eventsProcessed: 0,
      newEvents: 0,
      updatedEvents: 0,
      cancelledEvents: 0,
      errors: [],
    });
  });
});
