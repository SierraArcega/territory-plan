import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GridSortChips } from "../GridSortChips";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

function emptyLayout(): GridViewLayout {
  return {
    columns: [],
    sort: [],
    filters: { kind: "and", children: [] },
    groupBy: null,
  };
}

describe("GridSortChips", () => {
  it("clicking + Sort opens the SortFieldPicker", async () => {
    const user = userEvent.setup();
    render(
      <GridSortChips
        source="districts"
        layout={emptyLayout()}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByText("Add sort")).toBeNull();

    await user.click(screen.getByText("Sort"));
    expect(screen.getByText("Add sort")).toBeTruthy();
  });

  it("picking a field adds a chip in asc direction", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GridSortChips
        source="districts"
        layout={emptyLayout()}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("Sort"));

    const pickerBtns = screen.getAllByText("District");
    const pickerBtn = pickerBtns.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    await user.click(pickerBtn);

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(1);
    expect(next.sort[0]).toEqual({ id: "name", dir: "asc" });
  });

  it("clicking chip body flips direction asc → desc", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      sort: [{ id: "name", dir: "asc" }],
    };
    render(
      <GridSortChips
        source="districts"
        layout={layout}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Toggle District direction"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort[0]).toEqual({ id: "name", dir: "desc" });
  });

  it("X removes a chip from the sort stack", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      sort: [
        { id: "name", dir: "asc" },
        { id: "state", dir: "desc" },
      ],
    };
    render(
      <GridSortChips
        source="districts"
        layout={layout}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByLabelText("Remove sort State"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(1);
    expect(next.sort[0].id).toBe("name");
  });

  it("picker disables fields already in the sort stack", async () => {
    const user = userEvent.setup();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      sort: [{ id: "name", dir: "asc" }],
    };
    render(
      <GridSortChips
        source="districts"
        layout={layout}
        onChange={() => {}}
      />,
    );

    await user.click(screen.getByText("Sort"));

    const pickerBtns = screen.getAllByText("District");
    const pickerBtn = pickerBtns.find((el) => el.tagName === "BUTTON") as HTMLButtonElement;
    expect(pickerBtn.disabled).toBe(true);
  });

  it("Clear all empties the sort stack when 2+ sorts", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const layout: GridViewLayout = {
      ...emptyLayout(),
      sort: [
        { id: "name", dir: "asc" },
        { id: "state", dir: "desc" },
      ],
    };
    render(
      <GridSortChips
        source="districts"
        layout={layout}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByText("Clear all"));

    expect(onChange).toHaveBeenCalledOnce();
    const next = onChange.mock.calls[0][0] as GridViewLayout;
    expect(next.sort).toHaveLength(0);
  });

  it("Clear all is hidden when fewer than 2 sorts", () => {
    const layout: GridViewLayout = {
      ...emptyLayout(),
      sort: [{ id: "name", dir: "asc" }],
    };
    render(
      <GridSortChips
        source="districts"
        layout={layout}
        onChange={() => {}}
      />,
    );

    expect(screen.queryByText("Clear all")).toBeNull();
  });
});
