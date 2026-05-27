"use client";
import { useRef, useState, useCallback } from "react";
import { ChevronDown, Search, Download, Trash2, Loader2 } from "lucide-react";
import { AnchoredPopover } from "../AnchoredPopover";
import { useBulkRemoveDistrictsFromPlan } from "@/features/plans/lib/queries";
import { FindContactsPopover } from "./FindContactsPopover";
import { fetchExportRows, resolvePlanLeaids, type ExportRow } from "./export-helpers";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

export type SelectionState =
  | { mode: "none" }
  | { mode: "explicit"; leaids: Set<string> }
  | { mode: "all-filtered"; total: number };

interface BulkActionsMenuProps {
  planId: string;
  selection: Exclude<SelectionState, { mode: "none" }>;
  layout: GridViewLayout;
  onSelectionCleared: () => void;
}

type Surface = null | "remove" | "find-contacts";

export function BulkActionsMenu({
  planId,
  selection,
  layout,
  onSelectionCleared,
}: BulkActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<Surface>(null);
  const [resolving, setResolving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const removeMutation = useBulkRemoveDistrictsFromPlan();

  const selectionCount =
    selection.mode === "explicit" ? selection.leaids.size : selection.total;

  const getLeaids = useCallback(async (): Promise<string[]> => {
    if (selection.mode === "explicit") {
      return Array.from(selection.leaids);
    }
    setResolving(true);
    try {
      return await resolvePlanLeaids(planId, layout);
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleExportCsv = useCallback(async () => {
    setOpen(false);
    setResolving(true);
    try {
      let rows: ExportRow[];
      const allRows = await fetchExportRows(planId, layout);
      if (selection.mode === "explicit") {
        const selectedLeaids = selection.leaids;
        rows = allRows.filter((r) => selectedLeaids.has(r.leaid));
      } else {
        rows = allRows;
      }

      const headers = [
        "District Name", "State", "LEAID", "Enrollment",
        "Renewal Target", "Winback Target", "Expansion Target", "New Business Target",
      ];
      const csvRows = rows.map((r) => [
        String(r.name ?? ""),
        String(r.state_abbrev ?? ""),
        String(r.leaid ?? ""),
        String(r.enrollment ?? ""),
        String(r.renewal_target ?? ""),
        String(r.winback_target ?? ""),
        String(r.expansion_target ?? ""),
        String(r.new_business_target ?? ""),
      ]);
      const csv = [headers, ...csvRows]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `districts-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      // TODO: surface to user via toast if one is available
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleConfirmRemove = useCallback(async () => {
    try {
      const leaids = await getLeaids();
      await removeMutation.mutateAsync({ planId, leaids });
      setSurface(null);
      onSelectionCleared();
    } catch (err) {
      console.error("Bulk remove failed:", err);
      // Keep dialog open; mutation isPending state resets automatically
    }
  }, [getLeaids, removeMutation, planId, onSelectionCleared]);

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#403770] hover:bg-[#F7F5FA] whitespace-nowrap";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Bulk Actions"
        disabled={resolving}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
      >
        {resolving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <span>Bulk Actions</span>
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {/* Actions dropdown */}
      <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)}>
        <div
          role="menu"
          aria-label="Bulk actions"
          style={{ width: 200 }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-1.5 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => { setOpen(false); setSurface("find-contacts"); }}
          >
            <Search className="h-3.5 w-3.5 opacity-70 shrink-0" />
            Find Contacts
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={handleExportCsv}
          >
            <Download className="h-3.5 w-3.5 opacity-70 shrink-0" />
            Export to CSV
          </button>
          <div className="my-1 h-px bg-[#EFEDF5]" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#c25a52] hover:bg-[#fef1f0] whitespace-nowrap"
            onClick={() => { setOpen(false); setSurface("remove"); }}
          >
            <Trash2 className="h-3.5 w-3.5 opacity-80 shrink-0" />
            Remove from plan
          </button>
        </div>
      </AnchoredPopover>

      {/* Remove confirm */}
      {surface === "remove" && (
        <AnchoredPopover anchorRef={btnRef} open onDismiss={() => setSurface(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm bulk removal"
            style={{ width: 256 }}
            className="rounded-xl border border-[#E2DEEC] bg-white p-4 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
          >
            <p className="m-0 mb-3 text-[13px] leading-snug text-[#403770]">
              <b>Remove {selectionCount} district{selectionCount !== 1 ? "s" : ""}</b>{" "}
              from this plan? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[#E2DEEC] px-3 py-1.5 text-[12px] text-[#544A78]"
                onClick={() => setSurface(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm remove"
                disabled={removeMutation.isPending || resolving}
                className="rounded-md bg-[#c25a52] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                onClick={handleConfirmRemove}
              >
                {removeMutation.isPending || resolving
                  ? "Removing…"
                  : `Remove ${selectionCount}`}
              </button>
            </div>
          </div>
        </AnchoredPopover>
      )}

      {/* Find Contacts popover */}
      {surface === "find-contacts" && (
        <FindContactsPopover
          planId={planId}
          selection={selection}
          layout={layout}
          anchorRef={btnRef}
          open
          onClose={() => setSurface(null)}
        />
      )}
    </>
  );
}
