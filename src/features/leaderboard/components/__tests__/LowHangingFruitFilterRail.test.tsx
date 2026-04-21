import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitFilterRail from "../LowHangingFruitFilterRail";
import { DEFAULT_FILTERS } from "../../lib/filters";

const facets = {
  categoryCounts: { missing_renewal: 68, fullmind_winback: 34, ek12_winback: 25 },
  states: ["CA", "TX", "FL"],
  products: ["Live Instruction", "HI"],
};

describe("LowHangingFruitFilterRail", () => {
  it("renders category counts", () => {
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={() => {}} />);
    expect(screen.getByText(/Missing Renewal \(68\)/)).toBeInTheDocument();
    expect(screen.getByText(/Fullmind Winback \(34\)/)).toBeInTheDocument();
  });

  it("toggles category checkbox via onChange", () => {
    const onChange = vi.fn();
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Missing Renewal/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ["missing_renewal"] }),
    );
  });

  it("toggles hideWithFy27Target", () => {
    const onChange = vi.fn();
    render(<LowHangingFruitFilterRail filters={DEFAULT_FILTERS} facets={facets} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Hide districts with FY27 target/i));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ hideWithFy27Target: true }),
    );
  });
});
