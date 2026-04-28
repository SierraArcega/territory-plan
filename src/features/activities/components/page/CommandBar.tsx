"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  CATEGORY_LABELS,
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { useUsers, useProfile, useTags } from "@/features/shared/lib/queries";
import { useStates } from "@/features/map/lib/queries";
import {
  useActivitiesChrome,
  type ActivitiesFilters,
} from "@/features/activities/lib/filters-store";
import { cn } from "@/features/shared/lib/cn";

interface CommandBarProps {
  open: boolean;
  onClose: () => void;
}

type Suggestion = {
  kind: string;
  label: string;
  apply: () => void;
};

/**
 * ⌘K full-screen command palette. Searches across categories, types, statuses,
 * states, owners, and tags. Selecting a suggestion toggles that filter and
 * closes the overlay. Empty query shows hint copy.
 *
 * Keybinds: ⌘K / ctrl+K to open from anywhere; Esc to close. Backdrop click
 * also closes. The text query is forwarded to filters.text in real time so
 * the surrounding views narrow as the user types.
 *
 * Reference: design_handoff_activities_calendar/reference/components/FilterVariants.jsx:146-270
 */
export default function CommandBar({ open, onClose }: CommandBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const [query, setQuery] = useState("");

  const { data: users } = useUsers();
  const { data: profile } = useProfile();
  const { data: states } = useStates({ enabled: open });
  const { data: tags } = useTags();

  // Sync local query → filters.text so views update as the user types.
  useEffect(() => {
    if (!open) return;
    setQuery(filters.text);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function toggle<K extends keyof ActivitiesFilters>(key: K, value: string) {
    const current = filters[key] as unknown as string[];
    if (!Array.isArray(current)) return;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchFilters({ [key]: next } as Partial<ActivitiesFilters>);
  }

  const suggestions: Suggestion[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Suggestion[] = [];
    (Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).forEach((c) => {
      if (CATEGORY_LABELS[c].toLowerCase().includes(q)) {
        out.push({
          kind: "Category",
          label: CATEGORY_LABELS[c],
          apply: () => toggle("categories", c),
        });
      }
    });
    (Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).forEach((t) => {
      if (ACTIVITY_TYPE_LABELS[t].toLowerCase().includes(q)) {
        out.push({
          kind: "Type",
          label: ACTIVITY_TYPE_LABELS[t],
          apply: () => toggle("types", t),
        });
      }
    });
    VALID_ACTIVITY_STATUSES.forEach((s) => {
      if (ACTIVITY_STATUS_CONFIG[s].label.toLowerCase().includes(q)) {
        out.push({
          kind: "Status",
          label: ACTIVITY_STATUS_CONFIG[s].label,
          apply: () => toggle("statuses", s),
        });
      }
    });
    (states ?? []).forEach((s) => {
      if (s.name.toLowerCase().includes(q) || s.abbrev.toLowerCase().includes(q)) {
        out.push({
          kind: "State",
          label: `${s.name} (${s.abbrev})`,
          apply: () => toggle("states", s.abbrev),
        });
      }
    });
    (users ?? []).forEach((u) => {
      const name = u.fullName ?? u.email;
      if (name.toLowerCase().includes(q)) {
        out.push({
          kind: "Rep",
          label: profile?.id === u.id ? `Me · ${name}` : name,
          apply: () => toggle("owners", u.id),
        });
      }
    });
    (tags ?? []).forEach((t) => {
      if (t.name.toLowerCase().includes(q)) {
        out.push({
          kind: "Tag",
          label: t.name,
          apply: () => toggle("tags", String(t.id)),
        });
      }
    });
    return out.slice(0, 12);
  }, [query, states, users, tags, profile?.id, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search and filter command palette"
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] bg-[rgba(64,55,112,0.25)]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[90vw] bg-white rounded-2xl border border-[#D4CFE2] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#E2DEEC]">
          <Search className="w-4 h-4 text-[#8A80A8]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              patchFilters({ text: e.target.value });
            }}
            placeholder="Search activities, reps, states, tags…"
            className="flex-1 text-[15px] text-[#403770] placeholder:text-[#A69DC0] bg-transparent border-none outline-none"
            aria-label="Filter command query"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#544A78] bg-[#EFEDF5] border border-[#E2DEEC] rounded">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-1.5">
          {!query && (
            <div className="px-3 py-3 text-xs text-[#8A80A8] leading-relaxed">
              Start typing to filter by rep, state, activity type, status, or tag. Try{" "}
              <b className="text-[#403770]">"Renewal"</b>,{" "}
              <b className="text-[#403770]">"Hartford"</b>, or{" "}
              <b className="text-[#403770]">"Priya"</b>.
            </div>
          )}
          {query && suggestions.length === 0 && (
            <div className="px-3.5 py-3.5 text-[13px] text-[#8A80A8]">
              No matches for{" "}
              <b className="text-[#403770]">"{query}"</b>.
              Free-text search remains active across activity titles.
            </div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={`${s.kind}-${s.label}-${i}`}
              type="button"
              onClick={() => {
                s.apply();
                onClose();
              }}
              className={cn(
                "fm-focus-ring w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left",
                "hover:bg-[#EFEDF5] [transition-duration:120ms] transition-colors"
              )}
            >
              <span className="min-w-[64px] text-[9px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]">
                {s.kind}
              </span>
              <span className="text-[13px] font-medium text-[#403770] flex-1 truncate">
                {s.label}
              </span>
              <span className="text-[10px] text-[#A69DC0]">toggle filter</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Returns a stable handler that opens the CommandBar when ⌘K / Ctrl+K is
 * pressed. Mount once at the page-shell level alongside `<CommandBar/>`.
 */
export function useCommandBarHotkey(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);
}
