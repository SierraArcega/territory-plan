import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SignalItemRow from "../SignalItemRow";
import type { DistrictSignalItem } from "../queries";

function row(overrides: Partial<DistrictSignalItem> = {}): DistrictSignalItem {
  return {
    type: "vac",
    id: "vac-1",
    title: "HS Math Teacher",
    date: new Date().toISOString(),
    ...overrides,
  };
}

describe("SignalItemRow", () => {
  it("renders the title and a relative date", () => {
    render(<SignalItemRow item={row({ title: "HS Math Teacher" })} />);
    expect(screen.getByText("HS Math Teacher")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("renders the meta line and the rfp secondary (due) date", () => {
    render(
      <SignalItemRow
        item={row({
          type: "rfp",
          meta: "Springfield County",
          secondaryDate: new Date(Date.now() - 3 * 86400000).toISOString(),
        })}
      />,
    );
    expect(screen.getByText(/Springfield County/)).toBeInTheDocument();
    expect(screen.getByText(/due 3d/)).toBeInTheDocument();
  });
});
