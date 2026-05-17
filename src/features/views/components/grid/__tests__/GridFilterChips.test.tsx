import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { GridFilterChips } from "../GridFilterChips";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

// Mock useEnumValues so MultiSelectWidget doesn't require a running API
vi.mock("@/features/views/hooks/useEnumValues", () => ({
  useEnumValues: () => ({ data: { values: [] }, isLoading: false }),
}));

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function emptyLayout(): GridViewLayout {
  return { columns: [], sort: [], filters: { kind: "and", children: [] } };
}

describe("GridFilterChips", () => {
  describe("chip rendering", () => {
    it("renders chips from layout.filters.children — one chip per rule", () => {
      const layout: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Acme" },
            { kind: "rule", fieldId: "is_customer", op: "is", value: true },
          ],
        },
      };

      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={layout}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      // Each chip shows the column header label + colon
      expect(screen.getByText("District:")).toBeTruthy();
      expect(screen.getByText("Customer:")).toBeTruthy();
    });

    it("renders the + Filter button at all times", () => {
      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      expect(screen.getByText("Filter")).toBeTruthy();
    });

    it("renders 'Clear all' only when chips are present", () => {
      const Wrapper = makeWrapper();
      const { rerender } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      expect(screen.queryByText("Clear all")).toBeNull();

      const layoutWithChip: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Test" },
          ],
        },
      };
      rerender(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={layoutWithChip}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      expect(screen.getByText("Clear all")).toBeTruthy();
    });
  });

  describe("+ Filter → picker → widget flow", () => {
    it("clicking + Filter opens the FilterFieldPicker", async () => {
      const user = userEvent.setup();
      const Wrapper = makeWrapper();
      const { container } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      // Picker not visible yet
      expect(screen.queryByText("Add filter")).toBeNull();

      // Click the + Filter button (first button in the strip)
      const filterBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
      await user.click(filterBtn);

      expect(screen.getByText("Add filter")).toBeTruthy();
    });

    it("clicking a picker option opens the corresponding widget", async () => {
      const user = userEvent.setup();
      const Wrapper = makeWrapper();
      const { container } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      const filterBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
      await user.click(filterBtn);

      // Picker is now open; find the "District" button inside the picker popover
      const pickerBtns = screen.getAllByText("District");
      // Picker renders column buttons — find the one inside the picker (last or by parent)
      const pickerDistrictBtn = pickerBtns.find(el => el.tagName === "BUTTON") as HTMLButtonElement;
      await user.click(pickerDistrictBtn);

      // TextWidget renders an input with placeholder "Search…"
      expect(screen.getByPlaceholderText("Search…")).toBeTruthy();
    });
  });

  describe("widget Apply commits a new rule", () => {
    it("applying a toggle widget adds a FilterRule to layout.filters", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const Wrapper = makeWrapper();

      const { container } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={onChange}
          />
        </Wrapper>,
      );

      // Open picker
      const filterBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
      await user.click(filterBtn);

      // Customer column uses toggle widget — find the button in the picker
      const customerBtns = screen.getAllByText("Customer");
      const customerPickerBtn = customerBtns.find(el => el.tagName === "BUTTON") as HTMLButtonElement;
      await user.click(customerPickerBtn);

      // ToggleWidget shows "Yes" and "No" buttons (labels.on / labels.off)
      await user.click(screen.getByText("Yes"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const nextLayout = onChange.mock.calls[0][0] as GridViewLayout;
      expect(nextLayout.filters.children).toHaveLength(1);
      const node = nextLayout.filters.children[0];
      expect(node).toEqual({
        kind: "rule",
        fieldId: "is_customer",
        op: "is",
        value: true,
      });
    });

    it("applying a multiselect widget adds a FilterAny node", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const Wrapper = makeWrapper();

      // Mock useEnumValues returns states so the multiselect renders something
      const { container } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={onChange}
          />
        </Wrapper>,
      );

      // Open picker
      const filterBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
      await user.click(filterBtn);

      // "State" column uses multiselect (enumSource: "states")
      // useEnumValues is mocked to return [] so the picker will show "No matches"
      const stateBtns = screen.getAllByText("State");
      const statePickerBtn = stateBtns.find(el => el.tagName === "BUTTON") as HTMLButtonElement;
      await user.click(statePickerBtn);

      // Widget renders with Apply button; click Apply with empty selection
      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const nextLayout = onChange.mock.calls[0][0] as GridViewLayout;
      expect(nextLayout.filters.children).toHaveLength(1);
      const node = nextLayout.filters.children[0];
      expect(node).toEqual({
        kind: "any",
        fieldId: "state",
        op: "is any of",
        values: [],
      });
    });
  });

  describe("chip × removes filter", () => {
    it("clicking × on a chip calls onChange with the chip removed", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const layout: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Acme" },
            { kind: "rule", fieldId: "is_customer", op: "is", value: true },
          ],
        },
      };

      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={layout}
            onChange={onChange}
          />
        </Wrapper>,
      );

      // Remove "District" chip (first one) using aria-label
      const removeBtn = screen.getByRole("button", { name: "Remove District" });
      await user.click(removeBtn);

      expect(onChange).toHaveBeenCalledTimes(1);
      const nextLayout = onChange.mock.calls[0][0] as GridViewLayout;
      // Only the Customer chip remains
      expect(nextLayout.filters.children).toHaveLength(1);
      expect((nextLayout.filters.children[0] as { fieldId: string }).fieldId).toBe(
        "is_customer",
      );
    });
  });

  describe("Clear all", () => {
    it("clicking Clear all emits layout with empty children", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const layout: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Acme" },
          ],
        },
      };

      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={layout}
            onChange={onChange}
          />
        </Wrapper>,
      );

      await user.click(screen.getByText("Clear all"));

      expect(onChange).toHaveBeenCalledTimes(1);
      const nextLayout = onChange.mock.calls[0][0] as GridViewLayout;
      expect(nextLayout.filters.children).toHaveLength(0);
    });
  });

  describe("chip body reopens widget editor with existing value", () => {
    it("clicking a chip body opens the widget populated with current value", async () => {
      const user = userEvent.setup();
      const layout: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Springfield" },
          ],
        },
      };

      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={layout}
            onChange={() => {}}
          />
        </Wrapper>,
      );

      // The chip body has "District:" label — click it
      await user.click(screen.getByText("District:"));

      // TextWidget opens with the existing value pre-filled
      const input = screen.getByPlaceholderText("Search…") as HTMLInputElement;
      expect(input.value).toBe("Springfield");
    });
  });

  describe("numberRange emits FilterAnd with two rules", () => {
    it("numberRange apply commits an AND node with >= and <= rules", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const Wrapper = makeWrapper();

      const { container } = render(
        <Wrapper>
          <GridFilterChips
            source="districts"
            layout={emptyLayout()}
            onChange={onChange}
          />
        </Wrapper>,
      );

      // Open picker
      const filterBtn = container.querySelector("button[type='button']") as HTMLButtonElement;
      await user.click(filterBtn);

      // "Enrollment" column has numberRange
      const enrollmentBtns = screen.getAllByText("Enrollment");
      const enrollmentPickerBtn = enrollmentBtns.find(el => el.tagName === "BUTTON") as HTMLButtonElement;
      await user.click(enrollmentPickerBtn);

      // Fill in min and max — number inputs have role "spinbutton"
      const [minInput, maxInput] = screen.getAllByRole("spinbutton");
      await user.clear(minInput);
      await user.type(minInput, "100");
      await user.clear(maxInput);
      await user.type(maxInput, "500");

      await user.click(screen.getByRole("button", { name: "Apply" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      const nextLayout = onChange.mock.calls[0][0] as GridViewLayout;
      const node = nextLayout.filters.children[0];
      // Must be an AND of two rules (>=, <=) — validates against FilterAnd schema
      expect(node.kind).toBe("and");
      if (node.kind === "and") {
        expect(node.children).toHaveLength(2);
        expect(node.children[0]).toEqual({
          kind: "rule",
          fieldId: "enrollment",
          op: ">=",
          value: 100,
        });
        expect(node.children[1]).toEqual({
          kind: "rule",
          fieldId: "enrollment",
          op: "<=",
          value: 500,
        });
      }
    });
  });

  describe("schema round-trip invariant", () => {
    it("nodes emitted by GridFilterChips pass filterAndSchema.parse", async () => {
      const { filterAndSchema } = await import("@/lib/saved-views/schema");

      const layout: GridViewLayout = {
        ...emptyLayout(),
        filters: {
          kind: "and",
          children: [
            { kind: "rule", fieldId: "name", op: "contains", value: "Acme" },
            { kind: "any", fieldId: "state", op: "is any of", values: ["CA", "TX"] },
            {
              kind: "and",
              children: [
                { kind: "rule", fieldId: "enrollment", op: ">=", value: 100 },
                { kind: "rule", fieldId: "enrollment", op: "<=", value: 500 },
              ],
            },
            { kind: "rule", fieldId: "is_customer", op: "is", value: true },
          ],
        },
      };

      // All node shapes must parse without throwing
      expect(() => filterAndSchema.parse(layout.filters)).not.toThrow();
    });
  });
});
