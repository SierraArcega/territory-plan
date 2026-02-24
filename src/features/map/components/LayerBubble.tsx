"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useMapV2Store, ALL_SCHOOL_TYPES, type SchoolType } from "@/features/map/lib/store";
import { VENDOR_CONFIGS, VENDOR_IDS, SIGNAL_CONFIGS, SIGNAL_IDS, LOCALE_LAYER_META, ALL_LOCALE_IDS, type VendorId, type SignalId, type LocaleId } from "@/features/map/lib/layers";
import { VENDOR_PALETTES, SIGNAL_PALETTES, getVendorPalette, getSignalPalette, DEFAULT_VENDOR_PALETTE } from "@/features/map/lib/palettes";
import { ACCOUNT_TYPES, type AccountTypeValue } from "@/features/shared/types/account-types";


// Fullmind engagement levels
type FullmindEngagement = "target" | "renewal_pipeline" | "expansion_pipeline" | "new_business_pipeline" | "winback_pipeline" | "first_year" | "multi_year_growing" | "multi_year_flat" | "multi_year_shrinking" | "lapsed";

const FULLMIND_ENGAGEMENT_META: Record<FullmindEngagement, { label: string; color: string }> = {
  target:              { label: "Target",          color: "#e8f1f5" },
  renewal_pipeline:    { label: "Renewal",         color: "#8bb5cb" },
  expansion_pipeline:  { label: "Expansion",       color: "#6EA3BE" },
  new_business_pipeline: { label: "New Business",  color: "#c4dae6" },
  winback_pipeline:    { label: "Winback",         color: "#d1e3ec" },
  first_year:          { label: "First Year Customer", color: "#a6c9da" },
  multi_year_growing:  { label: "Growing",         color: "#a6c9da" },
  multi_year_flat:     { label: "Flat",            color: "#6EA3BE" },
  multi_year_shrinking: { label: "Shrinking",      color: "#8bb5cb" },
  lapsed:              { label: "Churned",         color: "#FFB347" },
};

// Group definitions for Fullmind
const FULLMIND_PIPELINE_CHILDREN: FullmindEngagement[] = ["renewal_pipeline", "expansion_pipeline", "new_business_pipeline", "winback_pipeline"];
const FULLMIND_MULTIYEAR_CHILDREN: FullmindEngagement[] = ["multi_year_growing", "multi_year_flat", "multi_year_shrinking"];

const COMPETITOR_VENDOR_IDS = VENDOR_IDS.filter((v) => v !== "fullmind");

// Competitor engagement levels
type CompetitorEngagement = "renewal_pipeline" | "expansion_pipeline" | "new_business_pipeline" | "winback_pipeline" | "multi_year_growing" | "multi_year_flat" | "multi_year_shrinking" | "new" | "churned";

const COMPETITOR_ENGAGEMENT_META: Record<CompetitorEngagement, { label: string }> = {
  renewal_pipeline:    { label: "Renewal" },
  expansion_pipeline:  { label: "Expansion" },
  new_business_pipeline: { label: "New Business" },
  winback_pipeline:    { label: "Winback" },
  multi_year_growing:  { label: "Growing" },
  multi_year_flat:     { label: "Flat" },
  multi_year_shrinking: { label: "Shrinking" },
  new:                 { label: "New" },
  churned:             { label: "Churned" },
};

// Group definitions for Competitors
const COMPETITOR_PIPELINE_CHILDREN: CompetitorEngagement[] = ["renewal_pipeline", "expansion_pipeline", "new_business_pipeline", "winback_pipeline"];
const COMPETITOR_MULTIYEAR_CHILDREN: CompetitorEngagement[] = ["multi_year_growing", "multi_year_flat", "multi_year_shrinking"];

/**
 * Maps an engagement level name to the actual DB category key(s) used by
 * expression builders and deriveVendorCategoryColors.
 *
 * Fullmind's "first_year" maps to "new" in the DB.
 * All other engagements map 1:1.
 */
function engagementToDBKeys(vendorId: string, engagement: string): string[] {
  if (vendorId === "fullmind" && engagement === "first_year") {
    return [`fullmind:new`];
  }
  return [`${vendorId}:${engagement}`];
}

const SCHOOL_TYPE_META: Record<SchoolType, { label: string; color: string }> = {
  elementary: { label: "Elementary", color: "#6EA3BE" },  // Steel Blue
  middle:     { label: "Middle",     color: "#403770" },  // Plum
  high:       { label: "High",       color: "#FFCF70" },  // Golden
  charter:    { label: "Charter",    color: "#89a2a1" },  // Robin's Egg 30% shade
};

/* ─── Saved view shape ─── */
interface SavedMapView {
  id: string;
  name: string;
  activeVendors: VendorId[];
  filterOwner: string | null;
  filterPlanId: string | null;
  filterStates: string[];
  visibleSchoolTypes: SchoolType[];
  activeSignal: SignalId | null;
  visibleLocales: LocaleId[];
  filterAccountTypes: AccountTypeValue[];
  fullmindEngagement: string[];
  competitorEngagement: Record<string, string[]>;
  selectedFiscalYear: "fy24" | "fy25" | "fy26" | "fy27";
  vendorPalettes?: Record<string, string>;
  signalPalette?: string;
}

const STORAGE_KEY = "territory-plan:saved-map-views";

function loadSavedViews(): SavedMapView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistViews(views: SavedMapView[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

/* ─── Chevron icon ─── */
function ChevronDown({ open, className = "" }: { open: boolean; className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`transition-transform duration-200 ${open ? "" : "-rotate-90"} ${className}`}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Color swatch ─── */
function ColorDot({ color, size = "w-3 h-3" }: { color: string; size?: string }) {
  return (
    <span
      className={`${size} rounded-full shrink-0 ring-1 ring-black/5`}
      style={{ backgroundColor: color }}
    />
  );
}

/* ─── Palette pickers ─── */
function VendorPalettePicker({ vendorId, activePaletteId, onSelect }: {
  vendorId: string;
  activePaletteId: string;
  onSelect: (paletteId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-6 pr-2 py-1.5">
      {VENDOR_PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`w-5 h-5 rounded-full transition-all ${
            p.id === activePaletteId
              ? "ring-2 ring-offset-1 ring-plum scale-110"
              : "hover:scale-110 ring-1 ring-black/10"
          }`}
          style={{ backgroundColor: p.baseColor }}
          title={p.label}
          aria-label={`${p.label} palette`}
        />
      ))}
    </div>
  );
}

function SignalPalettePicker({ activePaletteId, onSelect }: {
  activePaletteId: string;
  onSelect: (paletteId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-[52px] pr-2 py-1.5">
      {SIGNAL_PALETTES.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className={`flex gap-0.5 items-center px-1.5 py-1 rounded-md transition-all ${
            p.id === activePaletteId
              ? "ring-2 ring-offset-1 ring-plum bg-plum/5"
              : "hover:bg-gray-100 ring-1 ring-black/5"
          }`}
          title={p.label}
          aria-label={`${p.label} palette`}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[0] }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[2] }} />
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.growthStops[4] }} />
        </button>
      ))}
    </div>
  );
}

