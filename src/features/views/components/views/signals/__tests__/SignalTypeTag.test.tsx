import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SignalTypeTag, { SIGNAL_TYPE_META } from "../SignalTypeTag";
import type { SignalType } from "@/lib/signals/sql";

describe("SignalTypeTag", () => {
  it.each(["vac", "news", "rfp"] as const)(
    "renders the %s label when withLabel is set",
    (type: SignalType) => {
      render(<SignalTypeTag type={type} withLabel />);
      expect(screen.getByText(SIGNAL_TYPE_META[type].label)).toBeInTheDocument();
    },
  );

  it("omits the label when withLabel is false", () => {
    render(<SignalTypeTag type="vac" />);
    expect(screen.queryByText("VAC")).toBeNull();
  });

  it("tags itself with the type via data attribute and the type tint color", () => {
    const { container } = render(<SignalTypeTag type="rfp" withLabel />);
    const tag = container.querySelector('[data-signal-type="rfp"]') as HTMLElement;
    expect(tag).toBeTruthy();
    expect(tag.style.color).toBeTruthy();
  });

  it("provides distinct tints for each type", () => {
    const fgs = new Set(
      (["vac", "news", "rfp"] as const).map((t) => SIGNAL_TYPE_META[t].fg),
    );
    expect(fgs.size).toBe(3);
  });
});
