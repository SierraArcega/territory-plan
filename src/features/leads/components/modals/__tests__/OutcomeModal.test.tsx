import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import { makeLead, NOW } from "./fixtures";

const logEngagementMock = vi.fn().mockResolvedValue({});
const linkOppMock = vi.fn().mockResolvedValue({});

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useLogEngagementMutation: () => ({ mutateAsync: logEngagementMock, isPending: false }),
    useLinkOpportunityMutation: () => ({ mutateAsync: linkOppMock, isPending: false }),
    useDistrictOpenOppsQuery: () => ({ data: [], isLoading: false }),
  };
});

import OutcomeModal from "../OutcomeModal";

function renderModal(lead = makeLead()) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <OutcomeModal lead={lead} onClose={onClose} now={NOW} />
    </ToastProvider>,
  );
  return { onClose };
}

const save = () => screen.getByRole("button", { name: "Save & close" }) as HTMLButtonElement;

describe("OutcomeModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    logEngagementMock.mockResolvedValue({});
    linkOppMock.mockResolvedValue({});
  });

  it("requires a star rating before saving", () => {
    renderModal();
    expect(save().disabled).toBe(true);
    expect(screen.getByText("Required to save")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "3 stars" }));
    expect(save().disabled).toBe(false);
  });

  it("submits the engagement with the mapped activity type, rating, outcome and status", async () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    fireEvent.click(screen.getByRole("button", { name: /Moved Forward/ }));
    fireEvent.click(save());
    await waitFor(() => expect(logEngagementMock).toHaveBeenCalled());
    expect(logEngagementMock).toHaveBeenCalledWith({
      leadId: "lead-1",
      type: "cold_call",
      title: "Call · Mesa Valley USD 51",
      notes: null,
      rating: 4,
      outcomeType: "positive_progress",
      resultingStatus: "working",
      reason: null,
    });
    expect(linkOppMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("outcome pills are single-select: a new pick replaces, re-clicking clears", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
    const forward = screen.getByRole("button", { name: /Moved Forward/ });
    const goodChat = screen.getByRole("button", { name: /Good Chat/ });

    fireEvent.click(forward);
    expect(forward).toHaveAttribute("aria-pressed", "true");
    // Picking another pill replaces the first (only one outcome persists).
    fireEvent.click(goodChat);
    expect(goodChat).toHaveAttribute("aria-pressed", "true");
    expect(forward).toHaveAttribute("aria-pressed", "false");
    // Re-clicking the active pill deselects it.
    fireEvent.click(goodChat);
    expect(goodChat).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(save());
    await waitFor(() => expect(logEngagementMock).toHaveBeenCalled());
    expect(logEngagementMock.mock.calls[0][0].outcomeType).toBeNull();
  });

  it("maps Email and Meeting to the email / discovery_call activity types", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Email" }));
    fireEvent.click(screen.getByRole("button", { name: "1 star" }));
    fireEvent.click(save());
    await waitFor(() => expect(logEngagementMock).toHaveBeenCalled());
    expect(logEngagementMock.mock.calls[0][0].type).toBe("email");
    expect(logEngagementMock.mock.calls[0][0].title).toBe("Email · Mesa Valley USD 51");
  });

  it("requires a reason when the resulting status is Unqualified", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "2 stars" }));
    fireEvent.click(screen.getByRole("button", { name: /Unqualified/ }));
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Disqualification reason"), {
      target: { value: "No Response" },
    });
    expect(save().disabled).toBe(false);
  });

  it("passes the reason with an unqualified transition", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "2 stars" }));
    fireEvent.click(screen.getByRole("button", { name: /Unqualified/ }));
    fireEvent.change(screen.getByLabelText("Disqualification reason"), {
      target: { value: "No Response" },
    });
    fireEvent.click(save());
    await waitFor(() => expect(logEngagementMock).toHaveBeenCalled());
    expect(logEngagementMock.mock.calls[0][0].resultingStatus).toBe("unqualified");
    expect(logEngagementMock.mock.calls[0][0].reason).toBe("No Response");
  });

  it("links the drafted Stage 0 opp before the engagement when entering Meeting Scheduled", async () => {
    renderModal(); // working lead with no opportunity
    fireEvent.click(screen.getByRole("button", { name: "5 stars" }));
    fireEvent.click(screen.getByRole("button", { name: /Meeting Scheduled/ }));
    // Required-opp section appears with the suggested draft (already valid).
    expect(screen.getByText("Creates a Stage 0 opportunity")).toBeTruthy();
    fireEvent.click(save());
    await waitFor(() => expect(linkOppMock).toHaveBeenCalled());
    expect(linkOppMock).toHaveBeenCalledWith({
      leadId: "lead-1",
      name: "Mesa Valley USD 51 — Virtual Instruction",
      amount: 75000,
      closeDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    await waitFor(() => expect(logEngagementMock).toHaveBeenCalled());
    expect(logEngagementMock.mock.calls[0][0].resultingStatus).toBe("meeting_scheduled");
    // The opp call landed before the engagement call.
    expect(linkOppMock.mock.invocationCallOrder[0]).toBeLessThan(
      logEngagementMock.mock.invocationCallOrder[0],
    );
  });

  it("does not require an opp when the lead already has one", () => {
    renderModal(
      makeLead({
        status: "meeting_scheduled",
        opportunity: {
          id: "opp-1",
          name: "Mesa Valley USD 51 — Virtual Instruction",
          stage: "0 - Meeting Booked",
          amount: 96000,
          closeDate: "2026-08-14T00:00:00.000Z",
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "3 stars" }));
    expect(screen.queryByText("Creates a Stage 0 opportunity")).toBeNull();
    expect(save().disabled).toBe(false);
  });

  it("offers only legal status transitions for a meeting_scheduled lead", () => {
    renderModal(makeLead({ status: "meeting_scheduled" }));
    expect(screen.getByRole("button", { name: /Working/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sales Qualified/ })).toBeTruthy();
    // A working lead cannot jump straight to Sales Qualified.
    cleanup();
    renderModal(makeLead({ status: "working" }));
    expect(screen.queryByRole("button", { name: /Sales Qualified/ })).toBeNull();
  });
});
