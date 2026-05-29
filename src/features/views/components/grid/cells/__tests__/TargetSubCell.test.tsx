import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TargetSubCell } from "../TargetSubCell";

const mockMutate = vi.fn();
vi.mock("@/features/plans/lib/queries", () => ({
  useUpdateDistrictTargets: () => ({ mutate: mockMutate, isPending: false }),
}));

const BASE = {
  planId: "1",
  leaid: "0601234",
  field: "renewalTarget" as const,
  value: 20000,
};

describe("TargetSubCell", () => {
  beforeEach(() => mockMutate.mockReset());

  it("renders formatted value when not editing", () => {
    render(<TargetSubCell {...BASE} />);
    expect(screen.getByText("$20K")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders — when value is null", () => {
    render(<TargetSubCell {...BASE} value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("clicking enters edit mode with raw number pre-filled", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe("20000");
  });

  it("blur fires mutation with only this field — no sibling values", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "15000" } });
    fireEvent.blur(input);
    expect(mockMutate).toHaveBeenCalledWith({
      planId: "1",
      leaid: "0601234",
      renewalTarget: 15000,
    });
    // Siblings must NOT be present — sending them risks clobbering a
    // concurrent edit on another sub-cell with a stale value.
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty("expansionTarget");
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty("winbackTarget");
    expect(mockMutate.mock.calls[0][0]).not.toHaveProperty("newBusinessTarget");
  });

  it("Enter key fires mutation", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "10000" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ renewalTarget: 10000 })
    );
  });

  it("Escape cancels without firing mutation", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(mockMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("empty input saves null (clears the field)", () => {
    render(<TargetSubCell {...BASE} />);
    fireEvent.click(screen.getByText("$20K"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ renewalTarget: null })
    );
  });
});
