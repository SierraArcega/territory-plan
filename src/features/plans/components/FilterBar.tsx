"use client";

// FilterBar - Universal filter bar with search, filters, sort, group, and saved views
// Follows Fullmind brand with coral/plum accent colors and clean compact design

import { useState, useRef, useEffect } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  id: string;
  label: string;
  type: "select" | "multiselect";
  options: FilterOption[];
}

export interface SavedView {
  id: string;
  name: string;
  tab: string;
  filters: Record<string, string | string[]>;
  sort: { field: string; direction: "asc" | "desc" };
  groupBy: string;
  viewMode: "cards" | "table";
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string | string[]>;
  onFilterChange: (filters: Record<string, string | string[]>) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  sortOptions: FilterOption[];
  currentSort: { field: string; direction: "asc" | "desc" };
  onSortChange: (sort: { field: string; direction: "asc" | "desc" }) => void;
  groupOptions: FilterOption[];
  currentGroup: string;
  onGroupChange: (group: string) => void;
  savedViews: SavedView[];
  onSaveView: (name: string) => void;
  onLoadView: (view: SavedView) => void;
  onDeleteView: (viewId: string) => void;
}

// Dropdown component for consistent styling
interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  align?: "left" | "right";
}

function Dropdown({ trigger, children, isOpen, onToggle, onClose, align = "left" }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={onToggle}>{trigger}</div>
      {isOpen && (
        <div
          className={`
            absolute z-50 mt-1 min-w-[180px] bg-white rounded-lg shadow-lg border border-gray-200 py-1
            ${align === "right" ? "right-0" : "left-0"}
          `}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Filter chip for active filters
interface FilterChipProps {
  label: string;
  value: string | string[];
  onRemove: () => void;
}

function FilterChip({ label, value, onRemove }: FilterChipProps) {
  const displayValue = Array.isArray(value) ? value.join(", ") : value;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#C4E7E6] text-[#403770] rounded-full">
      <span className="text-gray-500">{label}:</span>
      <span className="truncate max-w-[100px]">{displayValue}</span>
      <button
        onClick={onRemove}
        className="ml-0.5 hover:text-[#F37167] transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}

export default function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  searchTerm,
  onSearchChange,
  sortOptions,
  currentSort,
  onSortChange,
  groupOptions,
  currentGroup,
  onGroupChange,
  savedViews,
  onSaveView,
  onLoadView,
  onDeleteView,
}: FilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [saveViewName, setSaveViewName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

  const closeDropdowns = () => setOpenDropdown(null);

  const handleFilterSelect = (filterId: string, value: string) => {
    const filter = filters.find(f => f.id === filterId);
    if (!filter) return;

    if (filter.type === "multiselect") {
      const currentValues = (activeFilters[filterId] as string[]) || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter(v => v !== value)
        : [...currentValues, value];
      onFilterChange({ ...activeFilters, [filterId]: newValues.length ? newValues : [] });
    } else {
      onFilterChange({ ...activeFilters, [filterId]: value });
      closeDropdowns();
    }
  };

  const handleRemoveFilter = (filterId: string) => {
    const newFilters = { ...activeFilters };
    delete newFilters[filterId];
    onFilterChange(newFilters);
  };

  const handleClearAll = () => {
    onFilterChange({});
    onSearchChange("");
  };

  const handleSaveView = () => {
    if (saveViewName.trim()) {
      onSaveView(saveViewName.trim());
      setSaveViewName("");
      setShowSaveInput(false);
      closeDropdowns();
    }
  };

  const activeFilterCount = Object.keys(activeFilters).filter(
    k => activeFilters[k] && (Array.isArray(activeFilters[k]) ? (activeFilters[k] as string[]).length > 0 : true)
  ).length;

  const hasActiveState = activeFilterCount > 0 || searchTerm;

  return (
    <div className="space-y-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200" />

        {/* Filter dropdowns */}
        {filters.map((filter) => {
          if (filter.options.length === 0) return null;

          const isActive = activeFilters[filter.id] &&
            (Array.isArray(activeFilters[filter.id])
              ? (activeFilters[filter.id] as string[]).length > 0
              : true);

          return (
            <Dropdown
              key={filter.id}
              isOpen={openDropdown === filter.id}
              onToggle={() => setOpenDropdown(openDropdown === filter.id ? null : filter.id)}
              onClose={closeDropdowns}
              trigger={
                <button
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? "bg-[#403770] text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }
                  `}
                >
                  {filter.label}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              }
            >
              <div className="max-h-[240px] overflow-y-auto">
                {filter.options.map((option) => {
                  const isSelected = filter.type === "multiselect"
                    ? ((activeFilters[filter.id] as string[]) || []).includes(option.value)
                    : activeFilters[filter.id] === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => handleFilterSelect(filter.id, option.value)}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                        ${isSelected
                          ? "bg-[#C4E7E6] text-[#403770]"
                          : "text-gray-700 hover:bg-gray-50"
                        }
                      `}
                    >
                      {filter.type === "multiselect" && (
                        <span className={`
                          w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                          ${isSelected ? "bg-[#403770] border-[#403770]" : "border-gray-300"}
                        `}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                      )}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </Dropdown>
          );
        })}

        {/* Sort dropdown */}
        <Dropdown
          isOpen={openDropdown === "sort"}
          onToggle={() => setOpenDropdown(openDropdown === "sort" ? null : "sort")}
          onClose={closeDropdowns}
          trigger={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Sort
            </button>
          }
        >
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                const newDirection = currentSort.field === option.value && currentSort.direction === "asc" ? "desc" : "asc";
                onSortChange({ field: option.value, direction: newDirection });
                closeDropdowns();
              }}
              className={`
                w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors
                ${currentSort.field === option.value
                  ? "bg-[#C4E7E6] text-[#403770]"
                  : "text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              <span>{option.label}</span>
              {currentSort.field === option.value && (
                <svg
                  className={`w-4 h-4 transition-transform ${currentSort.direction === "desc" ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              )}
            </button>
          ))}
        </Dropdown>

        {/* Group dropdown */}
        <Dropdown
          isOpen={openDropdown === "group"}
          onToggle={() => setOpenDropdown(openDropdown === "group" ? null : "group")}
          onClose={closeDropdowns}
          trigger={
            <button className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors
              ${currentGroup !== "none"
                ? "bg-[#403770] text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }
            `}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Group
            </button>
          }
        >
          {groupOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onGroupChange(option.value);
                closeDropdowns();
              }}
              className={`
                w-full flex items-center px-3 py-2 text-sm text-left transition-colors
                ${currentGroup === option.value
                  ? "bg-[#C4E7E6] text-[#403770]"
                  : "text-gray-700 hover:bg-gray-50"
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </Dropdown>

        {/* Saved Views dropdown */}
        <Dropdown
          isOpen={openDropdown === "views"}
          onToggle={() => setOpenDropdown(openDropdown === "views" ? null : "views")}
          onClose={() => {
            closeDropdowns();
            setShowSaveInput(false);
            setSaveViewName("");
          }}
          align="right"
          trigger={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Views
              {savedViews.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-[#403770] text-white rounded-full">
                  {savedViews.length}
                </span>
              )}
            </button>
          }
        >
          <div className="min-w-[220px]">
            {savedViews.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Saved Views
                </div>
                {savedViews.map((view) => (
                  <div
                    key={view.id}
                    className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 group"
                  >
                    <button
                      onClick={() => {
                        onLoadView(view);
                        closeDropdowns();
                      }}
                      className="flex-1 text-sm text-left text-gray-700 hover:text-[#403770]"
                    >
                      {view.name}
                    </button>
                    <button
                      onClick={() => onDeleteView(view.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      aria-label={`Delete ${view.name} view`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
                <div className="border-t border-gray-100 my-1" />
              </>
            )}

            {showSaveInput ? (
              <div className="p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="View name..."
                    value={saveViewName}
                    onChange={(e) => setSaveViewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveView();
                      if (e.key === "Escape") {
                        setShowSaveInput(false);
                        setSaveViewName("");
                      }
                    }}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveView}
                    disabled={!saveViewName.trim()}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveInput(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#403770] hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Save Current View
              </button>
            )}
          </div>
        </Dropdown>

        {/* Clear all button */}
        {hasActiveState && (
          <button
            onClick={handleClearAll}
            className="text-sm text-gray-500 hover:text-[#F37167] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Filtered by:</span>
          {Object.entries(activeFilters).map(([key, value]) => {
            if (!value || (Array.isArray(value) && value.length === 0)) return null;
            const filter = filters.find(f => f.id === key);
            if (!filter) return null;

            // Get display labels for the values
            const displayValue = Array.isArray(value)
              ? value.map(v => filter.options.find(o => o.value === v)?.label || v)
              : filter.options.find(o => o.value === value)?.label || value;

            return (
              <FilterChip
                key={key}
                label={filter.label}
                value={displayValue}
                onRemove={() => handleRemoveFilter(key)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
