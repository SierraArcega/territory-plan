"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import { useCreateTerritoryPlan } from "@/features/plans/lib/queries";
import type { IncreaseTarget, IncreaseTargetBucket } from "../lib/types";

interface Props {
  districts: IncreaseTarget[];
  anchorRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  /** Fires after every district has been added. addedCount may be less than
   *  districts.length if some additions failed (the picker shows an inline
   *  error and keeps the popover open in that case). */
  onSuccess: (planName: string, addedCount: number) => void;
}

const TARGET_FY = 2027;

function defaultBucket(category: IncreaseTarget["category"]): IncreaseTargetBucket {
  return category === "missing_renewal" ? "renewal" : "winback";
}

function defaultTarget(d: IncreaseTarget): number {
  return d.suggestedTarget ?? 0;
}

export default function LhfBulkPlanPicker({
  districts,
  anchorRef,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [isPending, setIsPending] = useState(false);

  const plansQuery = useMyPlans();
  const addMutation = useAddDistrictToPlanMutation();
  const createMutation = useCreateTerritoryPlan();

  const fy27Plans = (plansQuery.data ?? []).filter((p) => p.fiscalYear === TARGET_FY);

  // Position popover above the anchor (toolbar lives at the bottom of the page).
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const width = 240;
      const estHeight = namingNew ? 130 : 240;
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
      const top = Math.max(8, rect.top - estHeight - 6);
      setCoords({ top, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, anchorRef, namingNew]);

  useEffect(() => {
    if (isOpen) return;
    setNamingNew(false);
    setNewName("");
    setErrorMessage(null);
  }, [isOpen]);

  useEffect(() => {
    if (!namingNew) return;
    const id = requestAnimationFrame(() => newNameInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [namingNew]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef.current?.focus();
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !coords) return null;

  // Sequentially add each district with derived defaults. Sequential (not
  // Promise.all) keeps the DB writes ordered and avoids hammering the API
  // when reps select 20+ rows at once.
  const addAll = async (planId: string) => {
    let added = 0;
    for (const d of districts) {
      try {
        await addMutation.mutateAsync({
          planId,
          leaid: d.leaid,
          bucket: defaultBucket(d.category),
          targetAmount: defaultTarget(d),
        });
        added += 1;
      } catch {
        // Continue on per-row failure; surfaced via the count delta.
      }
    }
    return added;
  };

  const handlePick = async (planId: string, planName: string) => {
    if (isPending) return;
    setErrorMessage(null);
    setIsPending(true);
    try {
      const added = await addAll(planId);
      if (added === 0) {
        setErrorMessage("Couldn't add any districts. Try again.");
      } else {
        onSuccess(planName, added);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      newNameInputRef.current?.focus();
      return;
    }
    setErrorMessage(null);
    setIsPending(true);
    try {
      const created = await createMutation.mutateAsync({
        name: trimmed,
        fiscalYear: TARGET_FY,
      });
      const added = await addAll(created.id);
      if (added === 0) {
        setErrorMessage("Plan created, but no districts were added. Try again.");
      } else {
        onSuccess(created.name, added);
      }
    } catch {
      setErrorMessage("Couldn't create the plan. Try again.");
    } finally {
      setIsPending(false);
    }
  };

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Add ${districts.length} districts to a plan`}
      className="fixed z-50 w-60 rounded-xl bg-white shadow-lg border border-[#D4CFE2] overflow-hidden"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      {namingNew ? (
        <form onSubmit={handleCreate} className="p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8A80A8]">
            Name your new FY27 plan
          </div>
          <input
            ref={newNameInputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="FY27 · "
            className="w-full rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-xs text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40"
            disabled={isPending}
          />
          {errorMessage && (
            <p className="text-[11px] text-[#F37167]" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setNamingNew(false);
                setNewName("");
                setErrorMessage(null);
              }}
              disabled={isPending}
              className="px-2 py-1 text-xs font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !newName.trim()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50"
            >
              {isPending && (
                <span
                  className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden
                />
              )}
              Create &amp; add {districts.length}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8A80A8] border-b border-[#E2DEEC]">
            Add {districts.length} {districts.length === 1 ? "district" : "districts"} to plan
          </div>
          <div className="max-h-64 overflow-y-auto">
            {plansQuery.isLoading ? (
              <div className="px-3 py-2 text-xs text-[#A69DC0]">Loading plans…</div>
            ) : fy27Plans.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[#A69DC0]">No FY27 plans yet.</div>
            ) : (
              fy27Plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handlePick(p.id, p.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-[#403770] hover:bg-[#F7F5FA] disabled:opacity-50 text-left"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[11px] text-[#A69DC0] tabular-nums shrink-0 ml-2">
                    {p.districtCount}
                  </span>
                </button>
              ))
            )}
          </div>
          {isPending && (
            <div className="px-3 py-1.5 text-[11px] text-[#6E6390] flex items-center gap-1.5">
              <span
                className="w-3 h-3 border-2 border-[#403770] border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
              Adding {districts.length} districts…
            </div>
          )}
          {errorMessage && (
            <p className="px-3 py-1.5 text-[11px] text-[#F37167]" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setNamingNew(true);
            }}
            disabled={isPending}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#403770] border-t border-[#E2DEEC] hover:bg-[#F7F5FA] disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            New plan…
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
