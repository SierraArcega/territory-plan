import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import { makeLead, NOW } from "./fixtures";

const linkOppMock = vi.fn();
const openOppsMock = vi.fn();
const oppSearchMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLinkOpportunityMutation: () => ({ mutate: linkOppMock, isPending: false }),
    useDistrictOpenOppsQuery: () => openOppsMock(),
    useOppSearchQuery: (q: string) => oppSearchMock(q),
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
    oppSearchMock.mockReturnValue({ data: undefined, isLoading: false });
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

  it("shows the empty state when the district has no open opps, pointing at search", () => {
    openOppsMock.mockReturnValue({ data: [], isLoading: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    expect(
      screen.getByText(/No open opportunities at this district/),
    ).toBeTruthy();
    expect(screen.getByLabelText("Search all opportunities")).toBeTruthy();
  });

  it("labels the district list with the district name", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    expect(screen.getByText("Open at Mesa Valley USD 51")).toBeTruthy();
  });

  it("searches the whole opportunities table, lead-district matches first", () => {
    const ELSEWHERE_OPP = {
      id: "opp-77",
      name: "Pueblo County 70 — Tutoring & Intervention",
      stage: "2 - Proposal",
      netBookingAmount: 50000,
      districtName: "Pueblo County 70",
      districtLeaId: "0806990",
      closeDate: null,
    };
    const HOME_OPP = {
      id: "opp-88",
      name: "Mesa Valley USD 51 — Credit Recovery",
      stage: "1 - Discovery",
      netBookingAmount: 80000,
      districtName: "Mesa Valley USD 51",
      districtLeaId: "0802940",
      closeDate: null,
    };
    // Server order has the other district first — the UI must pin home first.
    oppSearchMock.mockReturnValue({ data: [ELSEWHERE_OPP, HOME_OPP], isLoading: false });
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Link existing" }));
    fireEvent.change(screen.getByLabelText("Search all opportunities"), {
      target: { value: "recovery" },
    });
    expect(oppSearchMock).toHaveBeenLastCalledWith("recovery");
    const rows = screen.getAllByTestId(/^opp-row-/);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual([
      "opp-row-opp-88",
      "opp-row-opp-77",
    ]);
    // Cross-district results show their district and are linkable
    expect(screen.getByText("Pueblo County 70")).toBeTruthy();
    fireEvent.click(screen.getByTestId("opp-row-opp-77"));
    fireEvent.click(screen.getByRole("button", { name: "Link opportunity" }));
    expect(linkOppMock).toHaveBeenCalledWith(
      { leadId: "lead-1", opportunityId: "opp-77" },
      expect.anything(),
    );
  });
});
