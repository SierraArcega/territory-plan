import { create } from "zustand";
import type { QueryParams } from "./types";

/**
 * UI-only state for the Reports tab. Server state (draft persistence, saved
 * reports, run results) lives in TanStack Query. URL params own `view` and
 * `selectedReportId`. Each public action calls `set()` exactly once.
 */

interface ReportsState {
  chatOpen: boolean;
  activePopover: string | null;
  /** Snapshot of the params that produced the last visible result. */
  lastRunSnapshot: QueryParams | null;
  /** True when draft params diverge from the snapshot after a run. */
  dirty: boolean;

  toggleChat: () => void;
  openPopover: (id: string) => void;
  closePopover: () => void;
  markDirty: () => void;
  snapshotRun: (params: QueryParams) => void;
  reset: () => void;
}

const INITIAL: Omit<ReportsState, "toggleChat" | "openPopover" | "closePopover" | "markDirty" | "snapshotRun" | "reset"> = {
  chatOpen: true,
  activePopover: null,
  lastRunSnapshot: null,
  dirty: false,
};

export const useReportsStore = create<ReportsState>((set) => ({
  ...INITIAL,

  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  openPopover: (id) => set({ activePopover: id }),

  closePopover: () => set({ activePopover: null }),

  markDirty: () => set({ dirty: true }),

  snapshotRun: (params) => set({ lastRunSnapshot: params, dirty: false }),

  reset: () => set(INITIAL),
}));

// Narrow selector hooks — components subscribe to only the slice they need,
// per CLAUDE.md's "isolate subscriptions" rule.
export const useChatOpen = () => useReportsStore((s) => s.chatOpen);
export const useActivePopover = () => useReportsStore((s) => s.activePopover);
export const useDirty = () => useReportsStore((s) => s.dirty);
export const useLastRunSnapshot = () =>
  useReportsStore((s) => s.lastRunSnapshot);

/**
 * Pure helper — true when current params would produce different results than
 * the snapshot. Compares by stable JSON-string equality (param key ordering
 * isn't guaranteed but is consistent between runs of the validator).
 */
export function isDirty(
  current: QueryParams | null,
  snapshot: QueryParams | null,
): boolean {
  if (!current && !snapshot) return false;
  if (!current || !snapshot) return true;
  return JSON.stringify(current) !== JSON.stringify(snapshot);
}
