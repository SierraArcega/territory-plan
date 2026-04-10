"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface DistrictSearchResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  cityLocation: string | null;
}

interface DistrictSearchInputProps {
  excludeLeaids: string[];
  onSelect: (district: { leaid: string; name: string; stateAbbrev: string | null }) => void;
}

export default function DistrictSearchInput({
  excludeLeaids,
  onSelect,
}: DistrictSearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<DistrictSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    let cancelled = false;

    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/districts/search?q=${encodeURIComponent(debouncedQuery)}`
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (!cancelled) {
          setResults(data.items ?? []);
          setShowDropdown(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (district: DistrictSearchResult) => {
      if (excludeLeaids.includes(district.leaid)) return;
      onSelect({
        leaid: district.leaid,
        name: district.name,
        stateAbbrev: district.stateAbbrev,
      });
      setQuery("");
      setResults([]);
      setShowDropdown(false);
    },
    [excludeLeaids, onSelect]
  );

  const formatEnrollment = (enrollment: number | null): string => {
    if (enrollment === null) return "";
    if (enrollment >= 1000) {
      return `${(enrollment / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return enrollment.toLocaleString();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search districts..."
          className="w-full pl-8 pr-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
        {isLoading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#A69DC0] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-[#E2DEEC] rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 && !isLoading ? (
            <div className="px-3 py-3 text-sm text-[#A69DC0] italic">
              No districts found
            </div>
          ) : (
            results.slice(0, 8).map((district) => {
              const isExcluded = excludeLeaids.includes(district.leaid);
              return (
                <button
                  key={district.leaid}
                  type="button"
                  onClick={() => handleSelect(district)}
                  disabled={isExcluded}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    isExcluded
                      ? "text-[#C2BBD4] cursor-not-allowed bg-[#FAFAFA]"
                      : "text-[#403770] hover:bg-[#F7F5FA] cursor-pointer"
                  }`}
                >
                  <span className="font-medium">{district.name}</span>
                  {district.stateAbbrev && (
                    <span className="text-[#A69DC0] ml-1">
                      · {district.stateAbbrev}
                    </span>
                  )}
                  {district.enrollment !== null && (
                    <span className="text-[#A69DC0] ml-1">
                      ({formatEnrollment(district.enrollment)})
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
