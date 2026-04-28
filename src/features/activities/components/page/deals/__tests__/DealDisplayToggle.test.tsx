import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import DealDisplayToggle from "../DealDisplayToggle";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

describe("DealDisplayToggle", () => {
  beforeEach(() => {
    // Reset to default before each test
    useActivitiesChrome.setState({ dealDisplay: "overlay" });
  });

  it("clicking 'As objects' calls setDealDisplay('objects')", () => {
    render(<DealDisplayToggle />);
    fireEvent.click(screen.getByRole("button", { name: /as objects/i }));
    expect(useActivitiesChrome.getState().dealDisplay).toBe("objects");
  });
});
