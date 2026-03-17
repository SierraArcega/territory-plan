import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DistrictExploreModal from "../DistrictExploreModal";

vi.mock("@/features/districts/lib/queries", () => ({
  useDistrictDetail: () => ({ data: null, isLoading: true }),
}));

vi.mock("@/lib/api", () => ({
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/activities/lib/queries", () => ({
  useActivities: () => ({ data: null }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("DistrictExploreModal — responsive sizing", () => {
  it("modal panel uses responsive width (70vw + max-w) instead of fixed w-[1076px]", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".w-\\[1076px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-w-\\[1076px\\]")).not.toBeNull();
    // Verify the 70vw width class is present
    const modalPanel = container.querySelector(".max-w-\\[1076px\\]");
    expect(modalPanel?.className).toContain("w-[70vw]");
  });

  it("modal panel uses responsive height (70vh + max-h) instead of fixed h-[745px]", () => {
    const { container } = renderWithClient(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".h-\\[745px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-h-\\[745px\\]")).not.toBeNull();
    // Verify the 70vh height class is present
    const modalPanel = container.querySelector(".max-h-\\[745px\\]");
    expect(modalPanel?.className).toContain("h-[70vh]");
  });
});
