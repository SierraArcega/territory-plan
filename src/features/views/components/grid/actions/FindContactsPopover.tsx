"use client";
import { useState, useCallback, type RefObject } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { TARGET_ROLES, type TargetRole } from "@/features/shared/types/contact-types";
import { AnchoredPopover } from "../AnchoredPopover";
import { useBulkEnrichFlow } from "@/features/plans/lib/enrich-flow";
import ExistingContactsModal from "@/features/plans/components/ExistingContactsModal";
import { resolvePlanLeaids } from "./export-helpers";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import type { SelectionState } from "./BulkActionsMenu";

interface FindContactsPopoverProps {
  planId: string;
  selection: Exclude<SelectionState, { mode: "none" }>;
  layout: GridViewLayout;
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

export function FindContactsPopover({
  planId,
  selection,
  layout,
  anchorRef,
  open,
  onClose,
}: FindContactsPopoverProps) {
  const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");
  const [schoolLevels, setSchoolLevels] = useState<Set<number>>(new Set([1, 2, 3]));
  const [resolving, setResolving] = useState(false);

  const {
    isEnriching,
    toast,
    setToast,
    modalState,
    setModalState,
    progressPercent,
    progress,
    handleStartEnrichment,
    bulkEnrich,
    expandRollup,
  } = useBulkEnrichFlow({ planId });

  const selectionCount =
    selection.mode === "explicit" ? selection.leaids.size : selection.total;

  const getLeaids = useCallback(async (): Promise<string[]> => {
    if (selection.mode === "explicit") return Array.from(selection.leaids);
    setResolving(true);
    try {
      return await resolvePlanLeaids(planId, layout);
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleStart = useCallback(async () => {
    try {
      const leaids = await getLeaids();
      await handleStartEnrichment({ targetRole: selectedRole, schoolLevels, leaids });
      onClose();
    } catch (err) {
      console.error("Find contacts failed:", err);
      // getLeaids error: leave popover open so user can retry
      // handleStartEnrichment error: the hook's own toast handles it
    }
  }, [getLeaids, handleStartEnrichment, selectedRole, schoolLevels, onClose]);

  const isDisabled =
    bulkEnrich.isPending ||
    resolving ||
    isEnriching ||
    (selectedRole === "Principal" && schoolLevels.size === 0);

  return (
    <>
      <AnchoredPopover anchorRef={anchorRef} open={open} onDismiss={onClose}>
        <div
          style={{ width: 230 }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          {/* Header with scope badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-[#403770]">Find Contacts</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F37167]">
              {selectionCount} district{selectionCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Role dropdown */}
          <label className="block text-[10px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
            Target Role
          </label>
          <div className="relative mb-3">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
              className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
            >
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
          </div>

          {/* School level checkboxes (Principal only) */}
          {selectedRole === "Principal" && (
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                School Level
              </label>
              <div className="flex flex-col gap-1.5">
                {[
                  { value: 1, label: "Primary" },
                  { value: 2, label: "Middle" },
                  { value: 3, label: "High" },
                ].map(({ value, label }) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-[13px] text-[#403770] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={schoolLevels.has(value)}
                      onChange={(e) =>
                        setSchoolLevels((prev) => {
                          const next = new Set(prev);
                          e.target.checked ? next.add(value) : next.delete(value);
                          return next;
                        })
                      }
                      className="w-3.5 h-3.5 accent-[#403770]"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Progress bar when enriching */}
          {isEnriching && progress && progress.queued > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8AA891] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[11px] text-[#403770]/60 whitespace-nowrap">
                {progress.enriched}/{progress.queued}
              </span>
            </div>
          )}

          <button
            type="button"
            aria-label="Start enrichment"
            disabled={isDisabled}
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {(bulkEnrich.isPending || resolving) && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {bulkEnrich.isPending || resolving ? "Starting…" : "Start enrichment"}
          </button>
        </div>
      </AnchoredPopover>

      {modalState && (
        <ExistingContactsModal
          planId={planId}
          variant={modalState.variant}
          districtCount={modalState.districtCount}
          newCount={modalState.newCount}
          onClose={() => setModalState(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-3 ${
            toast.type === "success"
              ? "bg-[#8AA891] text-white"
              : toast.type === "warning"
                ? "bg-amber-500 text-white"
                : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-[#403770] text-white"
          }`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onClick}
              disabled={expandRollup.isPending}
              className="inline-flex items-center px-2.5 py-1 text-[12px] font-semibold text-white bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-md whitespace-nowrap"
            >
              {expandRollup.isPending ? "Expanding…" : toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
