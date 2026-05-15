import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SelectWidget } from "../SelectWidget";

vi.mock("@/features/views/hooks/useEnumValues", () => ({
  useEnumValues: vi.fn(),
}));
import { useEnumValues } from "@/features/views/hooks/useEnumValues";

const setEnumState = (state: {
  data?: { values: { value: string; label: string }[] };
  isLoading?: boolean;
}) => {
  (useEnumValues as ReturnType<typeof vi.fn>).mockReturnValue(state);
};

describe("SelectWidget", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders all static values", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta", "Gamma"] }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gamma" })).toBeInTheDocument();
  });

  it("shows loading state for dynamic enum sources", () => {
    setEnumState({ isLoading: true, data: undefined });
    render(
      <SelectWidget
        widget={{ kind: "select", enumSource: "states" }}
        value={null}
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
      <SelectWidget
        widget={{ kind: "select", enumSource: "states" }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "California" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Texas" })).toBeInTheDocument();
  });

  it("clicking an option highlights it with bg-[#EFEDF5] class", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta"] }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    const alphaBtn = screen.getByRole("button", { name: "Alpha" });
    fireEvent.click(alphaBtn);
    expect(alphaBtn.className).toContain("bg-[#EFEDF5]");
  });

  it("Apply emits the selected string", () => {
    const onApply = vi.fn();
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta"] }}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith("Alpha");
  });

  it("Apply is disabled when nothing is selected", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta"] }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });

  it("Apply is enabled when a value is pre-selected via prop", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta"] }}
        value="Alpha"
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Apply" })).not.toBeDisabled();
  });

  it("type-to-search filters visible options case-insensitively", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Apple", "Apricot", "Banana"] }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "ap" },
    });
    expect(screen.getByRole("button", { name: "Apple" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apricot" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Banana" }),
    ).not.toBeInTheDocument();
  });

  it("shows No matches when filter query has no results", () => {
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Apple", "Banana"] }}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "zzz" },
    });
    expect(screen.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("Cancel fires onCancel without applying", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <SelectWidget
        widget={{ kind: "select", values: ["Alpha", "Beta"] }}
        value={null}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
  });
});
