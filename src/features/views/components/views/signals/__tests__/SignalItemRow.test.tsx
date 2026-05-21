import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SignalItemRow, { detailKindForType } from "../SignalItemRow";
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

describe("detailKindForType", () => {
  it("maps vac→vacancy, news→news, rfp→rfp", () => {
    expect(detailKindForType("vac")).toBe("vacancy");
    expect(detailKindForType("news")).toBe("news");
    expect(detailKindForType("rfp")).toBe("rfp");
  });
});

describe("SignalItemRow", () => {
  it("renders the title and a relative date", () => {
    render(<SignalItemRow item={row({ title: "HS Math Teacher" })} />);
    expect(screen.getByText("HS Math Teacher")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("sets data-row-kind=vacancy for a vac item", () => {
    const { container } = render(<SignalItemRow item={row({ type: "vac" })} />);
    const el = container.querySelector("[data-row-kind]") as HTMLElement;
    expect(el.dataset.rowKind).toBe("vacancy");
  });

  it("stringifies a numeric-looking rfp id into the data-row-id attribute", () => {
    // The wire shape is already a string, but a numeric value coerces too.
    const item = { ...row({ type: "rfp" }), id: 42 as unknown as string };
    const { container } = render(<SignalItemRow item={item} />);
    const el = container.querySelector("[data-row-kind]") as HTMLElement;
    expect(el.dataset.rowKind).toBe("rfp");
    expect(el.dataset.rowId).toBe("42");
    expect(typeof el.dataset.rowId).toBe("string");
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
