"use client";

import { useState, useRef } from "react";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import {
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  ACTIVITY_CATEGORIES,
  CATEGORY_LABELS,
  type ActivityType,
  type ActivityStatus,
  type ActivityCategory,
} from "@/features/activities/types";
import type { ActivityListItem } from "@/features/shared/types/api-types";

const RELATION_TYPES = [
  { value: "related", label: "Related" },
  { value: "follow_up", label: "Follow-up to" },
  { value: "part_of", label: "Part of" },
  { value: "preceded_by", label: "Preceded by" },
];

export interface RelationDraft {
  activityId: string;
  title: string;
  type: ActivityType;
  startDate: string | null;
  status: string;
  relationType: string;
}

interface RelatedActivitiesTabProps {
  relations: RelationDraft[];
  onChange: (relations: RelationDraft[]) => void;
  onViewActivity?: (activityId: string, title: string) => void;
}

export default function RelatedActivitiesTab({ relations, onChange, onViewActivity }: RelatedActivitiesTabProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ActivityListItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ActivityType>("dinner");
  const [isCreating, setIsCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const linkedIds = new Set(relations.map((r) => r.activityId));

  const handleSearch = (query: string) => {
    setSearch(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchJson<{ activities: ActivityListItem[] }>(
          `${API_BASE}/activities?search=${encodeURIComponent(query)}&limit=8`
        );
        setResults(data.activities.filter((a) => !linkedIds.has(a.id)));
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const addRelation = (activity: { id: string; title: string; type: ActivityType; startDate: string | null; status: string }) => {
    onChange([
      ...relations,
      {
        activityId: activity.id,
        title: activity.title,
        type: activity.type,
        startDate: activity.startDate,
        status: activity.status,
        relationType: "related",
      },
    ]);
    setSearch("");
    setResults([]);
  };

  const removeRelation = (activityId: string) => {
    onChange(relations.filter((r) => r.activityId !== activityId));
  };

  const updateRelationType = (activityId: string, relationType: string) => {
    onChange(
      relations.map((r) => (r.activityId === activityId ? { ...r, relationType } : r))
    );
  };

  const handleCreateAndLink = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    try {
      const activity = await fetchJson<{ id: string; title: string; type: string; startDate: string | null; status: string }>(
        `${API_BASE}/activities`,
        {
          method: "POST",
          body: JSON.stringify({
            type: newType,
            title: newTitle.trim(),
            status: "planned",
          }),
        }
      );
      addRelation({
        id: activity.id,
        title: activity.title,
        type: activity.type as ActivityType,
        startDate: activity.startDate,
        status: activity.status,
      });
      setNewTitle("");
      setShowCreate(false);
    } catch (err) {
      console.error("Failed to create related activity:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search activities to link..."
          className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
        {isSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-[#A69DC0] border-t-transparent rounded-full animate-spin" />
        )}
        {search.trim().length >= 2 && !isSearching && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {results.length > 0 ? (
              results.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => addRelation(a)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#F7F5FA] border-b border-[#E2DEEC] last:border-b-0 transition-colors"
                >
                  <span className="text-base">{ACTIVITY_TYPE_ICONS[a.type]}</span>
                  <span className="flex-1 text-left text-[#403770] truncate">{a.title}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: ACTIVITY_STATUS_CONFIG[a.status as ActivityStatus]?.bgColor,
                      color: ACTIVITY_STATUS_CONFIG[a.status as ActivityStatus]?.color,
                    }}
                  >
                    {ACTIVITY_STATUS_CONFIG[a.status as ActivityStatus]?.label || a.status}
                  </span>
                </button>
              ))
            ) : (
              <div className="px-3 py-3 text-sm text-[#A69DC0]">
                No activities found for &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick-create inline form */}
      {showCreate ? (
        <div className="border border-[#E2DEEC] rounded-lg p-3 bg-[#FDFCFF] space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Activity title..."
            autoFocus
            className="w-full px-3 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
          />
          <div className="flex flex-wrap gap-1">
            {(Object.entries(ACTIVITY_CATEGORIES) as [ActivityCategory, readonly ActivityType[]][]).map(
              ([, types]) =>
                types.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewType(t)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                      newType === t
                        ? "bg-[#403770] text-white"
                        : "border border-[#D4CFE2] text-[#8A80A8] hover:border-[#403770] hover:text-[#403770]"
                    }`}
                  >
                    {ACTIVITY_TYPE_ICONS[t]} {ACTIVITY_TYPE_LABELS[t]}
                  </button>
                ))
            )}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateAndLink}
              disabled={!newTitle.trim() || isCreating}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? "Creating..." : "Create & Link"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewTitle(""); }}
              className="px-3 py-1.5 text-xs font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="text-xs text-[#403770] hover:text-[#322a5a] font-medium"
        >
          + Create new activity
        </button>
      )}

      {/* Linked activities */}
      {relations.length === 0 && !showCreate ? (
        <div className="text-center py-6">
          <p className="text-sm text-[#A69DC0]">No related activities yet</p>
          <p className="text-xs text-[#C2BBD4] mt-1">Search above or create a new one to link</p>
        </div>
      ) : (
        <div className="space-y-2">
          {relations.map((r) => (
            <div
              key={r.activityId}
              className="flex items-center gap-2 px-3 py-2 border border-[#E2DEEC] rounded-lg bg-[#FDFCFF]"
            >
              <span className="text-base">{ACTIVITY_TYPE_ICONS[r.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#403770] truncate">{r.title}</p>
                <p className="text-[10px] text-[#A69DC0]">
                  {ACTIVITY_TYPE_LABELS[r.type]}
                  {r.startDate && ` · ${new Date(r.startDate).toLocaleDateString()}`}
                </p>
              </div>
              {onViewActivity && (
                <button
                  type="button"
                  onClick={() => onViewActivity(r.activityId, r.title)}
                  className="px-2 py-1 text-[10px] font-medium text-[#403770] border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors"
                >
                  View
                </button>
              )}
              <button
                type="button"
                onClick={() => removeRelation(r.activityId)}
                className="p-1 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
