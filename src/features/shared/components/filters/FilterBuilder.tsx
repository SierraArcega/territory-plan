"use client";

// FilterBuilder — structured filtering with a 3-step popover picker
// (Column → Operator → Value) and robin's-egg active-filter pills.
// Controlled: pass `filters` + `onChange`; evaluate rows with
// buildFilterPredicate from filter-builder-utils. Filters AND together.
// Visuals per the leads design handoff §Filtering: dashed Filter trigger,
// rgba(196,231,230,0.32) pills (click to edit, × to remove), white popover
// radius 12 with popover shadow 0 10px 28px -8px rgba(64,55,112,0.22).

import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  X,
} from "lucide-react";
import { useOutsideClick } from "@/features/shared/lib/use-outside-click";
import {
  OPERATORS_BY_TYPE,
  filterValueLabel,
  operatorLabel,
  operatorNeedsValue,
  type ActiveFilter,
  type FilterBuilderOp,
  type FilterColumn,
} from "./filter-builder-utils";

interface FilterBuilderProps<Row> {
  columns: FilterColumn<Row>[];
  filters: ActiveFilter[];
  onChange: (filters: ActiveFilter[]) => void;
}

type Step = "column" | "operator" | "value";
type Draft = string | [string, string];

let nextFilterId = 1;
function makeFilterId(): string {
  return `f${Date.now()}-${nextFilterId++}`;
}

const INPUT_CLASS =
  "w-full rounded-lg border border-[#C2BBD4] bg-white px-2.5 py-[7px] text-[13px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]";

function ListRow({
  onClick,
  active,
  right,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-[11px] py-2 text-left text-[13px] text-[#403770] ${
        active ? "bg-[#F3F0FB]" : "hover:bg-[#FAF8FC]"
      }`}
    >
      <span className="min-w-0 flex-1 truncate whitespace-nowrap">
        {children}
      </span>
      {right}
    </button>
  );
}

function StepHeader({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[7px] border-b border-[#EFEDF5] bg-[#FAF8FC] px-[11px] py-[9px]">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="flex rounded-md p-0.5 text-[#8A80A8] hover:bg-[#EFEDF5]"
      >
        <ChevronLeft size={15} />
      </button>
      <span className="min-w-0 truncate whitespace-nowrap text-xs font-bold text-[#403770]">
        {children}
      </span>
    </div>
  );
}

function ApplyButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mt-2.5 w-full rounded-lg px-2.5 py-2 text-[12.5px] font-semibold text-white ${
        disabled ? "cursor-not-allowed bg-[#C9C2DE]" : "bg-[#403770] hover:bg-[#322a5a]"
      }`}
    >
      Apply
    </button>
  );
}

