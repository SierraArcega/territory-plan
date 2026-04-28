import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RangeFilter from "../RangeFilter";

type MockFilter = {
  id: string;
  column: string;
  op: string;
  value: [number, number];
};

const storeState: { searchFilters: MockFilter[]; removeSearchFilter: ReturnType<typeof vi.fn> } = {
  searchFilters: [],
  removeSearchFilter: vi.fn(),
};

vi.mock("@/features/map/lib/store", () => {
  const useMapV2Store = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  (useMapV2Store as unknown as { getState: () => typeof storeState }).getState = () => storeState;
  return { useMapV2Store };
});

const baseProps = {
  label: "Enrollment",
  column: "enrollment",
  min: 0,
  max: 200000,
  step: 500,
};

beforeEach(() => {
  storeState.searchFilters = [];
  storeState.removeSearchFilter.mockReset();
  vi.useRealTimers();
});

const getMinInput = () => screen.getByLabelText("Enrollment minimum") as HTMLInputElement;
const getMaxInput = () => screen.getByLabelText("Enrollment maximum") as HTMLInputElement;

describe("RangeFilter — input rendering", () => {
  it("renders editable min and max inputs alongside the slider", () => {
    render(<RangeFilter {...baseProps} onApply={vi.fn()} />);
    expect(getMinInput()).toBeTruthy();
    expect(getMaxInput()).toBeTruthy();
    expect(screen.getByLabelText("Enrollment slider minimum")).toBeTruthy();
    expect(screen.getByLabelText("Enrollment slider maximum")).toBeTruthy();
  });

  it("renders prefix and suffix adornments", () => {
    const { container } = render(
      <RangeFilter {...baseProps} prefix="$" suffix="%" onApply={vi.fn()} />
    );
    const text = container.textContent ?? "";
    // Prefix and suffix appear twice (once per input pair)
    expect((text.match(/\$/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((text.match(/%/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});

describe("RangeFilter — typing commits", () => {
  it("does not apply while typing", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "13" } });
    fireEvent.change(input, { target: { value: "137" } });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("commits on blur and bypasses step (137 in a step=500 row)", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "137" } });
    fireEvent.blur(input);
    expect(onApply).toHaveBeenCalledWith("enrollment", 137, 200000);
  });

  it("commits on Enter", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Enter triggers blur via e.currentTarget.blur() — the blur handler commits.
    fireEvent.blur(input);
    expect(onApply).toHaveBeenCalledWith("enrollment", 1500, 200000);
  });

  it("Escape reverts unsaved input", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "9999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(input.value).toBe("0");
    // The blur after Escape sees the reverted value (0) which equals min and current lo (0),
    // so applyImmediate sees min===min, max===max → removeSearchFilter (or no-op when not active)
    // — either way, onApply itself is not called with an applied range.
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe("RangeFilter — clamping and swap", () => {
  it("clamps a value above max", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMaxInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "999999999" } });
    fireEvent.blur(input);
    // When clamped to max and lo is still 0, both bounds match defaults → filter not applied
    // (matches existing slider reset-to-bounds behavior). Verify the input shows the clamped max.
    expect(input.value).toBe("200000");
  });

  it("clamps and applies via onApply when an active sub-range exists", () => {
    const onApply = vi.fn();
    storeState.searchFilters = [
      { id: "f1", column: "enrollment", op: "between", value: [50, 100] },
    ];
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMaxInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "999999999" } });
    fireEvent.blur(input);
    expect(onApply).toHaveBeenCalledWith("enrollment", 50, 200000);
  });

  it("clamps a negative min to range min", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-500" } });
    fireEvent.blur(input);
    expect(input.value).toBe("0");
  });

  it("swaps lo and hi when typed min exceeds current max", () => {
    const onApply = vi.fn();
    storeState.searchFilters = [
      { id: "f1", column: "enrollment", op: "between", value: [0, 100] },
    ];
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const minInput = getMinInput();
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: "5000" } });
    fireEvent.blur(minInput);
    // Typed lo (5000) > current hi (100) → swap so lo=100, hi=5000
    expect(onApply).toHaveBeenCalledWith("enrollment", 100, 5000);
  });

  it("rounds typed decimals to integers when step >= 1", () => {
    const onApply = vi.fn();
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "137.6" } });
    fireEvent.blur(input);
    expect(onApply).toHaveBeenCalledWith("enrollment", 138, 200000);
  });

  it("preserves decimals when step < 1", () => {
    const onApply = vi.fn();
    render(
      <RangeFilter
        label="Enrollment"
        column="enrollment"
        min={-50}
        max={50}
        step={0.5}
        onApply={onApply}
      />
    );
    const input = getMinInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-12.5" } });
    fireEvent.blur(input);
    expect(onApply).toHaveBeenCalledWith("enrollment", -12.5, 50);
  });
});

describe("RangeFilter — bounds-reset behavior", () => {
  it("removes the filter when both inputs return to bounds", () => {
    const onApply = vi.fn();
    storeState.searchFilters = [
      { id: "active", column: "enrollment", op: "between", value: [100, 5000] },
    ];
    render(<RangeFilter {...baseProps} onApply={onApply} />);
    const minInput = getMinInput();
    fireEvent.focus(minInput);
    fireEvent.change(minInput, { target: { value: "0" } });
    fireEvent.blur(minInput);
    const maxInput = getMaxInput();
    fireEvent.focus(maxInput);
    fireEvent.change(maxInput, { target: { value: "200000" } });
    fireEvent.blur(maxInput);
    expect(storeState.removeSearchFilter).toHaveBeenCalledWith("active");
  });
});
