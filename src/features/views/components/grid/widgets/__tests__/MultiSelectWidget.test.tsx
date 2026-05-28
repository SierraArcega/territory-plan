import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MultiSelectWidget } from "../MultiSelectWidget";

vi.mock("@/features/views/hooks/useEnumValues", () => ({
  useEnumValues: vi.fn(),
}));
import { useEnumValues } from "@/features/views/hooks/useEnumValues";

const setEnumState = (state: { data?: { values: { value: string; label: string }[] }; isLoading?: boolean }) => {
  (useEnumValues as ReturnType<typeof vi.fn>).mockReturnValue(state);
};

describe("MultiSelectWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all static values", () => {
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["one", "two", "three"] }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText("one")).toBeInTheDocument();
    expect(screen.getByLabelText("two")).toBeInTheDocument();
    expect(screen.getByLabelText("three")).toBeInTheDocument();
  });

  it("shows loading state for dynamic enum sources", () => {
    setEnumState({ isLoading: true, data: undefined });
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", enumSource: "states" }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders fetched options when enum query resolves", () => {
    setEnumState({
      isLoading: false,
      data: {
        values: [
          { value: "CA", label: "California" },
          { value: "TX", label: "Texas" },
        ],
      },
    });
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", enumSource: "states" }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText("California")).toBeInTheDocument();
    expect(screen.getByLabelText("Texas")).toBeInTheDocument();
  });

  it("checkbox toggle adds value to selection", () => {
    const onApply = vi.fn();
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["alpha", "beta", "gamma"] }}
        value={[]}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByLabelText("alpha"));
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(["alpha"]);
  });

  it("checkbox toggle removes value from selection when already selected", () => {
    const onApply = vi.fn();
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["alpha", "beta", "gamma"] }}
        value={["alpha", "beta"]}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    // Uncheck "alpha"
    fireEvent.click(screen.getByLabelText("alpha"));
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(["beta"]);
  });

  it("type-to-search filters visible options case-insensitively", () => {
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["Apple", "Apricot", "Banana"] }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "ap" } });
    expect(screen.getByLabelText("Apple")).toBeInTheDocument();
    expect(screen.getByLabelText("Apricot")).toBeInTheDocument();
    expect(screen.queryByLabelText("Banana")).not.toBeInTheDocument();
  });

  it("matches dynamic options by abbreviation (value) when label does not match", () => {
    setEnumState({
      isLoading: false,
      data: {
        values: [
          { value: "MT", label: "Montana" },
          { value: "MN", label: "Minnesota" },
          { value: "CA", label: "California" },
        ],
      },
    });
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", enumSource: "states" }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "MT" },
    });
    expect(screen.getByLabelText("Montana")).toBeInTheDocument();
    expect(screen.queryByLabelText("Minnesota")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("California")).not.toBeInTheDocument();
  });

  it("Apply button fires onApply with current selection", () => {
    const onApply = vi.fn();
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["x", "y"] }}
        value={["x"]}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(["x"]);
  });

  it("Cancel button fires onCancel without modifying selection", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["x", "y"] }}
        value={["x"]}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );
    // Toggle something, then cancel
    fireEvent.click(screen.getByLabelText("y"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });

  it("shows No matches when filter query has no results", () => {
    render(
      <MultiSelectWidget
        widget={{ kind: "multiselect", values: ["Apple", "Banana"] }}
        value={[]}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "zzz" } });
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });
});
