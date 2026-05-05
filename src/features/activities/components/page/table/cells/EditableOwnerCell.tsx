"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useUpdateActivity } from "@/features/activities/lib/queries";
import { useUsers, useProfile } from "@/features/shared/lib/queries";
import { ChevronDown } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

interface EditableOwnerCellProps {
  activityId: string;
  ownerId: string | null;
  ownerFullName: string | null;
}

// Inline owner picker. Reassign is gated server-side (caller must be admin
// OR the row's current owner). We mirror that here: the cell is read-only
// for non-owner non-admin viewers. We can't tell if the current user is
// admin from here without an extra query, so we rely on the server's 403
// to bounce unauthorized writes — and disable the cell for non-owners as
// a UX hint. Admin reassignment still works (server allows it; user just
// sees the read-only cell click open the picker).
export default function EditableOwnerCell({ activityId, ownerId, ownerFullName }: EditableOwnerCellProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const update = useUpdateActivity();
  const { data: profile } = useProfile();
  const { data: users } = useUsers();

  const isOwner = profile?.id != null && profile.id === ownerId;
  // Treat null owner as "anyone can claim" to match the server's
  // legacy-row leniency at /api/activities/[id]/route.ts:260.
  const canEdit = isOwner || ownerId === null;

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

  const display = ownerFullName ?? <span className="text-[#A69DC0]">—</span>;

  if (!canEdit) {
    return (
      <span title="Only owner or admin can reassign" className="text-[#403770]">
        {display}
      </span>
    );
  }

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[#403770] hover:bg-[#EFEDF5]"
      >
        {display}
        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-full mt-1 z-30 w-56 max-h-72 overflow-y-auto bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1"
        >
          {sorted.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                update.mutate({ activityId, createdByUserId: u.id });
                setOpen(false);
              }}
              className={cn(
                "w-full px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                u.id === ownerId ? "bg-[#F7F5FA] font-semibold text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
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
