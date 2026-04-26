import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContactsActionBar from "../ContactsActionBar";

const mockMutateAsync = vi.fn().mockResolvedValue({ total: 3, skipped: 0, queued: 3 });
const mockExpandMutateAsync = vi.fn().mockResolvedValue({ rollupsExpanded: [], expandedCount: 0 });

vi.mock("@/features/plans/lib/queries", () => ({
  useBulkEnrich: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useEnrichProgress: () => ({
    data: { total: 0, enriched: 0, queued: 0 },
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
