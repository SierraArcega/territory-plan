import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SegmentLegend from "../SegmentLegend";

describe("SegmentLegend", () => {
  it("renders a row per segment with formatted value and rounded percent", () => {
    render(
      <SegmentLegend
        segments={[
          { key: "return", label: "Return", value: 280 },
          { key: "new", label: "New biz", value: 140 },
          { key: "winback", label: "Win-back", value: 60 },
        ]}
        format={(v) => `$${v}K`}
      />,
    );
    expect(screen.getByText("Return")).toBeInTheDocument();
    expect(screen.getByText("$280K")).toBeInTheDocument();
    expect(screen.getByText("58%")).toBeInTheDocument(); // 280/480
    expect(screen.getByText("New biz")).toBeInTheDocument();
    expect(screen.getByText("13%")).toBeInTheDocument(); // 60/480
  });
  it("renders nothing when total is zero", () => {
    const { container } = render(<SegmentLegend segments={[]} format={(v) => `${v}`} />);
    expect(container.firstChild).toBeNull();
  });
});
