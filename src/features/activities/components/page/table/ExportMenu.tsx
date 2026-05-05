"use client";

import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown } from "lucide-react";
import { rowsToCsv, downloadCsv } from "@/features/reports/lib/csv";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import { ACTIVITY_TYPE_LABELS, ACTIVITY_STATUS_CONFIG, type ActivityStatus, type ActivityType } from "@/features/activities/types";
import { cn } from "@/features/shared/lib/cn";

interface ExportMenuProps {
  selectedRows: ActivityListItem[];
  filteredRows: ActivityListItem[];
}

const EXPORT_COLUMNS = [
  "Date",
  "Type",
  "Title",
  "District",
  "Contact",
  "Owner",
  "Status",
  "Outcome notes",
];

function rowToExportObject(row: ActivityListItem): Record<string, unknown> {
  return {
    Date: row.startDate ?? "",
    Type: ACTIVITY_TYPE_LABELS[row.type as ActivityType] ?? row.type,
    Title: row.title,
    District: row.districtName ?? "",
    Contact: row.contactName ?? "",
    Owner: row.ownerFullName ?? "",
    Status: ACTIVITY_STATUS_CONFIG[row.status as ActivityStatus]?.label ?? row.status,
    "Outcome notes": row.outcomePreview ?? "",
  };
}

export default function ExportMenu({ selectedRows, filteredRows }: ExportMenuProps) {
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

  function exportRows(rows: ActivityListItem[]) {
    if (rows.length === 0) return;
    const data = rows.map(rowToExportObject);
    const csv = rowsToCsv(EXPORT_COLUMNS, data);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`activities-${date}.csv`, csv);
    setOpen(false);
  }

  const selectedCount = selectedRows.length;
  const filteredCount = filteredRows.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <Download className="w-3.5 h-3.5" />
        Export
        <ChevronDown className="w-3 h-3 text-[#8A80A8]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-56 bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1">
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => exportRows(selectedRows)}
            className={cn(
              "w-full text-left px-2.5 py-1.5 text-xs rounded-md",
              selectedCount === 0
                ? "text-[#A69DC0] cursor-not-allowed"
                : "text-[#403770] hover:bg-[#F7F5FA]"
            )}
          >
            Export selected
            <span className="ml-1 text-[#8A80A8]">({selectedCount})</span>
          </button>
          <button
            type="button"
            disabled={filteredCount === 0}
            onClick={() => exportRows(filteredRows)}
            className={cn(
              "w-full text-left px-2.5 py-1.5 text-xs rounded-md",
              filteredCount === 0
                ? "text-[#A69DC0] cursor-not-allowed"
                : "text-[#403770] hover:bg-[#F7F5FA]"
            )}
          >
            Export all filtered
            <span className="ml-1 text-[#8A80A8]">({filteredCount})</span>
          </button>
        </div>
      )}
    </div>
  );
}
