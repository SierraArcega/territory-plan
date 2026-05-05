"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ActivitiesParams } from "@/features/shared/types/api-types";
import type { ActivityCategory, ActivityType } from "@/features/activities/types";
import { useProfile } from "@/features/shared/lib/queries";

export type CalendarView = "schedule" | "month" | "week" | "table" | "map";
export type Grain = "day" | "week" | "month" | "quarter";
export type SyncState = "connected" | "stale" | "disconnected";
export type DealKind = "won" | "lost" | "created" | "progressed" | "closing";

export type ActivitySortKey = "date" | "type" | "title" | "district" | "owner" | "status";
export type SortDir = "asc" | "desc";
export interface TableSort { column: ActivitySortKey; direction: SortDir }

export interface ActivitiesFilters {
  categories: ActivityCategory[];
  types: ActivityType[];
  dealKinds: DealKind[];
  dealStages: string[];
  dealMin: number;
  dealMax: number | null;
  statuses: string[];
  owners: string[]; // user IDs (created by); empty = team scope
  attendeeIds: string[]; // user IDs of attendees
  districts: string[]; // district leaids
  contactIds: number[]; // contact IDs (Table view)
  inPerson: ("yes" | "no")[]; // empty = no filter; ["yes"] / ["no"] / both
  states: string[]; // state codes
  territories: string[]; // plan IDs
  tags: string[];
  text: string;
  // Table-view-only date range; null = no bound. Calendar views ignore these
  // and continue to compute the window from anchor + grain.
  dateFrom: string | null;
  dateTo: string | null;
}

export const EMPTY_FILTERS: ActivitiesFilters = {
  categories: [],
  types: [],
  dealKinds: [],
  dealStages: [],
  dealMin: 0,
  dealMax: null,
  statuses: [],
  owners: [],
  attendeeIds: [],
  districts: [],
  contactIds: [],
  inPerson: [],
  states: [],
  territories: [],
  tags: [],
  text: "",
  dateFrom: null,
  dateTo: null,
};

// Default Table column set (Wide bundle from spec). Order is left→right
// in the rendered header. Hidden-by-default columns are added via the picker.
export const DEFAULT_TABLE_COLUMNS = [
  "date",
  "type",
  "title",
  "district",
  "contact",
  "owner",
  "status",
  "outcome",
] as const;
export const DEFAULT_TABLE_SORTS: TableSort[] = [{ column: "date", direction: "desc" }];
export const DEFAULT_TABLE_PAGE_SIZE = 50;

interface ChromeState {
  view: CalendarView;
  grain: Grain;
  anchorIso: string; // ISO date string for the current period anchor
  savedViewId: string | null;
  railCollapsed: boolean;
  syncState: SyncState;
  filters: ActivitiesFilters;
  // Table-view UI state — persisted across sessions
  tableSorts: TableSort[];
  tableVisibleColumns: string[];
  tablePage: number;
  tablePageSize: number;
  // Setters
  setView: (v: CalendarView) => void;
  setGrain: (g: Grain) => void;
  setAnchor: (iso: string) => void;
  setSavedViewId: (id: string | null) => void;
  setRailCollapsed: (collapsed: boolean) => void;
  setSyncState: (s: SyncState) => void;
  setFilters: (next: ActivitiesFilters | ((prev: ActivitiesFilters) => ActivitiesFilters)) => void;
  patchFilters: (patch: Partial<ActivitiesFilters>) => void;
  resetFilters: () => void;
  setTableSorts: (sorts: TableSort[]) => void;
  setTableVisibleColumns: (columns: string[]) => void;
  setTablePage: (page: number) => void;
  setTablePageSize: (size: number) => void;
}

export const useActivitiesChrome = create<ChromeState>()(
  persist(
    (set) => ({
      view: "schedule",
      grain: "week",
      anchorIso: new Date().toISOString(),
      savedViewId: null,
      railCollapsed: false,
      syncState: "disconnected",
      filters: EMPTY_FILTERS,
      tableSorts: DEFAULT_TABLE_SORTS,
      tableVisibleColumns: [...DEFAULT_TABLE_COLUMNS],
      tablePage: 0,
      tablePageSize: DEFAULT_TABLE_PAGE_SIZE,

      setView: (view) => set({ view }),
      setGrain: (grain) => set({ grain }),
      setAnchor: (anchorIso) => set({ anchorIso }),
      setSavedViewId: (savedViewId) => set({ savedViewId }),
      setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
      setSyncState: (syncState) => set({ syncState }),
      setFilters: (next) =>
        set((s) => ({
          filters: typeof next === "function" ? next(s.filters) : next,
          tablePage: 0, // any filter change resets to first page
        })),
      patchFilters: (patch) =>
        set((s) => ({ filters: { ...s.filters, ...patch }, tablePage: 0 })),
      resetFilters: () => set({ filters: EMPTY_FILTERS, savedViewId: null, tablePage: 0 }),
      setTableSorts: (tableSorts) => set({ tableSorts, tablePage: 0 }),
      setTableVisibleColumns: (tableVisibleColumns) => set({ tableVisibleColumns }),
      setTablePage: (tablePage) => set({ tablePage }),
      setTablePageSize: (tablePageSize) => set({ tablePageSize, tablePage: 0 }),
    }),
    {
      name: "cal", // -> cal in localStorage
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : ({} as Storage))),
      partialize: (s) => ({
        view: s.view,
        grain: s.grain,
        savedViewId: s.savedViewId,
        railCollapsed: s.railCollapsed,
        tableSorts: s.tableSorts,
        tableVisibleColumns: s.tableVisibleColumns,
        tablePageSize: s.tablePageSize,
      }),
    }
  )
);

