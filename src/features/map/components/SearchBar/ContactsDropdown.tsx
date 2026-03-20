"use client";

import { useRef, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

interface ContactsDropdownProps {
  onClose: () => void;
}

const SENIORITY_LEVELS = [
  "Executive Leadership",
  "Senior Leadership",
  "Director Level",
  "Manager/Coordinator Level",
  "Specialist Level",
  "Administrative Support",
  "School-Level Leadership",
];

const PERSONAS = [
  "Superintendent",
  "Assistant Superintendent",
  "Chief Academic Officer",
  "Director of Curriculum",
  "Director of Special Education",
  "Director of ELL/Bilingual",
  "Director of Technology",
  "Director of Federal Programs",
  "Chief Financial Officer",
  "Director of HR",
  "Director of Student Services",
  "Principal",
  "Assistant Principal",
  "Instructional Coach",
  "Other",
];

export default function ContactsDropdown({ onClose }: ContactsDropdownProps) {
  const filters = useMapV2Store((s) => s.layerFilters.contacts);
  const setLayerFilter = useMapV2Store((s) => s.setLayerFilter);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement).closest(".search-bar-root")) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const toggleSeniority = useCallback((level: string) => {
    const current = filters.seniorityLevel ?? [];
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level];
    setLayerFilter("contacts", { seniorityLevel: next.length ? next : null });
  }, [filters.seniorityLevel, setLayerFilter]);

  const togglePersona = useCallback((persona: string) => {
    const current = filters.persona ?? [];
    const next = current.includes(persona)
      ? current.filter((p) => p !== persona)
      : [...current, persona];
    setLayerFilter("contacts", { persona: next.length ? next : null });
  }, [filters.persona, setLayerFilter]);

  const togglePrimaryOnly = useCallback(() => {
    setLayerFilter("contacts", { primaryOnly: !filters.primaryOnly });
  }, [filters.primaryOnly, setLayerFilter]);

  return (
    <div ref={ref} className="bg-white rounded-lg shadow-lg border border-[#D4CFE2] p-4 min-w-[280px] max-h-[60vh] overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F37167]" />
          <h3 className="text-sm font-semibold text-[#544A78]">Contacts</h3>
        </div>
        <button onClick={onClose} className="text-[#A69DC0] hover:text-[#6E6390]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Seniority Level */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Seniority Level</h4>
          <div className="space-y-1">
            {SENIORITY_LEVELS.map((level) => (
              <label key={level} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.seniorityLevel ?? []).includes(level)}
                  onChange={() => toggleSeniority(level)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{level}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Persona */}
        <div>
          <h4 className="text-[11px] font-semibold text-[#8A80A8] tracking-wider uppercase mb-2">Persona</h4>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {PERSONAS.map((persona) => (
              <label key={persona} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F7F5FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={(filters.persona ?? []).includes(persona)}
                  onChange={() => togglePersona(persona)}
                  className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/20 accent-[#403770]"
                />
                <span className="text-xs text-[#544A78]">{persona}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Primary Contact Only */}
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-[#544A78]">Primary Contact Only</span>
          <button
            onClick={togglePrimaryOnly}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              filters.primaryOnly ? "bg-[#403770]" : "bg-[#D4CFE2]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                filters.primaryOnly ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
