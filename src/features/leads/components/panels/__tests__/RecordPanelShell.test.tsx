import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import RecordPanelShell, { type BreadcrumbItem } from "../RecordPanelShell";

function renderShell(trail: BreadcrumbItem[]) {
  const onBack = vi.fn();
  const onClose = vi.fn();
  render(
    <RecordPanelShell
      kicker="District record"
      title="Mesa Valley USD 51"
      subtitle="Grand Junction, CO · NCES 0802940"
      trail={trail}
      onBack={onBack}
      onClose={onClose}
    >
      <div>body</div>
    </RecordPanelShell>,
  );
  return { onBack, onClose };
}

beforeEach(cleanup);

describe("RecordPanelShell breadcrumbs", () => {
  it("renders the visited path; earlier levels clickable, current level not", () => {
    const jump = vi.fn();
    renderShell([
      { kind: "lead", label: "Karen Whitfield", onClick: jump },
      { kind: "contact", label: "Karen Whitfield", onClick: jump },
      { kind: "district", label: "Mesa Valley USD 51", onClick: null },
    ]);
    const nav = screen.getByRole("navigation", { name: "Record trail" });
    // Earlier levels are buttons…
    expect(within(nav).getAllByRole("button")).toHaveLength(2);
    // …the current level is plain text marked as the current location.
    const current = within(nav).getByText("Mesa Valley USD 51");
    expect(current.tagName).not.toBe("BUTTON");
    expect(current).toHaveAttribute("aria-current", "location");
    fireEvent.click(within(nav).getAllByRole("button")[0]);
    expect(jump).toHaveBeenCalledTimes(1);
  });
});

describe("RecordPanelShell controls", () => {
  it("Esc pops exactly one level (calls onBack once)", () => {
    const { onBack, onClose } = renderShell([]);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Back pops one level; Close clears the stack", () => {
    const { onBack, onClose } = renderShell([]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close record panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
