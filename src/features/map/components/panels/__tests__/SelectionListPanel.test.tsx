import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectionListPanel from "../SelectionListPanel";
import { useMapV2Store } from "@/features/map/lib/store";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  useDistrictDetail: (leaid: string | null) => ({
    data: leaid
      ? {
          district: {
            leaid,
            name: `District ${leaid}`,
            stateAbbrev: "MN",
            enrollment: 1000,
          },
          contacts: [],
          fullmindData: null,
          tags: [],
          trends: null,
        }
      : undefined,
    isLoading: false,
  }),
  useTerritoryPlans: () => ({ data: [] }),
  useAddDistrictsToPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Capture store actions for assertion
const mockClearSelectedDistricts = vi.fn();
const mockToggleLeaidSelection = vi.fn();
const mockSelectDistrict = vi.fn();

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: vi.fn(),
}));

function setupStore(leaids: string[]) {
  (useMapV2Store as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        selectedLeaids: new Set(leaids),
        clearSelectedDistricts: mockClearSelectedDistricts,
        toggleLeaidSelection: mockToggleLeaidSelection,
        selectDistrict: mockSelectDistrict,
      })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SelectionListPanel", () => {
  it("renders district count in header", () => {
    setupStore(["aaa", "bbb"]);
    render(<SelectionListPanel />);
    expect(screen.getByText(/2 Districts Selected/i)).toBeInTheDocument();
  });

  it("renders a row for each selected leaid", () => {
    setupStore(["aaa", "bbb", "ccc"]);
    render(<SelectionListPanel />);
    expect(screen.getByText("District aaa")).toBeInTheDocument();
    expect(screen.getByText("District bbb")).toBeInTheDocument();
    expect(screen.getByText("District ccc")).toBeInTheDocument();
  });

  it("calls clearSelectedDistricts when Clear all is clicked", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    expect(mockClearSelectedDistricts).toHaveBeenCalledOnce();
  });

  it("calls toggleLeaidSelection with leaid when checkbox row is clicked", () => {
    setupStore(["aaa", "bbb"]);
    render(<SelectionListPanel />);
    // Each row has a deselect button (the checkbox area)
    const deselect = screen.getAllByRole("button", { name: /deselect/i });
    fireEvent.click(deselect[0]);
    expect(mockToggleLeaidSelection).toHaveBeenCalledWith("aaa");
  });

  it("calls selectDistrict with leaid when Explore is clicked", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    fireEvent.click(screen.getByRole("button", { name: /explore district aaa/i }));
    expect(mockSelectDistrict).toHaveBeenCalledWith("aaa");
  });

  it("shows singular 'District Selected' for count of 1", () => {
    setupStore(["aaa"]);
    render(<SelectionListPanel />);
    expect(screen.getByText(/1 District Selected/i)).toBeInTheDocument();
  });
});
