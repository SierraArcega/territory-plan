"use client";

import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import {
  useSavedViews,
  PRESET_VIEWS,
  matchesPreset,
  type SavedView,
  type PresetView,
} from "@/features/activities/lib/saved-views";
import { cn } from "@/features/shared/lib/cn";

/**
 * Saved-view tabs row. Renders preset tabs (per handoff IDs) with leading
 * Lucide icon and coral underline on the active tab. User-saved views render
 * after the presets with a hover-revealed × button. "Save view" is right-aligned.
 *
 * Active state: prefers explicit `savedViewId` from chrome; falls back to
 * matching the current filter snapshot against each preset so a tab still
 * lights up after Reset.
 */
export default function SavedViewTabs({ currentUserId }: { currentUserId: string | null }) {
  const { views, save, remove } = useSavedViews();
  const setFilters = useActivitiesChrome((s) => s.setFilters);
  const filters = useActivitiesChrome((s) => s.filters);
  const savedViewId = useActivitiesChrome((s) => s.savedViewId);
  const setSavedViewId = useActivitiesChrome((s) => s.setSavedViewId);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  // Derived match: highlight a preset whose filter snapshot equals current
  // filters when nothing explicit is set. Cheap because preset list is small.
  const inferredPresetId = (() => {
    if (savedViewId) return null;
    const hit = PRESET_VIEWS.find((p) => matchesPreset(filters, p, currentUserId));
    return hit?.id ?? null;
  })();
  const activeId = savedViewId ?? inferredPresetId;

  // Clear stale `savedViewId` if it points at a preset whose filters have
  // since been edited away from the snapshot.
  useEffect(() => {
    if (!savedViewId) return;
    const preset = PRESET_VIEWS.find((p) => p.id === savedViewId);
    if (!preset) return; // user-saved view — leave alone
    if (!matchesPreset(filters, preset, currentUserId)) {
      setSavedViewId(null);
    }
  }, [filters, savedViewId, currentUserId, setSavedViewId]);

  function applyPreset(p: PresetView) {
    setFilters(p.build(currentUserId));
    setSavedViewId(p.id);
  }

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
      {PRESET_VIEWS.map((p) => (
        <PresetTab
          key={p.id}
          preset={p}
          active={activeId === p.id}
          onClick={() => applyPreset(p)}
        />
      ))}

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

function PresetTab({
  preset,
  active,
  onClick,
}: {
  preset: PresetView;
  active: boolean;
  onClick: () => void;
}) {
  const { Icon } = preset;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs",
        "font-medium tracking-[-0.005em]",
        "transition-colors duration-[120ms] ease-out",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px] rounded",
        active ? "text-[#403770] font-bold" : "text-[#8A80A8] hover:text-[#544A78]"
      )}
    >
      <Icon
        className={cn(
          "w-3.5 h-3.5 transition-colors duration-[120ms]",
          active ? "text-[#F37167]" : "text-[#A69DC0]"
        )}
        aria-hidden="true"
      />
      {preset.name}
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-2 right-2 -bottom-px h-0.5 bg-[#F37167] rounded-sm"
        />
      )}
    </button>
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
