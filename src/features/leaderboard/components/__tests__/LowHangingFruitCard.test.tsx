import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LowHangingFruitCard from "../LowHangingFruitCard";
import type { IncreaseTarget } from "../../lib/types";

const row: IncreaseTarget = {
  leaid: "000001",
  districtName: "Pasadena USD",
  state: "CA",
  enrollment: null,
  lmsId: "001A",
  category: "missing_renewal",
  fy26Revenue: 320_000,
  fy26CompletedRevenue: 0,
  fy26ScheduledRevenue: 0,
  fy26SessionCount: 12_400,
  fy26SubscriptionCount: null,
  fy26OppBookings: 0,
  fy26MinBookings: 0,
  priorYearRevenue: 0,
  priorYearVendor: null,
  priorYearFy: null,
  inFy27Plan: false,
  planIds: [],
  hasFy27Target: false,
  hasFy27Pipeline: false,
  fy27OpenPipeline: 0,
  inPlan: false,
  lastClosedWon: { repName: "M. Chen", repEmail: null, closeDate: "2026-03-10", schoolYr: "2025-26", amount: 260_000 },
  productTypes: ["Live Instruction", "High Intensity", "K-5 Core"],
  subProducts: [],
  revenueTrend: { fy24: null, fy25: 240_000, fy26: 320_000, fy27: null },
  suggestedTarget: 335_000,
};

describe("LowHangingFruitCard", () => {
  it("renders name, state, hero revenue, sessions, suggested target, category", () => {
    render(<LowHangingFruitCard row={row} selected={false} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText("Pasadena USD")).toBeInTheDocument();
    expect(screen.getByText("CA")).toBeInTheDocument();
    expect(screen.getByText(/\$320K/)).toBeInTheDocument();
    expect(screen.getByText(/12,400/)).toBeInTheDocument();
    expect(screen.getByText(/Suggested:\s*\$335K/)).toBeInTheDocument();
    expect(screen.getByText(/Missing Renewal/)).toBeInTheDocument();
  });

  it("clicking body calls onOpenDetail, clicking checkbox calls onToggleSelect", () => {
    const onOpenDetail = vi.fn();
    const onToggleSelect = vi.fn();
    render(<LowHangingFruitCard row={row} selected={false} onToggleSelect={onToggleSelect} onOpenDetail={onOpenDetail} onAddSuccess={() => {}} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggleSelect).toHaveBeenCalledWith("000001");
    expect(onOpenDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Pasadena USD"));
    expect(onOpenDetail).toHaveBeenCalled();
  });

  it("selected card shows checked styling via aria-checked=true", () => {
    render(<LowHangingFruitCard row={row} selected={true} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("renders em-dash when last sale is null", () => {
    render(<LowHangingFruitCard row={{ ...row, lastClosedWon: null }} selected={false} onToggleSelect={() => {}} onOpenDetail={() => {}} onAddSuccess={() => {}} />);
    expect(screen.getByText(/No recent sale/)).toBeInTheDocument();
  });
});
