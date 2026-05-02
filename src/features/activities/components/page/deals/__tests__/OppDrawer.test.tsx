import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import OppDrawer from "../OppDrawer";

describe("OppDrawer", () => {
  it("does not render when open is false", () => {
    const onClose = vi.fn();
    const { container } = render(
      <OppDrawer
        open={false}
        kind="won"
        heading="Closed won"
        events={[]}
        onClose={onClose}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("pressing Escape calls onClose", () => {
    const onClose = vi.fn();
    render(
      <OppDrawer
        open
        kind="won"
        heading="Closed won"
        events={[]}
        onClose={onClose}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking the backdrop calls onClose", () => {
    const onClose = vi.fn();
    render(
      <OppDrawer
        open
        kind="won"
        heading="Closed won"
        events={[]}
        onClose={onClose}
      />
    );
    const backdrop = screen.getByTestId("opp-drawer-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
