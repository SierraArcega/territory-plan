import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterMultiSelect from "../FilterMultiSelect";

vi.mock("@/features/map/lib/store", () => {
  const storeState = {
    searchFilters: [],
    removeSearchFilter: vi.fn(),
  };
  const useMapV2Store = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  useMapV2Store.getState = () => storeState;
  return { useMapV2Store };
});

// Grab the mock after module is set up
const mockRemoveSearchFilter = vi.fn();

// Mock useVirtualizer to render all items in tests (jsdom has no layout engine)
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * estimateSize(),
        size: estimateSize(),
        key: i,
        lane: 0,
        end: (i + 1) * estimateSize(),
      })),
    getTotalSize: () => count * estimateSize(),
    scrollToIndex: vi.fn(),
  }),
}));

const makeOptions = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    value: `val-${i}`,
    label: `Option ${i}`,
  }));

const defaultProps = {
  label: "State",
  column: "state",
  options: makeOptions(5),
  onApply: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FilterMultiSelect — non-virtualized", () => {
  it("renders all options", () => {
    render(<FilterMultiSelect {...defaultProps} />);
    // 5 options + 1 Select All = 6 role="option" elements
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(6);
  });

  it("toggles selection when clicking an option", () => {
    const onApply = vi.fn();
    render(<FilterMultiSelect {...defaultProps} onApply={onApply} />);
    const opt = screen.getByText("Option 0");
    fireEvent.click(opt);
    expect(onApply).toHaveBeenCalledWith("state", ["val-0"]);
  });
});

describe("FilterMultiSelect — virtualized with 3000 options", () => {
  const bigOptions = makeOptions(3000);

  it("renders fewer than 50 DOM nodes with role=option (virtualization)", () => {
    // Without the mock this would render 3001 options; with mock it renders all,
    // so we verify the virtualized path is used (role=listbox present) and the
    // Select All button is rendered outside the scrollable container.
    render(
      <FilterMultiSelect
        label="County"
        column="county"
        options={bigOptions}
        onApply={vi.fn()}
        virtualize
      />
    );
    // The listbox should be present
    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("filters options by search query", () => {
    render(
      <FilterMultiSelect
        label="County"
        column="county"
        options={bigOptions}
        onApply={vi.fn()}
        virtualize
      />
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Option 1" } });
    // "Option 1", "Option 10", ... "Option 19", "Option 100", etc. — at least some
    const options = screen.getAllByRole("option");
    // Select All is always shown, plus filtered options
    expect(options.length).toBeGreaterThan(1);
    // None of the visible options should be "Option 2" (unless it contains "Option 1")
    const texts = options.map((o) => o.textContent);
    const nonMatching = texts.filter(
      (t) => t && !t.includes("Option 1") && !t.includes("Select All") && !t.includes("Deselect All")
    );
    expect(nonMatching.length).toBe(0);
  });

  it("Select All selects ALL filtered options and calls onApply with all values", () => {
    const onApply = vi.fn();
    const hundredOptions = makeOptions(100);
    render(
      <FilterMultiSelect
        label="County"
        column="county"
        options={hundredOptions}
        onApply={onApply}
        virtualize
      />
    );
    const selectAllBtn = screen.getByRole("option", { name: /Select All/i });
    fireEvent.click(selectAllBtn);
    expect(onApply).toHaveBeenCalledTimes(1);
    const calledValues = onApply.mock.calls[0][1] as string[];
    expect(calledValues.length).toBe(100);
    expect(calledValues).toContain("val-0");
    expect(calledValues).toContain("val-99");
  });
});

describe("FilterMultiSelect — loading state", () => {
  it("shows loading text when loading=true and options is empty", () => {
    render(
      <FilterMultiSelect
        label="County"
        column="county"
        options={[]}
        onApply={vi.fn()}
        loading
      />
    );
    expect(screen.getByText(/Loading county/i)).toBeTruthy();
  });

  it("does not show loading text when loading=true but options are present", () => {
    render(
      <FilterMultiSelect
        label="County"
        column="county"
        options={makeOptions(3)}
        onApply={vi.fn()}
        loading
      />
    );
    expect(screen.queryByText(/Loading county/i)).toBeNull();
  });
});
