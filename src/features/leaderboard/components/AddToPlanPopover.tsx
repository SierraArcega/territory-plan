"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import type { IncreaseTarget, IncreaseTargetBucket } from "../lib/types";

interface AddToPlanPopoverProps {
  district: IncreaseTarget;
  anchorRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planName: string) => void;
}

const BUCKET_OPTIONS: { value: IncreaseTargetBucket; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "winback", label: "Winback" },
  { value: "expansion", label: "Expansion" },
  { value: "newBusiness", label: "New Business" },
];

// Parse a currency input like "$12,345", "12345.67", "1,200" into a number.
function parseTargetInput(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatTargetInput(raw: string): string {
  const n = parseTargetInput(raw);
  if (n <= 0) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default function AddToPlanPopover({
  district,
  anchorRef,
  isOpen,
  onClose,
  onSuccess,
}: AddToPlanPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const [planId, setPlanId] = useState<string>("");
  const [bucket, setBucket] = useState<IncreaseTargetBucket>("renewal");
  const [targetInput, setTargetInput] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const plansQuery = useMyPlans();
  const addMutation = useAddDistrictToPlanMutation();

  const plans = plansQuery.data ?? [];
  const isPlansLoading = plansQuery.isLoading;
  const isPlansReady = !isPlansLoading;
  const hasNoPlans = isPlansReady && plans.length === 0;

  const parsedTarget = useMemo(() => parseTargetInput(targetInput), [targetInput]);
  const canSubmit =
    !!planId && parsedTarget > 0 && !addMutation.isPending && !hasNoPlans;

  // Position the popover below the anchor button, right-aligned.
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = 320;
    const right = rect.right;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, right - width));
    const top = rect.bottom + 6;
    setCoords({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [updatePosition]);

  // Focus first field on open.
  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => {
      firstFieldRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen]);

  // Escape + outside-click to close. Also a simple focus trap (Tab cycles
  // within the popover's focusable elements).
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        anchorRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;
      const container = containerRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("aria-hidden"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    document.addEventListener("keydown", handleKey, true);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !coords) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMessage(null);
    const chosenPlan = plans.find((p) => p.id === planId);
    const planName = chosenPlan?.name ?? "plan";
    try {
      await addMutation.mutateAsync({
        planId,
        leaid: district.leaid,
        bucket,
        targetAmount: parsedTarget,
      });
      onSuccess(planName);
    } catch {
      setErrorMessage("Couldn't add to plan. Try again.");
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Add ${district.districtName} to a plan`}
      className="fixed z-[60] w-80 rounded-xl bg-white shadow-xl border border-[#D4CFE2]"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#403770] leading-tight">
            Add to plan
          </h3>
          <p className="text-[11px] text-[#6E6390] truncate">
            {district.districtName}
            {district.state ? ` · ${district.state}` : ""}
          </p>
        </div>

        {/* Plan select */}
        <div className="space-y-1">
          <label
            htmlFor="add-plan-select"
            className="block text-[11px] font-semibold text-[#544A78] uppercase tracking-wider"
          >
            Plan
          </label>
          <select
            id="add-plan-select"
            ref={firstFieldRef}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            disabled={hasNoPlans || isPlansLoading}
            className="w-full rounded-md border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#403770] focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPlansLoading ? (
              <option value="">Loading plans…</option>
            ) : hasNoPlans ? (
              <option value="">No plans yet</option>
            ) : (
              <>
                <option value="">Select a plan…</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </>
            )}
          </select>
          {hasNoPlans && (
            <p className="text-[11px] text-[#6E6390]">
              You have no plans — create one first.
            </p>
          )}
        </div>

        {/* Bucket radio group */}
        <fieldset className="space-y-1">
          <legend className="block text-[11px] font-semibold text-[#544A78] uppercase tracking-wider">
            Type
          </legend>
          <div className="grid grid-cols-2 gap-1">
            {BUCKET_OPTIONS.map((opt) => {
              const selected = bucket === opt.value;
              return (
                <label
                  key={opt.value}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                    selected
                      ? "border-[#403770] bg-[#EFEDF5] text-[#403770] font-semibold"
                      : "border-[#D4CFE2] text-[#6E6390] hover:border-[#C2BBD4]"
                  }`}
                >
                  <input
                    type="radio"
                    name="bucket"
                    value={opt.value}
                    checked={selected}
                    onChange={() => setBucket(opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                      selected
                        ? "border-[#403770]"
                        : "border-[#A69DC0]"
                    }`}
                  >
                    {selected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#403770]" />
                    )}
                  </span>
                  {opt.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Target input */}
        <div className="space-y-1">
          <label
            htmlFor="add-plan-target"
            className="block text-[11px] font-semibold text-[#544A78] uppercase tracking-wider"
          >
            Target
          </label>
          <div className="relative">
            <span
              className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#6E6390] pointer-events-none"
              aria-hidden="true"
            >
              $
            </span>
            <input
              id="add-plan-target"
              type="text"
              inputMode="decimal"
              value={targetInput}
              placeholder="0"
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => setTargetInput(formatTargetInput(e.target.value))}
              className="w-full rounded-md border border-[#C2BBD4] bg-white pl-5 pr-2 py-1.5 text-sm text-[#403770] focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40"
              required
            />
          </div>
        </div>

        {/* Error */}
        {errorMessage && (
          <p className="text-xs text-[#F37167]" role="alert">
            {errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={addMutation.isPending}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#6E6390] hover:text-[#403770] hover:bg-[#F7F5FA] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addMutation.isPending && (
              <span
                className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
            )}
            Add to Plan
          </button>
        </div>
      </form>
    </div>
  );
}
