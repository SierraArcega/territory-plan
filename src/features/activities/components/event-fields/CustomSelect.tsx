"use client";

import { useState, useRef, useEffect } from "react";

interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
}

export default function CustomSelect({ label, value, onChange, options, placeholder = "Select..." }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLabel = options.find((o) => o.value === value)?.label || placeholder;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[#8A80A8] mb-1">{label}</label>

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-colors bg-white ${
          isOpen
            ? "border-transparent ring-2 ring-[#F37167]"
            : "border-[#C2BBD4]"
        }`}
      >
        <span className={value ? "text-[#403770]" : "text-[#A69DC0]"}>
          {selectedLabel}
        </span>
        <svg
          className={`w-4 h-4 text-[#A69DC0] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  isSelected
                    ? "bg-[#F7F5FA] text-[#403770] font-medium"
                    : "text-[#544A78] hover:bg-[#F7F5FA]"
                }`}
              >
                {opt.label}
                {isSelected && (
                  <svg className="w-3.5 h-3.5 ml-auto text-[#403770]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
