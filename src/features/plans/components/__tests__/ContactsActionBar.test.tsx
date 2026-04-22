import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContactsActionBar from "../ContactsActionBar";

function withQueryClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

const mockMutateAsync = vi.fn().mockResolvedValue({ total: 3, skipped: 0, queued: 3 });
const mockExpandMutateAsync = vi.fn().mockResolvedValue({ rollupsExpanded: [], expandedCount: 0 });

let progressData: { total: number; enriched: number; queued: number } = {
  total: 0,
  enriched: 0,
  queued: 0,
};

vi.mock("@/features/plans/lib/queries", () => ({
  useBulkEnrich: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useEnrichProgress: () => ({
    data: progressData,
  }),
  useContactSources: () => ({
    data: { plans: [] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useExpandRollup: () => ({
    mutateAsync: mockExpandMutateAsync,
    isPending: false,
  }),
}));

describe("ContactsActionBar — Principal popover", () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
    mockMutateAsync.mockResolvedValue({ total: 3, skipped: 0, queued: 3 });
    mockExpandMutateAsync.mockClear();
    mockExpandMutateAsync.mockResolvedValue({ rollupsExpanded: [], expandedCount: 0 });
    progressData = { total: 0, enriched: 0, queued: 0 };
  });

  it("shows School Level checkboxes when Principal is selected", () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });

    expect(screen.getByText("School Level")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary")).toBeChecked();
    expect(screen.getByLabelText("Middle")).toBeChecked();
    expect(screen.getByLabelText("High")).toBeChecked();
  });

  it("disables Start when all school-level checkboxes are cleared", () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });

    fireEvent.click(screen.getByLabelText("Primary"));
    fireEvent.click(screen.getByLabelText("Middle"));
    fireEvent.click(screen.getByLabelText("High"));

    expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
  });

  it("passes schoolLevels to useBulkEnrich on Start", async () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    fireEvent.click(screen.getByLabelText("Middle")); // uncheck middle
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planId: "plan-1",
        targetRole: "Principal",
        schoolLevels: [1, 3],
      });
    });
  });

  it("does not pass schoolLevels for non-Principal roles", async () => {
    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["0100001"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    // Superintendent is the default — just click Start
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planId: "plan-1",
        targetRole: "Superintendent",
      });
    });
  });

  it("shows 'Expand to N districts' CTA when bulk-enrich returns reason=rollup-district", async () => {
    const rollupError = Object.assign(new Error("400: Plan contains rollup districts"), {
      status: 400,
      body: {
        reason: "rollup-district",
        rollupLeaids: ["3620580"],
        childLeaids: Array.from({ length: 309 }, (_, i) => `child-${i}`),
      },
    });
    mockMutateAsync.mockRejectedValueOnce(rollupError);

    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["3620580"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    expect(await screen.findByText(/309 child districts/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand to 309 districts/i })
    ).toBeInTheDocument();
  });

  it("expands rollup and retries enrichment when the Expand CTA is clicked", async () => {
    const rollupError = Object.assign(new Error("400: Plan contains rollup districts"), {
      status: 400,
      body: {
        reason: "rollup-district",
        rollupLeaids: ["3620580"],
        childLeaids: Array.from({ length: 309 }, (_, i) => `child-${i}`),
      },
    });
    // First call: rollup error. Second call (retry): success.
    mockMutateAsync
      .mockRejectedValueOnce(rollupError)
      .mockResolvedValueOnce({ total: 309, skipped: 0, queued: 309 });

    render(
      <ContactsActionBar
        planId="plan-1"
        planName="Plan"
        contacts={[]}
        allDistrictLeaids={["3620580"]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.click(screen.getByRole("button", { name: /start/i }));

    const expandBtn = await screen.findByRole("button", {
      name: /expand to 309 districts/i,
    });
    fireEvent.click(expandBtn);

    await vi.waitFor(() => {
      expect(mockExpandMutateAsync).toHaveBeenCalledWith({ planId: "plan-1" });
    });
    await vi.waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(2);
    });
  });
});

describe("ContactsActionBar — ExistingContactsModal triggers", () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
    progressData = { total: 0, enriched: 0, queued: 0 };
  });

  it("opens modal in queued-zero variant when queued=0 (not the 'Nothing to enrich' toast)", async () => {
    mockMutateAsync.mockResolvedValueOnce({ total: 2, skipped: 2, queued: 0 });

    render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001", "0100002"]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    expect(await screen.findByRole("heading", { name: /contacts already exist/i })).toBeInTheDocument();
    expect(screen.queryByText(/nothing to enrich/i)).not.toBeInTheDocument();
  });

  it("opens modal in partial variant after completion when queued>0 and skipped>0", async () => {
    mockMutateAsync.mockResolvedValueOnce({ total: 3, skipped: 1, queued: 2 });

    const { rerender } = render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001", "0100002", "0100003"]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    // No modal immediately on submit
    expect(screen.queryByRole("heading", { name: /enrichment complete/i })).not.toBeInTheDocument();

    // Simulate progress completion
    progressData = { total: 2, enriched: 2, queued: 2 };
    rerender(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001", "0100002", "0100003"]}
        />
      )
    );

    expect(await screen.findByRole("heading", { name: /enrichment complete/i })).toBeInTheDocument();
    expect(screen.getByText(/1 district already had contacts/i)).toBeInTheDocument();
  });

  it("does not open modal when queued=0 and skipped=0 (no-targets path) — shows toast instead", async () => {
    mockMutateAsync.mockResolvedValueOnce({ total: 0, skipped: 0, queued: 0, reason: "no-districts" });

    render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={[]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    expect(screen.queryByRole("heading", { name: /contacts already exist/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/no districts to enrich/i)).toBeInTheDocument();
  });

  it("shows 'no schools on record' toast when reason=no-schools-in-district", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      total: 0, skipped: 0, queued: 0, reason: "no-schools-in-district",
    });

    render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["3620580"]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    expect(await screen.findByText(/no schools on record for this district/i)).toBeInTheDocument();
  });

  it("shows 'no schools at the selected levels' toast when reason=no-schools-at-levels", async () => {
    mockMutateAsync.mockResolvedValueOnce({
      total: 0, skipped: 0, queued: 0, reason: "no-schools-at-levels",
    });

    render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001"]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    expect(await screen.findByText(/no schools at the selected levels/i)).toBeInTheDocument();
  });

  it("does not open modal when queued>0 and skipped=0 (all-new path)", async () => {
    mockMutateAsync.mockResolvedValueOnce({ total: 3, skipped: 0, queued: 3 });

    const { rerender } = render(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001"]}
        />
      )
    );

    fireEvent.click(screen.getByRole("button", { name: /find contacts/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /start/i }));
    });

    progressData = { total: 3, enriched: 3, queued: 3 };
    rerender(
      withQueryClient(
        <ContactsActionBar
          planId="plan-1"
          planName="Plan"
          contacts={[]}
          allDistrictLeaids={["0100001"]}
        />
      )
    );

    expect(screen.queryByRole("heading", { name: /enrichment complete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /contacts already exist/i })).not.toBeInTheDocument();
  });
});
