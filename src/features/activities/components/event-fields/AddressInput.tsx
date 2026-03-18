"use client";

import { useState, useEffect, useRef } from "react";
import { searchLocations, type GeocodeSuggestion } from "@/features/map/lib/geocode";

interface AddressInputProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
}

export default function AddressInput({ value, onChange, placeholder = "Search for an address..." }: AddressInputProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchLocations(val);
      setSuggestions(results);
      setShowDropdown(results.length > 0);
    }, 400);
  };

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    setQuery(suggestion.displayName);
    onChange(suggestion.displayName, suggestion.lat, suggestion.lng);
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
      {showDropdown && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm text-[#403770] hover:bg-[#F7F5FA] border-b border-[#E2DEEC] last:border-b-0 transition-colors"
            >
              {s.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
