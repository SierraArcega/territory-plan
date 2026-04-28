import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ColdDistrictRow, { type ColdDistrict } from "../ColdDistrictRow";

function cold(overrides: Partial<ColdDistrict> = {}): ColdDistrict {
  return {
    leaid: "0900330",
    districtName: "Hartford Public Schools",
    daysSinceActivity: 25,
    amount: 240000,
    stage: "Customer",
    mine: true,
    ...overrides,
  };
}

describe("ColdDistrictRow", () => {
  it("renders district name + days since activity, with a Snowflake icon present", () => {
    const { container } = render(<ColdDistrictRow district={cold()} />);
    expect(
      screen.getByText("Hartford Public Schools")
    ).toBeInTheDocument();
    expect(screen.getByText(/25 days no touch/i)).toBeInTheDocument();
    // Snowflake icon — lucide renders an svg with `lucide-snowflake` class
    const svg = container.querySelector("svg.lucide-snowflake");
    expect(svg).toBeTruthy();
  });
});
