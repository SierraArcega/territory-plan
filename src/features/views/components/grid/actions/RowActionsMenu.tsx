"use client";
import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Target, Briefcase, X } from "lucide-react";
import { AnchoredPopover } from "../AnchoredPopover";

interface Props {
  planId: string;
  leaid: string;
  districtName: string;
}

type Surface = null | "targets" | "remove" | "activity";

export function RowActionsMenu({ planId, leaid, districtName }: Props) {
  const [open, setOpen] = useState(false);
  const [, setSurface] = useState<Surface>(null); // surfaces wired in later tasks
  const btnRef = useRef<HTMLButtonElement>(null);

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#403770] hover:bg-[#F7F5FA]";

  function choose(next: Surface) {
    setOpen(false);
    setSurface(next);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${districtName}`}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-[#544A78] hover:bg-[#F7F5FA]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)}>
        {/* AnchoredPopover left-aligns under the anchor; shift a 220px panel left so it
            right-aligns under the ~32px right-edge kebab and stays on-screen. */}
        <div
          role="menu"
          style={{ width: 220, transform: "translateX(-188px)" }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-1.5 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          <button type="button" role="menuitem" className={item} onClick={() => choose("activity")}>
            <Pencil className="h-3.5 w-3.5 opacity-70" /> Log activity
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose("targets")}>
            <Target className="h-3.5 w-3.5 opacity-70" /> Set targets
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => setOpen(false)}>
            <Briefcase className="h-3.5 w-3.5 opacity-70" /> Create opportunity
            <span className="ml-auto text-[10px] text-[#A69DC0]">↗ LMS</span>
          </button>
          <div className="my-1 h-px bg-[#EFEDF5]" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#C2410C] hover:bg-[#FFF1EA]"
            onClick={() => choose("remove")}
          >
            <X className="h-3.5 w-3.5 opacity-80" /> Remove from plan
          </button>
        </div>
      </AnchoredPopover>
    </>
  );
}
