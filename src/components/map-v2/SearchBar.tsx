"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";

interface SearchResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  enrollment: number | null;
}

export default function SearchBar() {
  const searchQuery = useMapV2Store((s) => s.searchQuery);
  const setSearchQuery = useMapV2Store((s) => s.setSearchQuery);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/districts?search=${encodeURIComponent(query)}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.districts || []);
        setShowResults(true);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const handleSelect = (result: SearchResult) => {
    setSearchQuery("");
    setShowResults(false);
    setResults([]);
    selectDistrict(result.leaid);
  };

  // Close results on outside click
  useEffect(() => {
    if (!showResults) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showResults]);

  return (
    <div ref={containerRef} className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => results.length > 0 && setShowResults(true)}
        placeholder="Search districts..."
        className="w-full pl-9 pr-8 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 transition-all"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-plum rounded-full tile-loading-spinner" />
        </div>
      )}
      {!loading && searchQuery && (
        <button
          onClick={() => {
            setSearchQuery("");
            setResults([]);
            setShowResults(false);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
          aria-label="Clear search"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}

      {/* Results dropdown */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 max-h-[280px] overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.leaid}
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-gray-300 shrink-0">
                <path d="M7 1C4.5 1 2.5 3.5 2.5 6C2.5 9 7 13 7 13S11.5 9 11.5 6C11.5 3.5 9.5 1 7 1Z" stroke="currentColor" strokeWidth="1.2" />
                <circle cx="7" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-700 truncate">{result.name}</div>
                <div className="text-xs text-gray-400">
                  {result.stateAbbrev}
                  {result.enrollment ? ` · ${result.enrollment.toLocaleString()} students` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && searchQuery.length >= 2 && !loading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-4 z-30 text-center">
          <p className="text-xs text-gray-400">No districts found</p>
        </div>
      )}
    </div>
  );
}
