"use client";

import { useRef, useEffect, useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { VENDOR_CONFIGS, VENDOR_IDS, type VendorId } from "@/lib/map-v2-layers";

const VENDOR_DOT_COLORS: Record<VendorId, string> = {
  fullmind: "#403770",
  proximity: "#F37167",
  elevate: "#6EA3BE",
  tbt: "#FFCF70",
};

export default function LayerBubble() {
  const activeVendors = useMapV2Store((s) => s.activeVendors);
  const toggleVendor = useMapV2Store((s) => s.toggleVendor);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const setFilterOwner = useMapV2Store((s) => s.setFilterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const setFilterPlanId = useMapV2Store((s) => s.setFilterPlanId);
  const layerBubbleOpen = useMapV2Store((s) => s.layerBubbleOpen);
  const setLayerBubbleOpen = useMapV2Store((s) => s.setLayerBubbleOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch filter options
  const [owners, setOwners] = useState<string[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);

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
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
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
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Build summary text for the collapsed pill
  const vendorCount = activeVendors.size;
  const filterCount = (filterOwner ? 1 : 0) + (filterPlanId ? 1 : 0);
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
          className="absolute bottom-full right-0 mb-2 w-[320px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Map Layers
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

          {/* Filters */}
          <div className="px-3 pb-2 space-y-2">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
              Filters
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

            {/* Plan filter */}
            <select
              value={filterPlanId || ""}
              onChange={(e) => setFilterPlanId(e.target.value || null)}
              className="w-full text-sm bg-gray-50 border border-gray-200/60 rounded-lg px-2.5 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30"
            >
              <option value="">All Plans</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor layers */}
          <div className="px-3 pb-2 pt-1 border-t border-gray-100">
            <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 mt-2">
              Vendor Layers
            </div>
            <div className="space-y-0.5">
              {VENDOR_IDS.map((vendorId) => {
                const config = VENDOR_CONFIGS[vendorId];
                const isActive = activeVendors.has(vendorId);
                const isLastActive = isActive && activeVendors.size === 1;

                return (
                  <label
                    key={vendorId}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors group ${
                      isActive ? "bg-plum/5" : "hover:bg-gray-50"
                    }`}
                    title={config.shadingTooltip}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      disabled={isLastActive}
                      onChange={() => toggleVendor(vendorId)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-plum focus:ring-plum/30 disabled:opacity-40"
                    />
                    <span
                      className={`text-sm ${isActive ? "font-medium text-plum" : "text-gray-600"}`}
                    >
                      {config.label}
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Shading hint */}
            <p className="text-[11px] text-gray-400 italic mt-2 mb-1">
              Darker = deeper engagement
            </p>
          </div>
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
              className="w-2.5 h-2.5 rounded-full border border-white"
              style={{ backgroundColor: VENDOR_DOT_COLORS[vendorId] }}
            />
          ))}
        </div>
        <span className="text-sm font-medium text-gray-700">{pillText}</span>
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