// Enum value list — its own component so the search-input hook stays legal.
function EnumValueList<Row>({
  col,
  current,
  onApply,
}: {
  col: FilterColumn<Row>;
  current: string;
  onApply: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const options = (col.options ?? []).filter(
    (o) => !q || o.label.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div>
      {(col.options ?? []).length > 5 && (
        <div className="border-b border-[#EFEDF5] p-[9px]">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className={INPUT_CLASS}
          />
        </div>
      )}
      <div className="max-h-60 overflow-y-auto py-1">
        {options.map((o) => (
          <ListRow
            key={o.value}
            active={current === o.value}
            onClick={() => onApply(o.value)}
            right={
              current === o.value ? (
                <Check size={13} className="text-[#56792F]" />
              ) : null
            }
          >
            {o.label}
          </ListRow>
        ))}
        {!options.length && (
          <div className="px-3 py-3 text-center text-[12.5px] text-[#A69DC0]">
            No values.
          </div>
        )}
      </div>
    </div>
  );
}

function ValueStep<Row>({
  col,
  op,
  draft,
  setDraft,
  onApply,
}: {
  col: FilterColumn<Row>;
  op: FilterBuilderOp;
  draft: Draft;
  setDraft: (d: Draft) => void;
  onApply: (value: Draft) => void;
}) {
  if (col.type === "enum") {
    return (
      <EnumValueList col={col} current={String(draft)} onApply={onApply} />
    );
  }
  if (op === "between") {
    const [lo, hi] = Array.isArray(draft) ? draft : ["", ""];
    const inputType = col.type === "date" ? "date" : "number";
    const incomplete = lo === "" || hi === "";
    return (
      <div className="p-[11px]">
        <div
          className={
            col.type === "date" ? "flex flex-col gap-2" : "flex items-center gap-[7px]"
          }
        >
          <input
            autoFocus
            type={inputType}
            value={lo}
            onChange={(e) => setDraft([e.target.value, hi])}
            placeholder="Min"
            aria-label="From"
            className={INPUT_CLASS}
          />
          {col.type !== "date" && (
            <span className="text-xs text-[#A69DC0]">–</span>
          )}
          <input
            type={inputType}
            value={hi}
            onChange={(e) => setDraft([lo, e.target.value])}
            placeholder="Max"
            aria-label="To"
            className={INPUT_CLASS}
          />
        </div>
        <ApplyButton disabled={incomplete} onClick={() => onApply([lo, hi])} />
      </div>
    );
  }
  const single = Array.isArray(draft) ? "" : draft;
  const inputType =
    col.type === "number" ? "number" : col.type === "date" ? "date" : "text";
  const invalid = col.type === "text" ? !single.trim() : single === "";
  const apply = () => onApply(col.type === "text" ? single.trim() : single);
  return (
    <div className="p-[11px]">
      <input
        autoFocus
        type={inputType}
        value={single}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !invalid) apply();
        }}
        placeholder="Value"
        aria-label="Filter value"
        className={INPUT_CLASS}
      />
      <ApplyButton disabled={invalid} onClick={apply} />
    </div>
  );
}

