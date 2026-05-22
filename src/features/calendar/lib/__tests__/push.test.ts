import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    userIntegration: { findUnique: vi.fn(), update: vi.fn() },
    activity: { findUnique: vi.fn(), update: vi.fn() },
    calendarEvent: { findFirst: vi.fn() },
  },
}));

vi.mock("@/features/calendar/lib/google", () => ({
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

vi.mock("@/features/integrations/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted_${v}`),
  encrypt: vi.fn((v: string) => `encrypted_${v}`),
}));

import prisma from "@/lib/prisma";
import { createCalendarEvent, getValidAccessToken } from "@/features/calendar/lib/google";
import { pushActivityToCalendar } from "../push";

const USER_ID = "user-abc";
const ACTIVITY_ID = "act-1";
const NOW = new Date("2026-05-18T14:00:00.000Z");

function makeIntegration() {
  return {
    id: "int-1",
    userId: USER_ID,
    service: "google_calendar",
    accessToken: "enc-access",
    refreshToken: "enc-refresh",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    syncEnabled: true,
    status: "connected",
    metadata: {},
  };
}

function makeActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: ACTIVITY_ID,
    type: "discovery_call",
    title: "Meeting with Principal",
    notes: null,
    startDate: NOW,
    endDate: new Date(NOW.getTime() + 60 * 60 * 1000),
    googleEventId: null,
    source: "manual",
    contacts: [],
    ...overrides,
  };
}

function primeAccess() {
  vi.mocked(prisma.userIntegration.findUnique).mockResolvedValue(makeIntegration() as never);
  vi.mocked(getValidAccessToken).mockResolvedValue({
    accessToken: "decrypted_enc-access",
    expiresAt: new Date(Date.now() + 3_600_000),
  });
}

describe("pushActivityToCalendar — duplicate event guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("links existing googleEventId and skips create when a matching CalendarEvent exists", async () => {
    primeAccess();
    vi.mocked(prisma.activity.findUnique).mockResolvedValue(makeActivity() as never);
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue({
      googleEventId: "google-evt-existing",
    } as never);
    vi.mocked(prisma.activity.update).mockResolvedValue({} as never);

    await pushActivityToCalendar(USER_ID, ACTIVITY_ID);

    expect(createCalendarEvent).not.toHaveBeenCalled();
    expect(prisma.activity.update).toHaveBeenCalledWith({
      where: { id: ACTIVITY_ID },
      data: { googleEventId: "google-evt-existing" },
    });
  });

  it("proceeds to create when no matching CalendarEvent exists", async () => {
    primeAccess();
    vi.mocked(prisma.activity.findUnique).mockResolvedValue(makeActivity() as never);
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(null as never);
    vi.mocked(createCalendarEvent).mockResolvedValue("google-evt-new");
    vi.mocked(prisma.activity.update).mockResolvedValue({} as never);

    await pushActivityToCalendar(USER_ID, ACTIVITY_ID);

    expect(createCalendarEvent).toHaveBeenCalledTimes(1);
    expect(prisma.activity.update).toHaveBeenCalledWith({
      where: { id: ACTIVITY_ID },
      data: { googleEventId: "google-evt-new" },
    });
  });

  it("proceeds to create when CalendarEvent exists but googleEventId is null", async () => {
    primeAccess();
    vi.mocked(prisma.activity.findUnique).mockResolvedValue(makeActivity() as never);
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue({
      googleEventId: null,
    } as never);
    vi.mocked(createCalendarEvent).mockResolvedValue("google-evt-new");
    vi.mocked(prisma.activity.update).mockResolvedValue({} as never);

    await pushActivityToCalendar(USER_ID, ACTIVITY_ID);

    expect(createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it("queries calendarEvent with a ±15 min window around the activity startDate", async () => {
    primeAccess();
    vi.mocked(prisma.activity.findUnique).mockResolvedValue(makeActivity() as never);
    vi.mocked(prisma.calendarEvent.findFirst).mockResolvedValue(null as never);
    vi.mocked(createCalendarEvent).mockResolvedValue("google-evt-new");
    vi.mocked(prisma.activity.update).mockResolvedValue({} as never);

    await pushActivityToCalendar(USER_ID, ACTIVITY_ID);

    const call = vi.mocked(prisma.calendarEvent.findFirst).mock.calls[0][0];
    const windowMs = 15 * 60 * 1000;
    expect(call.where.startTime.gte.getTime()).toBe(NOW.getTime() - windowMs);
    expect(call.where.startTime.lte.getTime()).toBe(NOW.getTime() + windowMs);
    expect(call.where.userId).toBe(USER_ID);
    expect(call.where.title).toEqual({ equals: "Meeting with Principal", mode: "insensitive" });
  });

  it("skips push entirely for calendar_sync source activities with a googleEventId", async () => {
    primeAccess();
    vi.mocked(prisma.activity.findUnique).mockResolvedValue(
      makeActivity({ source: "calendar_sync", googleEventId: "existing-evt" }) as never
    );

    await pushActivityToCalendar(USER_ID, ACTIVITY_ID);

    expect(prisma.calendarEvent.findFirst).not.toHaveBeenCalled();
    expect(createCalendarEvent).not.toHaveBeenCalled();
  });
});