/* ─── Color swatch presets ─── */
const SWATCH_COLORS = [
  "#403770", "#665f8d", "#8c87a9", "#b3afc6", "#ecebf1",
  "#F37167", "#e06b5e", "#c44f44", "#fde3e1",
  "#6EA3BE", "#4a8ba8", "#a3c9db",
  "#FFCF70", "#ffd98d", "#FFB347",
  "#4ECDC4", "#3ab0a7", "#a3e6e1",
  "#E74C3C", "#2ECC71", "#3498DB", "#9B59B6",
  "#95A5A6", "#BDC3C7", "#ECF0F1",
];

function CategorySwatchPicker({
  activeColor,
  onSelect,
}: {
  activeColor: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 pl-10 pr-2 py-1.5">
      {SWATCH_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={`w-5 h-5 rounded-full transition-all ${
            c.toLowerCase() === activeColor.toLowerCase()
              ? "ring-2 ring-offset-1 ring-plum scale-110"
              : "hover:scale-110 ring-1 ring-black/10"
          }`}
          style={{ backgroundColor: c }}
          title={c}
        />
      ))}
    </div>
  );
}

function CategoryRow({
  categoryKey,
  label,
  checked,
  onToggle,
  color,
  opacity,
  onColorChange,
  onOpacityChange,
  swatchOpen,
  onToggleSwatch,
}: {
  categoryKey: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  swatchOpen: boolean;
  onToggleSwatch: () => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-2.5 pl-8 pr-4 py-1.5 rounded-lg transition-colors ${
          checked ? "bg-plum/5" : "hover:bg-gray-50"
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
        />
        <button
          type="button"
          onClick={onToggleSwatch}
          className="shrink-0 group"
          title="Change color"
        >
          <span
            className="w-3 h-3 rounded-full block ring-1 ring-black/5 group-hover:ring-2 group-hover:ring-plum/40 transition-all"
            style={{ backgroundColor: color }}
          />
        </button>
        <span className={`text-sm flex-1 ${checked ? "font-medium text-gray-800" : "text-gray-600"}`}>
          {label}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="w-16 h-1 accent-plum cursor-pointer shrink-0"
        />
        <span className="text-xs text-gray-400 w-7 text-right tabular-nums shrink-0">
          {Math.round(opacity * 100)}%
        </span>
      </div>
      {swatchOpen && (
        <CategorySwatchPicker activeColor={color} onSelect={onColorChange} />
      )}
    </div>
  );
}

/* ─── Group row with parent toggle ─── */
function GroupRow({
  label,
  childKeys,
  selectedEngagements,
  onToggleAll,
  children,
}: {
  label: string;
  childKeys: string[];
  selectedEngagements: string[];
  onToggleAll: (keys: string[], selectAll: boolean) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const selectedCount = childKeys.filter((c) => selectedEngagements.includes(c)).length;
  const allSelected = selectedCount === childKeys.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div>
      <div className="flex items-center gap-2.5 pl-8 pr-4 py-1 rounded-lg hover:bg-gray-50">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected; }}
          onChange={() => onToggleAll(childKeys, !allSelected)}
          className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
        />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 flex-1 min-w-0"
        >
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <ChevronDown open={open} className="text-gray-400" />
        </button>
      </div>
      {open && (
        <div className="pl-4">
          {children}
        </div>
      )}
    </div>
  );
}

