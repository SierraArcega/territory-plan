"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import {
  useSavedViews,
  type SavedView,
} from "@/features/activities/lib/saved-views";
import { cn } from "@/features/shared/lib/cn";

/**
 * Saved-view tabs row. Renders user-saved views with a hover-revealed ×
 * button; "Save view" is right-aligned. The row is empty until the user
 * saves their first view.
 */
export default function SavedViewTabs(_: { currentUserId: string | null }) {
  const { views, save, remove } = useSavedViews();
  const setFilters = useActivitiesChrome((s) => s.setFilters);
  const filters = useActivitiesChrome((s) => s.filters);
  const savedViewId = useActivitiesChrome((s) => s.savedViewId);
  const setSavedViewId = useActivitiesChrome((s) => s.setSavedViewId);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  function applySaved(view: SavedView) {
    setFilters(view.filters);
    setSavedViewId(view.id);
  }

  function commitSave() {
    const name = draftName.trim();
    if (!name) {
      setNaming(false);
      return;
    }
    const view = save(name, filters);
    setSavedViewId(view.id);
    setDraftName("");
    setNaming(false);
  }

  return (
    <div className="flex items-end gap-0.5 px-6 border-b border-[#E2DEEC] bg-white overflow-x-auto -mb-px">
      {views.map((v) => (
        <span key={v.id} className="inline-flex items-end group">
          <SavedTab
            label={v.name}
            active={savedViewId === v.id}
            onClick={() => applySaved(v)}
          />
          <button
            type="button"
            aria-label={`Delete saved view ${v.name}`}
            onClick={() => {
              if (savedViewId === v.id) setSavedViewId(null);
              remove(v.id);
            }}
            className="fm-focus-ring opacity-0 group-hover:opacity-100 ml-0.5 mr-1 mb-2.5 text-[#A69DC0] hover:text-[#F37167] transition-opacity focus-visible:opacity-100"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      <div className="flex-1" />

      {naming ? (
        <span className="inline-flex items-center gap-1 px-2 py-1.5 mb-1">
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitSave();
              if (e.key === "Escape") {
                setDraftName("");
                setNaming(false);
              }
            }}
            placeholder="View name"
            className="px-2 py-0.5 text-sm border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167]"
          />
          <button
            type="button"
            onClick={commitSave}
            className="fm-focus-ring px-2 py-0.5 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] [transition-duration:120ms] transition-colors"
          >
            Save
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="fm-focus-ring ml-1 mb-1 inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] rounded-md [transition-duration:120ms] transition-colors"
        >
          <Plus className="w-3 h-3" />
          Save view
        </button>
      )}
    </div>
  );
}

function SavedTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center px-3 py-2.5 text-xs font-medium",
        "transition-colors duration-[120ms] ease-out",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px] rounded",
        active ? "text-[#403770] font-bold" : "text-[#8A80A8] hover:text-[#544A78]"
      )}
    >
      {label}
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-2 right-2 -bottom-px h-0.5 bg-[#F37167] rounded-sm"
        />
      )}
    </button>
  );
}
