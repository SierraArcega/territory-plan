import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useFocusTrap } from "../use-focus-trap";

// Test wrapper that attaches the focus trap ref to a real DOM container
function FocusTrapTestHarness({ active }: { active: boolean }) {
  const ref = useFocusTrap<HTMLDivElement>(active);
  return (
    <div ref={ref} data-testid="trap-container">
      <button data-testid="btn1">First</button>
      <button data-testid="btn2">Second</button>
      <button data-testid="btn3">Third</button>
    </div>
  );
}

describe("useFocusTrap", () => {
  it("auto-focuses first focusable element when active", () => {
    render(<FocusTrapTestHarness active={true} />);
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));
  });

  it("does not auto-focus when inactive", () => {
    render(<FocusTrapTestHarness active={false} />);
    expect(document.activeElement).not.toBe(screen.getByTestId("btn1"));
  });

  it("wraps Tab from last to first element", () => {
    render(<FocusTrapTestHarness active={true} />);
    const btn3 = screen.getByTestId("btn3");
    const btn1 = screen.getByTestId("btn1");

    btn3.focus();
    expect(document.activeElement).toBe(btn3);

    // Simulate Tab on last element
    const tabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
    });
    screen.getByTestId("trap-container").dispatchEvent(tabEvent);
    expect(document.activeElement).toBe(btn1);
  });

  it("wraps Shift+Tab from first to last element", () => {
    render(<FocusTrapTestHarness active={true} />);
    const btn1 = screen.getByTestId("btn1");
    const btn3 = screen.getByTestId("btn3");

    btn1.focus();
    expect(document.activeElement).toBe(btn1);

    // Simulate Shift+Tab on first element
    const shiftTabEvent = new KeyboardEvent("keydown", {
      key: "Tab",
      shiftKey: true,
      bubbles: true,
    });
    screen.getByTestId("trap-container").dispatchEvent(shiftTabEvent);
    expect(document.activeElement).toBe(btn3);
  });

  it("restores focus to previously focused element on deactivation", () => {
    const outerButton = document.createElement("button");
    outerButton.textContent = "Outer";
    document.body.appendChild(outerButton);
    outerButton.focus();
    expect(document.activeElement).toBe(outerButton);

    const { unmount } = render(<FocusTrapTestHarness active={true} />);
    // Focus should move into the trap
    expect(document.activeElement).toBe(screen.getByTestId("btn1"));

    unmount();
    // Focus should restore to the outer button
    expect(document.activeElement).toBe(outerButton);

    document.body.removeChild(outerButton);
  });
});
