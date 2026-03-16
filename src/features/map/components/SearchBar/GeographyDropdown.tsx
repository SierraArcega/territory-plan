"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { mapV2Ref } from "@/features/map/lib/ref";
import ToggleChips from "./controls/ToggleChips";
import FilterMultiSelect from "./controls/FilterMultiSelect";


interface GeographyDropdownProps {
  onClose: () => void;
}

export default function GeographyDropdown({ onClose }: GeographyDropdownProps) {
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const ref = useRef<HTMLDivElement>(null);

  const [states, setStates] = useState<Array<{ abbrev: string; name: string }>>([]);
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("25");
  const [zipLoading, setZipLoading] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const addFilter = (column: string, op: string, value: any) => {
    addSearchFilter({ id: crypto.randomUUID(), column, op: op as any, value });
  };

  const handleZipSearch = async () => {
    if (!zip || zip.length < 5) return;
    setZipLoading(true);

    try {
      // Geocode the ZIP code
      const params = new URLSearchParams({ q: zip, format: "json", limit: "1", countrycodes: "us" });
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { "User-Agent": "TerritoryPlanBuilder/1.0" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.length) return;

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      const miles = Number(radius);

      // Add a special zip+radius filter
      addFilter("_zipRadius", "eq", { zip, lat, lng, miles });

      // Fly the map to the ZIP location with appropriate zoom
      const map = mapV2Ref.current;
      if (map) {
        const zoomByRadius: Record<number, number> = { 5: 11, 10: 10, 25: 9, 50: 8, 100: 7 };
        map.flyTo({ center: [lng, lat], zoom: zoomByRadius[miles] || 9, duration: 1500 });
      }

      setZip("");
    } finally {
      setZipLoading(false);
    }
  };

  return (
    <div ref={ref} className="bg-white rounded-xl shadow-xl border border-[#D4CFE2] p-4 w-[340px] animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#544A78]">Geography</h3>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {/* ZIP + Radius */}
        <div>
          <label className="text-xs font-medium text-[#8A80A8] mb-1.5 block">ZIP Code + Radius</label>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="ZIP code"
              maxLength={5}
              className="w-24 px-2 py-1.5 rounded border border-[#D4CFE2] text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
              onKeyDown={(e) => e.key === "Enter" && handleZipSearch()}
            />
            <select
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              className="px-2 py-1.5 rounded border border-[#D4CFE2] text-xs focus:outline-none focus:ring-1 focus:ring-plum/30"
            >
              <option value="5">5 mi</option>
              <option value="10">10 mi</option>
              <option value="25">25 mi</option>
              <option value="50">50 mi</option>
              <option value="100">100 mi</option>
            </select>
            <button
              onClick={handleZipSearch}
              disabled={zip.length < 5 || zipLoading}
              className="px-2.5 py-1.5 rounded text-[10px] font-bold text-white bg-plum hover:bg-plum/90 disabled:opacity-40 transition-colors"
            >
              {zipLoading ? "..." : "Search"}
            </button>
          </div>
        </div>

        {/* State */}
        {states.length > 0 && (
          <FilterMultiSelect
            label="State"
            column="state"
            options={states.map((s) => ({ value: s.abbrev, label: `${s.name} (${s.abbrev})` }))}
            onApply={(col, vals) => addFilter(col, "in", vals)}
          />
        )}

        {/* Urbanicity */}
        <ToggleChips
          label="Urbanicity"
          options={[
            { label: "City", column: "urbanicity", op: "in", value: ["11", "12", "13"] },
            { label: "Suburb", column: "urbanicity", op: "in", value: ["21", "22", "23"] },
            { label: "Town", column: "urbanicity", op: "in", value: ["31", "32", "33"] },
            { label: "Rural", column: "urbanicity", op: "in", value: ["41", "42", "43"] },
          ]}
          onSelect={(opt) => addSearchFilter({ id: crypto.randomUUID(), column: opt.column, op: opt.op as any, value: opt.value })}
        />
      </div>
    </div>
  );
}
