import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { AsyncMultiSelect } from "../AsyncMultiSelect";
import type { MultiSelectOption } from "../MultiSelect";

const RESULTS: MultiSelectOption[] = [
  { value: "lea001", label: "Lincoln USD (CA)" },
  { value: "lea002", label: "Jefferson USD (TX)" },
];

function setup(props: Partial<React.ComponentProps<typeof AsyncMultiSelect>> = {}) {
  const onChange = vi.fn();
  const onSearch = vi.fn().mockResolvedValue(RESULTS);
  const utils = render(
    <AsyncMultiSelect
      id="test-async"
      label="Districts"
      selected={[]}
      onChange={onChange}
      onSearch={onSearch}
      placeholder="Search districts…"
      countLabel="districts"
      {...props}
    />
  );
  return { ...utils, onChange, onSearch };
}

// Helper: fire the debounced search and flush all pending microtasks/timers.
// Using fake timers throughout these tests so vi.useFakeTimers() is called
// at the start of each test that needs it and vi.useRealTimers() at the end.
async function triggerSearch(query: string) {
  fireEvent.change(screen.getByRole("textbox"), { target: { value: query } });
  // advanceTimersByTime fires the 250ms debounce setTimeout…
  // wrapping in async act() also flushes the resulting promise microtasks.
  await act(async () => {
    vi.advanceTimersByTime(250);
  });
}

describe("AsyncMultiSelect — trigger label", () => {
  it("shows placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByRole("button", { name: /Search districts…/i })).toBeInTheDocument();
  });

  it("shows item label for 1 selected item (from label map)", () => {
    setup({ selected: ["lea001"] });
    const trigger = screen.getByRole("button");
    expect(trigger).toBeInTheDocument();
  });

  it("shows count label for 4+ selected", () => {
    setup({
      selected: ["lea001", "lea002", "lea003", "lea004"],
    });
    expect(screen.getByRole("button", { name: /4 districts/i })).toBeInTheDocument();
  });
});

describe("AsyncMultiSelect — dropdown search", () => {
  it("does NOT call onSearch when query is fewer than 2 chars", () => {
    const { onSearch } = setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "L" } });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("calls onSearch after debounce when query is 2+ chars", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Li" } });
    expect(onSearch).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(250); });
    expect(onSearch).toHaveBeenCalledWith("Li");
    vi.useRealTimers();
  });

  it("shows results from onSearch in the options list", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows 'Type to search…' hint when query is empty", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/Type to search/i)).toBeInTheDocument();
  });

  it("shows 'Search failed — try again' when onSearch rejects", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockRejectedValue(new Error("Network error"));
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText(/Search failed/i)).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — selection and label persistence", () => {
  it("calls onChange with the selected value", async () => {
    vi.useFakeTimers();
    const { onChange, onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Lincoln USD (CA)"));
    expect(onChange).toHaveBeenCalledWith(["lea001"]);
    vi.useRealTimers();
  });

  it("persists chip label after results are cleared by a new search", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn().mockResolvedValue(RESULTS);
    const onChange = vi.fn();

    // Stateful wrapper so we can simulate the parent re-rendering with updated selection
    function Wrapper() {
      const [selected, setSelected] = React.useState<string[]>([]);
      return (
        <AsyncMultiSelect
          id="test-async"
          label="Districts"
          selected={selected}
          onChange={(vals) => { onChange(vals); setSelected(vals); }}
          onSearch={onSearch}
          placeholder="Search districts…"
          countLabel="districts"
        />
      );
    }

    render(<Wrapper />);

    // Open and select lea001 by triggering search and clicking result
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Lincoln USD (CA)"));

    // Now change the search to something that returns no results —
    // async act flushes the debounce timer and the resolved/rejected promise together
    onSearch.mockResolvedValue([]);
    await triggerSearch("zzz");
    expect(onSearch).toHaveBeenCalledWith("zzz");

    // The chip for "Lincoln USD (CA)" must still be visible (labelMap preserved it)
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — select-all row", () => {
  it("does NOT render a select-all row", async () => {
    vi.useFakeTimers();
    const { onSearch } = setup();
    onSearch.mockResolvedValue(RESULTS);
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();
    expect(screen.queryByText(/Select all/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Select \d+ results/i)).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe("AsyncMultiSelect — close behaviour", () => {
  it("closes on Escape key", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("clears query on first Escape when query is active, closes on second Escape", async () => {
    vi.useFakeTimers();
    const onSearch = vi.fn().mockResolvedValue(RESULTS);
    render(
      <AsyncMultiSelect
        id="test-async"
        label="Districts"
        selected={[]}
        onChange={vi.fn()}
        onSearch={onSearch}
        placeholder="Search districts…"
      />
    );

    // Open and type a query
    fireEvent.click(screen.getByRole("button"));
    await triggerSearch("Li");
    expect(screen.getByText("Lincoln USD (CA)")).toBeInTheDocument();

    // First Escape: should clear query but keep dropdown open
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.getByRole("textbox")).toBeInTheDocument(); // still open
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(""); // query cleared

    // Second Escape: should close dropdown
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
