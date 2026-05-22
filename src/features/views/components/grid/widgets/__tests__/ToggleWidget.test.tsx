import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ToggleWidget } from "../ToggleWidget";

const widget = {
  kind: "toggle" as const,
  labels: { on: "Yes", off: "No" },
};

describe("ToggleWidget", () => {
  it("renders both labels", () => {
    render(
      <ToggleWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("clicking On button fires onApply(true)", () => {
    const onApply = vi.fn();
    render(
      <ToggleWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onApply).toHaveBeenCalledWith(true);
  });

  it("clicking Off button fires onApply(false)", () => {
    const onApply = vi.fn();
    render(
      <ToggleWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onApply).toHaveBeenCalledWith(false);
  });

  it("active value=true visually distinguishes On button with bg-[#403770] class", () => {
    render(
      <ToggleWidget
        widget={widget}
        value={true}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    const onBtn = screen.getByRole("button", { name: "Yes" });
    const offBtn = screen.getByRole("button", { name: "No" });
    expect(onBtn.className).toContain("bg-[#403770]");
    expect(offBtn.className).not.toContain("bg-[#403770]");
  });

  it("active value=false visually distinguishes Off button with bg-[#403770] class", () => {
    render(
      <ToggleWidget
        widget={widget}
        value={false}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    const onBtn = screen.getByRole("button", { name: "Yes" });
    const offBtn = screen.getByRole("button", { name: "No" });
    expect(offBtn.className).toContain("bg-[#403770]");
    expect(onBtn.className).not.toContain("bg-[#403770]");
  });

  it("neither button is highlighted when value is null", () => {
    render(
      <ToggleWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    const onBtn = screen.getByRole("button", { name: "Yes" });
    const offBtn = screen.getByRole("button", { name: "No" });
    expect(onBtn.className).not.toContain("bg-[#403770]");
    expect(offBtn.className).not.toContain("bg-[#403770]");
  });

  it("renders custom labels from widget config", () => {
    render(
      <ToggleWidget
        widget={{ kind: "toggle", labels: { on: "Active", off: "Inactive" } }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Active" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Inactive" }),
    ).toBeInTheDocument();
  });
});
