import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import { makeLead, NOW } from "./fixtures";

const linkOppMock = vi.fn();
const openOppsMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLinkOpportunityMutation: () => ({ mutate: linkOppMock, isPending: false }),
    useDistrictOpenOppsQuery: () => openOppsMock(),
  };
});

import LinkOpportunityModal from "../LinkOpportunityModal";

const OPEN_OPP = {
  id: "opp-33",
  name: "Mesa Valley USD 51 — Special Education Services",
  stage: "1 - Discovery",
  netBookingAmount: 110000,
  districtName: "Mesa Valley USD 51",
  districtLeaId: "0802940",
  closeDate: "2026-10-01T00:00:00.000Z",
};

function renderModal(lead = makeLead()) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <LinkOpportunityModal lead={lead} onClose={onClose} now={NOW} />
    </ToastProvider>,
  );
  return { onClose };
}

describe("LinkOpportunityModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    openOppsMock.mockReturnValue({ data: [OPEN_OPP], isLoading: false });
  });

  it("defaults to creating a Stage 0 opp with the suggested draft", () => {
    renderModal();
    expect(screen.getByText("Creates a Stage 0 opportunity")).toBeTruthy();
    expect((screen.getByLabelText("Opportunity name") as HTMLInputElement).value).toBe(
      "Mesa Valley USD 51 — Virtual Instruction",
    );
    fireEvent.click(screen.getByRole("button", { name: "Link Stage 0 opportunity" }));
    expect(linkOppMock).toHaveBeenCalledWith(
      {
        leadId: "lead-1",
        name: "Mesa Valley USD 51 — Virtual Instruction",
        amount: 75000,
        closeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      },
      expect.anything(),
    );
  });

  it("changing the product keeps the suggested name in sync", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Product line"), {
      target: { value: "Credit Recovery" },
    });
    expect((screen.getByLabelText("Opportunity name") as HTMLInputElement).value).toBe(
      "Mesa Valley USD 51 — Credit Recovery",
    );
  });

  it("links an existing open opp by id", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    // Save is disabled until an opp is picked.
    const saveBtn = screen.getByRole("button", { name: "Link opportunity" }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    fireEvent.click(screen.getByText("Mesa Valley USD 51 — Special Education Services"));
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);
    expect(linkOppMock).toHaveBeenCalledWith(
      { leadId: "lead-1", opportunityId: "opp-33" },
      expect.anything(),
    );
  });

  it("shows the empty state when the district has no open opps", () => {
    openOppsMock.mockReturnValue({ data: [], isLoading: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    expect(screen.getByText("No open opportunities to link.")).toBeTruthy();
  });
});
