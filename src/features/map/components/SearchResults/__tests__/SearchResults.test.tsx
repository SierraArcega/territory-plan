import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import SearchResults from "../index";

// ── Store mock ────────────────────────────────────────────────────────────────
let mockExploreModalLeaid: string | null = null;

const mockStoreState = {
  searchFilters: [],
  searchBounds: null,
  searchSort: { column: "enrollment", direction: "desc" },
  isSearchActive: true,
  searchResultsVisible: true,
  toggleSearchResults: vi.fn(),
  selectedDistrictLeaids: new Set<string>(),
  toggleDistrictSelection: vi.fn(),
  setDistrictSelection: vi.fn(),
  setSearchResultLeaids: vi.fn(),
  setSearchResultCentroids: vi.fn(),
  searchResultLeaids: [],
  exploreModalLeaid: null as string | null,
  setExploreModalLeaid: vi.fn(),
  hideTooltip: vi.fn(),
  setSearchBounds: vi.fn(),
  setSearchSort: vi.fn(),
};

vi.mock("@/features/map/lib/store", () => {
  const useMapV2Store = (selector: (s: typeof mockStoreState) => unknown) =>
    selector({ ...mockStoreState, exploreModalLeaid: mockExploreModalLeaid });

  // getState is called directly inside fetchResults and event handlers
  useMapV2Store.getState = () => ({
    ...mockStoreState,
    exploreModalLeaid: mockExploreModalLeaid,
  });

  return { useMapV2Store };
});

vi.mock("@/features/plans/lib/queries", () => ({
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { id: "user-1" } }),
}));

// Stub the modal itself — we only care it renders into document.body via portal
vi.mock("../DistrictExploreModal", () => ({
  default: () => <div data-testid="explore-modal-sentinel" />,
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("SearchResults — portal rendering", () => {
  beforeEach(() => {
    mockExploreModalLeaid = null;
    // fetch is globally mocked in setup.ts; ensure it resolves to avoid unhandled rejections
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
  });

  it("does not render the explore modal when exploreModalLeaid is null", () => {
    mockExploreModalLeaid = null;
    render(<SearchResults />);
    expect(document.body.querySelector("[data-testid='explore-modal-sentinel']")).toBeNull();
  });

  it("renders the explore modal into document.body (not inside SearchResults container) when exploreModalLeaid is set", () => {
    mockExploreModalLeaid = "1234567";
    const { container } = render(<SearchResults />);

    const sentinel = document.body.querySelector("[data-testid='explore-modal-sentinel']");
    expect(sentinel).not.toBeNull();

    // The modal must NOT be inside the SearchResults container div
    expect(container.querySelector("[data-testid='explore-modal-sentinel']")).toBeNull();
  });
});
