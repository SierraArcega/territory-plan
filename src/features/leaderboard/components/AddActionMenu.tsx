"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, ChevronDown, ExternalLink } from "lucide-react";
import type { IncreaseTarget } from "../lib/types";
import AddToPlanPopover from "./AddToPlanPopover";

interface Props {
  district: IncreaseTarget;
  onAddSuccess: (planName: string) => void;
  /** Renders the trigger at full drawer-footer width instead of the compact card size. */
  fullWidth?: boolean;
}

export default function AddActionMenu({ district, onAddSuccess, fullWidth }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const lmsHref = district.lmsId
    ? `https://lms.fullmindlearning.com/districts/${district.lmsId}`
    : null;

  const triggerClasses = fullWidth
    ? "w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
    : "shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors";

  const iconSize = fullWidth ? "w-4 h-4" : "w-3.5 h-3.5";
  const chevSize = fullWidth ? "w-3.5 h-3.5 opacity-80" : "w-3 h-3 opacity-80";

  return (
    <div className={fullWidth ? "w-full relative" : "relative"}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((v) => !v);
        }}
        className={triggerClasses}
      >
        <Plus className={iconSize} />
        Add
        <ChevronDown className={chevSize} />
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 mt-1 right-0 min-w-[180px] bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPopoverOpen(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#403770] hover:bg-[#F7F5FA] text-left"
          >
            <Plus className="w-3.5 h-3.5" />
            Add to plan
          </button>
          {lmsHref && (
            <a
              href={lmsHref}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#403770] hover:bg-[#F7F5FA]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in LMS
            </a>
          )}
        </div>
      )}

      {popoverOpen && (
        <AddToPlanPopover
          district={district}
          anchorRef={buttonRef}
          isOpen={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          onSuccess={(planName) => {
            setPopoverOpen(false);
            onAddSuccess(planName);
          }}
        />
      )}
    </div>
  );
}
