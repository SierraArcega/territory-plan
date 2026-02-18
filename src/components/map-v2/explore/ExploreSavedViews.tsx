"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type {
  ExploreEntity,
  ExploreFilter,
  ExploreSortConfig,
  ExploreSavedView,
} from "@/lib/map-v2-store";

interface ExploreSavedViewsProps {
  entity: ExploreEntity;
  // Current state for comparison
  currentFilters: ExploreFilter[];
  currentSorts: ExploreSortConfig[];
  currentColumns: string[];
  // Saved views from store
  savedViews: ExploreSavedView[];
  activeViewId: string | null;
  // Actions
  onSave: (view: ExploreSavedView) => void;
  onLoad: (viewId: string) => void;
  onDelete: (viewId: string) => void;
  onSetActiveViewId: (viewId: string | null) => void;
  // Reset to defaults
  onResetToDefaults: () => void;
}

export default function ExploreSavedViews({
  entity,
  currentFilters,
  currentSorts,
  currentColumns,
  savedViews,
  activeViewId,
  onSave,
  onLoad,
  onDelete,
  onSetActiveViewId,
  onResetToDefaults,
}: ExploreSavedViewsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setIsCreating(false);
        setNewViewName("");
      }
    },
    []
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, handleOutsideClick]);

  // Close when entity changes
  useEffect(() => {
    setIsOpen(false);
    setIsCreating(false);
    setNewViewName("");
  }, [entity]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Determine active view and label
  const activeView = savedViews.find((v) => v.id === activeViewId);

  // Detect if current state differs from default (no filters, no sorts, default columns)
  const hasModifications =
    currentFilters.length > 0 || currentSorts.length > 0;

  // Compute trigger label
  let triggerLabel = "Default View";
  if (activeView) {
    triggerLabel = activeView.name;
  } else if (hasModifications) {
    triggerLabel = "Unsaved View";
  }

  // Handle saving a new view
  const handleSaveNew = () => {
    const trimmed = newViewName.trim();
    if (!trimmed) return;

    const view: ExploreSavedView = {
      id: crypto.randomUUID(),
      name: trimmed,
      entity,
      filters: [...currentFilters],
      sorts: [...currentSorts],
      columns: [...currentColumns],
    };

    onSave(view);
    setIsCreating(false);
    setNewViewName("");
    setIsOpen(false);
  };

  // Handle loading "Default" view
  const handleLoadDefault = () => {
    onSetActiveViewId(null);
    onResetToDefaults();
    setIsOpen(false);
  };

  // Handle loading a saved view
  const handleLoadView = (viewId: string) => {
    onLoad(viewId);
    setIsOpen(false);
  };

  // Handle deleting a saved view
  const handleDeleteView = (e: React.MouseEvent, viewId: string) => {
    e.stopPropagation();
    onDelete(viewId);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) {
            setIsCreating(false);
            setNewViewName("");
          }
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          isOpen
            ? "bg-[#C4E7E6]/20 border-[#403770]/20 text-[#403770]"
            : "bg-white border-gray-200 text-gray-600 hover:border-[#403770]/20 hover:text-[#403770]"
        }`}
      >
        {/* Bookmark icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 2.5H11V12L7 9.5L3 12V2.5Z" />
        </svg>
        <span className="truncate max-w-[120px]">{triggerLabel}</span>
        {/* Dropdown chevron */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path d="M2.5 3.5L5 6L7.5 3.5" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Default view option — always first */}
          <div className="py-1">
            <button
              onClick={handleLoadDefault}
              className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors ${
                activeViewId === null
                  ? "bg-[#C4E7E6]/15 text-[#403770] font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {/* List icon for Default */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <path d="M2 3.5H12M2 7H12M2 10.5H12" />
              </svg>
              <span className="flex-1 truncate">Default</span>
              {activeViewId === null && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="#403770"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-shrink-0"
                >
                  <path d="M2 6L5 9L10 3" />
                </svg>
              )}
            </button>
          </div>

          {/* Saved views list */}
          {savedViews.length > 0 && (
            <>
              <div className="border-t border-gray-100" />
              <div className="py-1">
                {savedViews.map((view) => (
                  <button
                    key={view.id}
                    onClick={() => handleLoadView(view.id)}
                    className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 group transition-colors ${
                      activeViewId === view.id
                        ? "bg-[#C4E7E6]/15 text-[#403770] font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {/* Bookmark icon */}
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill={activeViewId === view.id ? "#403770" : "none"}
                      stroke={activeViewId === view.id ? "#403770" : "currentColor"}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0"
                    >
                      <path d="M3 2.5H11V12L7 9.5L3 12V2.5Z" />
                    </svg>
                    <span className="flex-1 truncate">{view.name}</span>
                    {/* Active checkmark */}
                    {activeViewId === view.id && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="#403770"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="flex-shrink-0"
                      >
                        <path d="M2 6L5 9L10 3" />
                      </svg>
                    )}
                    {/* Delete button — hidden until hover */}
                    <button
                      onClick={(e) => handleDeleteView(e, view.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-[#F37167] transition-all p-0.5"
                      title="Delete view"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <path d="M2 3H10M4.5 3V2H7.5V3M4.5 5V9M7.5 5V9M3 3V10.5H9V3" />
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Divider + Save current view */}
          <div className="border-t border-gray-100" />
          <div className="px-2 py-1.5">
            {!isCreating ? (
              <button
                onClick={() => setIsCreating(true)}
                className="w-full text-left px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-[#403770] hover:bg-[#C4E7E6]/10 rounded-md transition-all"
              >
                + Save current view
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="View name..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNew();
                    if (e.key === "Escape") {
                      setIsCreating(false);
                      setNewViewName("");
                    }
                  }}
                  className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770]/40"
                />
                <button
                  onClick={handleSaveNew}
                  disabled={!newViewName.trim()}
                  className="flex-shrink-0 px-2.5 py-1.5 text-xs font-medium bg-[#403770] text-white rounded-lg hover:bg-[#403770]/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
