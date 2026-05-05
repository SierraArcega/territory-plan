"use client";

import { useMemo } from "react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import { useUsers, useProfile } from "@/features/shared/lib/queries";
import { Square, SquareCheck } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";

export default function OwnerFilter({ onClose }: { onClose: () => void }) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const { data: users } = useUsers();
  const { data: profile } = useProfile();

  const sorted = useMemo(() => {
    const list = users ?? [];
    return [...list].sort((a, b) => {
      if (profile?.id === a.id) return -1;
      if (profile?.id === b.id) return 1;
      return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
    });
  }, [users, profile?.id]);

  function toggle(id: string) {
    const next = filters.owners.includes(id)
      ? filters.owners.filter((v) => v !== id)
      : [...filters.owners, id];
    patchFilters({ owners: next });
  }

  return (
    <div className="p-1 w-64 max-h-96 overflow-y-auto">
      {sorted.map((u) => {
        const active = filters.owners.includes(u.id);
        const Box = active ? SquareCheck : Square;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => toggle(u.id)}
            aria-pressed={active}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
              active ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
            )}
          >
            <Box className={cn("w-3.5 h-3.5", active ? "text-[#403770]" : "text-[#A69DC0]")} />
            {profile?.id === u.id ? "Me" : u.fullName ?? u.email}
          </button>
        );
      })}
      <div className="flex items-center justify-between border-t border-[#EFEDF5] mt-1 pt-1.5 px-1">
        <button
          type="button"
          onClick={() => patchFilters({ owners: [] })}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#F37167]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#544A78] hover:text-[#403770]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
