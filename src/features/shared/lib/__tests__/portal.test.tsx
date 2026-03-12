import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Portal } from "../portal";

describe("Portal", () => {
  it("renders children into document.body", () => {
    const { container } = render(
      <div>
        <Portal>
          <span data-testid="portaled">Hello</span>
        </Portal>
      </div>,
    );

    // Should NOT be inside the container div
    expect(container.querySelector('[data-testid="portaled"]')).toBeNull();
    // Should be in document.body
    expect(screen.getByTestId("portaled")).toBeTruthy();
    expect(screen.getByTestId("portaled").textContent).toBe("Hello");
  });

  it("renders into custom container", () => {
    const customContainer = document.createElement("div");
    customContainer.id = "portal-target";
    document.body.appendChild(customContainer);

    render(
      <Portal container={customContainer}>
        <span data-testid="custom">Custom</span>
      </Portal>,
    );

    expect(customContainer.querySelector('[data-testid="custom"]')).toBeTruthy();
    document.body.removeChild(customContainer);
  });

  it("cleans up portaled content on unmount", () => {
    const { unmount } = render(
      <Portal>
        <span data-testid="cleanup">Temp</span>
      </Portal>,
    );

    expect(screen.getByTestId("cleanup")).toBeTruthy();
    unmount();
    expect(screen.queryByTestId("cleanup")).toBeNull();
  });
});
