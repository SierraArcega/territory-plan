import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import OverdueDealRow from "../OverdueDealRow";
import type { OpenDeal } from "@/features/shared/types/api-types";

function deal(overrides: Partial<OpenDeal>): OpenDeal {
  return {
    id: "d",
    name: "Deal",
    stage: "Proposal",
    amount: 100000,
    closeDate: "2026-04-10T00:00:00.000Z",
    districtLeaid: "0900330",
    districtName: "Mapleton ISD",
    salesRepId: null,
    daysToClose: -10,
    detailsLink: null,
    ...overrides,
  };
}

describe("OverdueDealRow", () => {
  it("renders the days-overdue copy and changes severity rail color across buckets", () => {
    const { container, rerender } = render(
      <OverdueDealRow deal={deal({ daysToClose: -10 })} />
    );
    expect(screen.getByText(/10 days overdue/i)).toBeInTheDocument();
    const sev10 = (
      container.querySelector("[data-severity]") as HTMLElement
    ).dataset.severity;
    const railStyle10 = (
      container.querySelector(
        "[data-testid='overdue-severity-rail']"
      ) as HTMLElement
    ).getAttribute("style");
    expect(sev10).toBe("med"); // -8..-30 = med

    rerender(<OverdueDealRow deal={deal({ daysToClose: -3 })} />);
    const sev3 = (
      container.querySelector("[data-severity]") as HTMLElement
    ).dataset.severity;
    const railStyle3 = (
      container.querySelector(
        "[data-testid='overdue-severity-rail']"
      ) as HTMLElement
    ).getAttribute("style");
    expect(sev3).toBe("low"); // ≥-7 = low
    // rail color differs between buckets
    expect(railStyle10).not.toBe(railStyle3);
  });
});
