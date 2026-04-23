import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DistrictCard from "../DistrictCard";
import { useMapV2Store } from "@/features/map/lib/store";

// ── Mock the data hook ───────────────────────────────────────────────────────
// We return a minimally-realistic DistrictDetail shape. The rollup strip reads
// isRollup, childLeaids, and schoolCount off data.district.
let mockDistrict: {
  name: string;
  stateAbbrev: string;
  accountType: string;
  isRollup: boolean;
  childLeaids: string[];
  schoolCount: number;
} = {
  name: "New York City Department Of Education",
  stateAbbrev: "NY",
  accountType: "district",
  isRollup: true,
  childLeaids: Array.from({ length: 309 }, (_, i) => `child-${i}`),
  schoolCount: 1491,
};

vi.mock("@/lib/api", () => ({
  useDistrictDetail: () => ({
    data: {
      district: mockDistrict,
      contacts: [],
      fullmindData: null,
      tags: [],
      trends: null,
      edits: null,
      territoryPlanIds: [],
      educationData: null,
      enrollmentDemographics: null,
    },
    isLoading: false,
    error: null,
  }),
  useRemoveDistrictFromPlan: () => ({ mutate: vi.fn(), isPending: false }),
}));

// Stub heavy child components so this test stays focused on the rollup strip.
vi.mock("../../panels/district/DistrictHeader", () => ({
  default: () => <div data-testid="district-header" />,
}));
vi.mock("../../panels/district/tabs/DistrictTabStrip", () => ({
  default: () => <div data-testid="district-tab-strip" />,
}));
vi.mock("../../panels/district/tabs/PlanningTab", () => ({
  default: () => <div data-testid="planning-tab" />,
}));
vi.mock("../../panels/district/tabs/SignalsTab", () => ({
  default: () => <div data-testid="signals-tab" />,
}));
vi.mock("../../panels/district/tabs/SchoolsTab", () => ({
  default: () => <div data-testid="schools-tab" />,
}));
vi.mock("../../panels/district/ContactsTab", () => ({
  default: () => <div data-testid="contacts-tab" />,
}));
vi.mock("@/features/activities/components/ActivityTimeline", () => ({
  default: () => <div data-testid="activity-timeline" />,
}));

describe("DistrictCard — rollup strip", () => {
  it("renders 'N child districts' header for a rollup with real count", () => {
    mockDistrict = {
      name: "New York City Department Of Education",
      stateAbbrev: "NY",
      accountType: "district",
      isRollup: true,
      childLeaids: Array.from({ length: 309 }, (_, i) => `child-${i}`),
      schoolCount: 1491,
    };
    render(<DistrictCard leaid="3620580" />);
    expect(screen.getByText(/309 child districts/i)).toBeInTheDocument();
    expect(screen.getByText(/1,491 schools/i)).toBeInTheDocument();
  });

  it("'Select all 309' button dispatches selectDistricts with all child leaids", () => {
    mockDistrict = {
      name: "New York City Department Of Education",
      stateAbbrev: "NY",
      accountType: "district",
      isRollup: true,
      childLeaids: Array.from({ length: 309 }, (_, i) => `child-${i}`),
      schoolCount: 1491,
    };
    const spy = vi.spyOn(useMapV2Store.getState(), "selectDistricts");
    render(<DistrictCard leaid="3620580" />);
    fireEvent.click(screen.getByRole("button", { name: /select all 309/i }));
    expect(spy).toHaveBeenCalledWith(
      Array.from({ length: 309 }, (_, i) => `child-${i}`)
    );
    spy.mockRestore();
  });

  it("does not render the strip for non-rollup districts", () => {
    mockDistrict = {
      name: "Regular District",
      stateAbbrev: "MN",
      accountType: "district",
      isRollup: false,
      childLeaids: [],
      schoolCount: 0,
    };
    render(<DistrictCard leaid="2700001" />);
    expect(screen.queryByText(/child districts/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /select all/i })).not.toBeInTheDocument();
  });
});
