import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SignalsControls, { type SignalsToolbarState } from "../SignalsControls";

function state(overrides: Partial<SignalsToolbarState> = {}): SignalsToolbarState {
  return {
    types: { vac: true, news: true, rfp: true },
    since: "30d",
    search: "",
    expandAll: false,
    ...overrides,
  };
}

const onChange = vi.fn();

beforeEach(() => {
  onChange.mockReset();
});

describe("SignalsControls", () => {
  it("toggling a type chip off emits the new mask", () => {
    render(<SignalsControls state={state()} onChange={onChange} searchDisabled={false} />);
    fireEvent.click(screen.getByText("News"));
    expect(onChange).toHaveBeenCalledWith({
      types: { vac: true, news: false, rfp: true },
    });
  });

  it("never lets the user turn the last remaining type off", () => {
    render(
      <SignalsControls
        state={state({ types: { vac: false, news: true, rfp: false } })}
        onChange={onChange}
        searchDisabled={false}
      />,
    );
    fireEvent.click(screen.getByText("News"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selecting a time window emits the new since value", () => {
    render(<SignalsControls state={state()} onChange={onChange} searchDisabled={false} />);
    fireEvent.click(screen.getByText("7d"));
    expect(onChange).toHaveBeenCalledWith({ since: "7d" });
  });

  it("typing in the search box emits the new search value", () => {
    render(<SignalsControls state={state()} onChange={onChange} searchDisabled={false} />);
    fireEvent.change(screen.getByLabelText("Search districts"), {
      target: { value: "spring" },
    });
    expect(onChange).toHaveBeenCalledWith({ search: "spring" });
  });

  it("renders the search input disabled (not hidden) while loading", () => {
    render(<SignalsControls state={state()} onChange={onChange} searchDisabled={true} />);
    const input = screen.getByLabelText("Search districts") as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it("toggling expand-all emits the inverted flag", () => {
    render(<SignalsControls state={state({ expandAll: false })} onChange={onChange} searchDisabled={false} />);
    fireEvent.click(screen.getByText("Expand all"));
    expect(onChange).toHaveBeenCalledWith({ expandAll: true });
  });
});
