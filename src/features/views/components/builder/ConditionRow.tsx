"use client";

/**
 * ConditionRow — a single editable WHERE/AND row inside the conditions editor.
 *
 * Two render modes based on the row's `kind`:
 *   - "rule": three selects (field / op / value) + trash.
 *   - "any":  field select + "is any of" pill + chip-pill bag of values + trash.
 *
 * The chip-pill mode is only produced by the AI list builder's flatten step
 * (OR-of-same-field → `any`). The manual editor cannot promote a row to `any`
 * directly today — instead the user can switch the op to "is any of" /
 * "is not any of" to convert the row.
 *
 * Value widget per FieldDef.type:
 *   - enum / boolean → <select> with enumValues
 *   - integer / decimal → <input type="number">
 *   - date / duration → text fallback (real date pickers ship in Phase F)
 *   - text → <input type="text">
 */
import { Trash2 } from "lucide-react";
import type {
  FilterAny,
  FilterRule,
  FilterLeaf,
  FilterValue,
  SavedListSource,
} from "@/lib/saved-views/filter-tree";
import { SOURCE_FIELDS, type FieldDef } from "@/lib/saved-views/source-fields";
import { changeRowOp, isAnyOp, replaceRowField } from "./builder-utils";

interface ConditionRowProps {
  idx: number;
  row: FilterLeaf;
  source: SavedListSource;
  onReplace: (next: FilterLeaf) => void;
  onDelete: () => void;
}

export default function ConditionRow({
  idx,
  row,
  source,
  onReplace,
  onDelete,
}: ConditionRowProps) {
  const fields = SOURCE_FIELDS[source];
  const field = fields.find((f) => f.id === row.fieldId) ?? fields[0];
  const isAny = row.kind === "any";

  const onFieldChange = (nextFieldId: string) => {
    onReplace(replaceRowField(source, nextFieldId));
  };

  const onOpChange = (nextOp: string) => {
    onReplace(changeRowOp(row, nextOp, field));
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg">
      <span
        className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider w-8 flex-shrink-0 whitespace-nowrap"
        aria-hidden
      >
        {idx === 0 ? "WHERE" : "AND"}
      </span>

      {/* Field select */}
      <RowSelect
        value={field.id}
        onChange={onFieldChange}
        ariaLabel="Field"
        options={fields.map((f) => ({ value: f.id, label: f.label }))}
      />

      {/* Op select */}
      <RowSelect
        value={row.op}
        onChange={onOpChange}
        ariaLabel="Operator"
        options={field.ops.map((o) => ({ value: o, label: o }))}
      />

      {/* Value slot — chip-pills or single value */}
      {isAny ? (
        <ChipValueSlot
          row={row as FilterAny}
          field={field}
          onReplace={onReplace}
        />
      ) : (
        <SingleValueSlot
          row={row as FilterRule}
          field={field}
          onReplace={onReplace}
        />
      )}

      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete condition"
        className="p-1 rounded-md text-[#A69DC0] hover:text-[#F37167] hover:bg-[#FFFCFA] transition-colors duration-100 flex-shrink-0"
      >
        <Trash2 className="w-3 h-3" aria-hidden />
      </button>
    </div>
  );
}

// ── Sub-renderers ─────────────────────────────────────────────────────────

interface RowSelectProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  grow?: boolean;
}

function RowSelect({ value, onChange, ariaLabel, options, grow }: RowSelectProps) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "px-2 py-1 border border-[#D4CFE2] rounded-md bg-white text-[#403770]",
        "text-xs font-medium cursor-pointer outline-none focus:border-[#403770]",
        "min-w-0",
        grow ? "flex-1" : "flex-shrink-0",
      ].join(" ")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SingleValueSlot({
  row,
  field,
  onReplace,
}: {
  row: FilterRule;
  field: FieldDef;
  onReplace: (next: FilterLeaf) => void;
}) {
  const setValue = (next: FilterValue) =>
    onReplace({ ...row, value: next });

  // Enum-backed single-value: render a select with the allowed values.
  if (field.enumValues && field.enumValues.length > 0) {
    return (
      <RowSelect
        value={String(row.value ?? "")}
        onChange={(v) => setValue(v)}
        ariaLabel="Value"
        grow
        options={field.enumValues.map((v) => ({ value: v, label: v }))}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <RowSelect
        value={String(row.value ?? "true")}
        onChange={(v) => setValue(v === "true")}
        ariaLabel="Value"
        grow
        options={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
      />
    );
  }

  if (field.type === "integer" || field.type === "decimal") {
    return (
      <input
        type="number"
        aria-label="Value"
        value={
          row.value == null || row.value === "" ? "" : Number(row.value as number)
        }
        onChange={(e) => {
          const num = e.target.value === "" ? null : Number(e.target.value);
          setValue(num);
        }}
        className="flex-1 min-w-0 px-2 py-1 border border-[#D4CFE2] rounded-md bg-white text-[#403770] text-xs font-medium outline-none focus:border-[#403770] tabular-nums"
      />
    );
  }

  // Text / date / duration — text input fallback. Real date pickers shipped
  // in Phase F; for now the rep can type "30 days" or "2025-05-13".
  return (
    <input
      type="text"
      aria-label="Value"
      value={row.value == null ? "" : String(row.value)}
      onChange={(e) => setValue(e.target.value)}
      placeholder={field.type === "duration" ? "e.g. 30 days" : ""}
      className="flex-1 min-w-0 px-2 py-1 border border-[#D4CFE2] rounded-md bg-white text-[#403770] text-xs font-medium outline-none focus:border-[#403770]"
    />
  );
}

function ChipValueSlot({
  row,
  field,
  onReplace,
}: {
  row: FilterAny;
  field: FieldDef;
  onReplace: (next: FilterLeaf) => void;
}) {
  const removeAt = (idx: number) =>
    onReplace({
      ...row,
      values: row.values.filter((_, i) => i !== idx),
    });

  const addValue = (next: string) => {
    if (!next) return;
    if (row.values.some((v) => String(v) === next)) return;
    onReplace({ ...row, values: [...row.values, next] });
  };

  // The pill bag — values are coerced to strings for display.
  return (
    <div className="flex-1 min-w-0 flex flex-wrap gap-1 px-1.5 py-1 border border-[#D4CFE2] rounded-md bg-white items-center min-h-7">
      {row.values.map((v, vi) => (
        <span
          key={vi}
          className="inline-flex items-center gap-1 px-2 py-px rounded-full bg-[#e8f1f5] text-[11px] font-semibold text-[#4d7285] whitespace-nowrap"
        >
          {String(v)}
          <button
            type="button"
            onClick={() => removeAt(vi)}
            aria-label={`Remove ${String(v)}`}
            className="bg-transparent border-none text-[#4d7285] hover:text-[#322a5a] leading-none text-sm"
          >
            ×
          </button>
        </span>
      ))}
      {/* Inline picker — only when the field has an enum list to offer. */}
      {field.enumValues && field.enumValues.length > 0 && (
        <select
          aria-label="Add value"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) addValue(v);
          }}
          className="bg-transparent text-[11px] text-[#8A80A8] border-none outline-none cursor-pointer min-w-0"
        >
          <option value="">+ add</option>
          {field.enumValues
            .filter((v) => !row.values.some((rv) => String(rv) === v))
            .map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
        </select>
      )}
    </div>
  );
}

// Re-export for the field default helper (covers a common consumer pattern).
export function isAnyOpExport(op: string) {
  return isAnyOp(op);
}
