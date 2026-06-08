import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import StageDealsModal from "../StageDealsModal";
import type { OppView } from "@/features/home/lib/pipeline";

// Minimal OppView fixture; only the fields the modal reads need to be realistic.
function makeOpp(i: number, stagePrefix: number): OppView {
  return {
    account: `Acct ${i}`,
    state: "CA",
    source: "new",
    stageName: "Commitment",
    stagePrefix,
    netBooking: 1000 + i,
    minPurchase: 1000 + i,
    maxBudget: 2000 + i,
    weighted: 900 + i,
    closeDate: null,
    daysInStage: 3,
    tier: "on",
    overdue: false,
    detailsLink: null,
  };
}

// Header row + N data rows.
const dataRowCount = () => screen.getAllByRole("row").length - 1;

describe("StageDealsModal", () => {
  it("counts every deal in the stage, not just the rendered page", () => {
    // 60 deals in stage 5 (Commitment), plus noise in other stages.
    const opps = [
      ...Array.from({ length: 60 }, (_, i) => makeOpp(i, 5)),
      ...Array.from({ length: 10 }, (_, i) => makeOpp(100 + i, 2)),
    ];
    render(<StageDealsModal stagePrefix={5} opps={opps} onClose={() => {}} />);

    // The header reflects the TRUE in-stage total — this is the funnel count.
    expect(screen.getByText(/60 open deals in this stage/i)).toBeInTheDocument();
  });

  it("paginates at 50 rows and reveals the rest via Show more", async () => {
    const user = userEvent.setup();
    const opps = Array.from({ length: 60 }, (_, i) => makeOpp(i, 5));
    render(<StageDealsModal stagePrefix={5} opps={opps} onClose={() => {}} />);

    // Never render more than 50 at once (CLAUDE.md).
    expect(dataRowCount()).toBe(50);

    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(dataRowCount()).toBe(60);
    // All revealed -> no more "Show more".
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("does not show pagination when the stage fits in one page", () => {
    const opps = Array.from({ length: 11 }, (_, i) => makeOpp(i, 5));
    render(<StageDealsModal stagePrefix={5} opps={opps} onClose={() => {}} />);
    expect(dataRowCount()).toBe(11);
    expect(screen.queryByRole("button", { name: /show more/i })).not.toBeInTheDocument();
  });

  it("resets pagination when switching to a different stage", async () => {
    const user = userEvent.setup();
    const opps = [
      ...Array.from({ length: 60 }, (_, i) => makeOpp(i, 5)),
      ...Array.from({ length: 55 }, (_, i) => makeOpp(200 + i, 2)),
    ];
    const onClose = vi.fn();
    const { rerender } = render(<StageDealsModal stagePrefix={5} opps={opps} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /show more/i }));
    expect(dataRowCount()).toBe(60);

    // Open a different stage -> back to the first page.
    rerender(<StageDealsModal stagePrefix={2} opps={opps} onClose={onClose} />);
    expect(dataRowCount()).toBe(50);
  });
});
