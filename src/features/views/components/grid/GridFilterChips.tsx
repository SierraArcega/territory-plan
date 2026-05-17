"use client";
import { useState } from "react";
import { X, Plus } from "lucide-react";
import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource, FilterNode } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import { FilterFieldPicker } from "./FilterFieldPicker";
import { MultiSelectWidget } from "./widgets/MultiSelectWidget";
import { SelectWidget } from "./widgets/SelectWidget";
import { NumberRangeWidget } from "./widgets/NumberRangeWidget";
import { DateRangeWidget } from "./widgets/DateRangeWidget";
import type { DateRangeValue } from "./widgets/DateRangeWidget";
import { ToggleWidget } from "./widgets/ToggleWidget";
import { TextWidget } from "./widgets/TextWidget";

interface GridFilterChipsProps {
  source: SavedListSource;
  layout: GridViewLayout;
  onChange: (next: GridViewLayout) => void;
}

interface EditState {
  mode: "picker" | "widget";
  column?: ColumnDef;
  /** When editing an existing chip: the index in layout.filters.children */
  chipIndex?: number;
}

// ---------------------------------------------------------------------------
// Schema-safe node builders
//
// FilterRule.value is FilterValue = string | number | boolean | null.
// FilterAny.values is FilterValue[].
// Neither can hold objects (e.g. {min, max}).
//
// For numberRange we emit a FilterAnd with up to 2 FilterRule children.
// For dateRange "between" we emit a FilterAnd with 2 FilterRule children.
// For dateRange "within"/"before" we emit a single FilterRule with a string.
// For multiselect we emit a FilterAny node.
// For select / toggle / text we emit a single FilterRule.
// ---------------------------------------------------------------------------

function buildNumberRangeNode(
  fieldId: string,
  value: { min: number | null; max: number | null },
): FilterNode {
  const children: FilterNode[] = [];
  if (value.min != null) {
    children.push({ kind: "rule", fieldId, op: ">=", value: value.min });
  }
  if (value.max != null) {
    children.push({ kind: "rule", fieldId, op: "<=", value: value.max });
  }
  if (children.length === 1) return children[0];
  if (children.length === 0) {
    // Shouldn't happen (widget requires at least one bound), but emit a harmless rule
    return { kind: "rule", fieldId, op: ">=", value: 0 };
  }
  return { kind: "and", children };
}

function buildDateRangeNode(
  fieldId: string,
  value: DateRangeValue,
): FilterNode {
  if (!value) return { kind: "rule", fieldId, op: "within", value: "30 days" };
  if (value.kind === "within") {
    return { kind: "rule", fieldId, op: "within", value: value.value };
  }
  if (value.kind === "before") {
    return { kind: "rule", fieldId, op: "before", value: value.value };
  }
  // between → AND of two rules
  return {
    kind: "and",
    children: [
      { kind: "rule", fieldId, op: ">=", value: value.from },
      { kind: "rule", fieldId, op: "<=", value: value.to },
    ],
  };
}

// ---------------------------------------------------------------------------
// Chip display helpers
// ---------------------------------------------------------------------------

/**
 * Extract the "field-id token" that identifies a chip in layout.filters.children.
 * Because numberRange and dateRange "between" emit AND sub-nodes, the chip's
 * fieldId lives in the first child rule.
 */
function chipFieldId(node: FilterNode): string | null {
  if (node.kind === "rule" || node.kind === "any") return node.fieldId;
  if (node.kind === "and" && node.children.length > 0) {
    const first = node.children[0];
    if (first.kind === "rule") return first.fieldId;
  }
  return null;
}

/**
 * Reconstruct a display-friendly value from a persisted node so the chip
 * body re-opens the widget with the right state.
 */
