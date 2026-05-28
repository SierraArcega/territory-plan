import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BatchActionCard } from "../BatchActionCard";
import type { ProposedAction } from "../../lib/types";

function mk(id: string, summary: string): ProposedAction {
  return { id, objectType: "activity", operation: "create", targetId: null, fields: {},
    preview: { title: "Log activity", summary, rows: [], destructive: false } };
}
const actions = [mk("a1", "Check-in — Lake Mills"), mk("a2", "Check-in — Forest City"), mk("a3", "Check-in — Garner")];

describe("BatchActionCard", () => {
  it("summarizes the group and confirms all selected by default", () => {
    const onConfirmMany = vi.fn();
    render(<BatchActionCard actions={actions} statusById={{}} onConfirmMany={onConfirmMany} onDismissAll={() => {}} />);
    expect(screen.getByText(/Log 3 activities/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /confirm 3/i }));
    expect(onConfirmMany).toHaveBeenCalledWith(actions);
  });

  it("excludes an unchecked item from the confirmed set", () => {
    const onConfirmMany = vi.fn();
    render(<BatchActionCard actions={actions} statusById={{}} onConfirmMany={onConfirmMany} onDismissAll={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /review/i })); // expand
    // Checkbox aria-label is the full summary ("Check-in — Forest City").
    fireEvent.click(screen.getByLabelText(/Forest City/));
    fireEvent.click(screen.getByRole("button", { name: /confirm 2/i }));
    expect(onConfirmMany).toHaveBeenCalledWith([actions[0], actions[2]]);
  });
});
