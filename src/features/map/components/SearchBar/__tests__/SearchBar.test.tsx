import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import SearchBar from "../index";

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      searchFilters: [],
      selectedFiscalYear: "fy26",
      setSelectedFiscalYear: vi.fn(),
      compareMode: false,
      compareFyA: "fy25",
      compareFyB: "fy26",
      enterCompareMode: vi.fn(),
      exitCompareMode: vi.fn(),
      setCompareFyA: vi.fn(),
      setCompareFyB: vi.fn(),
      exploreModalLeaid: "1234567",  // simulate modal open
      clearSearchFilters: vi.fn(),
    }),
}));

vi.mock("@/features/map/lib/geocode", () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/map/lib/ref", () => ({
  mapV2Ref: { current: null },
}));

vi.mock("../GeographyDropdown", () => ({ default: () => null }));
vi.mock("../FullmindDropdown", () => ({ default: () => null }));
vi.mock("../CompetitorsDropdown", () => ({ default: () => null }));
vi.mock("../FinanceDropdown", () => ({ default: () => null }));
vi.mock("../DemographicsDropdown", () => ({ default: () => null }));
vi.mock("../AcademicsDropdown", () => ({ default: () => null }));
vi.mock("../FilterPills", () => ({ default: () => null }));

describe("SearchBar — no dimming overlay when modal is open", () => {
  it("does not render a bg-black/40 dimming overlay when exploreModalLeaid is set", () => {
    const { container } = render(<SearchBar />);
    // The removed overlay had class bg-black/40 and pointer-events-auto
    const overlay = container.querySelector(".bg-black\\/40");
    expect(overlay).toBeNull();
  });
});
