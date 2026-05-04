import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import DistrictSearchCard from "../DistrictSearchCard";

vi.mock("@/features/map/lib/store", () => ({
  useMapV2Store: (selector: (s: { setHoveredLeaid: () => void }) => unknown) =>
    selector({ setHoveredLeaid: vi.fn() }),
}));

vi.mock("@/features/shared/lib/financial-helpers", () => ({
  getFinancial: () => null,
}));

const district = {
  leaid: "0123456",
  name: "Union County Schools",
  stateAbbrev: "NC",
  countyName: "Union County",
  enrollment: 41497,
  isCustomer: false,
  accountType: "PROSPECT",
  ownerUser: null,
  ellPct: null,
  swdPct: null,
  childrenPovertyPercent: null,
  medianHouseholdIncome: null,
  expenditurePerPupil: 10600,
  urbanCentricLocale: null,
  districtFinancials: [],
  territoryPlans: [],
};

describe("DistrictSearchCard", () => {
  let onToggleSelect: ReturnType<typeof vi.fn>;
  let onExplore: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onToggleSelect = vi.fn();
    onExplore = vi.fn();
  });

  it("clicking the card body calls onExplore, not onToggleSelect", () => {
    const { getByTestId } = render(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByTestId("district-card"));
    expect(onExplore).toHaveBeenCalledWith("0123456");
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("clicking the X button on a selected card calls onToggleSelect, not onExplore", () => {
    const { getByTitle } = render(
      <DistrictSearchCard
        district={district}
        isSelected={true}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByTitle("Remove"));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onExplore).not.toHaveBeenCalled();
  });

  it("clicking the + button on an unselected card calls onToggleSelect, not onExplore", () => {
    const { getByTitle } = render(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByTitle("Add to selection"));
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
    expect(onExplore).not.toHaveBeenCalled();
  });

  it("clicking the Explore button calls onExplore, not onToggleSelect", () => {
    const { getByRole } = render(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    fireEvent.click(getByRole("button", { name: /explore/i }));
    expect(onExplore).toHaveBeenCalledWith("0123456");
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it("shows Remove title when selected and Add to selection title when not selected", () => {
    const { getByTitle, rerender } = render(
      <DistrictSearchCard
        district={district}
        isSelected={true}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    expect(getByTitle("Remove")).toBeTruthy();
    rerender(
      <DistrictSearchCard
        district={district}
        isSelected={false}
        onToggleSelect={onToggleSelect}
        onExplore={onExplore}
        activeFilters={[]}
      />
    );
    expect(getByTitle("Add to selection")).toBeTruthy();
  });
});