function extractChipValue(
  node: FilterNode,
  widgetKind: string | undefined,
): unknown {
  if (node.kind === "any") return node.values;
  if (node.kind === "rule") return node.value;
  if (node.kind === "and") {
    if (widgetKind === "numberRange") {
      // AND of >= and <= rules
      let min: number | null = null;
      let max: number | null = null;
      for (const child of node.children) {
        if (child.kind === "rule") {
          if (child.op === ">=" && typeof child.value === "number") min = child.value;
          if (child.op === "<=" && typeof child.value === "number") max = child.value;
        }
      }
      return { min, max };
    }
    if (widgetKind === "dateRange") {
      // AND of >= and <= rules
      let from = "";
      let to = "";
      for (const child of node.children) {
        if (child.kind === "rule") {
          if (child.op === ">=" && typeof child.value === "string") from = child.value;
          if (child.op === "<=" && typeof child.value === "string") to = child.value;
        }
      }
      return { kind: "between", from, to } satisfies DateRangeValue;
    }
  }
  return null;
}

function formatChipValue(
  node: FilterNode,
  widgetKind: string | undefined,
): string {
  const v = extractChipValue(node, widgetKind);
  if (v == null) return "—";
  if (Array.isArray(v)) {
    if (v.length === 0) return "(none)";
    if (v.length <= 2) return (v as string[]).join(", ");
    return `${v[0]}, ${v[1]} +${v.length - 2}`;
  }
  if (typeof v === "object" && v !== null) {
    if ("min" in v || "max" in v) {
      const { min, max } = v as { min?: number | null; max?: number | null };
      if (min != null && max != null) return `${min}–${max}`;
      if (min != null) return `≥ ${min}`;
      if (max != null) return `≤ ${max}`;
      return "—";
    }
    if ("kind" in v) {
      const o = v as DateRangeValue & object;
      if (o && "kind" in o) {
        if (o.kind === "within") return `Last ${(o as { kind: "within"; value: string }).value}`;
        if (o.kind === "before") return `Before ${(o as { kind: "before"; value: string }).value}`;
        if (o.kind === "between") {
          const b = o as { kind: "between"; from: string; to: string };
          return `${b.from} – ${b.to}`;
        }
      }
    }
    return JSON.stringify(v);
  }
  return String(v);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GridFilterChips({
  source,
  layout,
  onChange,
}: GridFilterChipsProps) {
  const [edit, setEdit] = useState<EditState | null>(null);

  // Build chip array from layout.filters.children
  const chips = layout.filters.children.map((child, i) => {
    const fid = chipFieldId(child);
    const col = fid
      ? SOURCE_COLUMNS[source].find(
          (c) => (c.filterFieldId ?? c.id) === fid,
        )
      : null;
    return { index: i, node: child, column: col ?? null };
  });

  const usedFieldIds = chips
    .map((c) => chipFieldId(c.node))
    .filter((x): x is string => x !== null);

  const removeAt = (i: number) =>
    onChange({
      ...layout,
      filters: {
        ...layout.filters,
        children: layout.filters.children.filter((_, idx) => idx !== i),
      },
    });

  const clearAll = () =>
    onChange({ ...layout, filters: { kind: "and", children: [] } });

  const commit = (
    column: ColumnDef,
    rawValue: unknown,
    chipIndex?: number,
  ) => {
    const fieldId = column.filterFieldId ?? column.id;
    const w = column.filterWidget;

    let node: FilterNode;
    if (w?.kind === "multiselect") {
      node = {
        kind: "any",
        fieldId,
        op: "is any of",
        values: (rawValue as string[]).filter(
          (v): v is string => typeof v === "string",
        ),
      };
    } else if (w?.kind === "numberRange") {
      node = buildNumberRangeNode(
        fieldId,
        (rawValue as { min: number | null; max: number | null }) ?? {
          min: null,
          max: null,
        },
      );
    } else if (w?.kind === "dateRange") {
      node = buildDateRangeNode(fieldId, rawValue as DateRangeValue);
    } else if (w?.kind === "select") {
      node = { kind: "rule", fieldId, op: "is", value: rawValue as string };
    } else if (w?.kind === "toggle") {
      node = { kind: "rule", fieldId, op: "is", value: rawValue as boolean };
    } else {
      // text
      node = {
        kind: "rule",
        fieldId,
        op: "contains",
        value: rawValue as string,
      };
    }

    const nextChildren = [...layout.filters.children];
    if (chipIndex !== undefined) {
      nextChildren[chipIndex] = node;
    } else {
      nextChildren.push(node);
    }
    onChange({ ...layout, filters: { ...layout.filters, children: nextChildren } });
    setEdit(null);
  };

  const renderWidget = (
    column: ColumnDef,
    currentValue: unknown,
    onApply: (v: unknown) => void,
  ) => {
    const w = column.filterWidget;
    if (!w) return null;
    switch (w.kind) {
      case "multiselect":
        return (
          <MultiSelectWidget
            widget={w}
            value={Array.isArray(currentValue) ? (currentValue as string[]) : []}
            onApply={(vals) => onApply(vals)}
            onCancel={() => setEdit(null)}
          />
        );
      case "select":
        return (
          <SelectWidget
            widget={w}
            value={typeof currentValue === "string" ? currentValue : null}
            onApply={(v) => onApply(v)}
            onCancel={() => setEdit(null)}
          />
        );
      case "numberRange":
        return (
          <NumberRangeWidget
            widget={w}
            value={
              (currentValue as { min: number | null; max: number | null }) ?? {
                min: null,
                max: null,
              }
            }
            onApply={(v) => onApply(v)}
            onCancel={() => setEdit(null)}
          />
        );
      case "dateRange":
        return (
          <DateRangeWidget
            widget={w}
            value={(currentValue as DateRangeValue) ?? null}
            onApply={(v) => onApply(v)}
            onCancel={() => setEdit(null)}
          />
        );
      case "toggle":
        return (
          <ToggleWidget
            widget={w}
            value={typeof currentValue === "boolean" ? currentValue : null}
            onApply={(v) => onApply(v)}
            onCancel={() => setEdit(null)}
          />
        );
      case "text":
        return (
          <TextWidget
            widget={w}
            value={typeof currentValue === "string" ? currentValue : null}
            onApply={(v) => onApply(v)}
            onCancel={() => setEdit(null)}
          />
        );
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2">
        {chips.map((c) => {
          const label =
            c.column?.header ??
            chipFieldId(c.node) ??
            "?";
          const widgetKind = c.column?.filterWidget?.kind;

          return (
            <div
              key={c.index}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-2 py-0.5 text-[12px] text-[#403770] whitespace-nowrap"
            >
              <button
                type="button"
                onClick={() =>
                  c.column &&
                  setEdit({
                    mode: "widget",
                    column: c.column,
                    chipIndex: c.index,
                  })
                }
              >
                <span className="font-medium">{label}:</span>{" "}
                <span className="text-[#544A78]">
                  {formatChipValue(c.node, widgetKind)}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={() => removeAt(c.index)}
                className="ml-1 text-[#8A80A8] hover:text-[#403770]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setEdit({ mode: "picker" })}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[#E2DEEC] px-2 py-0.5 text-[12px] text-[#544A78] hover:bg-[#F7F5FA]"
        >
          <Plus className="h-3 w-3" />
          <span className="whitespace-nowrap">Filter</span>
        </button>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="ml-2 shrink-0 whitespace-nowrap text-[11px] text-[#8A80A8] underline hover:text-[#403770]"
          >
            Clear all
          </button>
        )}

      {/* Popover host — rendered outside the overflow-x-auto strip so it
          isn't clipped/forced into a scroll context. */}
      {edit?.mode === "picker" && (
        <div className="absolute left-0 top-full z-10 mt-1">
          <FilterFieldPicker
            source={source}
            usedFieldIds={usedFieldIds}
            onPick={(col) => setEdit({ mode: "widget", column: col })}
            onClose={() => setEdit(null)}
          />
        </div>
      )}
      {edit?.mode === "widget" && edit.column && (
        <div className="absolute left-0 top-full z-10 mt-1">
          {renderWidget(
            edit.column,
            edit.chipIndex !== undefined
              ? extractChipValue(
                  layout.filters.children[edit.chipIndex],
                  edit.column.filterWidget?.kind,
                )
              : undefined,
            (v) => commit(edit.column!, v, edit.chipIndex),
          )}
        </div>
      )}
    </div>
  );
}
