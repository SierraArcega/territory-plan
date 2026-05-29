import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/home/lib/queries", () => ({ useRankTrajectory: vi.fn() }));

import RankTrajectoryModal from "../RankTrajectoryModal";
import { useRankTrajectory } from "@/features/home/lib/queries";

const mockHook = vi.mocked(useRankTrajectory);

const COLUMNS = ["Pre-FY", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const vals = (n: number) => COLUMNS.map(() => n);
const line = (ranks: number[]) => ({ ranks, values: vals(1000), inRoster: true });
const rep = (name: string, isCaller: boolean, ranks: number[]) => ({ name, isCaller, ranks, values: vals(500) });

const payload = {
  fy: 2026,
  schoolYr: "2025-26",
  columns: COLUMNS,
  todayIndex: 11,
  metrics: [
    {
      metricKey: "bookings",
      name: "Bookings",
      color: "#F37167",
      caller: line([5, 5, 4, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2]),
      reps: [
        rep("Me Rep", true, [5, 5, 4, 4, 3, 3, 2, 2, 2, 2, 2, 2, 2]),
        rep("Alex Rivera", false, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      ],
      segments: {
        return: { caller: line([6, 6, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3]), reps: [rep("Me Rep", true, [6, 6, 5, 5, 4, 4, 3, 3, 3, 3, 3, 3, 3])] },
      },
    },
    {
      metricKey: "openPipeline",
      name: "Open pipeline",
      color: "#403770",
      caller: line([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]),
      reps: [rep("Me Rep", true, [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3])],
      segments: {},
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = (over: Record<string, unknown>) => ({ data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...over } as any);

describe("RankTrajectoryModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockHook.mockReturnValue(result({ data: payload }));
  });

  it("renders nothing when closed", () => {
    const { container } = render(<RankTrajectoryModal open={false} onClose={vi.fn()} fy={2026} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the chart, metric pills, and the monthly table when open", () => {
    render(<RankTrajectoryModal open onClose={vi.fn()} fy={2026} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: /all metrics/i })).toBeTruthy();
    expect(screen.getAllByText("Bookings").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Monthly ranks/i)).toBeTruthy();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<RankTrajectoryModal open onClose={onClose} fy={2026} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("isolates a metric when its pill is clicked", () => {
    render(<RankTrajectoryModal open onClose={vi.fn()} fy={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /^Bookings/i }));
    expect(screen.getByText(/Showing/i).textContent).toContain("Bookings");
  });

  it("expands a metric row to reveal the team breakdown", () => {
    render(<RankTrajectoryModal open onClose={vi.fn()} fy={2026} />);
    expect(screen.queryByText("Alex Rivera")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /expand Bookings team/i }));
    expect(screen.getByText("Alex Rivera")).toBeTruthy();
  });

  it("offers an Export CSV action", () => {
    render(<RankTrajectoryModal open onClose={vi.fn()} fy={2026} />);
    expect(screen.getByRole("button", { name: /export csv/i })).toBeTruthy();
  });
});
