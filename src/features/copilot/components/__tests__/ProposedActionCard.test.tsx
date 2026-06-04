import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposedActionCard } from "../ProposedActionCard";
import type { ProposedAction } from "../../lib/types";

function mk(over: Partial<ProposedAction["preview"]> = {}): ProposedAction {
  return {
    id: "a1", objectType: "activity", operation: "create", targetId: null, fields: {},
    preview: { title: "Log activity", summary: "Program check-in — Lake Mills",
      rows: [{ label: "Type", value: "Program check-in" }], destructive: false, ...over },
  };
}

describe("ProposedActionCard", () => {
  it("calls onConfirm when Confirm is clicked", () => {
    const onConfirm = vi.fn();
    render(<ProposedActionCard action={mk()} status="idle" onConfirm={onConfirm} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("collapses to a done line when confirmed", () => {
    render(<ProposedActionCard action={mk()} status="confirmed" onConfirm={() => {}} onDismiss={() => {}} />);
    expect(screen.queryByRole("button", { name: /confirm/i })).toBeNull();
    expect(screen.getByText(/done/i)).toBeTruthy();
  });

  it("styles the Confirm button destructively for a destructive action (preserved behavior)", () => {
    render(<ProposedActionCard action={mk({ destructive: true })} status="idle" onConfirm={() => {}} onDismiss={() => {}} />);
    const confirm = screen.getByRole("button", { name: /confirm/i });
    // Destructive confirm uses the coral token, not the default plum.
    expect(confirm.className).toContain("F37167");
  });
});
