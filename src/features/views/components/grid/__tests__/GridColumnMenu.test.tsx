import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GridColumnMenu, reorderColumns } from "../GridColumnMenu";
import { SOURCE_COLUMNS, getDefaultLayoutColumns } from "@/features/views/lib/columns";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

function emptyLayout(source: "districts" | "contacts" | "opps" | "vacancies" | "news" | "rfps" = "districts"): GridViewLayout {
  return {
    columns: getDefaultLayoutColumns(source),
    sort: [],
    filters: { kind: "and", children: [] },
  };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const gear = screen.getByRole("button", { name: "Columns" });
  await user.click(gear);
}

describe("GridColumnMenu", () => {
  describe("rendering", () => {
    it("gear button renders closed by default", () => {
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      expect(screen.getByRole("button", { name: "Columns" })).toBeTruthy();
      // Popover not yet visible
      expect(screen.queryByText("Reset to defaults")).toBeNull();
    });

    it("clicking gear opens popover with one row per SOURCE_COLUMNS[source] column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const cols = SOURCE_COLUMNS["districts"];
      for (const col of cols) {
        const label = col.group ? `${col.group} ${col.header}` : col.header;
        expect(screen.getByText(label)).toBeTruthy();
      }
    });

    it("each column row has a visibility checkbox", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="contacts"
          layout={emptyLayout("contacts")}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const cols = SOURCE_COLUMNS["contacts"];
      for (const col of cols) {
        expect(screen.getByRole("checkbox", { name: `Show ${col.header}` })).toBeTruthy();
      }
    });

    it("each column row has an up and down arrow button", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const cols = SOURCE_COLUMNS["districts"];
      for (const col of cols) {
        const label = col.group ? `${col.group} ${col.header}` : col.header;
        expect(screen.getByRole("button", { name: `Move ${label} up` })).toBeTruthy();
        expect(screen.getByRole("button", { name: `Move ${label} down` })).toBeTruthy();
      }
    });

    it("renders 'Reset to defaults' button", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);
      expect(screen.getByText("Reset to defaults")).toBeTruthy();
    });

    it("checkboxes reflect defaultVisible for each column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const cols = SOURCE_COLUMNS["districts"];
      for (const col of cols) {
        const label = col.group ? `${col.group} ${col.header}` : col.header;
        const cb = screen.getByRole("checkbox", { name: `Show ${label}` }) as HTMLInputElement;
        expect(cb.checked).toBe(col.defaultVisible);
      }
    });
  });

  describe("visibility toggle", () => {
    it("toggling a visible-by-default column's checkbox calls onChange with visible=false", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      // "District" column is defaultVisible=true, so its checkbox is checked
      const cb = screen.getByRole("checkbox", { name: "Show District" });
      await user.click(cb);

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: GridViewLayout = onChange.mock.calls[0][0];
      const entry = next.columns.find((c) => c.id === "name");
      expect(entry?.visible).toBe(false);
    });

    it("toggling a hidden-by-default column's checkbox calls onChange with visible=true", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      // "Enrollment" column is defaultVisible=false
      const cb = screen.getByRole("checkbox", { name: "Show Enrollment" });
      await user.click(cb);

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: GridViewLayout = onChange.mock.calls[0][0];
      const entry = next.columns.find((c) => c.id === "enrollment");
      expect(entry?.visible).toBe(true);
    });

    it("toggling preserves all other column entries", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const cols = SOURCE_COLUMNS["districts"];

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      await user.click(screen.getByRole("checkbox", { name: "Show State" }));

      const next: GridViewLayout = onChange.mock.calls[0][0];
      // All source columns should be present in next.columns
      expect(next.columns).toHaveLength(cols.length);
    });
  });

  describe("up/down reorder", () => {
    it("clicking ↑ on a column swaps its order with the column above", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      // "State" is at defaultOrder=1; clicking ↑ should swap it with "District" (defaultOrder=0)
      await user.click(screen.getByRole("button", { name: "Move State up" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: GridViewLayout = onChange.mock.calls[0][0];
      const stateEntry = next.columns.find((c) => c.id === "state");
      const nameEntry = next.columns.find((c) => c.id === "name");
      // After swap, "state" should have order 0 and "name" should have order 1
      expect(stateEntry?.order).toBe(0);
      expect(nameEntry?.order).toBe(1);
    });

    it("clicking ↓ on a column swaps its order with the column below", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      // "District" is at defaultOrder=0; clicking ↓ should swap with "State" (defaultOrder=1)
      await user.click(screen.getByRole("button", { name: "Move District down" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: GridViewLayout = onChange.mock.calls[0][0];
      const nameEntry = next.columns.find((c) => c.id === "name");
      const stateEntry = next.columns.find((c) => c.id === "state");
      expect(nameEntry?.order).toBe(1);
      expect(stateEntry?.order).toBe(0);
    });
  });

  describe("edge disabling", () => {
    it("↑ button is disabled for the topmost column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      // "District" is order=0, so it's first — ↑ should be disabled
      const upBtn = screen.getByRole("button", { name: "Move District up" }) as HTMLButtonElement;
      expect(upBtn.disabled).toBe(true);
    });

    it("↓ button is disabled for the bottommost column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      // "Stage" is the last column (defaultOrder=8) for districts
      const cols = SOURCE_COLUMNS["districts"];
      const lastCol = cols.slice().sort((a, b) => a.defaultOrder - b.defaultOrder).at(-1)!;
      const downBtn = screen.getByRole("button", { name: `Move ${lastCol.header} down` }) as HTMLButtonElement;
      expect(downBtn.disabled).toBe(true);
    });

    it("↑ is enabled for a non-first column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      // "State" is order=1 — ↑ should be enabled
      const upBtn = screen.getByRole("button", { name: "Move State up" }) as HTMLButtonElement;
      expect(upBtn.disabled).toBe(false);
    });

    it("↓ is enabled for a non-last column", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      // "District" is order=0 — ↓ should be enabled
      const downBtn = screen.getByRole("button", { name: "Move District down" }) as HTMLButtonElement;
      expect(downBtn.disabled).toBe(false);
    });
  });

  describe("Reset to defaults", () => {
    it("reset emits layout with getDefaultLayoutColumns columns and sort=[]", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      // Start with a modified layout (enrollment visible, custom sort)
      const modifiedLayout: GridViewLayout = {
        columns: [
          ...getDefaultLayoutColumns("districts").map((c) =>
            c.id === "enrollment" ? { ...c, visible: true } : c,
          ),
        ],
        sort: [{ id: "enrollment", dir: "desc" as const }],
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Springfield" },
          ],
        },
      };

      render(
        <GridColumnMenu
          source="districts"
          layout={modifiedLayout}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      await user.click(screen.getByText("Reset to defaults"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const next: GridViewLayout = onChange.mock.calls[0][0];

      // Columns reset to defaults
      const defaultCols = getDefaultLayoutColumns("districts");
      expect(next.columns).toEqual(defaultCols);

      // Sort cleared
      expect(next.sort).toEqual([]);

      // Filters preserved (not cleared)
      expect(next.filters.children).toHaveLength(1);
    });

    it("reset closes the popover", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={onChange}
        />,
      );
      await openMenu(user);

      // Confirm open
      expect(screen.getByText("Reset to defaults")).toBeTruthy();

      await user.click(screen.getByText("Reset to defaults"));

      // Confirm closed
      expect(screen.queryByText("Reset to defaults")).toBeNull();
    });
  });

  describe("outside click", () => {
    it("clicking outside the menu closes it", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <div data-testid="outside">Outside</div>
          <GridColumnMenu
            source="districts"
            layout={emptyLayout()}
            onChange={() => {}}
          />
        </div>,
      );

      await openMenu(user);
      expect(screen.getByText("Reset to defaults")).toBeTruthy();

      await user.click(screen.getByTestId("outside"));
      expect(screen.queryByText("Reset to defaults")).toBeNull();
    });
  });

  describe("drag handle", () => {
    it("renders a drag handle button for each column row", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="districts"
          layout={emptyLayout()}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const handles = screen.getAllByLabelText("Drag to reorder");
      expect(handles.length).toBe(SOURCE_COLUMNS.districts.length);
    });

    it("renders drag handles for contacts source too", async () => {
      const user = userEvent.setup();
      render(
        <GridColumnMenu
          source="contacts"
          layout={emptyLayout("contacts")}
          onChange={() => {}}
        />,
      );
      await openMenu(user);

      const handles = screen.getAllByLabelText("Drag to reorder");
      expect(handles.length).toBe(SOURCE_COLUMNS.contacts.length);
    });
  });

  // ---------------------------------------------------------------------------
  // reorderColumns pure helper tests
  // Preferred strategy: test the exported pure helper directly so we never
  // depend on jsdom DOM rects (which @dnd-kit relies on internally).
  // ---------------------------------------------------------------------------
  describe("reorderColumns (pure helper)", () => {
    it("moves a column from index 1 to index 0", () => {
      const layout = emptyLayout();
      // "state" is defaultOrder=1, "name" is defaultOrder=0
      const next = reorderColumns("districts", layout, "state", "name");
      const stateEntry = next.columns.find((c) => c.id === "state");
      const nameEntry = next.columns.find((c) => c.id === "name");
      expect(stateEntry?.order).toBe(0);
      expect(nameEntry?.order).toBe(1);
    });

    it("moves a column from index 0 to index 1", () => {
      const layout = emptyLayout();
      // drag "name" (order=0) onto "state" (order=1)
      const next = reorderColumns("districts", layout, "name", "state");
      const nameEntry = next.columns.find((c) => c.id === "name");
      const stateEntry = next.columns.find((c) => c.id === "state");
      expect(nameEntry?.order).toBe(1);
      expect(stateEntry?.order).toBe(0);
    });

    it("is a no-op when activeId === overId", () => {
      const layout = emptyLayout();
      const next = reorderColumns("districts", layout, "name", "name");
      // same id: no reorder happens, layout returned as-is (reference equality)
      // The early return `return layout` fires only when active.id === over.id,
      // but the id-equality check here matches on column IDs before that branch.
      // Use deep equality since the function rebuilds but preserves same values.
      expect(next).toStrictEqual(layout);
    });

    it("preserves all columns in the output", () => {
      const layout = emptyLayout();
      const next = reorderColumns("districts", layout, "state", "name");
      expect(next.columns).toHaveLength(SOURCE_COLUMNS.districts.length);
    });

    it("preserves visibility flags after reorder", () => {
      const layout = emptyLayout();
      const next = reorderColumns("districts", layout, "state", "name");
      // Each column's visibility should match the default
      for (const col of SOURCE_COLUMNS.districts) {
        const entry = next.columns.find((c) => c.id === col.id);
        expect(entry?.visible).toBe(col.defaultVisible);
      }
    });

    it("assigns contiguous 0-based order indices after reorder", () => {
      const layout = emptyLayout();
      const next = reorderColumns("districts", layout, "target", "name");
      const orders = next.columns.map((c) => c.order).sort((a, b) => a - b);
      const expected = Array.from({ length: SOURCE_COLUMNS.districts.length }, (_, i) => i);
      expect(orders).toEqual(expected);
    });
  });
});
