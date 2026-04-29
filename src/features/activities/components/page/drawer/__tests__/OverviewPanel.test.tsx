import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/activities/lib/queries", () => ({
  useLinkActivityDistricts: vi.fn(),
  useUnlinkActivityDistrict: vi.fn(),
  useSearchContacts: vi.fn(),
}));

vi.mock("@/features/shared/lib/queries", () => ({
  useUsers: vi.fn(),
}));

import {
  useLinkActivityDistricts,
  useUnlinkActivityDistrict,
  useSearchContacts,
} from "@/features/activities/lib/queries";
import { useUsers } from "@/features/shared/lib/queries";
import OverviewPanel from "../OverviewPanel";
import type { Activity } from "@/features/shared/types/api-types";

beforeEach(() => {
  vi.clearAllMocks();
  (useLinkActivityDistricts as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  (useUnlinkActivityDistrict as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  (useSearchContacts as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: { contacts: [], total: 0 },
    isLoading: false,
  });
  (useUsers as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    data: [],
  });
});

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "act-1",
    type: "discovery_call",
    category: "meetings",
    title: "Test activity",
    notes: null,
    startDate: "2026-04-27T15:00:00.000Z",
    endDate: "2026-04-27T16:00:00.000Z",
    status: "planned",
    createdByUserId: "user-1",
    createdByUser: null,
    createdAt: "2026-04-27T00:00:00.000Z",
    updatedAt: "2026-04-27T00:00:00.000Z",
    googleEventId: null,
    source: "manual",
    outcome: null,
    outcomeType: null,
    sentiment: null,
    nextStep: null,
    followUpDate: null,
    dealImpact: "none",
    outcomeDisposition: null,
    address: null,
    addressLat: null,
    addressLng: null,
    inPerson: null,
    metadata: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    plans: [],
    districts: [],
    contacts: [],
    states: [],
    expenses: [],
    attendees: [],
    relatedActivities: [],
    opportunities: [],
    rating: null,
    ...overrides,
  };
}

describe("OverviewPanel", () => {
  it("renders the 5 primary status pills (Tentative label for `requested`)", () => {
    render(
      <OverviewPanel
        activity={makeActivity()}
        readOnly={false}
        onPatch={vi.fn()}
        notesCount={0}
        attachmentsCount={0}
      />
    );
    expect(screen.getByRole("button", { name: /planned/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentative/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /in progress/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^completed$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelled/i })).toBeInTheDocument();
  });

  it("clicking a status pill calls onPatch with the new status", () => {
    const onPatch = vi.fn();
    render(
      <OverviewPanel
        activity={makeActivity()}
        readOnly={false}
        onPatch={onPatch}
        notesCount={0}
        attachmentsCount={0}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^completed$/i }));
    expect(onPatch).toHaveBeenCalledWith({ status: "completed" });
  });

  it("changing duration recomputes endDate from startDate + minutes", () => {
    const onPatch = vi.fn();
    render(
      <OverviewPanel
        activity={makeActivity()}
        readOnly={false}
        onPatch={onPatch}
        notesCount={0}
        attachmentsCount={0}
      />
    );
    const input = screen.getByLabelText(/duration in minutes/i);
    fireEvent.change(input, { target: { value: "90" } });
    expect(onPatch).toHaveBeenCalledTimes(1);
    const arg = onPatch.mock.calls[0][0];
    expect(arg.endDate).toBeTruthy();
    const startMs = new Date("2026-04-27T15:00:00.000Z").getTime();
    const endMs = new Date(arg.endDate).getTime();
    expect((endMs - startMs) / 60000).toBe(90);
  });

  it("renders a (legacy) chip when status is `planning` and hides the primary 5 from being toggled to it", () => {
    render(
      <OverviewPanel
        activity={makeActivity({ status: "planning" })}
        readOnly={false}
        onPatch={vi.fn()}
        notesCount={0}
        attachmentsCount={0}
      />
    );
    expect(screen.getByText(/legacy/i)).toBeInTheDocument();
  });

  it("disables status buttons when readOnly", () => {
    render(
      <OverviewPanel
        activity={makeActivity()}
        readOnly
        onPatch={vi.fn()}
        notesCount={0}
        attachmentsCount={0}
      />
    );
    expect(screen.getByRole("button", { name: /planned/i })).toBeDisabled();
  });
});
