"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useActivitiesChrome, EMPTY_FILTERS } from "@/features/activities/lib/filters-store";
import { useSavedViews, type SavedView } from "@/features/activities/lib/saved-views";

const PRESETS: { id: string; name: string; build: (currentUserId: string | null) => typeof EMPTY_FILTERS }[] = [
  { id: "all", name: "All activities", build: () => ({ ...EMPTY_FILTERS }) },
  {
    id: "my_week",
    name: "My week",
    build: (uid) => ({ ...EMPTY_FILTERS, owners: uid ? [uid] : [] }),
  },
  {
    id: "meetings",
    name: "Meetings",
    build: () => ({ ...EMPTY_FILTERS, categories: ["meetings"] }),
  },
  {
    id: "events",
    name: "Events",
    build: () => ({ ...EMPTY_FILTERS, categories: ["events"] }),
  },
  {
    id: "campaigns",
    name: "Campaigns",
    build: () => ({ ...EMPTY_FILTERS, categories: ["campaigns"] }),
  },
];

export default function SavedViewTabs({ currentUserId }: { currentUserId: string | null }) {
  const { views, save, remove } = useSavedViews();
  const setFilters = useActivitiesChrome((s) => s.setFilters);
  const filters = useActivitiesChrome((s) => s.filters);
  const savedViewId = useActivitiesChrome((s) => s.savedViewId);
  const setSavedViewId = useActivitiesChrome((s) => s.setSavedViewId);
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setFilters(preset.build(currentUserId));
    setSavedViewId(id);
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
    <div className="flex items-center gap-1 px-6 border-b border-[#E2DEEC] bg-white overflow-x-auto">
      {PRESETS.map((p) => (
        <TabButton
          key={p.id}
          active={savedViewId === p.id}
          onClick={() => applyPreset(p.id)}
        >
          {p.name}
        </TabButton>
      ))}

      {views.map((v) => (
        <span key={v.id} className="inline-flex items-center group">
          <TabButton active={savedViewId === v.id} onClick={() => applySaved(v)}>
            {v.name}
          </TabButton>
          <button
            type="button"
            aria-label={`Delete saved view ${v.name}`}
            onClick={() => {
              if (savedViewId === v.id) setSavedViewId(null);
              remove(v.id);
            }}
            className="opacity-0 group-hover:opacity-100 ml-0.5 mr-1 text-[#A69DC0] hover:text-[#F37167] transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}

      {naming ? (
        <span className="inline-flex items-center gap-1 px-2 py-1.5">
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
            className="px-2 py-0.5 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a]"
          >
            Save
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="ml-1 inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#6E6390] hover:text-[#403770] hover:bg-[#F7F5FA] rounded-md transition-colors"
        >
          <Plus className="w-3 h-3" />
          Save view
        </button>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-[#403770] text-[#403770]"
          : "border-transparent text-[#8A80A8] hover:text-[#403770]"
      }`}
    >
      {children}
    </button>
  );
}
