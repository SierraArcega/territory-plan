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
  it("modal panel uses max-w-[1076px] instead of fixed w-[1076px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    expect(container.querySelector(".w-\\[1076px\\]")).toBeNull();
    expect(container.querySelector(".max-w-\\[1076px\\]")).not.toBeNull();
  });

  it("modal panel uses max-h-[745px] instead of fixed h-[745px]", () => {
    const { container } = render(
      <DistrictExploreModal leaid="1234567" onClose={vi.fn()} />
    );
    expect(container.querySelector(".h-\\[745px\\]")).toBeNull();
    expect(container.querySelector(".max-h-\\[745px\\]")).not.toBeNull();
  });
});
