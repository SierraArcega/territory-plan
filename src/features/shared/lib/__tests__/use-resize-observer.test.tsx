import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useResizeObserver } from "../use-resize-observer";

// Mock ResizeObserver
let observerCallback: ResizeObserverCallback;
let mockDisconnect: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockDisconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn((cb: ResizeObserverCallback) => {
      observerCallback = cb;
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: mockDisconnect,
      };
    }),
  );
});

// Test component that attaches the ref to a real DOM element
function TestComponent() {
  const { ref, width, height } = useResizeObserver<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="observed">
      {width}x{height}
    </div>
  );
}

describe("useResizeObserver", () => {
  it("returns initial width and height of 0", () => {
    render(<TestComponent />);
    expect(screen.getByTestId("observed").textContent).toBe("0x0");
  });

  it("updates width and height when observer fires", () => {
    render(<TestComponent />);

    // Simulate the ResizeObserver callback firing
    act(() => {
      observerCallback(
        [{ contentRect: { width: 300, height: 200 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(screen.getByTestId("observed").textContent).toBe("300x200");
  });

  it("cleans up observer on unmount", () => {
    const { unmount } = render(<TestComponent />);
    unmount();
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
