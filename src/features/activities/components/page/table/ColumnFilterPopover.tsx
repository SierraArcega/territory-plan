"use client";

import { useEffect, useRef } from "react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import DateRangeFilter from "./filters/DateRangeFilter";
import TypeFilter from "./filters/TypeFilter";
import OwnerFilter from "./filters/OwnerFilter";
import StatusFilter from "./filters/StatusFilter";
import DistrictFilter from "./filters/DistrictFilter";
import ContactFilter from "./filters/ContactFilter";
import TextFilter from "./filters/TextFilter";

interface ColumnFilterPopoverProps {
  columnKey: string;
  onClose: () => void;
}

// Generic filter dispatcher. Anchored relative to its trigger by the parent
// header cell (which sets `relative` on its container). Click-outside +
// Escape close. Each body owns its own Apply/Clear/Done — the popover just
// wraps and positions.
export default function ColumnFilterPopover({ columnKey, onClose }: ColumnFilterPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    // Defer attaching the listener so the click that opened the popover
    // doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function body() {
    switch (columnKey) {
      case "date":
      case "createdAt":
        return <DateRangeFilter onClose={onClose} />;
      case "type":
        return <TypeFilter onClose={onClose} />;
      case "owner":
        return <OwnerFilter onClose={onClose} />;
      case "status":
        return <StatusFilter onClose={onClose} />;
      case "district":
        return <DistrictFilter onClose={onClose} />;
      case "contact":
        return <ContactFilter onClose={onClose} />;
      case "title":
      case "outcome":
        return (
          <TextFilter
            value={columnKey === "outcome" ? filters.text : filters.text}
            placeholder={
              columnKey === "outcome"
                ? "Search notes & outcome…"
                : "Search title…"
            }
            onChange={(next) => patchFilters({ text: next })}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      ref={ref}
      role="dialog"
      className="absolute left-0 top-full mt-1 z-30 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden"
    >
      {body()}
    </div>
  );
}
