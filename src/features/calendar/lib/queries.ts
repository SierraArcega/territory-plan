import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type {
  CalendarConnection,
  CalendarStatusResponse,
  CalendarSyncResult,
  CalendarInboxResponse,
} from "@/features/shared/types/api-types";

// --- Calendar Connection Hooks ---

// Check if the user has a Google Calendar connection and get its status
export function useCalendarConnection() {
  return useQuery({
    queryKey: ["calendarConnection"],
    queryFn: () => fetchJson<CalendarStatusResponse>(`${API_BASE}/calendar/status`),
    staleTime: 5 * 60 * 1000, // 5 minutes — connection status doesn't change often
  });
}

// Disconnect Google Calendar
export function useDisconnectCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/calendar/disconnect`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

// Update calendar connection settings (sync toggle, company domain)
export function useUpdateCalendarSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { syncEnabled?: boolean; companyDomain?: string }) =>
      fetchJson<{ connection: CalendarConnection }>(
        `${API_BASE}/calendar/status`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// Update sync configuration (direction, activity types, reminders)
export function useUpdateCalendarSyncConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      syncDirection?: "one_way" | "two_way";
      syncedActivityTypes?: string[];
      reminderMinutes?: number;
      secondReminderMinutes?: number | null;
    }) =>
      fetchJson<{ connection: CalendarConnection }>(
        `${API_BASE}/calendar/status`,
        { method: "PATCH", body: JSON.stringify(data) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// --- Calendar Sync Hooks ---

// Trigger a calendar sync — pulls events from Google Calendar and stages them
export function useTriggerCalendarSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<CalendarSyncResult>(`${API_BASE}/calendar/sync`, {
        method: "POST",
      }),
    onSuccess: () => {
      // Refresh inbox and connection status after sync
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// --- Calendar Inbox Hooks ---

// List calendar events (defaults to pending = the inbox)
export function useCalendarInbox(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);

  return useQuery({
    queryKey: ["calendarEvents", status || "pending"],
    queryFn: () =>
      fetchJson<CalendarInboxResponse>(
        `${API_BASE}/calendar/events?${params.toString()}`
      ),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Get just the pending count (for badge display on nav tabs)
// Uses the same endpoint as useCalendarConnection which returns pendingCount
export function useCalendarInboxCount() {
  return useQuery({
    queryKey: ["calendarConnection"],
    queryFn: () => fetchJson<CalendarStatusResponse>(`${API_BASE}/calendar/status`),
    staleTime: 2 * 60 * 1000,
    select: (data) => data.pendingCount,
  });
}

// Confirm a calendar event → creates an Activity
export function useConfirmCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      ...overrides
    }: {
      eventId: string;
      activityType?: string;
      title?: string;
      planIds?: string[];
      districtLeaids?: string[];
      contactIds?: number[];
      notes?: string;
    }) =>
      fetchJson<{ activityId: string }>(
        `${API_BASE}/calendar/events/${eventId}`,
        { method: "POST", body: JSON.stringify(overrides) }
      ),
    onSuccess: () => {
      // Refresh inbox, activities, and connection (pending count changes)
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// Dismiss a calendar event (hide from inbox)
export function useDismissCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) =>
      fetchJson<{ success: boolean }>(
        `${API_BASE}/calendar/events/${eventId}`,
        { method: "PATCH" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}

// Batch confirm all high-confidence pending events
export function useBatchConfirmCalendarEvents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      fetchJson<{ confirmed: number; activityIds: string[] }>(
        `${API_BASE}/calendar/events/batch-confirm`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}

// --- Backfill / Auto-sync Hooks ---

// Fires a single incremental sync on mount once the user has completed backfill.
// Returns a callback-ref setter so a parent (e.g. HomeView) can subscribe to
// "new events arrived" events and show a toast.
export interface AutoSyncController {
  setOnNewEvents: (cb: (newEventCount: number) => void) => void;
}

export function useAutoSyncCalendarOnMount(): AutoSyncController {
  const { data } = useCalendarConnection();
  const sync = useTriggerCalendarSync();
  const ranRef = useRef(false);
  const onNewEventsRef = useRef<((n: number) => void) | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    if (!data?.connected) return;
    if (!data.connection?.syncEnabled) return;
    // Skip auto-sync while backfill is still pending — the wizard owns sync
    if (!data.connection?.backfillCompletedAt) return;

    ranRef.current = true;
    sync.mutate(undefined, {
      onSuccess: (result) => {
        if (result.newEvents > 0 && onNewEventsRef.current) {
          onNewEventsRef.current(result.newEvents);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync is a stable mutation object; we only care about the guard refs + connection data
  }, [data]);

  return {
    setOnNewEvents: (cb: (n: number) => void) => {
      onNewEventsRef.current = cb;
    },
  };
}

// Derives whether the user needs to set up or resume the backfill wizard.
export interface BackfillStatus {
  isLoading: boolean;
  connected: boolean;
  needsSetup: boolean;
  needsResume: boolean;
  backfillCompletedAt: string | null;
}

export function useBackfillStatus(): BackfillStatus {
  const { data, isLoading } = useCalendarConnection();
  const connection = data?.connection ?? null;
  const connected = !!data?.connected;
  return {
    isLoading,
    connected,
    needsSetup:
      connected && !connection?.backfillStartDate && !connection?.backfillCompletedAt,
    needsResume:
      connected && !!connection?.backfillStartDate && !connection?.backfillCompletedAt,
    backfillCompletedAt: connection?.backfillCompletedAt ?? null,
  };
}

// Start the backfill wizard: sets backfillStartDate = now - days and syncs.
export type BackfillDays = 7 | 30 | 60 | 90;

export interface BackfillStartResult extends CalendarSyncResult {
  pendingCount: number;
}

export function useStartBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (days: BackfillDays) =>
      fetchJson<BackfillStartResult>(`${API_BASE}/calendar/backfill/start`, {
        method: "POST",
        body: JSON.stringify({ days }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
      queryClient.invalidateQueries({ queryKey: ["calendarEvents"] });
    },
  });
}

// Mark the backfill wizard complete — sets backfillCompletedAt = now.
export function useCompleteBackfill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson<{ success: boolean }>(`${API_BASE}/calendar/backfill/complete`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendarConnection"] });
    },
  });
}