export default function LayerBubble() {
  const activeVendors = useMapV2Store((s) => s.activeVendors);
  const toggleVendor = useMapV2Store((s) => s.toggleVendor);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const setFilterOwner = useMapV2Store((s) => s.setFilterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const setFilterPlanId = useMapV2Store((s) => s.setFilterPlanId);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const toggleFilterState = useMapV2Store((s) => s.toggleFilterState);
  const setFilterStates = useMapV2Store((s) => s.setFilterStates);
  const visibleSchoolTypes = useMapV2Store((s) => s.visibleSchoolTypes);
  const toggleSchoolType = useMapV2Store((s) => s.toggleSchoolType);
  const setVisibleSchoolTypes = useMapV2Store((s) => s.setVisibleSchoolTypes);
  const activeSignal = useMapV2Store((s) => s.activeSignal);
  const setActiveSignal = useMapV2Store((s) => s.setActiveSignal);
  const visibleLocales = useMapV2Store((s) => s.visibleLocales);
  const toggleLocale = useMapV2Store((s) => s.toggleLocale);
  const setVisibleLocales = useMapV2Store((s) => s.setVisibleLocales);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const toggleAccountType = useMapV2Store((s) => s.toggleAccountType);
  const setFilterAccountTypes = useMapV2Store((s) => s.setFilterAccountTypes);
  const fullmindEngagement = useMapV2Store((s) => s.fullmindEngagement);
  const toggleFullmindEngagement = useMapV2Store((s) => s.toggleFullmindEngagement);
  const setFullmindEngagement = useMapV2Store((s) => s.setFullmindEngagement);
  const competitorEngagement = useMapV2Store((s) => s.competitorEngagement);
  const toggleCompetitorEngagement = useMapV2Store((s) => s.toggleCompetitorEngagement);
  const setCompetitorEngagement = useMapV2Store((s) => s.setCompetitorEngagement);
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const setSelectedFiscalYear = useMapV2Store((s) => s.setSelectedFiscalYear);
  const compareMode = useMapV2Store((s) => s.compareMode);
  const compareView = useMapV2Store((s) => s.compareView);
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);
  const enterCompareMode = useMapV2Store((s) => s.enterCompareMode);
  const exitCompareMode = useMapV2Store((s) => s.exitCompareMode);
  const setCompareView = useMapV2Store((s) => s.setCompareView);
  const setCompareFyA = useMapV2Store((s) => s.setCompareFyA);
  const setCompareFyB = useMapV2Store((s) => s.setCompareFyB);
  const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
  const setVendorPalette = useMapV2Store((s) => s.setVendorPalette);
  const vendorOpacities = useMapV2Store((s) => s.vendorOpacities);
  const setVendorOpacity = useMapV2Store((s) => s.setVendorOpacity);
  const signalPalette = useMapV2Store((s) => s.signalPalette);
  const setSignalPalette = useMapV2Store((s) => s.setSignalPalette);
  const categoryColors = useMapV2Store((s) => s.categoryColors);
  const categoryOpacities = useMapV2Store((s) => s.categoryOpacities);
  const setCategoryColor = useMapV2Store((s) => s.setCategoryColor);
  const setCategoryOpacity = useMapV2Store((s) => s.setCategoryOpacity);
  const layerBubbleOpen = useMapV2Store((s) => s.layerBubbleOpen);
  const setLayerBubbleOpen = useMapV2Store((s) => s.setLayerBubbleOpen);
  const ref = useRef<HTMLDivElement>(null);

  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Dynamic engagement colors from active Fullmind palette
  const fullmindPalette = getVendorPalette(vendorPalettes.fullmind);
  const dynamicFullmindColors: Record<string, string> = {
    target: fullmindPalette.stops[0],
    renewal_pipeline: fullmindPalette.stops[4],
    expansion_pipeline: fullmindPalette.stops[5],
    new_business_pipeline: fullmindPalette.stops[2],
    winback_pipeline: fullmindPalette.stops[1],
    first_year: fullmindPalette.stops[3],
    multi_year_growing: fullmindPalette.stops[3],
    multi_year_flat: fullmindPalette.stops[5],
    multi_year_shrinking: fullmindPalette.stops[4],
    lapsed: "#FFB347",
  };

  // Fetch filter options
  const [owners, setOwners] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [states, setStates] = useState<Array<{ abbrev: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/sales-executives")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setOwners(data.map?.((d: any) => d.name || d) || []))
      .catch(() => {});
    fetch("/api/territory-plans")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setPlans(data.map?.((d: any) => ({ id: d.id, name: d.name })) || [])
      )
      .catch(() => {});
    fetch("/api/states")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setStates(
          (data as Array<{ abbrev: string; name: string }>).sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        )
      )
      .catch(() => {});
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (useMapV2Store.getState().hasUnsavedChanges()) {
          setShowUnsavedWarning(true);
          return;
        }
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Close on Escape
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (showUnsavedWarning) {
          setShowUnsavedWarning(false);
          setLayerBubbleOpen(false);
          return;
        }
        if (useMapV2Store.getState().hasUnsavedChanges()) {
          setShowUnsavedWarning(true);
          return;
        }
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen, showUnsavedWarning]);

  // Palette picker toggle: vendorId or "signal", null = closed
  const [palettePickerOpen, setPalettePickerOpen] = useState<string | null>(null);

  // Collapsible section state
  const [accountTypesOpen, setAccountTypesOpen] = useState(false);
  const [fullmindOpen, setFullmindOpen] = useState(false);
  const [vendorLayersOpen, setVendorLayersOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const [dataLayersOpen, setDataLayersOpen] = useState(false);

  // State dropdown
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  // Saved views
  const [savedViews, setSavedViews] = useState<SavedMapView[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  useEffect(() => {
    if (saveDialogOpen) {
      requestAnimationFrame(() => saveInputRef.current?.focus());
    }
  }, [saveDialogOpen]);

  const handleSaveView = useCallback(() => {
    const name = viewName.trim();
    if (!name) return;
    const view: SavedMapView = {
      id: crypto.randomUUID(),
      name,
      activeVendors: [...activeVendors] as VendorId[],
      filterOwner,
      filterPlanId,
      filterStates: [...filterStates],
      visibleSchoolTypes: [...visibleSchoolTypes] as SchoolType[],
      activeSignal,
      visibleLocales: [...visibleLocales] as LocaleId[],
      filterAccountTypes: [...filterAccountTypes] as AccountTypeValue[],
      fullmindEngagement: [...fullmindEngagement],
      competitorEngagement: { ...competitorEngagement },
      selectedFiscalYear,
      vendorPalettes: { ...vendorPalettes },
      signalPalette,
    };
    const next = [...savedViews, view];
    setSavedViews(next);
    persistViews(next);
    useMapV2Store.getState().captureSnapshot();
    setViewName("");
    setSaveDialogOpen(false);
  }, [viewName, activeVendors, filterOwner, filterPlanId, filterStates, visibleSchoolTypes, activeSignal, visibleLocales, filterAccountTypes, fullmindEngagement, competitorEngagement, selectedFiscalYear, vendorPalettes, signalPalette, savedViews]);

  const handleLoadView = useCallback(
    (view: SavedMapView) => {
      // Apply vendor state — need to set it via store.
      // We'll toggle vendors to match the saved set.
      const store = useMapV2Store.getState();
      const target = new Set(view.activeVendors);
      // First add missing vendors, then remove extra ones
      for (const v of VENDOR_IDS) {
        const isActive = store.activeVendors.has(v);
        const shouldBeActive = target.has(v);
        if (isActive !== shouldBeActive) {
          store.toggleVendor(v);
        }
      }
      store.setFilterOwner(view.filterOwner);
      store.setFilterPlanId(view.filterPlanId);
      store.setFilterStates(view.filterStates);
      store.setVisibleSchoolTypes(new Set(view.visibleSchoolTypes));
      store.setActiveSignal(view.activeSignal ?? null);
      store.setVisibleLocales(new Set(view.visibleLocales ?? []));
      store.setFilterAccountTypes(view.filterAccountTypes ?? []);
      store.setFullmindEngagement(view.fullmindEngagement ?? []);
      // Restore per-competitor engagement filters
      const savedCompEng = view.competitorEngagement ?? {};
      for (const vid of COMPETITOR_VENDOR_IDS) {
        store.setCompetitorEngagement(vid, savedCompEng[vid] ?? []);
      }
      store.setSelectedFiscalYear((view.selectedFiscalYear as "fy24" | "fy25" | "fy26" | "fy27") ?? "fy26");
      // Restore palette preferences if present
      if (view.vendorPalettes) {
        for (const [vid, pid] of Object.entries(view.vendorPalettes)) {
          store.setVendorPalette(vid as any, pid);
        }
      }
      if (view.signalPalette) {
        store.setSignalPalette(view.signalPalette);
      }
      store.captureSnapshot();
    },
    []
  );

  const handleDeleteView = useCallback(
    (id: string) => {
      const next = savedViews.filter((v) => v.id !== id);
      setSavedViews(next);
      persistViews(next);
    },
    [savedViews]
  );

  // Build summary text for the collapsed pill
  const vendorCount = activeVendors.size;
  const filterCount =
    (filterOwner ? 1 : 0) + (filterPlanId ? 1 : 0) + (filterStates.length > 0 ? 1 : 0) + (filterAccountTypes.length > 0 ? 1 : 0);
  let pillText = "";
  if (vendorCount === 1) {
    const v = VENDOR_CONFIGS[[...activeVendors][0]];
    pillText = v?.label || "Fullmind";
  } else {
    pillText = `${vendorCount} vendors`;
  }
  if (filterCount > 0) {
    pillText += ` \u00b7 ${filterCount} filter${filterCount > 1 ? "s" : ""}`;
  }

  return (
    <div ref={ref} className="absolute bottom-6 right-6 z-10">
      {/* Expanded popover */}
      {layerBubbleOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[380px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Build a Map View
            </span>
            <button
              onClick={() => setLayerBubbleOpen(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-plum hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M2 2L8 8M8 2L2 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable content area */}
          <div className="max-h-[60vh] overflow-y-auto">

          {/* ════════════════════════════════════════════
              GROUP 1: FILTERS
              ════════════════════════════════════════════ */}
          <div className="px-3 pb-2 space-y-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Filters
            </div>

            {/* State multi-select */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setStateDropdownOpen(!stateDropdownOpen)}
                className="w-full flex items-center justify-between text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
              >
                <span
                  className={
                    filterStates.length === 0
                      ? "text-gray-500"
                      : "text-gray-700 truncate"
                  }
                >
                  {filterStates.length === 0
                    ? "All States"
                    : filterStates.length <= 3
                      ? filterStates.sort().join(", ")
                      : `${filterStates.length} states`}
                </span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  className={`text-gray-400 shrink-0 ml-1 transition-transform duration-150 ${stateDropdownOpen ? "rotate-180" : ""}`}
                >
                  <path
                    d="M2.5 4L5 6.5L7.5 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {stateDropdownOpen && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filterStates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterStates([])}
                      className="w-full text-left text-xs text-plum hover:bg-gray-50 px-2.5 py-1.5 border-b border-gray-100"
                    >
                      Clear selection
                    </button>
                  )}
                  {states.map((s) => (
                    <label
                      key={s.abbrev}
                      className="flex items-center gap-2 px-2.5 py-1 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filterStates.includes(s.abbrev)}
                        onChange={() => toggleFilterState(s.abbrev)}
                        className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                      />
                      <span className="text-sm text-gray-700">{s.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {s.abbrev}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Owner filter */}
            <select
              value={filterOwner || ""}
              onChange={(e) => setFilterOwner(e.target.value || null)}
              className="w-full text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
            >
              <option value="">All Owners</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>

          {/* Account Types (collapsible, inside Filters group) */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setAccountTypesOpen(!accountTypesOpen)}
              className="w-full flex items-center gap-1.5 mt-2 mb-1 group"
            >
              <ChevronDown
                open={accountTypesOpen}
                className="text-gray-400 group-hover:text-gray-600"
              />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                Account Types
              </span>
              {filterAccountTypes.length > 0 && (
                <span className="ml-auto text-xs text-plum font-medium">
                  {filterAccountTypes.length} selected
                </span>
              )}
            </button>

            {accountTypesOpen && (
              <div className="space-y-0.5">
                <label
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    filterAccountTypes.length === 0
                      ? "bg-plum/5"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filterAccountTypes.length === 0}
                    ref={(el) => {
                      if (el) el.indeterminate =
                        filterAccountTypes.length > 0 &&
                        filterAccountTypes.length < ACCOUNT_TYPES.length;
                    }}
                    onChange={() => {
                      if (filterAccountTypes.length > 0) {
                        setFilterAccountTypes([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                  />
                  <span
                    className={`text-sm ${
                      filterAccountTypes.length === 0
                        ? "font-medium text-gray-800"
                        : "text-gray-600"
                    }`}
                  >
                    All Types
                  </span>
                </label>
                {ACCOUNT_TYPES.map((acctType) => {
                  const isActive = filterAccountTypes.includes(acctType.value);
                  return (
                    <label
                      key={acctType.value}
                      className={`flex items-center gap-2.5 pl-6 pr-2 py-1 rounded-lg cursor-pointer transition-colors ${
                        isActive ? "bg-plum/5" : "hover:bg-gray-50"
                      }`}
                      title={acctType.tooltip}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleAccountType(acctType.value)}
                        className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                      />
                      <span
                        className={`text-sm ${isActive ? "font-medium text-gray-800" : "text-gray-600"}`}
                      >
                        {acctType.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════
              GROUP 2: SALES DATA (FY-dependent)
              ════════════════════════════════════════════ */}
          <div className="px-3 pt-2 pb-1 bg-gray-50/50 border-t-2 border-gray-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-plum uppercase tracking-wider">
                Sales Data
              </span>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value as "fy24" | "fy25" | "fy26" | "fy27")}
                disabled={compareMode}
                className={`text-xs font-medium bg-white border border-gray-200/60 rounded-md px-2 py-1 text-plum focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 cursor-pointer ${compareMode ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <option value="fy27">FY27</option>
                <option value="fy26">FY26</option>
                <option value="fy25">FY25</option>
                <option value="fy24">FY24</option>
              </select>
            </div>

            {/* Compare Years toggle */}
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={() => compareMode ? exitCompareMode() : enterCompareMode()}
                className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
              />
              <span className={`text-xs font-medium ${compareMode ? "text-plum" : "text-gray-500"}`}>
                Compare Years
              </span>
            </label>

            {/* Compare controls (visible when toggle ON) */}
            {compareMode && (
              <div className="mt-2 mb-1 space-y-2 bg-white rounded-lg border border-gray-200/60 p-2.5">
                {/* Segmented control: Changes / Side-by-Side */}
                <div className="flex rounded-md overflow-hidden border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setCompareView("changes")}
                    className={`flex-1 text-xs font-medium py-1.5 transition-colors ${
                      compareView === "changes"
                        ? "bg-plum text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Check viewport width for side-by-side
                      if (typeof window !== "undefined" && window.innerWidth < 768) return;
                      setCompareView("side_by_side");
                    }}
                    title={typeof window !== "undefined" && window.innerWidth < 768 ? "Wider screen required" : undefined}
                    className={`flex-1 text-xs font-medium py-1.5 transition-colors border-l border-gray-200 ${
                      compareView === "side_by_side"
                        ? "bg-plum text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>

                {/* FY dropdowns */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10 shrink-0">From:</span>
                  <select
                    value={compareFyA}
                    onChange={(e) => setCompareFyA(e.target.value as "fy24" | "fy25" | "fy26" | "fy27")}
                    className="flex-1 text-xs font-medium bg-gray-50 border border-gray-200/60 rounded-md px-2 py-1.5 text-plum focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
                  >
                    {(["fy24", "fy25", "fy26", "fy27"] as const)
                      .filter((fy) => fy !== compareFyB)
                      .map((fy) => (
                        <option key={fy} value={fy}>{fy.replace("fy", "FY")}</option>
                      ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-10 shrink-0">To:</span>
                  <select
                    value={compareFyB}
                    onChange={(e) => setCompareFyB(e.target.value as "fy24" | "fy25" | "fy26" | "fy27")}
                    className="flex-1 text-xs font-medium bg-gray-50 border border-gray-200/60 rounded-md px-2 py-1.5 text-plum focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
                  >
                    {(["fy24", "fy25", "fy26", "fy27"] as const)
                      .filter((fy) => fy !== compareFyA)
                      .map((fy) => (
                        <option key={fy} value={fy}>{fy.replace("fy", "FY")}</option>
                      ))}
                  </select>
                </div>

                {/* Same-FY warning */}
                {compareFyA === compareFyB && (
                  <p className="text-xs text-coral italic">
                    Select different fiscal years to see changes.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fullmind (inside Sales Data group) */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-1.5 mt-2 mb-1">
              <button
                type="button"
                onClick={() => setFullmindOpen(!fullmindOpen)}
                className="flex items-center gap-1.5 group flex-1"
              >
                <ChevronDown
                  open={fullmindOpen}
                  className="text-gray-400 group-hover:text-gray-600"
                />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                  Fullmind
                </span>
              </button>
              {activeVendors.has("fullmind") && (
                <button
                  type="button"
                  onClick={() => setPalettePickerOpen(palettePickerOpen === "fullmind" ? null : "fullmind")}
                  className="text-xs text-gray-400 hover:text-plum transition-colors"
                >
                  Palette
                </button>
              )}
            </div>
            {palettePickerOpen === "fullmind" && (
              <VendorPalettePicker
                vendorId="fullmind"
                activePaletteId={vendorPalettes.fullmind}
                onSelect={(id) => setVendorPalette("fullmind", id)}
              />
            )}

            {fullmindOpen && (
              <div className="space-y-0.5">
                <label
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeVendors.has("fullmind") ? "bg-plum/5" : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={activeVendors.has("fullmind")}
                    onChange={() => toggleVendor("fullmind")}
                    className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                  />
                  <ColorDot color={getVendorPalette(vendorPalettes.fullmind).dotColor} />
                  <span className={`text-sm ${activeVendors.has("fullmind") ? "font-medium text-plum" : "text-gray-600"}`}>
                    Show on Map
                  </span>
                </label>

                {activeVendors.has("fullmind") && (
                  <>
                    <div className="text-xs text-gray-400 mt-1.5 mb-0.5 pl-2 flex items-center gap-1.5">
                      Filter by engagement:
                      {compareMode && compareView === "changes" && (
                        <span className="text-[10px] italic text-gray-300" title="Filters disabled in Changes view">
                          (disabled)
                        </span>
                      )}
                    </div>
                    <div className={compareMode && compareView === "changes" ? "pointer-events-none opacity-40" : ""}>
                    {/* Target (standalone) */}
                    {(["target"] as FullmindEngagement[]).map((level) => {
                      const meta = FULLMIND_ENGAGEMENT_META[level];
                      const dbKeys = engagementToDBKeys("fullmind", level);
                      const primaryKey = dbKeys[0];
                      return (
                        <CategoryRow
                          key={level}
                          categoryKey={primaryKey}
                          label={meta.label}
                          checked={fullmindEngagement.includes(level)}
                          onToggle={() => toggleFullmindEngagement(level)}
                          color={categoryColors[primaryKey] ?? meta.color}
                          opacity={categoryOpacities[primaryKey] ?? 0.75}
                          onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                          onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                          swatchOpen={palettePickerOpen === primaryKey}
                          onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                        />
                      );
                    })}
                    {/* Pipeline (group) */}
                    <GroupRow
                      label="Pipeline"
                      childKeys={FULLMIND_PIPELINE_CHILDREN as string[]}
                      selectedEngagements={fullmindEngagement}
                      onToggleAll={(keys, selectAll) => {
                        const next = selectAll
                          ? [...new Set([...fullmindEngagement, ...keys])]
                          : fullmindEngagement.filter((e) => !keys.includes(e));
                        setFullmindEngagement(next);
                      }}
                    >
                      {FULLMIND_PIPELINE_CHILDREN.map((level) => {
                        const meta = FULLMIND_ENGAGEMENT_META[level];
                        const dbKeys = engagementToDBKeys("fullmind", level);
                        const primaryKey = dbKeys[0];
                        return (
                          <CategoryRow
                            key={level}
                            categoryKey={primaryKey}
                            label={meta.label}
                            checked={fullmindEngagement.includes(level)}
                            onToggle={() => toggleFullmindEngagement(level)}
                            color={categoryColors[primaryKey] ?? meta.color}
                            opacity={categoryOpacities[primaryKey] ?? 0.75}
                            onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                            onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                            swatchOpen={palettePickerOpen === primaryKey}
                            onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                          />
                        );
                      })}
                    </GroupRow>
                    {/* First Year (standalone) */}
                    {(["first_year"] as FullmindEngagement[]).map((level) => {
                      const meta = FULLMIND_ENGAGEMENT_META[level];
                      const dbKeys = engagementToDBKeys("fullmind", level);
                      const primaryKey = dbKeys[0];
                      return (
                        <CategoryRow
                          key={level}
                          categoryKey={primaryKey}
                          label={meta.label}
                          checked={fullmindEngagement.includes(level)}
                          onToggle={() => toggleFullmindEngagement(level)}
                          color={categoryColors[primaryKey] ?? meta.color}
                          opacity={categoryOpacities[primaryKey] ?? 0.75}
                          onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                          onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                          swatchOpen={palettePickerOpen === primaryKey}
                          onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                        />
                      );
                    })}
                    {/* Multi-Year (group) */}
                    <GroupRow
                      label="Multi-Year"
                      childKeys={FULLMIND_MULTIYEAR_CHILDREN as string[]}
                      selectedEngagements={fullmindEngagement}
                      onToggleAll={(keys, selectAll) => {
                        const next = selectAll
                          ? [...new Set([...fullmindEngagement, ...keys])]
                          : fullmindEngagement.filter((e) => !keys.includes(e));
                        setFullmindEngagement(next);
                      }}
                    >
                      {FULLMIND_MULTIYEAR_CHILDREN.map((level) => {
                        const meta = FULLMIND_ENGAGEMENT_META[level];
                        const dbKeys = engagementToDBKeys("fullmind", level);
                        const primaryKey = dbKeys[0];
                        return (
                          <CategoryRow
                            key={level}
                            categoryKey={primaryKey}
                            label={meta.label}
                            checked={fullmindEngagement.includes(level)}
                            onToggle={() => toggleFullmindEngagement(level)}
                            color={categoryColors[primaryKey] ?? meta.color}
                            opacity={categoryOpacities[primaryKey] ?? 0.75}
                            onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                            onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                            swatchOpen={palettePickerOpen === primaryKey}
                            onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                          />
                        );
                      })}
                    </GroupRow>
                    {/* Churned (standalone) */}
                    {(["lapsed"] as FullmindEngagement[]).map((level) => {
                      const meta = FULLMIND_ENGAGEMENT_META[level];
                      const dbKeys = engagementToDBKeys("fullmind", level);
                      const primaryKey = dbKeys[0];
                      return (
                        <CategoryRow
                          key={level}
                          categoryKey={primaryKey}
                          label={meta.label}
                          checked={fullmindEngagement.includes(level)}
                          onToggle={() => toggleFullmindEngagement(level)}
                          color={categoryColors[primaryKey] ?? meta.color}
                          opacity={categoryOpacities[primaryKey] ?? 0.75}
                          onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                          onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                          swatchOpen={palettePickerOpen === primaryKey}
                          onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                        />
                      );
                    })}
                    {fullmindEngagement.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFullmindEngagement([])}
                        className="text-xs text-plum hover:text-plum/80 pl-6 mt-0.5 mb-1 transition-colors"
                      >
                        Show all engagement levels
                      </button>
                    )}
                    </div>{/* end disabled wrapper */}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Competitors (inside Sales Data group) */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100 bg-gray-50/30">
            <div className="flex items-center gap-1.5 mt-2 mb-1">
              <button
                type="button"
                onClick={() => setVendorLayersOpen(!vendorLayersOpen)}
                className="flex items-center gap-1.5 group flex-1"
              >
                <ChevronDown
                  open={vendorLayersOpen}
                  className="text-gray-400 group-hover:text-gray-600"
                />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                  Competitors
                </span>
              </button>
            </div>

            {vendorLayersOpen && (
              <div className="space-y-0.5">
                {COMPETITOR_VENDOR_IDS.map((vendorId) => {
                  const config = VENDOR_CONFIGS[vendorId];
                  const isActive = activeVendors.has(vendorId);
                  const vendorEngagement = competitorEngagement[vendorId] || [];

                  return (
                    <div key={vendorId}>
                      <div
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-colors group ${
                          isActive ? "bg-plum/5" : "hover:bg-gray-50"
                        }`}
                        title={config.shadingTooltip}
                      >
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleVendor(vendorId)}
                          className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                        />
                        <ColorDot color={getVendorPalette(vendorPalettes[vendorId]).dotColor} />
                        <span
                          className={`text-sm flex-1 ${isActive ? "font-medium text-plum" : "text-gray-600"}`}
                        >
                          {config.label}
                        </span>
                        {isActive && (
                          <button
                            type="button"
                            onClick={() => setPalettePickerOpen(palettePickerOpen === vendorId ? null : vendorId)}
                            className="text-xs text-gray-400 hover:text-plum transition-colors"
                          >
                            Palette
                          </button>
                        )}
                      </div>
                      {palettePickerOpen === vendorId && (
                        <VendorPalettePicker
                          vendorId={vendorId}
                          activePaletteId={vendorPalettes[vendorId]}
                          onSelect={(id) => setVendorPalette(vendorId, id)}
                        />
                      )}

                      {isActive && (
                        <>
                          <div className="text-xs text-gray-400 mt-1.5 mb-0.5 pl-2 flex items-center gap-1.5">
                            Filter by engagement:
                            {compareMode && compareView === "changes" && (
                              <span className="text-[10px] italic text-gray-300" title="Filters disabled in Changes view">
                                (disabled)
                              </span>
                            )}
                          </div>
                          <div className={compareMode && compareView === "changes" ? "pointer-events-none opacity-40" : ""}>
                          {/* Pipeline (group) */}
                          <GroupRow
                            label="Pipeline"
                            childKeys={COMPETITOR_PIPELINE_CHILDREN as string[]}
                            selectedEngagements={vendorEngagement}
                            onToggleAll={(keys, selectAll) => {
                              const next = selectAll
                                ? [...new Set([...vendorEngagement, ...keys])]
                                : vendorEngagement.filter((e) => !keys.includes(e));
                              setCompetitorEngagement(vendorId, next);
                            }}
                          >
                            {COMPETITOR_PIPELINE_CHILDREN.map((level) => {
                              const meta = COMPETITOR_ENGAGEMENT_META[level];
                              const dbKeys = engagementToDBKeys(vendorId, level);
                              const primaryKey = dbKeys[0];
                              return (
                                <CategoryRow
                                  key={level}
                                  categoryKey={primaryKey}
                                  label={meta.label}
                                  checked={vendorEngagement.includes(level)}
                                  onToggle={() => toggleCompetitorEngagement(vendorId, level)}
                                  color={categoryColors[primaryKey] ?? getVendorPalette(vendorPalettes[vendorId]).dotColor}
                                  opacity={categoryOpacities[primaryKey] ?? 0.75}
                                  onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                                  onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                                  swatchOpen={palettePickerOpen === primaryKey}
                                  onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                                />
                              );
                            })}
                          </GroupRow>
                          {/* New (standalone) */}
                          {(["new"] as CompetitorEngagement[]).map((level) => {
                            const meta = COMPETITOR_ENGAGEMENT_META[level];
                            const dbKeys = engagementToDBKeys(vendorId, level);
                            const primaryKey = dbKeys[0];
                            return (
                              <CategoryRow
                                key={level}
                                categoryKey={primaryKey}
                                label={meta.label}
                                checked={vendorEngagement.includes(level)}
                                onToggle={() => toggleCompetitorEngagement(vendorId, level)}
                                color={categoryColors[primaryKey] ?? getVendorPalette(vendorPalettes[vendorId]).dotColor}
                                opacity={categoryOpacities[primaryKey] ?? 0.75}
                                onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                                onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                                swatchOpen={palettePickerOpen === primaryKey}
                                onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                              />
                            );
                          })}
                          {/* Multi-Year (group) */}
                          <GroupRow
                            label="Multi-Year"
                            childKeys={COMPETITOR_MULTIYEAR_CHILDREN as string[]}
                            selectedEngagements={vendorEngagement}
                            onToggleAll={(keys, selectAll) => {
                              const next = selectAll
                                ? [...new Set([...vendorEngagement, ...keys])]
                                : vendorEngagement.filter((e) => !keys.includes(e));
                              setCompetitorEngagement(vendorId, next);
                            }}
                          >
                            {COMPETITOR_MULTIYEAR_CHILDREN.map((level) => {
                              const meta = COMPETITOR_ENGAGEMENT_META[level];
                              const dbKeys = engagementToDBKeys(vendorId, level);
                              const primaryKey = dbKeys[0];
                              return (
                                <CategoryRow
                                  key={level}
                                  categoryKey={primaryKey}
                                  label={meta.label}
                                  checked={vendorEngagement.includes(level)}
                                  onToggle={() => toggleCompetitorEngagement(vendorId, level)}
                                  color={categoryColors[primaryKey] ?? getVendorPalette(vendorPalettes[vendorId]).dotColor}
                                  opacity={categoryOpacities[primaryKey] ?? 0.75}
                                  onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                                  onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                                  swatchOpen={palettePickerOpen === primaryKey}
                                  onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                                />
                              );
                            })}
                          </GroupRow>
                          {/* Churned (standalone) */}
                          {(["churned"] as CompetitorEngagement[]).map((level) => {
                            const meta = COMPETITOR_ENGAGEMENT_META[level];
                            const dbKeys = engagementToDBKeys(vendorId, level);
                            const primaryKey = dbKeys[0];
                            return (
                              <CategoryRow
                                key={level}
                                categoryKey={primaryKey}
                                label={meta.label}
                                checked={vendorEngagement.includes(level)}
                                onToggle={() => toggleCompetitorEngagement(vendorId, level)}
                                color={categoryColors[primaryKey] ?? getVendorPalette(vendorPalettes[vendorId]).dotColor}
                                opacity={categoryOpacities[primaryKey] ?? 0.75}
                                onColorChange={(c) => dbKeys.forEach((k) => setCategoryColor(k, c))}
                                onOpacityChange={(o) => dbKeys.forEach((k) => setCategoryOpacity(k, o))}
                                swatchOpen={palettePickerOpen === primaryKey}
                                onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === primaryKey ? null : primaryKey)}
                              />
                            );
                          })}
                          {vendorEngagement.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCompetitorEngagement(vendorId, [])}
                              className="text-xs text-plum hover:text-plum/80 pl-6 mt-0.5 mb-1 transition-colors"
                            >
                              Show all engagement levels
                            </button>
                          )}
                          </div>{/* end disabled wrapper */}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════
              GROUP 3: MARKET DATA (FY-independent)
              ════════════════════════════════════════════ */}
          <div className="px-3 pt-2 pb-1 bg-white border-t-2 border-gray-200/80">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Market Data
            </span>
          </div>

          {/* Signals */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1.5 mt-2 mb-1">
              <button
                type="button"
                onClick={() => setSignalsOpen(!signalsOpen)}
                className="flex items-center gap-1.5 group flex-1"
              >
                <ChevronDown
                  open={signalsOpen}
                  className="text-gray-400 group-hover:text-gray-600"
                />
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                  Signals
                </span>
              </button>
              {activeSignal && (
                <button
                  type="button"
                  onClick={() => setPalettePickerOpen(palettePickerOpen === "signals" ? null : "signals")}
                  className="text-xs text-gray-400 hover:text-plum transition-colors"
                >
                  Palette
                </button>
              )}
            </div>
            {palettePickerOpen === "signals" && (
              <SignalPalettePicker
                activePaletteId={signalPalette}
                onSelect={setSignalPalette}
              />
            )}

            {signalsOpen && (
              <div className="space-y-0.5">
                {SIGNAL_IDS.map((signalId) => {
                  const config = SIGNAL_CONFIGS[signalId];
                  const isActive = activeSignal === signalId;

                  return (
                    <div key={signalId}>
                      <button
                        type="button"
                        onClick={() => setActiveSignal(signalId)}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                          isActive ? "bg-plum/5" : "hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isActive
                              ? "border-plum"
                              : "border-gray-300"
                          }`}
                        >
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-plum" />
                          )}
                        </span>
                        <ColorDot color={getSignalPalette(signalPalette).dotColor} />
                        <span
                          className={`text-sm ${isActive ? "font-medium text-plum" : "text-gray-600"}`}
                        >
                          {config.label}
                        </span>
                      </button>

                      {isActive && (
                        <>
                          <div className="space-y-0.5">
                            {(() => {
                              const items = signalId === "expenditure"
                                ? [
                                    { label: "Well Above Avg", catName: "well_above" },
                                    { label: "Above Avg",      catName: "above" },
                                    { label: "Below Avg",      catName: "below" },
                                    { label: "Well Below Avg", catName: "well_below" },
                                  ]
                                : [
                                    { label: "Strong Growth",  catName: "strong_growth" },
                                    { label: "Growth",         catName: "growth" },
                                    { label: "Stable",         catName: "stable" },
                                    { label: "Decline",        catName: "decline" },
                                    { label: "Strong Decline", catName: "strong_decline" },
                                  ];
                              const sigPal = getSignalPalette(signalPalette);
                              return items.map((item) => {
                                const key = `${signalId}:${item.catName}`;
                                const defaultColor = signalId === "expenditure"
                                  ? sigPal.expenditureStops[["well_above","above","below","well_below"].indexOf(item.catName)]
                                  : sigPal.growthStops[["strong_growth","growth","stable","decline","strong_decline"].indexOf(item.catName)];
                                return (
                                  <CategoryRow
                                    key={item.catName}
                                    categoryKey={key}
                                    label={item.label}
                                    checked={true}
                                    onToggle={() => {}}
                                    color={categoryColors[key] ?? defaultColor}
                                    opacity={categoryOpacities[key] ?? 0.55}
                                    onColorChange={(c) => setCategoryColor(key, c)}
                                    onOpacityChange={(o) => setCategoryOpacity(key, o)}
                                    swatchOpen={palettePickerOpen === key}
                                    onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === key ? null : key)}
                                  />
                                );
                              });
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 italic mt-1 mb-1 pl-2">
                  3-year trend (click again to deactivate)
                </p>
              </div>
            )}
          </div>

          {/* Locale */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setLocaleOpen(!localeOpen)}
              className="w-full flex items-center gap-1.5 mt-2 mb-1 group"
            >
              <ChevronDown
                open={localeOpen}
                className="text-gray-400 group-hover:text-gray-600"
              />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                Locale
              </span>
            </button>

            {localeOpen && (
              <div className="space-y-0.5">
                <label
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    visibleLocales.size === ALL_LOCALE_IDS.length
                      ? "bg-plum/5"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleLocales.size === ALL_LOCALE_IDS.length}
                    ref={(el) => {
                      if (el) el.indeterminate =
                        visibleLocales.size > 0 &&
                        visibleLocales.size < ALL_LOCALE_IDS.length;
                    }}
                    onChange={() => {
                      if (visibleLocales.size === ALL_LOCALE_IDS.length) {
                        setVisibleLocales(new Set());
                      } else {
                        setVisibleLocales(new Set(ALL_LOCALE_IDS));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                  />
                  <span
                    className={`text-sm ${
                      visibleLocales.size > 0
                        ? "font-medium text-gray-800"
                        : "text-gray-600"
                    }`}
                  >
                    All Locales
                  </span>
                </label>
                {ALL_LOCALE_IDS.map((localeId) => {
                  const meta = LOCALE_LAYER_META[localeId];
                  const key = `locale:${localeId}`;
                  return (
                    <CategoryRow
                      key={localeId}
                      categoryKey={key}
                      label={meta.label}
                      checked={visibleLocales.has(localeId)}
                      onToggle={() => toggleLocale(localeId)}
                      color={categoryColors[key] ?? meta.color}
                      opacity={categoryOpacities[key] ?? 0.75}
                      onColorChange={(c) => setCategoryColor(key, c)}
                      onOpacityChange={(o) => setCategoryOpacity(key, o)}
                      swatchOpen={palettePickerOpen === key}
                      onToggleSwatch={() => setPalettePickerOpen(palettePickerOpen === key ? null : key)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Schools */}
          <div className="px-3 pb-3 pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setDataLayersOpen(!dataLayersOpen)}
              className="w-full flex items-center gap-1.5 mt-2 mb-1 group"
            >
              <ChevronDown
                open={dataLayersOpen}
                className="text-gray-400 group-hover:text-gray-600"
              />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                Schools
              </span>
            </button>

            {dataLayersOpen && (
              <div className="space-y-0.5">
                {/* Select All toggle */}
                <label
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    visibleSchoolTypes.size === ALL_SCHOOL_TYPES.length
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={visibleSchoolTypes.size === ALL_SCHOOL_TYPES.length}
                    ref={(el) => {
                      if (el) el.indeterminate =
                        visibleSchoolTypes.size > 0 &&
                        visibleSchoolTypes.size < ALL_SCHOOL_TYPES.length;
                    }}
                    onChange={() => {
                      if (visibleSchoolTypes.size === ALL_SCHOOL_TYPES.length) {
                        setVisibleSchoolTypes(new Set());
                      } else {
                        setVisibleSchoolTypes(new Set(ALL_SCHOOL_TYPES));
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                  />
                  <span
                    className={`text-sm ${
                      visibleSchoolTypes.size > 0
                        ? "font-medium text-gray-800"
                        : "text-gray-600"
                    }`}
                  >
                    All Schools
                  </span>
                </label>

                {/* Individual school type toggles */}
                {ALL_SCHOOL_TYPES.map((type) => {
                  const meta = SCHOOL_TYPE_META[type];
                  const isActive = visibleSchoolTypes.has(type);
                  return (
                    <label
                      key={type}
                      className={`flex items-center gap-2.5 pl-6 pr-2 py-1 rounded-lg cursor-pointer transition-colors ${
                        isActive ? "bg-blue-50/50" : "hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleSchoolType(type)}
                        className="w-4 h-4 rounded border-gray-300 text-plum focus:ring-plum/30"
                      />
                      <ColorDot color={meta.color} />
                      <span
                        className={`text-sm ${isActive ? "font-medium text-gray-800" : "text-gray-600"}`}
                      >
                        {meta.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          </div>{/* end scrollable content area */}

          {/* ─── Save View ─── */}
          <div className="px-3 pb-3 pt-1 border-t border-gray-100">
            {!saveDialogOpen ? (
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setSaveDialogOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-medium text-plum hover:text-plum/80 transition-colors"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className="shrink-0"
                  >
                    <path
                      d="M2.5 1.5H8.29L10.5 3.71V9.5C10.5 10.05 10.05 10.5 9.5 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V2.5C1.5 1.95 1.95 1.5 2.5 1.5Z"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <rect
                      x="4"
                      y="7"
                      width="4"
                      height="3.5"
                      rx="0.5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                    <rect
                      x="4"
                      y="1.5"
                      width="3"
                      height="2.5"
                      rx="0.5"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                  Save this view
                </button>

                {savedViews.length > 0 && (
                  <span className="text-xs text-gray-400 ml-auto">
                    {savedViews.length} saved
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    ref={saveInputRef}
                    type="text"
                    value={viewName}
                    onChange={(e) => setViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveView();
                      if (e.key === "Escape") setSaveDialogOpen(false);
                    }}
                    placeholder="View name..."
                    className="flex-1 text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveView}
                    disabled={!viewName.trim()}
                    className="px-2.5 py-1.5 text-xs font-medium bg-plum text-white rounded-lg hover:bg-plum/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveDialogOpen(false);
                      setViewName("");
                    }}
                    className="px-1.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path
                        d="M2 2L8 8M8 2L2 8"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Saved views list */}
            {savedViews.length > 0 && !saveDialogOpen && (
              <div className="mt-2 space-y-0.5 max-h-28 overflow-y-auto">
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 group transition-colors"
                  >
                    {/* Vendor color dots preview */}
                    <div className="flex -space-x-0.5 shrink-0">
                      {view.activeVendors.map((v) => (
                        <ColorDot
                          key={v}
                          color={getVendorPalette(view.vendorPalettes?.[v] ?? DEFAULT_VENDOR_PALETTE[v as VendorId]).dotColor}
                          size="w-1.5 h-1.5"
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleLoadView(view)}
                      className="flex-1 text-left text-sm text-gray-600 hover:text-plum truncate transition-colors"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteView(view.id)}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-red-500 transition-all shrink-0"
                      aria-label={`Delete "${view.name}" view`}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M2 2L8 8M8 2L2 8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showUnsavedWarning && (
            <div className="px-4 py-2.5 bg-amber-50 border-t border-amber-200 flex items-center gap-2">
              <span className="text-xs text-amber-800 flex-1">Unsaved changes</span>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setSaveDialogOpen(true);
                }}
                className="px-2.5 py-1 text-xs font-medium bg-plum text-white rounded-md hover:bg-plum/90 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedWarning(false);
                  setLayerBubbleOpen(false);
                }}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setLayerBubbleOpen(!layerBubbleOpen)}
        className={`
          flex items-center gap-2 px-3 py-2
          bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60
          hover:shadow-xl transition-all duration-150
          ${layerBubbleOpen ? "ring-2 ring-plum/20" : ""}
        `}
        aria-label="Map layers. Click to configure."
      >
        {/* Stacked vendor dots */}
        <div className="flex -space-x-1">
          {VENDOR_IDS.filter((v) => activeVendors.has(v)).map((vendorId) => (
            <span
              key={vendorId}
              className="w-3 h-3 rounded-full border border-white"
              style={{ backgroundColor: getVendorPalette(vendorPalettes[vendorId]).dotColor }}
            />
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700">Build View</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-gray-400 transition-transform duration-150 ${layerBubbleOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M2.5 6.5L5 4L7.5 6.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
