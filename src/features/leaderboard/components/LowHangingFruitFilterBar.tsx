"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { IncreaseTargetCategory } from "../lib/types";
import type { LHFFilters, RevenueBand } from "../lib/filters";
import { DEFAULT_FILTERS } from "../lib/filters";

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

function useOutsideClick<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside, enabled]);
}

interface DropdownProps {
  label: string;
  activeCount: number;
  children: (close: () => void) => React.ReactNode;
  width?: number;
}

function Dropdown({ label, activeCount, children, width = 240 }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClick(wrapRef, () => setOpen(false), open);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
          activeCount > 0
            ? "bg-[#EFEDF5] border-[#403770] text-[#403770]"
            : "bg-white border-[#D4CFE2] text-[#6E6390] hover:border-[#C2BBD4]"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-[#403770]">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute z-30 mt-1 left-0 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden"
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

interface CheckOptionProps {
  checked: boolean;
  label: string;
  suffix?: string;
  onChange: () => void;
}

function CheckOption({ checked, label, suffix, onChange }: CheckOptionProps) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#403770] cursor-pointer hover:bg-[#F7F5FA]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
      />
      <span className="flex-1">{label}</span>
      {suffix && <span className="text-[#8A80A8]">{suffix}</span>}
    </label>
  );
}

function RadioOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#403770] cursor-pointer hover:bg-[#F7F5FA]">
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className="w-3.5 h-3.5 border-[#C2BBD4] text-[#403770]"
      />
      <span>{label}</span>
    </label>
  );
}

export default function LowHangingFruitFilterBar({ filters, facets, onChange }: Props) {
  const [stateQuery, setStateQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");

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

  const anyActive =
    filters.categories.length > 0 ||
    filters.states.length > 0 ||
    filters.products.length > 0 ||
    filters.revenueBand !== null ||
    filters.lastRep !== "anyone" ||
    filters.hideWithFy27Target;

  const filteredStates = stateQuery
    ? facets.states.filter((s) => s.toLowerCase().includes(stateQuery.toLowerCase()))
    : facets.states;

  const filteredProducts = productQuery
    ? facets.products.filter((p) => p.toLowerCase().includes(productQuery.toLowerCase()))
    : facets.products;

  return (
    <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-6 py-3 border-b border-[#E2DEEC] bg-white">
      <span className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mr-1">
        Filters
      </span>

      {/* Category */}
      <Dropdown label="Category" activeCount={filters.categories.length} width={240}>
        {() => (
          <div className="py-1.5">
            {(["missing_renewal", "fullmind_winback", "ek12_winback"] as IncreaseTargetCategory[]).map((c) => (
              <CheckOption
                key={c}
                checked={filters.categories.includes(c)}
                label={CATEGORY_LABELS[c]}
                suffix={String(facets.categoryCounts[c] ?? 0)}
                onChange={() => toggleCategory(c)}
              />
            ))}
          </div>
        )}
      </Dropdown>

      {/* State */}
      <Dropdown label="State" activeCount={filters.states.length} width={260}>
        {() => (
          <>
            <div className="p-2 border-b border-[#E2DEEC]">
              <input
                type="text"
                value={stateQuery}
                onChange={(e) => setStateQuery(e.target.value)}
                placeholder="Search states…"
                className="w-full px-2 py-1 text-xs border border-[#C2BBD4] rounded text-[#403770]"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1.5">
              {filteredStates.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#A69DC0]">No matches</div>
              ) : (
                filteredStates.map((s) => (
                  <CheckOption
                    key={s}
                    checked={filters.states.includes(s)}
                    label={s}
                    onChange={() => toggleState(s)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </Dropdown>

      {/* Product */}
      <Dropdown label="Product" activeCount={filters.products.length} width={260}>
        {() => (
          <>
            <div className="p-2 border-b border-[#E2DEEC]">
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full px-2 py-1 text-xs border border-[#C2BBD4] rounded text-[#403770]"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1.5">
              {filteredProducts.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#A69DC0]">No matches</div>
              ) : (
                filteredProducts.map((p) => (
                  <CheckOption
                    key={p}
                    checked={filters.products.includes(p)}
                    label={p}
                    onChange={() => toggleProduct(p)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </Dropdown>

      {/* Revenue band */}
      <Dropdown label="Revenue" activeCount={filters.revenueBand ? 1 : 0} width={200}>
        {(close) => (
          <div className="py-1.5">
            <RadioOption
              checked={filters.revenueBand === null}
              label="Any"
              onChange={() => {
                onChange({ ...filters, revenueBand: null });
                close();
              }}
            />
            {BANDS.map((b) => (
              <RadioOption
                key={b.value}
                checked={filters.revenueBand === b.value}
                label={b.label}
                onChange={() => {
                  onChange({ ...filters, revenueBand: b.value });
                  close();
                }}
              />
            ))}
          </div>
        )}
      </Dropdown>

      {/* Last rep */}
      <Dropdown label="Last Rep" activeCount={filters.lastRep !== "anyone" ? 1 : 0} width={220}>
        {(close) => (
          <div className="py-1.5">
            <RadioOption
              checked={filters.lastRep === "anyone"}
              label="Anyone"
              onChange={() => {
                onChange({ ...filters, lastRep: "anyone" });
                close();
              }}
            />
            <RadioOption
              checked={filters.lastRep === "open"}
              label="Unassigned / no previous rep"
              onChange={() => {
                onChange({ ...filters, lastRep: "open" });
                close();
              }}
            />
          </div>
        )}
      </Dropdown>

      {/* FY27 toggle — inline */}
      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border border-[#D4CFE2] text-[#6E6390] cursor-pointer hover:border-[#C2BBD4]">
        <input
          type="checkbox"
          checked={filters.hideWithFy27Target}
          onChange={(e) => onChange({ ...filters, hideWithFy27Target: e.target.checked })}
          aria-label="Hide districts with FY27 target set"
          className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770]"
        />
        <span>Hide districts with FY27 target</span>
      </label>

      {anyActive && (
        <button
          type="button"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-[#F37167] hover:bg-[#FEF2F1] rounded-md ml-1"
        >
          <X className="w-3 h-3" />
          Clear all
        </button>
      )}
    </div>
  );
}
