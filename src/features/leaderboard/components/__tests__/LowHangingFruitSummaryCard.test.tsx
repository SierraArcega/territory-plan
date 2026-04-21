import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LowHangingFruitSummaryCard from "../LowHangingFruitSummaryCard";

vi.mock("../../lib/queries", () => ({
  useLowHangingFruitList: () => ({
    data: { totalRevenueAtRisk: 4_200_000, districts: Array.from({ length: 127 }, (_, i) => ({ leaid: String(i) })) },
    isLoading: false, isError: false,
  }),
}));

describe("LowHangingFruitSummaryCard", () => {
  it("renders counts and clicking View all calls onViewAll", () => {
    const onViewAll = vi.fn();
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <LowHangingFruitSummaryCard onViewAll={onViewAll} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/127/)).toBeInTheDocument();
    expect(screen.getByText(/\$4\.2M/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View all/i }));
    expect(onViewAll).toHaveBeenCalled();
  });
});
