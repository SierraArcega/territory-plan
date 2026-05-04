import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import SearchBar from "../index";

// SearchBar's useDropdownData fires fetch() on mount for /api/sales-executives
// and /api/tags. jsdom has no fetch, so stub it to return empty arrays.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

vi.mock("@/features/map/lib/store", () => {
  const storeState = {
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
    activeLayers: new Set(["districts"]),
    toggleLayer: vi.fn(),
    layerFilters: { contacts: {}, vacancies: {}, activities: {}, plans: {} },
    dateRange: { vacancies: { start: null, end: null, preset: null }, activities: { start: null, end: null, preset: null } },
    openResultsPanel: vi.fn(),
    isSearchActive: true,
    searchResultsVisible: true,
  };
  const useMapV2Store = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  useMapV2Store.getState = () => storeState;
  return { useMapV2Store };
});

vi.mock("@/features/map/lib/geocode", () => ({
  searchLocations: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/map/lib/ref", () => ({
  mapV2Ref: { current: null },
}));

vi.mock("@/features/map/lib/queries", () => ({
  useGeographyPrefetch: vi.fn(),
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
