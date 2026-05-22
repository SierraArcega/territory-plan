import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GridGroupChip } from "../GridGroupChip";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

function emptyLayout(): GridViewLayout {
  return {
    columns: [],
    sort: [],
    filters: { kind: "and", children: [] },
    groupBy: null,
  };
}

describe("GridGroupChip", () => {
  it("clicking + Group opens the GroupFieldPicker", async () => {
    const user = userEvent.setup();
    render(
      <GridGroupChip
        source="districts"
        layout={emptyLayout()}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByText("Group by")).toBeNull();

    await user.click(screen.getByText("Group"));
    expect(screen.getByText("Group by")).toBeTruthy();
  });

  it("picking a field sets layout.groupBy and chip appears", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GridGroupChip
        source="districts"
        layout={emptyLayout()}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("Group"));

    const stateBtns = screen.getAllByText("State");
    const pickerBtn = stateBtns.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    await user.click(pickerBtn);

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.groupBy).toEqual({ id: "state" });
  });

  it("picking a different field replaces the existing groupBy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };
    render(
      <GridGroupChip
        source="districts"
        layout={layout}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Change group field"));

    const customerBtns = screen.getAllByText("Customer");
    const pickerBtn = customerBtns.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    await user.click(pickerBtn);

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.groupBy).toEqual({ id: "is_customer" });
  });

  it("X clears the groupBy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };
    render(
      <GridGroupChip
        source="districts"
        layout={layout}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Remove group"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.groupBy).toBeNull();
  });

  it("picker disables the currently grouped field", async () => {
    const user = userEvent.setup();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      groupBy: { id: "state" },
    };
    render(
      <GridGroupChip
        source="districts"
        layout={layout}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByLabelText("Change group field"));

    const stateBtns = screen.getAllByText("State");
    const pickerBtn = stateBtns.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    expect(pickerBtn.disabled).toBe(true);
  });

  // Regression: the picker must portal out of the chip wrapper so the strip's
  // overflow-x-auto (which forces overflow-y:auto) can't clip it.
  it("portals the picker out of the chip wrapper so it can't be clipped", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <GridGroupChip
        source="districts"
        layout={emptyLayout()}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByText("Group"));

    const panel = screen.getByText("Group by");
    expect(container.contains(panel)).toBe(false);
  });

});
