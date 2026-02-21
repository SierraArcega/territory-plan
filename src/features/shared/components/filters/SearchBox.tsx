"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMapStore } from "@/lib/store";
import { useDistricts } from "@/lib/api";

interface SearchBoxProps {
  compact?: boolean;
}

export default function SearchBox({ compact = false }: SearchBoxProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { setSearchQuery, setSelectedLeaid } = useMapStore();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  // Fetch matching districts
  const { data: searchResults, isLoading } = useDistricts({
    search: debouncedValue,
    limit: 10,
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(value.length > 0);
  };

  const handleSelectDistrict = useCallback(
    (leaid: string, name: string) => {
      setSelectedLeaid(leaid);
      setInputValue(name);
      setIsOpen(false);
    },
    [setSelectedLeaid]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(inputValue);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    setSearchQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
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
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue && setIsOpen(true)}
            placeholder="Search districts..."
            className={`w-full pl-10 pr-10 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] placeholder-gray-400 ${
              compact ? "h-9 py-1.5" : "py-2"
            }`}
          />

          {/* Clear Button */}
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#403770]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && debouncedValue && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto"
        >
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
          ) : searchResults?.districts && searchResults.districts.length > 0 ? (
            <>
              {searchResults.districts.map((district) => (
                <button
                  key={district.leaid}
                  onClick={() =>
                    handleSelectDistrict(district.leaid, district.name)
                  }
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#C4E7E6]/30 focus:bg-[#C4E7E6]/30 focus:outline-none"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-[#403770]">
                        {district.name}
                      </span>
                      <span className="ml-2 text-gray-500">
                        {district.stateAbbrev}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {district.isCustomer && (
                        <span className="w-2 h-2 rounded-full bg-[#F37167]" />
                      )}
                      {district.hasOpenPipeline && (
                        <span className="w-2 h-2 rounded-full bg-[#6EA3BE]" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {searchResults.total > searchResults.districts.length && (
                <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100">
                  Showing {searchResults.districts.length} of{" "}
                  {searchResults.total} results. Press Enter to search all.
                </div>
              )}
            </>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">
              No districts found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
