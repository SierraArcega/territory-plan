import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { createRef, type RefObject } from "react";
import type { IncreaseTarget } from "../../lib/types";
import type { TerritoryPlan } from "@/features/shared/types/api-types";

// Mock hooks used by the component. mutate state is controlled via the
// module-level mockMutation object so individual tests can tweak it.
interface MockMutation {
  mutateAsync: ReturnType<typeof vi.fn>;
  isPending: boolean;
}

const mockMutation: MockMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
};

interface MockPlansQuery {
  data: TerritoryPlan[] | undefined;
  isLoading: boolean;
}

const mockPlansQuery: MockPlansQuery = {
  data: [],
  isLoading: false,
};

vi.mock("../../lib/queries", () => ({
  useMyPlans: () => mockPlansQuery,
  useAddDistrictToPlanMutation: () => mockMutation,
}));

import AddToPlanPopover from "../AddToPlanPopover";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePlan(overrides: Partial<TerritoryPlan> = {}): TerritoryPlan {
  return {
    id: "plan-1",
    name: "West Region Q1",
    description: null,
    owner: { id: "user-1", fullName: "Me", avatarUrl: null },
    color: "#403770",
    status: "working",
    fiscalYear: 2026,
    startDate: null,
    endDate: null,
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-15T00:00:00Z",
    districtCount: 0,
    totalEnrollment: 0,
    stateCount: 0,
    states: [],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
    renewalRollup: 0,
    expansionRollup: 0,
    winbackRollup: 0,
    newBusinessRollup: 0,
    pipelineTotal: 0,
    districtLeaids: [],
    schoolNcesIds: [],
    ...overrides,
  };
}

function makeDistrict(overrides: Partial<IncreaseTarget> = {}): IncreaseTarget {
  return {
    leaid: "0601234",
    districtName: "Demo USD",
    state: "CA",
    enrollment: 1000,
    lmsId: null,
    category: "missing_renewal",
    priorYearRevenue: 0,
    priorYearVendor: null,
    priorYearFy: null,
    fy26Revenue: 50000,
    fy26CompletedRevenue: 30000,
    fy26ScheduledRevenue: 20000,
    fy26SessionCount: 100,
    fy26SubscriptionCount: 5,
    fy26OppBookings: 0,
    fy26MinBookings: 0,
    inFy27Plan: false,
    inPlan: false,
    planIds: [],
    hasFy27Target: false,
    hasFy27Pipeline: false,
    fy27OpenPipeline: 0,
    lastClosedWon: null,
    productTypes: [],
    subProducts: [],
    revenueTrend: { fy24: null, fy25: null, fy26: null, fy27: null },
    suggestedTarget: null,
    ...overrides,
  };
}

// Renders the popover with a real anchor element attached to the DOM so
// getBoundingClientRect returns sensible numbers.
function renderPopover(
  overrides: {
    isOpen?: boolean;
    onClose?: () => void;
    onSuccess?: (planName: string) => void;
    district?: IncreaseTarget;
  } = {},
) {
  const onClose = overrides.onClose ?? vi.fn();
  const onSuccess = overrides.onSuccess ?? vi.fn();
  const district = overrides.district ?? makeDistrict();

  // Build an anchor button in the DOM so the popover can position itself.
  const anchorEl = document.createElement("button");
  anchorEl.textContent = "Anchor";
  document.body.appendChild(anchorEl);

  const anchorRef: RefObject<HTMLButtonElement | null> = createRef<HTMLButtonElement>();
  // createRef gives a read-only .current by type; we write through once here
  // deliberately as this simulates the ref being attached.
  (anchorRef as { current: HTMLButtonElement | null }).current = anchorEl;

  const utils = render(
    <AddToPlanPopover
      district={district}
      anchorRef={anchorRef}
      isOpen={overrides.isOpen ?? true}
      onClose={onClose}
      onSuccess={onSuccess}
    />,
  );

  return { ...utils, onClose, onSuccess, district, anchorEl };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AddToPlanPopover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutation.mutateAsync = vi.fn().mockResolvedValue({
      added: 1,
      planId: "plan-1",
    });
    mockMutation.isPending = false;
    mockPlansQuery.data = [makePlan()];
    mockPlansQuery.isLoading = false;
  });

  it("disables Submit when no plan is selected", async () => {
    renderPopover();

    // Wait for dialog to mount (position calc uses rAF).
    await screen.findByRole("dialog");
    const submit = screen.getByRole("button", { name: "Add to Plan" });
    expect(submit).toBeDisabled();
  });

  it("disables Submit when the target amount is empty", async () => {
    renderPopover();

    const planSelect = await screen.findByLabelText("Plan");
    fireEvent.change(planSelect, { target: { value: "plan-1" } });

    const submit = screen.getByRole("button", { name: /add to plan/i });
    expect(submit).toBeDisabled();
  });

  it("enables Submit when plan + positive target + default Renewal bucket are set", async () => {
    renderPopover();

    const planSelect = await screen.findByLabelText("Plan");
    fireEvent.change(planSelect, { target: { value: "plan-1" } });

    const targetInput = screen.getByLabelText("Target");
    fireEvent.change(targetInput, { target: { value: "25000" } });

    const submit = screen.getByRole("button", { name: /add to plan/i });
    expect(submit).not.toBeDisabled();
  });

  it("sends winbackTarget in the mutation payload when Winback bucket is selected", async () => {
    const district = makeDistrict({ leaid: "0603333" });
    renderPopover({ district });

    fireEvent.change(await screen.findByLabelText("Plan"), {
      target: { value: "plan-1" },
    });
    fireEvent.change(screen.getByLabelText("Target"), {
      target: { value: "400000" },
    });
    // Switch bucket
    fireEvent.click(screen.getByRole("radio", { name: /winback/i }));

    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => {
      expect(mockMutation.mutateAsync).toHaveBeenCalledTimes(1);
    });
    expect(mockMutation.mutateAsync).toHaveBeenCalledWith({
      planId: "plan-1",
      leaid: "0603333",
      bucket: "winback",
      targetAmount: 400000,
    });
  });

  it("closes the popover on Escape", async () => {
    const onClose = vi.fn();
    renderPopover({ onClose });

    await screen.findByRole("dialog");
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows inline error text on mutation failure and stays open", async () => {
    mockMutation.mutateAsync = vi.fn().mockRejectedValue(new Error("nope"));
    const onClose = vi.fn();
    renderPopover({ onClose });

    fireEvent.change(await screen.findByLabelText("Plan"), {
      target: { value: "plan-1" },
    });
    fireEvent.change(screen.getByLabelText("Target"), {
      target: { value: "10000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't add to plan/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onSuccess with the chosen plan name on success", async () => {
    const onSuccess = vi.fn();
    renderPopover({ onSuccess });

    fireEvent.change(await screen.findByLabelText("Plan"), {
      target: { value: "plan-1" },
    });
    fireEvent.change(screen.getByLabelText("Target"), {
      target: { value: "25000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("West Region Q1");
    });
  });

  it("renders a disabled select with helper text when the plan list is empty", async () => {
    mockPlansQuery.data = [];
    renderPopover();

    const planSelect = await screen.findByLabelText("Plan");
    expect(planSelect).toBeDisabled();
    expect(screen.getByText(/no plans — create one first/i)).toBeInTheDocument();
  });
});
