"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { ExploreEntity, ExploreFilter, FilterOp } from "@/features/map/lib/store";
import { useTags, useTerritoryPlans, useCompetitorFYs } from "@/lib/api";
import type { ColumnDef } from "./columns/districtColumns";
import { districtColumns, getCompetitorColumns } from "./columns/districtColumns";
import { activityColumns } from "./columns/activityColumns";
import { taskColumns } from "./columns/taskColumns";
import { contactColumns } from "./columns/contactColumns";
import { planColumns } from "./columns/planColumns";

const COLUMNS_BY_ENTITY: Record<ExploreEntity, ColumnDef[]> = {
  districts: districtColumns,
  activities: activityColumns,
  tasks: taskColumns,
  contacts: contactColumns,
  plans: planColumns,
};

// ---- Operator mapping ----

interface OperatorOption {
  op: FilterOp;
  label: string;
  needsValue: boolean; // false for is_empty/is_not_empty
}

const OPERATORS_BY_TYPE: Record<string, OperatorOption[]> = {
  text: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "contains", label: "contains", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  enum: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  number: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "gt", label: "greater than", needsValue: true },
    { op: "lt", label: "less than", needsValue: true },
    { op: "between", label: "between", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  boolean: [
    { op: "is_true", label: "is true", needsValue: false },
    { op: "is_false", label: "is false", needsValue: false },
  ],
  date: [
    { op: "eq", label: "is", needsValue: true },
    { op: "gt", label: "after", needsValue: true },
    { op: "lt", label: "before", needsValue: true },
    { op: "between", label: "between", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  tags: [
    { op: "contains", label: "contains", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  relation: [
    { op: "eq", label: "includes any of", needsValue: true },
    { op: "neq", label: "excludes all of", needsValue: true },
    { op: "is_empty", label: "has none", needsValue: false },
    { op: "is_not_empty", label: "has any", needsValue: false },
  ],
};

function getOperatorLabel(op: FilterOp): string {
  for (const ops of Object.values(OPERATORS_BY_TYPE)) {
    const found = ops.find((o) => o.op === op);
    if (found) return found.label;
  }
  return op;
}

// ---- Props ----

interface ExploreFiltersProps {
  entity: ExploreEntity;
  filters: ExploreFilter[];
  onAddFilter: (filter: ExploreFilter) => void;
  onUpdateFilter: (filterId: string, updates: Partial<ExploreFilter>) => void;
  onRemoveFilter: (filterId: string) => void;
  onClearAll: () => void;
}

// ---- Pill display helpers ----

function getColumnLabel(columns: ColumnDef[], columnKey: string): string {
  const col = columns.find((c) => c.key === columnKey);
  return col?.label ?? columnKey;
}

function formatFilterPill(columns: ColumnDef[], filter: ExploreFilter): string {
  const label = getColumnLabel(columns, filter.column);
  const opLabel = getOperatorLabel(filter.op);

  if (
    filter.op === "is_empty" ||
    filter.op === "is_not_empty" ||
    filter.op === "is_true" ||
    filter.op === "is_false"
  ) {
    return `${label} \u00b7 ${opLabel}`;
  }

  if (filter.op === "between") {
    const [min, max] = filter.value as [number, number];
    return `${label} \u00b7 between \u00b7 ${min.toLocaleString()}\u2013${max.toLocaleString()}`;
  }

  // Multi-select relation values (string[])
  if (Array.isArray(filter.value) && filter.value.every((v) => typeof v === "string")) {
    const names = filter.value as string[];
    const display = names.length <= 2 ? names.join(", ") : `${names[0]} +${names.length - 1} more`;
    return `${label} \u00b7 ${opLabel} \u00b7 ${display}`;
  }

  const displayValue =
    typeof filter.value === "number"
      ? filter.value.toLocaleString()
      : String(filter.value).replace(/_/g, " ");
  return `${label} \u00b7 ${opLabel} \u00b7 ${displayValue}`;
}

// ---- Value Input Components ----

function TextFilterInput({
  operator,
  initialValue,
  onSubmit,
}: {
  operator: OperatorOption;
  initialValue?: string;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const placeholder =
    operator.op === "contains" ? "Contains..." : operator.op === "eq" ? "Equals..." : "Value...";
  return (
    <div className="p-3 space-y-2">
      <input
        autoFocus
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
        }}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
      />
      <button
        disabled={!value.trim()}
        onClick={() => value.trim() && onSubmit(value.trim())}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

function EnumFilterInput({
  enumValues,
  onSubmit,
}: {
  enumValues: string[];
  onSubmit: (value: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = enumValues.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      {enumValues.length > 5 && (
        <div className="px-2 pt-2">
          <input
            autoFocus
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
          />
        </div>
      )}
      <div className="p-2 max-h-48 overflow-y-auto">
        {filtered.map((val) => (
          <button
            key={val}
            onClick={() => onSubmit(val)}
            className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 rounded-md hover:bg-[#C4E7E6]/15 hover:text-[#403770] capitalize transition-colors"
          >
            {val.replace(/_/g, " ")}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
        )}
      </div>
    </div>
  );
}

function NumberFilterInput({
  operator,
  initialValue,
  onSubmit,
}: {
  operator: OperatorOption;
  initialValue?: number | [number, number];
  onSubmit: (value: number | [number, number]) => void;
}) {
  const isBetween = operator.op === "between";
  const initMin =
    isBetween && Array.isArray(initialValue)
      ? String((initialValue as [number, number])[0])
      : !isBetween && typeof initialValue === "number"
        ? String(initialValue)
        : "";
  const initMax =
    isBetween && Array.isArray(initialValue)
      ? String((initialValue as [number, number])[1])
      : "";

  const [value, setValue] = useState(initMin);
  const [max, setMax] = useState(initMax);

  const handleApply = () => {
    if (isBetween) {
      const hasMin = value !== "" && !isNaN(Number(value));
      const hasMax = max !== "" && !isNaN(Number(max));
      if (hasMin && hasMax) {
        onSubmit([Number(value), Number(max)]);
      }
    } else {
      if (value !== "" && !isNaN(Number(value))) {
        onSubmit(Number(value));
      }
    }
  };

  const canApply = isBetween
    ? value !== "" && !isNaN(Number(value)) && max !== "" && !isNaN(Number(max))
    : value !== "" && !isNaN(Number(value));

  return (
    <div className="p-3 space-y-2">
      {isBetween ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="number"
            placeholder="Min"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
          />
          <input
            type="number"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
          />
        </div>
      ) : (
        <input
          autoFocus
          type="number"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
        />
      )}
      <button
        disabled={!canApply}
        onClick={handleApply}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

function DateFilterInput({
  operator,
  initialValue,
  onSubmit,
}: {
  operator: OperatorOption;
  initialValue?: string | [string, string];
  onSubmit: (value: string | [string, string]) => void;
}) {
  const isBetween = operator.op === "between";
  const initStart =
    isBetween && Array.isArray(initialValue)
      ? (initialValue as [string, string])[0]
      : !isBetween && typeof initialValue === "string"
        ? initialValue
        : "";
  const initEnd =
    isBetween && Array.isArray(initialValue)
      ? (initialValue as [string, string])[1]
      : "";

  const [value, setValue] = useState(initStart);
  const [endDate, setEndDate] = useState(initEnd);

  const handleApply = () => {
    if (isBetween) {
      if (value && endDate) onSubmit([value, endDate]);
    } else {
      if (value) onSubmit(value);
    }
  };

  const canApply = isBetween ? !!(value && endDate) : !!value;

  return (
    <div className="p-3 space-y-2">
      {isBetween ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
          />
        </div>
      ) : (
        <input
          autoFocus
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
        />
      )}
      <button
        disabled={!canApply}
        onClick={handleApply}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

// ---- Relation filter (tags / plans dropdown) ----

function RelationFilterInput({
  relationSource,
  initialValue,
  onSubmit,
}: {
  relationSource: "tags" | "plans";
  initialValue?: string[];
  onSubmit: (value: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initialValue || []));
  const { data: tags } = useTags();
  const { data: plans } = useTerritoryPlans();

  const items = relationSource === "tags"
    ? (tags || []).map((t) => ({ id: String(t.id), name: t.name, color: t.color }))
    : (plans || []).map((p) => ({ id: p.id, name: p.name, color: p.color }));

  const filtered = search.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div>
      <div className="px-2 pt-2">
        <input
          autoFocus
          type="text"
          placeholder={`Search ${relationSource}\u2026`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
        />
      </div>
      <div className="p-1.5 max-h-48 overflow-y-auto">
        {filtered.map((item) => {
          const isChecked = selected.has(item.name);
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.name)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] rounded-md transition-colors ${
                isChecked ? "bg-[#C4E7E6]/25 text-[#403770] font-medium" : "text-gray-700 hover:bg-[#C4E7E6]/15 hover:text-[#403770]"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 text-left">{item.name}</span>
              {isChecked && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6L5 9L10 3" />
                </svg>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-3 py-2 text-xs text-gray-400">
            {search.trim() ? "No matches" : `No ${relationSource} found`}
          </p>
        )}
      </div>
      <div className="px-2 pb-2 pt-1 border-t border-gray-100">
        <button
          disabled={selected.size === 0}
          onClick={() => onSubmit(Array.from(selected))}
          className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
        >
          Apply{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>
    </div>
  );
}

// ---- Back Button ----

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-gray-400 hover:text-[#403770] transition-colors"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 3.5L5 7L8.5 10.5" />
      </svg>
    </button>
  );
}

// ---- Main Component ----

type PickerStep = "column" | "operator" | "value";

export default function ExploreFilters({
  entity,
  filters,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  onClearAll,
}: ExploreFiltersProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>("column");
  const [selectedColumn, setSelectedColumn] = useState<ColumnDef | null>(null);
  const [selectedOperator, setSelectedOperator] = useState<OperatorOption | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingFilterId, setEditingFilterId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: competitorFYs } = useCompetitorFYs();

  const columns = useMemo(() => {
    const base = COLUMNS_BY_ENTITY[entity];
    if (entity !== "districts" || !competitorFYs?.length) return base;
    return [...base, ...getCompetitorColumns(competitorFYs)];
  }, [entity, competitorFYs]);

  // Close picker on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
      closePicker();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pickerOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [pickerOpen, handleOutsideClick]);

  // Group columns by group, filtered by search query
  const groupedColumns = columns.reduce<Record<string, ColumnDef[]>>((acc, col) => {
    if (searchQuery && !col.label.toLowerCase().includes(searchQuery.toLowerCase())) {
      return acc;
    }
    if (!acc[col.group]) acc[col.group] = [];
    acc[col.group].push(col);
    return acc;
  }, {});

  const closePicker = () => {
    setPickerOpen(false);
    setStep("column");
    setSelectedColumn(null);
    setSelectedOperator(null);
    setSearchQuery("");
    setEditingFilterId(null);
  };

  const handleSubmitFilter = (op: FilterOp, value: ExploreFilter["value"]) => {
    if (!selectedColumn) return;
    if (editingFilterId) {
      onUpdateFilter(editingFilterId, { column: selectedColumn.key, op, value });
    } else {
      onAddFilter({
        id: crypto.randomUUID(),
        column: selectedColumn.key,
        op,
        value,
      });
    }
    closePicker();
  };

  // Handle operator selection
  const handleSelectOperator = (operator: OperatorOption) => {
    setSelectedOperator(operator);
    if (!operator.needsValue) {
      // Immediately submit for operators that don't need a value
      if (!selectedColumn) return;
      if (editingFilterId) {
        onUpdateFilter(editingFilterId, {
          column: selectedColumn.key,
          op: operator.op,
          value: true,
        });
      } else {
        onAddFilter({
          id: crypto.randomUUID(),
          column: selectedColumn.key,
          op: operator.op,
          value: true,
        });
      }
      closePicker();
    } else {
      setStep("value");
    }
  };

  // Handle column selection
  const handleSelectColumn = (col: ColumnDef) => {
    setSelectedColumn(col);
    setSearchQuery("");
    setStep("operator");
  };

  // Click-to-edit: open picker pre-populated with existing filter
  const handleChipClick = (filter: ExploreFilter) => {
    const col = columns.find((c) => c.key === filter.column);
    if (!col) return;

    setEditingFilterId(filter.id);
    setSelectedColumn(col);
    setPickerOpen(true);

    // Find matching operator
    const operators = OPERATORS_BY_TYPE[col.filterType] || [];
    const matchedOp = operators.find((o) => o.op === filter.op);

    if (matchedOp) {
      setSelectedOperator(matchedOp);
      if (matchedOp.needsValue) {
        setStep("value");
      } else {
        // For no-value operators, show operator picker so user can change
        setStep("operator");
      }
    } else {
      setStep("operator");
    }
  };

  // Get the existing filter value for pre-populating edit mode
  const getEditingFilterValue = (): ExploreFilter["value"] | undefined => {
    if (!editingFilterId) return undefined;
    const filter = filters.find((f) => f.id === editingFilterId);
    return filter?.value;
  };

  // Render the value input based on filter type and selected operator
  const renderValueInput = () => {
    if (!selectedColumn || !selectedOperator) return null;
    const existingValue = getEditingFilterValue();

    switch (selectedColumn.filterType) {
      case "text":
      case "tags":
        return (
          <TextFilterInput
            operator={selectedOperator}
            initialValue={editingFilterId && typeof existingValue === "string" ? existingValue : undefined}
            onSubmit={(val) => handleSubmitFilter(selectedOperator.op, val)}
          />
        );
      case "relation":
        return (
          <RelationFilterInput
            relationSource={selectedColumn.relationSource || "tags"}
            initialValue={editingFilterId && Array.isArray(existingValue) ? existingValue as string[] : undefined}
            onSubmit={(vals) => handleSubmitFilter(selectedOperator.op, vals)}
          />
        );
      case "enum":
        return (
          <EnumFilterInput
            enumValues={selectedColumn.enumValues || []}
            onSubmit={(val) => handleSubmitFilter(selectedOperator.op, val)}
          />
        );
      case "number":
        return (
          <NumberFilterInput
            operator={selectedOperator}
            initialValue={
              editingFilterId
                ? (existingValue as number | [number, number] | undefined)
                : undefined
            }
            onSubmit={(val) => handleSubmitFilter(selectedOperator.op, val)}
          />
        );
      case "date":
        return (
          <DateFilterInput
            operator={selectedOperator}
            initialValue={
              editingFilterId
                ? (existingValue as string | [string, string] | undefined)
                : undefined
            }
            onSubmit={(val) => handleSubmitFilter(selectedOperator.op, val)}
          />
        );
      default:
        return null;
    }
  };

  const operatorsForColumn = selectedColumn
    ? OPERATORS_BY_TYPE[selectedColumn.filterType] || []
    : [];

  return (
    <div className="flex items-center gap-2 flex-wrap min-w-0">
      {/* Active filter pills */}
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#C4E7E6]/30 text-[#403770] rounded-full border border-[#C4E7E6]/50 cursor-pointer hover:bg-[#C4E7E6]/50 transition-colors"
          onClick={() => handleChipClick(filter)}
        >
          {formatFilterPill(columns, filter)}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveFilter(filter.id);
            }}
            className="text-[#403770]/40 hover:text-[#403770] transition-colors"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 3L9 9M9 3L3 9" />
            </svg>
          </button>
        </span>
      ))}

      {/* Add Filter button + picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => {
            if (pickerOpen) {
              closePicker();
            } else {
              setPickerOpen(true);
              setStep("column");
              setSelectedColumn(null);
              setSelectedOperator(null);
              setSearchQuery("");
              setEditingFilterId(null);
            }
          }}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-500 hover:border-[#403770]/20 hover:text-[#403770] hover:bg-[#C4E7E6]/10 transition-all"
        >
          + Add Filter
        </button>

        {pickerOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-30 overflow-hidden">
            {step === "column" && (
              // Step 1: Pick a column (searchable)
              <div>
                <div className="px-2 pt-2">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search attributes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {Object.entries(groupedColumns).map(([group, cols]) => (
                    <div key={group}>
                      <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        {group}
                      </div>
                      {cols.map((col) => (
                        <button
                          key={col.key}
                          onClick={() => handleSelectColumn(col)}
                          className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-[#C4E7E6]/15 hover:text-[#403770] transition-colors"
                        >
                          {col.label}
                        </button>
                      ))}
                    </div>
                  ))}
                  {Object.keys(groupedColumns).length === 0 && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center">
                      No matching attributes
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === "operator" && selectedColumn && (
              // Step 2: Pick an operator
              <div>
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                  <BackButton
                    onClick={() => {
                      setStep("column");
                      setSelectedColumn(null);
                      setSelectedOperator(null);
                      setEditingFilterId(null);
                    }}
                  />
                  <span className="text-xs font-semibold text-[#403770]">
                    {selectedColumn.label}
                  </span>
                </div>
                <div className="border-t border-gray-100">
                  <div className="py-1">
                    {operatorsForColumn.map((op) => (
                      <button
                        key={op.op}
                        onClick={() => handleSelectOperator(op)}
                        className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
                          selectedOperator?.op === op.op
                            ? "bg-[#C4E7E6]/25 text-[#403770] font-medium"
                            : "text-gray-700 hover:bg-[#C4E7E6]/15 hover:text-[#403770]"
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === "value" && selectedColumn && selectedOperator && (
              // Step 3: Enter value
              <div>
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                  <BackButton
                    onClick={() => {
                      setStep("operator");
                      setSelectedOperator(null);
                    }}
                  />
                  <span className="text-xs font-semibold text-[#403770]">
                    {selectedColumn.label}
                    <span className="font-normal text-gray-400">
                      {" \u00b7 "}
                      {selectedOperator.label}
                    </span>
                  </span>
                </div>
                <div className="border-t border-gray-100">
                  {renderValueInput()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear all */}
      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-xs font-medium text-gray-400 hover:text-[#F37167] transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
