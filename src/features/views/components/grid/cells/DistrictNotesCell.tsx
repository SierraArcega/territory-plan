"use client";
import { useRef, useState } from "react";
import { AnchoredPopover } from "../AnchoredPopover";
import { Portal } from "@/features/shared/lib/portal";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import { NotesPopover } from "../../notes/NotesPopover";
import { noteTypeMeta } from "../../../lib/note-types";

interface Props {
  leaid: string;
  districtName: string;
  latest: string | null;
  count: number;
  latestType: string | null;
}

export function DistrictNotesCell({ leaid, districtName, latest, count, latestType }: Props) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isMobile = useIsMobile();

  const popover = (
    <NotesPopover leaid={leaid} districtName={districtName} onClose={() => setOpen(false)} />
  );

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={`Notes${count ? ` (${count})` : ""}`}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 text-left rounded focus:outline-none focus:ring-2 focus:ring-[#6B4D9C]"
      >
        {latest ? (
          <>
            <span className="min-w-0 text-sm text-[#544A78] truncate whitespace-nowrap">{latest}</span>
            <span className={`flex-shrink-0 text-[11px] font-bold px-[7px] rounded-full ${latestType ? noteTypeMeta(latestType).pill : "bg-[#EFEBF7] text-[#6F4C8C]"}`}>{count}</span>
          </>
        ) : (
          <span className="text-sm text-[#A69DC0] whitespace-nowrap">+ Add note</span>
        )}
      </button>

      {isMobile
        ? open && <Portal>{popover}</Portal>
        : (
          <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)} align="left">
            {popover}
          </AnchoredPopover>
        )}
    </div>
  );
}
