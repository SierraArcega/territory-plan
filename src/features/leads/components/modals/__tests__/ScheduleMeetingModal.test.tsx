import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import { makeLead, NOW } from "./fixtures";

const mutateMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useUpdateLeadMutation: () => ({ mutate: mutateMock, isPending: false }),
  };
});

import ScheduleMeetingModal from "../ScheduleMeetingModal";

function renderModal(lead = makeLead()) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <ScheduleMeetingModal lead={lead} onClose={onClose} now={NOW} />
    </ToastProvider>,
  );
  return { onClose };
}

describe("ScheduleMeetingModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("defaults to the next business day at 10:00", () => {
    renderModal();
    const input = screen.getByLabelText("Meeting date and time") as HTMLInputElement;
    // NOW is Tue Jun 2 2026 → next business day Wed Jun 3.
    expect(input.value).toBe("2026-06-03T10:00");
  });

  it("announces the Stage 0 opp only when the lead has none", () => {
    renderModal();
    expect(screen.getByText("Creates a Stage 0 opportunity")).toBeTruthy();
    cleanup();
    renderModal(
      makeLead({
        opportunity: {
          id: "opp-1",
          name: "X",
          stage: "0 - Meeting Booked",
          amount: 1000,
          closeDate: null,
        },
      }),
    );
    expect(screen.queryByText("Creates a Stage 0 opportunity")).toBeNull();
  });

  it("PATCHes { status: meeting_scheduled, meetingAt } and closes on success", () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("Meeting date and time"), {
      target: { value: "2026-06-05T14:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Move to Meeting Scheduled/ }));
    expect(mutateMock).toHaveBeenCalledWith(
      {
        id: "lead-1",
        status: "meeting_scheduled",
        meetingAt: new Date("2026-06-05T14:00").toISOString(),
      },
      expect.anything(),
    );
    mutateMock.mock.calls[0][1].onSuccess();
    expect(onClose).toHaveBeenCalled();
  });
});
