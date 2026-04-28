"use client";

import { useEffect, useState, useCallback } from "react";
import {
  CalendarDays,
  Handshake,
  Inbox,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { EMPTY_FILTERS, type ActivitiesFilters } from "./filters-store";

export interface SavedView {
  id: string;
  name: string;
  filters: ActivitiesFilters;
  createdAt: string;
}

export interface PresetView {
  id: string;
  name: string;
  Icon: LucideIcon;
  build: (currentUserId: string | null) => ActivitiesFilters;
}

// Preset list per design handoff:
// All activities · My week · CT · Meetings · Renewals · Conferences
export const PRESET_VIEWS: PresetView[] = [
  {
    id: "all",
    name: "All activities",
    Icon: Inbox,
    build: () => ({ ...EMPTY_FILTERS }),
  },
  {
    id: "my-week",
    name: "My week",
    Icon: CalendarDays,
    build: (uid) => ({ ...EMPTY_FILTERS, owners: uid ? [uid] : [] }),
  },
  {
    id: "ct-meetings",
    name: "CT · Meetings",
    Icon: Handshake,
    build: () => ({
      ...EMPTY_FILTERS,
      categories: ["meetings"],
      states: ["CT"],
    }),
  },
  {
    id: "renewals",
    name: "Renewals",
    Icon: RefreshCw,
    build: () => ({
      ...EMPTY_FILTERS,
      types: ["renewal_conversation"],
    }),
  },
  {
    id: "conferences",
    name: "Conferences",
    Icon: Sparkles,
    build: () => ({
      ...EMPTY_FILTERS,
      types: ["conference"],
    }),
  },
];

const STORAGE_KEY = "cal.savedViews";

function readStorage(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(views: SavedView[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

export function useSavedViews() {
  // Lazy initializer keeps SSR safe (returns []) and avoids the
  // "setState in effect" anti-pattern that flagging just to hydrate from
  // localStorage would trigger.
  const [views, setViews] = useState<SavedView[]>(() => readStorage());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setViews(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((name: string, filters: ActivitiesFilters): SavedView => {
    const view: SavedView = {
      id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      filters,
      createdAt: new Date().toISOString(),
    };
    const next = [...readStorage(), view];
    writeStorage(next);
    setViews(next);
    return view;
  }, []);

  const remove = useCallback((id: string) => {
    const next = readStorage().filter((v) => v.id !== id);
    writeStorage(next);
    setViews(next);
  }, []);

  const rename = useCallback((id: string, name: string) => {
    const next = readStorage().map((v) => (v.id === id ? { ...v, name: name.trim() } : v));
    writeStorage(next);
    setViews(next);
  }, []);

  return { views, save, remove, rename };
}

// Best-effort match: does the current filter snapshot equal a preset's filter
// snapshot? Used by SavedViewTabs to highlight a preset tab when the saved
// `savedViewId` is null but the user happens to be in a state that matches a
// preset (e.g. after Reset filters → matches `all`).
export function matchesPreset(filters: ActivitiesFilters, preset: PresetView, currentUserId: string | null): boolean {
  const target = preset.build(currentUserId);
  return arrEq(filters.categories, target.categories) &&
    arrEq(filters.types, target.types) &&
    arrEq(filters.statuses, target.statuses) &&
    arrEq(filters.owners, target.owners) &&
    arrEq(filters.states, target.states) &&
    arrEq(filters.territories, target.territories) &&
    arrEq(filters.tags, target.tags) &&
    arrEq(filters.dealKinds, target.dealKinds) &&
    arrEq(filters.dealStages, target.dealStages) &&
    filters.dealMin === target.dealMin &&
    filters.dealMax === target.dealMax &&
    filters.text.trim() === target.text.trim();
}

function arrEq<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((v) => setB.has(v));
}
