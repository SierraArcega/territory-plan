import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ViewTabsStrip from "../ViewTabsStrip";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/views/plans/p1/table",
  useSearchParams: () => new URLSearchParams(),
}));

describe("ViewTabsStrip", () => {
  it("renders all 6 view-type tabs", () => {
    const { container } = render(
      <ViewTabsStrip kind="plan" groupId="p1" activeViewId="table" />,
    );
    // 6 view tabs + 1 "+ View" affordance = 7 buttons
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(7);
  });

  it("shows one Signals tab and none of the legacy Vacancies/News/RFPs tabs", () => {
    const { getByText, queryByText } = render(
      <ViewTabsStrip kind="plan" groupId="p1" activeViewId="map" />,
    );
    expect(getByText("Signals")).toBeTruthy();
    expect(queryByText("Vacancies")).toBeNull();
    expect(queryByText("News")).toBeNull();
    expect(queryByText("RFPs")).toBeNull();
  });

  it("marks the active tab with aria-current=page", () => {
    const { getByRole } = render(
      <ViewTabsStrip kind="plan" groupId="p1" activeViewId="contacts" />,
    );
    const active = getByRole("button", { current: "page" });
    expect(active.textContent).toMatch(/contacts/i);
  });

  it("renders the + View affordance", () => {
    const { getByLabelText } = render(
      <ViewTabsStrip kind="list" groupId="l1" activeViewId="map" />,
    );
    expect(getByLabelText(/add custom view/i)).toBeTruthy();
  });
});
