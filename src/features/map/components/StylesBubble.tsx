"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import type { MapViewState } from "@/features/map/lib/store";
import type { VendorId, ColorDimension } from "@/features/map/lib/layers";
import { VENDOR_CONFIGS, VENDOR_IDS, ALL_LOCALE_IDS, LOCALE_LAYER_META } from "@/features/map/lib/layers";
import { VENDOR_PALETTES, SIGNAL_PALETTES, getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";
import { useCreateMapView, useMapViews } from "@/features/map/lib/map-view-queries";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLOR_DIMENSIONS: { id: ColorDimension; label: string }[] = [
  { id: "engagement", label: "Engagement" },
  { id: "enrollment", label: "Enrollment" },
  { id: "ell", label: "ELL" },
  { id: "swd", label: "SWD" },
  { id: "expenditure", label: "Expenditure" },
  { id: "locale", label: "Locale" },
];

/** Categories per vendor for the "Customize" section */
const FULLMIND_CATEGORIES = [
  { key: "target", label: "Target" },
  { key: "new_business_pipeline", label: "New Pipeline" },
  { key: "winback_pipeline", label: "Winback" },
  { key: "renewal_pipeline", label: "Renewal" },
  { key: "expansion_pipeline", label: "Expansion" },
  { key: "lapsed", label: "Lapsed" },
  { key: "new", label: "First Year" },
  { key: "multi_year_growing", label: "Multi-Year Growing" },
  { key: "multi_year_flat", label: "Multi-Year Flat" },
  { key: "multi_year_shrinking", label: "Multi-Year Shrinking" },
];

const COMPETITOR_CATEGORIES = [
  { key: "churned", label: "Churned" },
  { key: "new_business_pipeline", label: "New Pipeline" },
  { key: "winback_pipeline", label: "Winback" },
  { key: "renewal_pipeline", label: "Renewal" },
  { key: "expansion_pipeline", label: "Expansion" },
  { key: "new", label: "New" },
  { key: "multi_year_growing", label: "Multi-Year Growing" },
  { key: "multi_year_flat", label: "Multi-Year Flat" },
  { key: "multi_year_shrinking", label: "Multi-Year Shrinking" },
];

const GROWTH_CATEGORIES = [
  { key: "strong_growth", label: "Strong Growth" },
  { key: "growth", label: "Growth" },
  { key: "stable", label: "Stable" },
  { key: "decline", label: "Decline" },
  { key: "strong_decline", label: "Strong Decline" },
];

const EXPENDITURE_CATEGORIES = [
  { key: "well_above", label: "Well Above Avg" },
  { key: "above", label: "Above Avg" },
  { key: "below", label: "Below Avg" },
  { key: "well_below", label: "Well Below Avg" },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Small section header */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-1.5">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color By Chips
// ---------------------------------------------------------------------------

function ColorBySection() {
  const colorBy = useMapV2Store((s) => s.colorBy);
  const setColorBy = useMapV2Store((s) => s.setColorBy);

  return (
    <div>
      <SectionHeader>Color By</SectionHeader>
      <div className="flex flex-wrap gap-1">
        {COLOR_DIMENSIONS.map((dim) => {
          const active = colorBy === dim.id;
          return (
            <button
              key={dim.id}
              onClick={() => setColorBy(dim.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                active
                  ? "bg-[#403770] text-white"
                  : "bg-[#f0edf5] text-[#6b5f8a] hover:bg-[#e4dff0]"
              }`}
            >
              {dim.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vendor Palette Selectors
// ---------------------------------------------------------------------------

function VendorPaletteRow({ vendorId }: { vendorId: VendorId }) {
  const currentPaletteId = useMapV2Store((s) => s.vendorPalettes[vendorId]);
  const setVendorPalette = useMapV2Store((s) => s.setVendorPalette);
  const isActive = useMapV2Store((s) => s.activeVendors.has(vendorId));
  const toggleVendor = useMapV2Store((s) => s.toggleVendor);
  const config = VENDOR_CONFIGS[vendorId];

  const currentPalette = VENDOR_PALETTES.find((p) => p.id === currentPaletteId);
  const accentColor = currentPalette?.baseColor ?? "#6b5f8a";

  return (
    <div
      className={`flex items-center gap-1.5 transition-opacity ${
        isActive ? "opacity-100" : "opacity-50"
      }`}
    >
      {/* Toggle checkbox */}
      <button
        onClick={() => toggleVendor(vendorId)}
        className={`w-3.5 h-3.5 rounded border-[1.5px] shrink-0 flex items-center justify-center transition-colors ${
          isActive
            ? "bg-[#403770] border-[#403770]"
            : "bg-white border-[#b3afc6] hover:border-[#403770]"
        }`}
      >
        {isActive && (
          <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
            <path
              d="M2 5l2.5 2.5L8 3"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Vendor name */}
      <span
        className={`text-[12px] w-[88px] truncate shrink-0 ${
          isActive ? "font-bold" : "font-normal text-gray-400"
        }`}
        style={{ color: isActive ? accentColor : undefined }}
      >
        {config.label}
      </span>

      {/* Palette dots */}
      <div className="flex gap-1 flex-wrap">
        {VENDOR_PALETTES.map((palette) => {
          const selected = palette.id === currentPaletteId;
          return (
            <button
              key={palette.id}
              title={palette.label}
              onClick={() => setVendorPalette(vendorId, palette.id)}
              className={`w-4 h-4 rounded-full border-[1.5px] transition-all shrink-0 ${
                selected
                  ? "border-[#403770] scale-110"
                  : "border-transparent hover:border-gray-300"
              }`}
              style={{ backgroundColor: palette.baseColor }}
            />
          );
        })}
      </div>
    </div>
  );
}

function VendorPalettesSection() {
  return (
    <div>
      <SectionHeader>Vendors</SectionHeader>
      <div className="space-y-1.5">
        {VENDOR_IDS.map((vid) => (
          <VendorPaletteRow key={vid} vendorId={vid} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signal Palette Selector
// ---------------------------------------------------------------------------

function SignalPaletteSection() {
  const currentId = useMapV2Store((s) => s.signalPalette);
  const setSignalPalette = useMapV2Store((s) => s.setSignalPalette);

  return (
    <div>
      <SectionHeader>Signal Palette</SectionHeader>
      <div className="flex gap-1.5">
        {SIGNAL_PALETTES.map((palette) => {
          const isActive = palette.id === currentId;
          return (
            <button
              key={palette.id}
              title={palette.label}
              onClick={() => setSignalPalette(palette.id)}
              className={`flex gap-0.5 px-1.5 py-1 rounded-md border transition-all ${
                isActive
                  ? "border-[#403770] bg-[#f8f6fb]"
                  : "border-transparent hover:border-gray-200 bg-gray-50"
              }`}
            >
              {palette.growthStops.map((color, i) => (
                <span
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Customize Colors & Opacity (collapsible)
// ---------------------------------------------------------------------------

function ColorSwatchButton({
  color,
  categoryKey,
}: {
  color: string;
  categoryKey: string;
}) {
  const setCategoryColor = useMapV2Store((s) => s.setCategoryColor);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <button
        className="w-5 h-5 rounded border border-gray-200 shrink-0"
        style={{ backgroundColor: color }}
        onClick={() => inputRef.current?.click()}
        title="Change color"
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => setCategoryColor(categoryKey, e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  );
}

function OpacitySlider({
  value,
  categoryKey,
}: {
  value: number;
  categoryKey: string;
}) {
  const setCategoryOpacity = useMapV2Store((s) => s.setCategoryOpacity);

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) =>
          setCategoryOpacity(categoryKey, parseFloat(e.target.value))
        }
        className="flex-1 h-1 accent-[#403770]"
      />
      <span className="text-[10px] text-gray-400 w-7 text-right tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

function CategoryRow({
  label,
  categoryKey,
}: {
  label: string;
  categoryKey: string;
}) {
  const color = useMapV2Store((s) => s.categoryColors[categoryKey] ?? "#cccccc");
  const opacity = useMapV2Store(
    (s) => s.categoryOpacities[categoryKey] ?? 0.75,
  );

  return (
    <div className="flex items-center gap-2 py-0.5">
      <ColorSwatchButton color={color} categoryKey={categoryKey} />
      <span className="text-[11px] text-gray-600 w-24 truncate shrink-0">
        {label}
      </span>
      <OpacitySlider value={opacity} categoryKey={categoryKey} />
    </div>
  );
}

function CustomizeSection() {
  const [open, setOpen] = useState(false);
  const colorBy = useMapV2Store((s) => s.colorBy);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  const renderCategories = () => {
    if (colorBy === "engagement") {
      const vendorIds = VENDOR_IDS.filter((v) => activeVendors.has(v));
      return vendorIds.map((vid) => {
        const cats =
          vid === "fullmind" ? FULLMIND_CATEGORIES : COMPETITOR_CATEGORIES;
        return (
          <div key={vid} className="mb-3 last:mb-0">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {VENDOR_CONFIGS[vid].label}
            </div>
            {cats.map((cat) => (
              <CategoryRow
                key={`${vid}:${cat.key}`}
                label={cat.label}
                categoryKey={`${vid}:${cat.key}`}
              />
            ))}
          </div>
        );
      });
    }

    if (colorBy === "locale") {
      return (
        <div>
          {ALL_LOCALE_IDS.map((lid) => (
            <CategoryRow
              key={`locale:${lid}`}
              label={LOCALE_LAYER_META[lid].label}
              categoryKey={`locale:${lid}`}
            />
          ))}
        </div>
      );
    }

    // Signal dimensions: enrollment, ell, swd, expenditure
    const signalId = colorBy as string;
    const cats =
      signalId === "expenditure" ? EXPENDITURE_CATEGORIES : GROWTH_CATEGORIES;

    return (
      <div>
        {cats.map((cat) => (
          <CategoryRow
            key={`${signalId}:${cat.key}`}
            label={cat.label}
            categoryKey={`${signalId}:${cat.key}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left"
      >
        <svg
          viewBox="0 0 12 12"
          fill="none"
          className={`w-3 h-3 text-[#8A80A8] transition-transform ${
            open ? "rotate-90" : ""
          }`}
        >
          <path
            d="M4 2l4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase">
          Customize
        </span>
      </button>
      {open && <div className="mt-2 pl-1">{renderCategories()}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved Views
// ---------------------------------------------------------------------------

function SavedViewsSection() {
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDesc, setSaveDesc] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const getViewSnapshot = useMapV2Store((s) => s.getViewSnapshot);
  const applyViewSnapshot = useMapV2Store((s) => s.applyViewSnapshot);
  const createView = useCreateMapView();
  const { data: views, isLoading } = useMapViews();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSave) inputRef.current?.focus();
  }, [showSave]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    setError(null);
    try {
      await createView.mutateAsync({
        name: saveName.trim(),
        description: saveDesc.trim() || undefined,
        isShared,
        state: getViewSnapshot() as unknown as Record<string, unknown>,
      });
      setToast(`Saved "${saveName.trim()}"`);
      setSaveName("");
      setSaveDesc("");
      setShowSave(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleLoad = async (viewId: string, viewName: string) => {
    try {
      const detail = await fetchJson<{ state: MapViewState }>(
        `${API_BASE}/map-views/${viewId}`,
      );
      applyViewSnapshot(detail.state);
      setToast(`Loaded "${viewName}"`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  const handleDelete = async (viewId: string) => {
    try {
      await fetchJson(`${API_BASE}/map-views/${viewId}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <SectionHeader>Saved Views</SectionHeader>

      {toast && (
        <div className="absolute -top-6 left-0 right-0 text-center">
          <span className="inline-block px-2.5 py-1 bg-gray-900 text-white text-[10px] rounded-md shadow-lg">
            {toast}
          </span>
        </div>
      )}

      {!showSave ? (
        <button
          onClick={() => setShowSave(true)}
          className="w-full text-[11px] font-medium text-[#6b5f8a] bg-[#f0edf5] hover:bg-[#e4dff0] rounded-md py-1.5 transition-colors"
        >
          Save current view
        </button>
      ) : (
        <div className="space-y-1.5">
          <input
            ref={inputRef}
            type="text"
            placeholder="View name"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            maxLength={200}
            className="w-full text-[11px] border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#403770]/40"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <textarea
            placeholder="Description (optional)"
            value={saveDesc}
            onChange={(e) => setSaveDesc(e.target.value)}
            rows={2}
            className="w-full text-[11px] border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#403770]/40 resize-none"
          />
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]/40"
            />
            Share with team
          </label>
          {error && (
            <div className="text-[10px] text-red-500">{error}</div>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              onClick={() => setShowSave(false)}
              className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!saveName.trim() || createView.isPending}
              className="text-[11px] font-medium text-white bg-[#403770] hover:bg-[#35305f] disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
            >
              {createView.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Existing saved views list */}
      {isLoading ? (
        <div className="text-[11px] text-gray-400 mt-2">Loading...</div>
      ) : views && views.length > 0 ? (
        <div className="mt-2 max-h-28 overflow-y-auto -mx-0.5 space-y-0.5">
          {views.map((v) => (
            <div
              key={v.id}
              className="flex items-center gap-1 group"
            >
              <button
                onClick={() => handleLoad(v.id, v.name)}
                className="flex-1 text-left text-[11px] text-gray-600 hover:text-[#403770] hover:bg-[#f8f6fb] rounded px-1.5 py-1 truncate transition-colors"
              >
                {v.name}
                {v.isShared && (
                  <span className="text-gray-400 ml-1 text-[9px]">
                    shared
                  </span>
                )}
              </button>
              <button
                onClick={() => handleDelete(v.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 p-0.5 transition-opacity"
                title="Delete"
              >
                <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3">
                  <path
                    d="M3 3l6 6M9 3l-6 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main StylesBubble
// ---------------------------------------------------------------------------

export default function StylesBubble() {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const colorBy = useMapV2Store((s) => s.colorBy);
  const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
  const signalPalette = useMapV2Store((s) => s.signalPalette);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  // Close on click outside
  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  // Close on Escape
  useEffect(() => {
    if (!expanded) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expanded]);

  // Derive preview dots from current palette
  const previewDots = getPreviewDots(
    colorBy,
    vendorPalettes,
    signalPalette,
    activeVendors,
  );

  const isEngagement = colorBy === "engagement";
  const isSignal =
    colorBy === "enrollment" ||
    colorBy === "ell" ||
    colorBy === "swd" ||
    colorBy === "expenditure";

  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 left-4 z-10"
    >
      {/* Expanded popover */}
      {expanded && (
        <div className="absolute bottom-full left-0 mb-2 w-[360px] max-h-[60vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200/60 p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[#403770]">
              District Styles
            </span>
            <button
              onClick={() => setExpanded(false)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
            >
              <svg viewBox="0 0 12 12" fill="none" className="w-3.5 h-3.5">
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <ColorBySection />

            {isEngagement && <VendorPalettesSection />}
            {isSignal && <SignalPaletteSection />}

            <div className="border-t border-gray-100 pt-3">
              <CustomizeSection />
            </div>

            <div className="border-t border-gray-100 pt-3">
              <SavedViewsSection />
            </div>
          </div>
        </div>
      )}

      {/* Collapsed pill button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/95 rounded-full shadow-md border border-gray-200/60 hover:shadow-lg transition-shadow"
      >
        {/* Paint palette icon */}
        <svg
          viewBox="0 0 16 16"
          fill="none"
          className="w-4 h-4 text-[#403770]"
        >
          <path
            d="M8 1.5a6.5 6.5 0 00-1.97 12.69c.33.1.45-.14.45-.31v-2.17c-1.83.45-2.21-.78-2.21-.78a1.74 1.74 0 00-.73-1c-.6-.41.04-.4.04-.4a1.38 1.38 0 011 .68 1.4 1.4 0 001.91.54 1.38 1.38 0 01.42-.88c-1.46-.17-3-.73-3-3.26a2.55 2.55 0 01.68-1.77 2.37 2.37 0 01.07-1.74s.55-.18 1.8.67a6.23 6.23 0 013.28 0c1.25-.85 1.8-.67 1.8-.67a2.37 2.37 0 01.07 1.74 2.55 2.55 0 01.68 1.77c0 2.54-1.55 3.09-3.02 3.25a1.55 1.55 0 01.44 1.22v1.8c0 .17.12.42.46.31A6.5 6.5 0 008 1.5z"
            fill="currentColor"
          />
          <circle cx="6" cy="6" r="1" fill="#F37167" />
          <circle cx="10" cy="6" r="1" fill="#6EA3BE" />
          <circle cx="8" cy="9" r="1" fill="#FFCF70" />
        </svg>

        <span className="text-[12px] font-medium text-[#403770]">Styles</span>

        {/* Preview dots */}
        <div className="flex gap-0.5 ml-0.5">
          {previewDots.map((color, i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPreviewDots(
  colorBy: ColorDimension,
  vendorPalettes: Record<VendorId, string>,
  signalPaletteId: string,
  activeVendors: Set<VendorId>,
): string[] {
  if (colorBy === "engagement") {
    // Show base colors of the first few active vendor palettes
    const ids = VENDOR_IDS.filter((v) => activeVendors.has(v)).slice(0, 4);
    return ids.map((vid) => getVendorPalette(vendorPalettes[vid]).baseColor);
  }

  if (colorBy === "locale") {
    return ALL_LOCALE_IDS.map((lid) => LOCALE_LAYER_META[lid].color);
  }

  // Signals
  const pal = getSignalPalette(signalPaletteId);
  if (colorBy === "expenditure") {
    return [...pal.expenditureStops];
  }
  return pal.growthStops.slice(0, 4);
}
