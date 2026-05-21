"use client";
import { useState } from "react";
import { NotesPopover } from "../../notes/NotesPopover";

interface Props {
  leaid: string;
  districtName: string;
  latest: string | null;
  count: number;
}

export function DistrictNotesCell({ leaid, districtName, latest, count }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notes${count ? ` (${count})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 max-w-[260px] text-left rounded focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {latest ? (
          <>
            <span className="text-sm text-[#544A78] truncate whitespace-nowrap">{latest}</span>
            <span className="flex-shrink-0 bg-[#EFEBF7] text-[#6F4C8C] text-[11px] font-bold px-[7px] rounded-full">{count}</span>
          </>
        ) : (
          <span className="text-sm text-[#A69DC0] whitespace-nowrap">+ Add note</span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50">
          <NotesPopover leaid={leaid} districtName={districtName} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
