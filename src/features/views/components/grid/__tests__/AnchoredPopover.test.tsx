import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useRef } from "react";
import { AnchoredPopover } from "../AnchoredPopover";

function Harness({
  open,
  onDismiss,
  align,
}: {
  open: boolean;
  onDismiss: () => void;
  align?: "left" | "right";
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={btnRef}>Trigger</button>
      <AnchoredPopover
        anchorRef={btnRef}
        open={open}
        onDismiss={onDismiss}
        align={align}
      >
        <div>Popover content</div>
      </AnchoredPopover>
    </>
  );
}

describe("AnchoredPopover", () => {
  it("does not render children when closed", () => {
    render(<Harness open={false} onDismiss={vi.fn()} />);
    expect(screen.queryByText("Popover content")).not.toBeInTheDocument();
  });

  it("renders children in a portal when open", () => {
    render(<Harness open={true} onDismiss={vi.fn()} />);
    expect(screen.getByText("Popover content")).toBeInTheDocument();
  });

  it("calls onDismiss when Escape is pressed", async () => {
    const onDismiss = vi.fn();
    render(<Harness open={true} onDismiss={onDismiss} />);
    // The dismiss listener is deferred by setTimeout(0).
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when clicking outside the panel", async () => {
    const onDismiss = vi.fn();
    render(
      <div>
        <Harness open={true} onDismiss={onDismiss} />
        <div data-testid="outside">Outside</div>
      </div>,
    );
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not call onDismiss when clicking inside the panel", async () => {
    const onDismiss = vi.fn();
    render(<Harness open={true} onDismiss={onDismiss} />);
    await act(() => new Promise((r) => setTimeout(r, 0)));
    fireEvent.mouseDown(screen.getByText("Popover content"));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
