"use client";

import type { IncreaseTargetCategory } from "../lib/types";
import type { LHFFilters, RevenueBand } from "../lib/filters";

interface Facets {
  categoryCounts: Record<IncreaseTargetCategory, number>;
  states: string[];
  products: string[];
}

interface Props {
  filters: LHFFilters;
  facets: Facets;
  onChange: (next: LHFFilters) => void;
}

const CATEGORY_LABELS: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing Renewal",
  fullmind_winback: "Fullmind Winback",
  ek12_winback: "EK12 Winback",
};

const BANDS: { value: RevenueBand; label: string }[] = [
  { value: "lt-50k", label: "< $50K" },
  { value: "50k-250k", label: "$50K – $250K" },
  { value: "250k-1m", label: "$250K – $1M" },
  { value: "1m+", label: "$1M+" },
];

export default function LowHangingFruitFilterRail({ filters, facets, onChange }: Props) {
  const toggleCategory = (c: IncreaseTargetCategory) => {
    const next = filters.categories.includes(c)
      ? filters.categories.filter((x) => x !== c)
      : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  const toggleState = (s: string) => {
    const next = filters.states.includes(s)
      ? filters.states.filter((x) => x !== s)
      : [...filters.states, s];
    onChange({ ...filters, states: next });
  };

  const toggleProduct = (p: string) => {
    const next = filters.products.includes(p)
      ? filters.products.filter((x) => x !== p)
      : [...filters.products, p];
    onChange({ ...filters, products: next });
  };

  const Section = ({
    title,
    active,
    onClear,
    children,
  }: {
    title: string;
    active: number;
    onClear: () => void;
    children: React.ReactNode;
  }) => (
    <fieldset className="border-t border-[#E2DEEC] py-3">
      <legend className="flex items-center justify-between w-full px-3 text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
        <span>
          {title}
          {active > 0 && <span className="ml-1 text-[#403770]">· {active}</span>}
        </span>
        {active > 0 && (
          <button type="button" className="text-[#F37167] hover:underline" onClick={onClear}>
            Clear
          </button>
        )}
      </legend>
      <div className="px-3 space-y-1">{children}</div>
    </fieldset>
  );

  const Checkbox = ({
    checked,
    label,
    onChange: onCheck,
  }: {
    checked: boolean;
    label: string;
    onChange: () => void;
  }) => (
    <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onCheck}
        aria-label={label}
        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <aside className="w-[220px] shrink-0 bg-[#F7F5FA] border-r border-[#E2DEEC] sticky top-0 self-start max-h-screen overflow-y-auto">
      <Section
        title="Category"
        active={filters.categories.length}
        onClear={() => onChange({ ...filters, categories: [] })}
      >
        {(["missing_renewal", "fullmind_winback", "ek12_winback"] as IncreaseTargetCategory[]).map((c) => (
          <Checkbox
            key={c}
            checked={filters.categories.includes(c)}
            label={`${CATEGORY_LABELS[c]} (${facets.categoryCounts[c] ?? 0})`}
            onChange={() => toggleCategory(c)}
          />
        ))}
      </Section>

      <Section
        title="State"
        active={filters.states.length}
        onClear={() => onChange({ ...filters, states: [] })}
      >
        <div className="grid grid-cols-3 gap-1">
          {facets.states.map((s) => (
            <Checkbox
              key={s}
              checked={filters.states.includes(s)}
              label={s}
              onChange={() => toggleState(s)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Product"
        active={filters.products.length}
        onClear={() => onChange({ ...filters, products: [] })}
      >
        {facets.products.map((p) => (
          <Checkbox
            key={p}
            checked={filters.products.includes(p)}
            label={p}
            onChange={() => toggleProduct(p)}
          />
        ))}
      </Section>

      <Section
        title="Revenue band"
        active={filters.revenueBand ? 1 : 0}
        onClear={() => onChange({ ...filters, revenueBand: null })}
      >
        {BANDS.map((b) => (
          <label key={b.value} className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
            <input
              type="radio"
              name="rev-band"
              checked={filters.revenueBand === b.value}
              onChange={() => onChange({ ...filters, revenueBand: b.value })}
              className="w-3.5 h-3.5 border-[#C2BBD4] text-[#403770]"
            />
            <span>{b.label}</span>
          </label>
        ))}
      </Section>

      <Section
        title="Last rep"
        active={filters.lastRep !== "anyone" ? 1 : 0}
        onClear={() => onChange({ ...filters, lastRep: "anyone" })}
      >
        <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.lastRep === "open"}
            onChange={(e) => onChange({ ...filters, lastRep: e.target.checked ? "open" : "anyone" })}
            aria-label="Unassigned / no previous rep"
            className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
          />
          <span>Unassigned / no previous rep</span>
        </label>
      </Section>

      <Section
        title="FY27 signal"
        active={filters.hideWithFy27Target ? 1 : 0}
        onClear={() => onChange({ ...filters, hideWithFy27Target: false })}
      >
        <label className="flex items-center gap-2 text-xs text-[#6E6390] cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hideWithFy27Target}
            onChange={(e) => onChange({ ...filters, hideWithFy27Target: e.target.checked })}
            aria-label="Hide districts with FY27 target set"
            className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
          />
          <span>Hide districts with FY27 target set</span>
        </label>
      </Section>
    </aside>
  );
}
