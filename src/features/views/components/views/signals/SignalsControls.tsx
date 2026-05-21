"use client";

/**
 * SignalsControls — the sticky toolbar atop the Signals view.
 *
 * Controls (all controlled — changes are emitted up to SignalsView):
 *   - Type chips (Vacancies / News / RFPs) — toggle on/off, all-on default.
 *     Active = filled plum; inactive = outline.
 *   - Time-window segmented control — 7d / 30d / 90d / All (default 30d).
 *   - District search input — client-side filter; rendered DISABLED while the
 *     summary loads (show loading state, don't hide UI).
 *   - Expand / collapse-all toggle.
 *
 * The toolbar scrolls horizontally (`overflow-x-auto`) on narrow widths; every
 * text span is `whitespace-nowrap` per the narrow-width-resilience rule.
 */
import { Search, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { SIGNAL_TYPE_META } from "./SignalTypeTag";
import type { SignalType, SignalWindow } from "@/lib/signals/sql";

export interface SignalsToolbarState {
  types: { vac: boolean; news: boolean; rfp: boolean };
  since: SignalWindow;
  search: string;
  expandAll: boolean;
}

interface SignalsControlsProps {
  state: SignalsToolbarState;
  /** Single patch emitter — SignalsView batches these into one setState. */
  onChange: (patch: Partial<SignalsToolbarState>) => void;
  /** True while the summary query is loading — disables the search input. */
  searchDisabled: boolean;
}

const TYPE_CHIPS: { type: SignalType; label: string }[] = [
  { type: "vac", label: "Vacancies" },
  { type: "news", label: "News" },
  { type: "rfp", label: "RFPs" },
];

const WINDOWS: { value: SignalWindow; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
  { value: "all", label: "All" },
];

export default function SignalsControls({
  state,
  onChange,
  searchDisabled,
}: SignalsControlsProps) {
  const { types, since, search, expandAll } = state;

  function toggleType(type: SignalType) {
    const next = { ...types, [type]: !types[type] };
    // Guard: never let the user turn every type off — that would render an
    // empty tree with no obvious recovery. Keep the last one on.
    if (!next.vac && !next.news && !next.rfp) return;
    onChange({ types: next });
  }

  const ExpandIcon = expandAll ? ChevronsDownUp : ChevronsUpDown;

  return (
    <div
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[#EFEDF5] bg-white px-3 py-2"
      // touch-action:auto lets the toolbar scroll horizontally on iOS without
      // fighting the list panel's pan-y lock below it.
      style={{ touchAction: "auto" }}
    >
      {/* Type chips */}
      <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Signal types">
        {TYPE_CHIPS.map(({ type, label }) => {
          const active = types[type];
          const meta = SIGNAL_TYPE_META[type];
          const Icon = meta.Icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap transition-colors duration-100 ${
                active
                  ? "border-[#403770] bg-[#403770] text-white"
                  : "border-[#D4CFE2] bg-white text-[#8A80A8] hover:text-[#403770] hover:border-[#403770]"
              }`}
            >
              <Icon className="h-3 w-3 flex-shrink-0" aria-hidden strokeWidth={2} />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Time-window segmented control */}
      <div
        className="flex shrink-0 items-center rounded-lg border border-[#E2DEEC] bg-white p-0.5"
        role="group"
        aria-label="Time window"
      >
        {WINDOWS.map(({ value, label }) => {
          const active = since === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ since: value })}
              aria-pressed={active}
              className={`rounded px-2 py-0.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-100 ${
                active
                  ? "bg-[#403770] text-white"
                  : "text-[#544A78] hover:bg-[#F7F5FA]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* District search */}
      <div className="relative flex min-w-[140px] shrink-0 items-center">
        <Search
          className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[#A69DC0]"
          aria-hidden
        />
        <input
          type="text"
          value={search}
          disabled={searchDisabled}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder={searchDisabled ? "Loading districts…" : "Search districts"}
          aria-label="Search districts"
          className="w-full rounded-lg border border-[#D4CFE2] bg-white py-1 pl-7 pr-2 text-[12px] text-[#403770] placeholder:text-[#A69DC0] focus:border-[#403770] focus:outline-none disabled:bg-[#F7F5FA] disabled:text-[#A69DC0]"
        />
      </div>

      {/* Expand / collapse all */}
      <button
        type="button"
        onClick={() => onChange({ expandAll: !expandAll })}
        aria-pressed={expandAll}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#544A78] hover:border-[#403770] hover:text-[#403770] transition-colors duration-100"
      >
        <ExpandIcon className="h-3.5 w-3.5 flex-shrink-0" aria-hidden strokeWidth={2} />
        <span className="whitespace-nowrap">
          {expandAll ? "Collapse all" : "Expand all"}
        </span>
      </button>
    </div>
  );
}
