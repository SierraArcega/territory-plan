"use client";

import { useEffect, useState, useCallback } from "react";
import type { ActivitiesFilters } from "./filters-store";

export interface SavedView {
  id: string;
  name: string;
  filters: ActivitiesFilters;
  createdAt: string;
}

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
