"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Download, ChevronDown, X } from "lucide-react";
import { useBulkUpdateActivities } from "@/features/activities/lib/queries";
import { useUsers, useProfile } from "@/features/shared/lib/queries";
import {
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityStatus,
} from "@/features/activities/types";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { rowsToCsv, downloadCsv } from "@/features/reports/lib/csv";
import { cn } from "@/features/shared/lib/cn";

interface BulkActionBarProps {
  selectedRows: ActivityListItem[];
  onClear: () => void;
}

// Sticky bottom action bar visible whenever ≥1 row is selected. Reassign
// owner, change status, export selected, clear. Mutations go through
// useBulkUpdateActivities — optimistic + per-row results; we surface the
// failed-row count via a small inline toast above the bar.
export default function BulkActionBar({ selectedRows, onClear }: BulkActionBarProps) {
  const ids = useMemo(() => selectedRows.map((r) => r.id), [selectedRows]);
  const bulk = useBulkUpdateActivities();
  const [toast, setToast] = useState<string | null>(null);

  if (ids.length === 0) return null;

  function applyResult(succeeded: string[], failed: { id: string; reason: string }[]) {
    if (failed.length === 0) {
      setToast(`Updated ${succeeded.length} ${succeeded.length === 1 ? "activity" : "activities"}.`);
    } else {
      setToast(`${succeeded.length} updated, ${failed.length} skipped.`);
    }
    setTimeout(() => setToast(null), 4000);
  }

  function handleStatusChange(status: ActivityStatus) {
    bulk.mutate(
      { ids, updates: { status } },
      {
        onSuccess: (res) => {
          applyResult(res.succeeded, res.failed);
          if (res.succeeded.length === ids.length) onClear();
        },
        onError: () => setToast("Couldn't update — try again."),
      }
    );
  }

  function handleOwnerChange(ownerId: string) {
    bulk.mutate(
      { ids, updates: { ownerId } },
      {
        onSuccess: (res) => {
          applyResult(res.succeeded, res.failed);
          if (res.succeeded.length === ids.length) onClear();
        },
        onError: () => setToast("Couldn't update — try again."),
      }
    );
  }

  function handleExport() {
    if (selectedRows.length === 0) return;
    const csv = rowsToCsv(
      ["Date", "Type", "Title", "District", "Contact", "Owner", "Status", "Outcome notes"],
      selectedRows.map((r) => ({
        Date: r.startDate ?? "",
        Type: r.type,
        Title: r.title,
        District: r.districtName ?? "",
        Contact: r.contactName ?? "",
        Owner: r.ownerFullName ?? "",
        Status: r.status,
        "Outcome notes": r.outcomePreview ?? "",
      }))
    );
    downloadCsv(`activities-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20">
      {toast && (
        <div className="px-6 py-1.5 text-[11px] text-[#403770] bg-[#EFEDF5] border-t border-[#D4CFE2] text-center">
          {toast}
        </div>
      )}
      <div className="flex items-center gap-2 px-6 py-2 bg-[#403770] text-white shadow-[0_-2px_12px_rgba(64,55,112,0.2)]">
        <span className="text-xs font-semibold">
          {ids.length} selected
        </span>
        <span aria-hidden className="w-px h-4 bg-white/30" />
        <OwnerPicker disabled={bulk.isPending} onPick={handleOwnerChange} />
        <StatusPicker disabled={bulk.isPending} onPick={handleStatusChange} />
        <button
          type="button"
          onClick={handleExport}
          disabled={bulk.isPending}
          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-white border border-white/30 rounded-lg hover:bg-white/10 disabled:opacity-50"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1 h-7 px-2 text-[11px] font-bold uppercase tracking-[0.06em] text-white/70 hover:text-white"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      </div>
    </div>
  );
}

function OwnerPicker({ disabled, onPick }: { disabled: boolean; onPick: (ownerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: users } = useUsers();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const sorted = useMemo(() => {
    const list = users ?? [];
    return [...list].sort((a, b) => {
      if (profile?.id === a.id) return -1;
      if (profile?.id === b.id) return 1;
      return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
    });
  }, [users, profile?.id]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-white border border-white/30 rounded-lg hover:bg-white/10 disabled:opacity-50"
      >
        Reassign owner
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-30 w-56 max-h-64 overflow-y-auto bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1">
          {sorted.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => { onPick(u.id); setOpen(false); }}
              className={cn(
                "w-full px-2 py-1.5 text-xs text-left rounded-md transition-colors text-[#403770] hover:bg-[#F7F5FA]"
              )}
            >
              {profile?.id === u.id ? "Me" : u.fullName ?? u.email}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPicker({ disabled, onPick }: { disabled: boolean; onPick: (status: ActivityStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-white border border-white/30 rounded-lg hover:bg-white/10 disabled:opacity-50"
      >
        Change status
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-full mb-1 z-30 w-44 bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1">
          {VALID_ACTIVITY_STATUSES.map((s) => {
            const c = ACTIVITY_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onPick(s); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md text-[#403770] hover:bg-[#F7F5FA]"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
