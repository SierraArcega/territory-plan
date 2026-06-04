"use client";

import type { PersonRef } from "@/lib/api";
import UserAvatar from "@/features/shared/components/UserAvatar";

/**
 * Display-only owner row. Editing the owner stays in NotesEditor (the "Notes &
 * Owner" card) which is already wired to PUT /api/districts/[leaid]/edits.
 */
export default function OwnerRow({ owner }: { owner: PersonRef | null }) {
  return (
    <div>
      <h4 className="text-xs font-bold text-[#403770] mb-1.5">Owner</h4>
      {owner?.id ? (
        <div className="flex items-center gap-2">
          <UserAvatar name={owner.fullName} avatarUrl={owner.avatarUrl} size={24} />
          <span className="text-sm text-[#403770] truncate whitespace-nowrap">
            {owner.fullName || "Unnamed user"}
          </span>
        </div>
      ) : (
        <span className="text-sm text-[#A69DC0] italic">No owner assigned</span>
      )}
    </div>
  );
}
