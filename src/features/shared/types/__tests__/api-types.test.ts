import { describe, it, expectTypeOf } from "vitest";
import type { ServiceTypeRevenue, DistrictPacing } from "../api-types";

describe("ServiceTypeRevenue type", () => {
  it("has serviceType and revenue fields", () => {
    expectTypeOf<ServiceTypeRevenue>().toEqualTypeOf<{
      serviceType: string;
      revenue: number;
    }>();
  });

  it("DistrictPacing includes serviceTypeRevenue array", () => {
    expectTypeOf<DistrictPacing["serviceTypeRevenue"]>().toEqualTypeOf<
      ServiceTypeRevenue[] | undefined
    >();
  });
});
