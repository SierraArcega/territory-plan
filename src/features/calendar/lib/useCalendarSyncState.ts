"use client";

import { useMemo } from "react";
import type { CalendarStatusResponse } from "@/features/shared/types/api-types";
import { useCalendarConnection } from "@/features/calendar/lib/queries";

export type CalendarSyncStateValue = "connected" | "stale" | "disconnected";

export interface CalendarSyncStateResult {
  state: CalendarSyncStateValue;
  isLoading: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  email: string | null;
  /** Raw status payload (null while loading or never fetched). */
  data: CalendarStatusResponse | null;
}

/** Stale threshold — sync that hasn't run in this long counts as stale. */
export const SYNC_STALE_MS = 30 * 60 * 1000; // 30 min

/**
 * Pure derivation of sync state from a status payload + the current time.
 * Exported so unit tests can verify the rules without React/QueryClient setup.
 */
export function deriveSyncState(
  data: CalendarStatusResponse | null | undefined,
  now: number = Date.now(),
  staleMs: number = SYNC_STALE_MS
): CalendarSyncStateValue {
  if (!data?.connected || !data.connection) return "disconnected";
  if (data.connection.status !== "connected") return "disconnected";

  const lastSyncAt = data.connection.lastSyncAt
    ? new Date(data.connection.lastSyncAt).getTime()
    : null;

  // pendingCount (events waiting in the inbox for the rep to log) is NOT a
  // sync-staleness signal. The badge tracks "is the sync running and recent",
  // not "have you cleaned out your inbox". Pending counts are surfaced
  // separately in the popover with a link to the Feed tab.
  if (lastSyncAt == null) return "stale";
  if (now - lastSyncAt > staleMs) return "stale";

  return "connected";
}

/**
 * Shared hook returning the derived sync state for both calendar sync badges.
 * Reactive in `lastSyncAt + pendingCount`; `stale` is recomputed on each render
 * (callers that need a constantly-updating "stale after 30 min" view should
 * trigger a re-render via React Query refetch — the connection query has a
 * 5-minute staleTime which is enough granularity here).
 */
export function useCalendarSyncState(): CalendarSyncStateResult {
  const { data, isLoading } = useCalendarConnection();

  return useMemo(() => {
    const state = deriveSyncState(data ?? null);
    const lastSyncAt = data?.connection?.lastSyncAt
      ? new Date(data.connection.lastSyncAt)
      : null;
    return {
      state,
      isLoading,
      lastSyncAt,
      pendingCount: data?.pendingCount ?? 0,
      email: data?.connection?.googleAccountEmail ?? null,
      data: data ?? null,
    };
  }, [data, isLoading]);
}