export default function FilterBuilder<Row>({
  columns,
  filters,
  onChange,
}: FilterBuilderProps<Row>) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("column");
  const [colKey, setColKey] = useState<string | null>(null);
  const [op, setOp] = useState<FilterBuilderOp | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft>("");
  const rootRef = useRef<HTMLDivElement>(null);

  const col = columns.find((c) => c.key === colKey) ?? null;

  const close = useCallback(() => {
    setOpen(false);
    setStep("column");
    setColKey(null);
    setOp(null);
    setEditId(null);
    setSearch("");
    setDraft("");
  }, []);

  useOutsideClick(rootRef, close, open);

  const commit = (committedOp: FilterBuilderOp, value?: Draft) => {
    if (!colKey) return;
    const next: ActiveFilter = {
      id: editId ?? makeFilterId(),
      column: colKey,
      op: committedOp,
      value,
    };
    onChange(
      editId
        ? filters.map((f) => (f.id === editId ? next : f))
        : [...filters, next],
    );
    close();
  };

  const pickColumn = (c: FilterColumn<Row>) => {
    setColKey(c.key);
    setSearch("");
    setStep("operator");
  };

  const pickOperator = (code: FilterBuilderOp) => {
    if (!operatorNeedsValue(code)) {
      commit(code);
      return;
    }
    setOp(code);
    setDraft(code === "between" ? ["", ""] : "");
    setStep("value");
  };

  const editPill = (f: ActiveFilter) => {
    setColKey(f.column);
    setOp(f.op);
    setEditId(f.id);
    setDraft(f.value ?? "");
    setStep(operatorNeedsValue(f.op) ? "value" : "operator");
    setOpen(true);
  };

  const removePill = (id: string) =>
    onChange(filters.filter((f) => f.id !== id));

  const onRootKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      close();
    }
  };

  // Group the searchable column list, preserving column order
  const groups: { name: string; cols: FilterColumn<Row>[] }[] = [];
  for (const c of columns) {
    if (search && !c.label.toLowerCase().includes(search.toLowerCase()))
      continue;
    const name = c.group ?? "Columns";
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, cols: [] };
      groups.push(g);
    }
    g.cols.push(c);
  }

  return (
    <div
      ref={rootRef}
      onKeyDown={onRootKeyDown}
      className="relative flex flex-wrap items-center gap-[7px]"
    >
      {filters.map((f) => {
        const c = columns.find((x) => x.key === f.column);
        if (!c) return null;
        const valueLabel = filterValueLabel(f, c);
        return (
          <span
            key={f.id}
            role="button"
            tabIndex={0}
            aria-label={`Edit filter: ${c.label} ${operatorLabel(c.type, f.op)}${valueLabel ? ` ${valueLabel}` : ""}`}
            onClick={() => editPill(f)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                editPill(f);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-[rgba(196,231,230,0.65)] bg-[rgba(196,231,230,0.32)] py-1 pl-[11px] pr-1.5 text-xs font-semibold text-[#403770] hover:bg-[rgba(196,231,230,0.55)]"
          >
            <span className="whitespace-nowrap text-[#6E6390]">{c.label}</span>
            <span className="whitespace-nowrap font-medium text-[#9E97B8]">
              {operatorLabel(c.type, f.op)}
            </span>
            {valueLabel && (
              <span className="whitespace-nowrap font-bold text-[#403770]">
                {valueLabel}
              </span>
            )}
            <button
              type="button"
              aria-label={`Remove filter: ${c.label}`}
              onClick={(e) => {
                e.stopPropagation();
                removePill(f.id);
              }}
              className="flex rounded-[5px] p-0.5 text-[#403770] opacity-40 hover:opacity-100"
            >
              <X size={12} />
            </button>
          </span>
        );
      })}

      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-dashed px-[11px] py-1.5 text-xs font-semibold text-[#5C5277] ${
          open ? "border-[#403770] bg-[#F3F0FB]" : "border-[#C2BBD4] bg-white hover:bg-[#FAF8FC]"
        }`}
      >
        <FilterIcon size={12} className="text-[#A69DC0]" />
        <span className="whitespace-nowrap">
          {filters.length ? "Add filter" : "Filter"}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-[35] w-[248px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[#D4CFE2] bg-white shadow-[0_10px_28px_-8px_rgba(64,55,112,0.22)]">
          {step === "column" && (
            <div>
              <div className="border-b border-[#EFEDF5] p-[9px]">
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search columns…"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="max-h-[280px] overflow-y-auto py-1">
                {groups.map((g) => (
                  <div key={g.name}>
                    <div className="px-[11px] pb-[3px] pt-[7px] text-[10px] font-bold uppercase tracking-[0.07em] text-[#A69DC0]">
                      {g.name}
                    </div>
                    {g.cols.map((c) => (
                      <ListRow
                        key={c.key}
                        onClick={() => pickColumn(c)}
                        right={
                          <ChevronRight size={13} className="text-[#C2BBD4]" />
                        }
                      >
                        {c.label}
                      </ListRow>
                    ))}
                  </div>
                ))}
                {!groups.length && (
                  <div className="px-3 py-3.5 text-center text-[12.5px] text-[#A69DC0]">
                    No columns match.
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "operator" && col && (
            <div>
              <StepHeader onBack={() => setStep("column")}>
                {col.label}
              </StepHeader>
              <div className="py-1">
                {OPERATORS_BY_TYPE[col.type].map((code) => (
                  <ListRow key={code} onClick={() => pickOperator(code)}>
                    {operatorLabel(col.type, code)}
                  </ListRow>
                ))}
              </div>
            </div>
          )}

          {step === "value" && col && op && (
            <div>
              <StepHeader onBack={() => setStep("operator")}>
                {col.label} · {operatorLabel(col.type, op)}
              </StepHeader>
              <ValueStep
                col={col}
                op={op}
                draft={draft}
                setDraft={setDraft}
                onApply={(value) => commit(op, value)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
