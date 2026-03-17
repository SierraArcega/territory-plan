import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import DistrictExploreModal from "../DistrictExploreModal";

vi.mock("@/features/districts/lib/queries", () => ({
  useDistrictDetail: () => ({ data: null, isLoading: true }),
}));

vi.mock("@/lib/api", () => ({
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe("DistrictExploreModal — responsive sizing", () => {
  it("modal panel uses responsive width (calc + max-w) instead of fixed w-[1076px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".w-\\[1076px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-w-\\[1076px\\]")).not.toBeNull();
    // Verify the calc-based width class is present (catches regressions that remove both)
    const modalPanel = container.querySelector(".max-w-\\[1076px\\]");
    expect(modalPanel?.className).toContain("w-[calc(100vw-104px)]");
  });

  it("modal panel uses responsive height (calc + max-h) instead of fixed h-[745px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    // Old fixed class must be gone
    expect(container.querySelector(".h-\\[745px\\]")).toBeNull();
    // New responsive classes must be present
    expect(container.querySelector(".max-h-\\[745px\\]")).not.toBeNull();
    // Verify the calc-based height class is present
    const modalPanel = container.querySelector(".max-h-\\[745px\\]");
    expect(modalPanel?.className).toContain("h-[calc(100vh-80px)]");
  });
});