// ===== Default-owner hydration =====

/**
 * Seeds `filters.owners` with the current user's ID once per page mount so the
 * default scope is "My activities". Only fires when:
 *   - profile has loaded
 *   - filters.owners is currently empty (untouched by user/preset)
 *
 * The ref guard ensures we never overwrite a user's manual selection on
 * subsequent renders or after they Reset and re-pick. Per CLAUDE.md UX rule:
 * "default owner to current user" + "ref guard to set the default once".
 */
export function useDefaultOwnerHydration() {
  const profileId = useProfile().data?.id ?? null;
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    if (!profileId) return;
    // Read current state synchronously so we don't fight a user who has
    // already touched the filter (e.g. via a saved-view click) before
    // profile resolves.
    const current = useActivitiesChrome.getState().filters.owners;
    if (current.length === 0) {
      patchFilters({ owners: [profileId] });
    }
    hydrated.current = true;
  }, [profileId, patchFilters]);
}

// ===== Param derivation =====

// Convert chrome (anchor + grain) into [startISO, endISO] for the visible window.
// Schedule defaults to a week; Month uses month bounds; etc.
export function getRangeForChrome(anchorIso: string, grain: Grain): { startIso: string; endIso: string } {
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) {
    const now = new Date();
    return getRangeForChrome(now.toISOString(), grain);
  }
  const start = new Date(anchor);
  const end = new Date(anchor);

  switch (grain) {
    case "day": {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "week": {
      const dow = start.getDay(); // 0=Sun
      start.setDate(start.getDate() - dow);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "month": {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0); // last day of current month
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "quarter": {
      const q = Math.floor(start.getMonth() / 3);
      start.setMonth(q * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(q * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    }
  }
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

// Build the useActivities() params from filters + chrome.
// Multi-value filters that the API doesn't support yet are applied client-side.
//
// Calendar views (schedule/week/month/map) derive the date window from
// anchor + grain. The Table view ignores anchor+grain and uses
// filters.dateFrom/dateTo (which may be null = unbounded) plus
// pagination + sort args.
export function deriveActivitiesParams(args: {
  filters: ActivitiesFilters;
  anchorIso: string;
  grain: Grain;
  view?: CalendarView;
  page?: number;
  pageSize?: number;
  sorts?: TableSort[];
}): ActivitiesParams {
  const isTable = args.view === "table";
  const params: ActivitiesParams = {};

  if (isTable) {
    if (args.filters.dateFrom) params.startDateFrom = args.filters.dateFrom.slice(0, 10);
    if (args.filters.dateTo) params.startDateTo = args.filters.dateTo.slice(0, 10);
    const pageSize = args.pageSize ?? DEFAULT_TABLE_PAGE_SIZE;
    params.limit = pageSize;
    if (args.page && args.page > 0) params.offset = args.page * pageSize;
    const primarySort = args.sorts?.[0] ?? DEFAULT_TABLE_SORTS[0];
    params.sortBy = primarySort.column;
    params.sortDir = primarySort.direction;
  } else {
    const { startIso, endIso } = getRangeForChrome(args.anchorIso, args.grain);
    params.startDateFrom = startIso.slice(0, 10);
    params.startDateTo = endIso.slice(0, 10);
    params.limit = 500;
  }

  // Single-value short-circuits — API supports these directly. Multi-value
  // categories ride the same `category` param as a CSV (route's readMulti
  // parses it back into a list).
  if (args.filters.categories.length === 1) params.category = args.filters.categories[0];
  else if (args.filters.categories.length > 1) params.category = args.filters.categories;
  if (args.filters.types.length === 1) params.type = args.filters.types[0];
  else if (args.filters.types.length > 1) params.type = args.filters.types;
  if (args.filters.statuses.length === 1) params.status = args.filters.statuses[0] as ActivitiesParams["status"];
  if (args.filters.owners.length === 1) params.ownerId = args.filters.owners[0];
  if (args.filters.owners.length === 0) params.ownerId = "all";
  if (args.filters.text.trim()) params.search = args.filters.text.trim();

  // Multi-value filters that the API now accepts directly. We send the full
  // list so the server-side `where` does the work and the client doesn't have
  // to re-filter post-fetch.
  if (args.filters.owners.length > 1) params.owner = args.filters.owners;
  if (args.filters.attendeeIds.length > 0) params.attendeeIds = args.filters.attendeeIds;
  if (args.filters.districts.length > 0) params.districtLeaids = args.filters.districts;
  if (args.filters.inPerson.length > 0) params.inPerson = args.filters.inPerson;
  if (args.filters.contactIds.length > 0) params.contactIds = args.filters.contactIds;

  return params;
}

// Apply remaining multi-select filters that the API doesn't support directly.
// Owner filtering is handled by the API via ownerId; multi-owner is approximated
// as "team scope" until the list endpoint accepts an ownerId array.
export function applyClientFilters<T extends { type?: string | null; status?: string | null }>(
  rows: T[],
  filters: ActivitiesFilters,
  categoryForType: (t: ActivityType) => ActivityCategory
): T[] {
  return rows.filter((row) => {
    if (filters.categories.length > 0) {
      if (!row.type) return false;
      if (!filters.categories.includes(categoryForType(row.type as ActivityType))) return false;
    }
    if (filters.types.length > 0) {
      if (!row.type || !filters.types.includes(row.type as ActivityType)) return false;
    }
    if (filters.statuses.length > 0) {
      if (!row.status || !filters.statuses.includes(row.status)) return false;
    }
    return true;
  });
}
