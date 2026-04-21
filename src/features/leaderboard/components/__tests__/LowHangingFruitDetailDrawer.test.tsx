import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitDetailDrawer from "../LowHangingFruitDetailDrawer";
import type { IncreaseTarget } from "../../lib/types";

const row: IncreaseTarget = {
  leaid: "1", districtName: "Pasadena USD", state: "CA",
  enrollment: null, lmsId: "001A", category: "missing_renewal",
  fy26Revenue: 320000, fy26CompletedRevenue: 220000, fy26ScheduledRevenue: 100000,
  fy26SessionCount: 12400, fy26SubscriptionCount: null, fy26OppBookings: 0, fy26MinBookings: 0,
  priorYearRevenue: 0, priorYearVendor: null, priorYearFy: null,
  inFy27Plan: false, planIds: [], hasFy27Target: false, hasFy27Pipeline: false,
  fy27OpenPipeline: 0, inPlan: false,
  lastClosedWon: { repName: "M. Chen", repEmail: null, closeDate: "2026-03-10", schoolYr: "2025-26", amount: 260000 },
  productTypes: ["Live Instruction", "HI"], subProducts: ["K-5 Core"],
  revenueTrend: { fy24: 180000, fy25: 240000, fy26: 320000, fy27: null },
  suggestedTarget: 335000,
};

describe("LowHangingFruitDetailDrawer", () => {
  it("renders nothing when row is null", () => {
    const { container } = render(<LowHangingFruitDetailDrawer row={null} onClose={() => {}} onAddSuccess={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
  it("renders district name and revenue trend", () => {
    render(<LowHangingFruitDetailDrawer row={row} onClose={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText(/FY24/)).toBeInTheDocument();
    expect(screen.getByText(/\$180K/)).toBeInTheDocument();
    expect(screen.getByText(/\$240K/)).toBeInTheDocument();
    expect(screen.getByText(/\$320K/)).toBeInTheDocument();
  });
  it("Esc calls onClose", () => {
    const onClose = vi.fn();
    render(<LowHangingFruitDetailDrawer row={row} onClose={onClose} onAddSuccess={() => {}} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
