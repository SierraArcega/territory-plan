import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider } from "@/features/shared/components/Toast";
import { makeLead } from "./fixtures";

const mutateMock = vi.fn();
const timelineMock = vi.fn();

vi.mock("@/features/leads/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/leads/lib/queries")>();
  return {
    ...actual,
    useUpdateLeadMutation: () => ({ mutate: mutateMock, isPending: false }),
    useLeadTimelineQuery: () => timelineMock(),
  };
});

import DisqualifyModal from "../DisqualifyModal";

function engagementItem(id: string) {
  return {
    itemType: "engagement",
    id,
    type: "email",
    title: "Outreach",
    notes: null,
    outcome: null,
    outcomeType: null,
    rating: null,
    points: 0,
    mixmaxSequenceName: null,
    mixmaxSequenceStep: null,
    mixmaxSequenceTotal: null,
    mixmaxOpenCount: null,
    mixmaxClickCount: null,
    source: "manual",
    createdByUserId: null,
    attribution: "own_contact",
    attributionName: null,
    ts: "2026-05-30T10:00:00Z",
  };
}

function lifecycleItem(id: string) {
  return {
    itemType: "lifecycle",
    id,
    kind: "created",
    payload: null,
    actorId: null,
    ts: "2026-05-22T09:00:00Z",
  };
}

function renderModal() {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <DisqualifyModal lead={makeLead()} onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose };
}

describe("DisqualifyModal", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    timelineMock.mockReturnValue({
      data: {
        items: [engagementItem("a1"), engagementItem("a2"), engagementItem("a3"), lifecycleItem("e1")],
      },
      isLoading: false,
    });
  });

  it("counts only engagement events in the preserved-history copy", () => {
    renderModal();
    // 3 engagement items, the lifecycle event is excluded.
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText(/stay on the records below/)).toBeTruthy();
  });

  it("names the contact and district records that keep the history", () => {
    renderModal();
    expect(screen.getByText("Karen Whitfield")).toBeTruthy();
    expect(screen.getByText("Mesa Valley USD 51")).toBeTruthy();
    expect(screen.getByText("Contact record")).toBeTruthy();
    expect(screen.getByText("District record")).toBeTruthy();
  });

  it("disables the confirm button until a reason is selected", () => {
    renderModal();
    const confirm = screen.getByRole("button", { name: /Disqualify · keep history/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Disqualification reason"), {
      target: { value: "No Response" },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });

  it("submits PATCH { status: unqualified, reason } and closes", () => {
    const { onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("Disqualification reason"), {
      target: { value: "Does Not Fit ICP" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Disqualify · keep history/ }));
    expect(mutateMock).toHaveBeenCalledWith(
      { id: "lead-1", status: "unqualified", reason: "Does Not Fit ICP" },
      expect.anything(),
    );
    // Simulate the mutation succeeding.
    mutateMock.mock.calls[0][1].onSuccess();
    expect(onClose).toHaveBeenCalled();
  });

  it("never submits without a reason", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: /Disqualify · keep history/ }));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
