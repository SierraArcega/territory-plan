"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import { useCreateTerritoryPlan } from "@/features/plans/lib/queries";
import type {
  IncreaseTarget,
  IncreaseTargetBucket,
} from "../lib/types";

interface Props {
  district: IncreaseTarget;
  anchorRef: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planName: string) => void;
}

const TARGET_FY = 2027;

const BUCKET_OPTIONS: { value: IncreaseTargetBucket; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "winback", label: "Winback" },
  { value: "expansion", label: "Expansion" },
  { value: "newBusiness", label: "New Business" },
];

function defaultBucket(category: IncreaseTarget["category"]): IncreaseTargetBucket {
  return category === "missing_renewal" ? "renewal" : "winback";
}

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

export default function LhfPlanPicker({
  district,
  anchorRef,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);
  const newNameInputRef = useRef<HTMLInputElement>(null);

  const [planId, setPlanId] = useState<string>("");
  const [bucket, setBucket] = useState<IncreaseTargetBucket>(() =>
    defaultBucket(district.category),
  );
  const [targetInput, setTargetInput] = useState<string>(() =>
    district.suggestedTarget != null
      ? formatTargetInput(String(district.suggestedTarget))
      : "",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const plansQuery = useMyPlans();
  const addMutation = useAddDistrictToPlanMutation();
  const createMutation = useCreateTerritoryPlan();

  const fy27Plans = (plansQuery.data ?? []).filter((p) => p.fiscalYear === TARGET_FY);
  const isPlansLoading = plansQuery.isLoading;
  const hasNoPlans = !isPlansLoading && fy27Plans.length === 0;
  const isPending = addMutation.isPending || createMutation.isPending;

  const parsedTarget = useMemo(() => parseTargetInput(targetInput), [targetInput]);
  const canSubmit = !!planId && parsedTarget > 0 && !isPending && !hasNoPlans;

  // Reset every time we reopen for a fresh district.
  useEffect(() => {
    if (!isOpen) return;
    setPlanId("");
    setBucket(defaultBucket(district.category));
    setTargetInput(
      district.suggestedTarget != null
        ? formatTargetInput(String(district.suggestedTarget))
        : "",
    );
    setErrorMessage(null);
    setNamingNew(false);
    setNewName("");
  }, [isOpen, district.leaid, district.category, district.suggestedTarget]);

  // Position popover near anchor, right-aligned. Flips above when there's
  // not enough room below (rows near the bottom of the viewport).
  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const width = 320;
      // Measure rendered height when available; fall back to a conservative estimate.
      const measured = containerRef.current?.offsetHeight ?? 0;
      const height = measured > 0 ? measured : 360;
      const margin = 8;
      const gap = 6;
      const left = Math.max(
        margin,
        Math.min(window.innerWidth - width - margin, rect.right - width),
      );
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      let top: number;
      if (spaceBelow >= height + gap + margin) {
        top = rect.bottom + gap;
      } else if (spaceAbove >= height + gap + margin) {
        top = rect.top - height - gap;
      } else {
        // Neither side fits; pin near the larger side and clamp to viewport.
        top =
          spaceBelow >= spaceAbove
            ? Math.min(rect.bottom + gap, window.innerHeight - height - margin)
            : Math.max(margin, rect.top - height - gap);
      }
      setCoords({ top, left });
    };
    update();
    // Re-run after layout to catch the measured height once the popover paints.
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isOpen, anchorRef, namingNew]);

  // Focus first field on open / new-plan input on toggle.
  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => {
      if (namingNew) newNameInputRef.current?.focus();
      else firstFieldRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, namingNew]);

  // Outside click + escape.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setErrorMessage(null);
    const chosenPlan = fy27Plans.find((p) => p.id === planId);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      newNameInputRef.current?.focus();
      return;
    }
    if (parsedTarget <= 0) {
      setErrorMessage("Set a target amount first.");
      return;
    }
    setErrorMessage(null);
    try {
      const created = await createMutation.mutateAsync({
        name: trimmed,
        fiscalYear: TARGET_FY,
      });
      await addMutation.mutateAsync({
        planId: created.id,
        leaid: district.leaid,
        bucket,
        targetAmount: parsedTarget,
      });
      onSuccess(created.name);
    } catch {
      setErrorMessage("Couldn't create the plan. Try again.");
    }
  };

  // Portal so the popover escapes sticky-cell stacking contexts in the table.
  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label={`Add ${district.districtName} to a plan`}
      className="fixed z-50 w-80 rounded-xl bg-white shadow-xl border border-[#D4CFE2]"
      style={{ top: coords.top, left: coords.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={namingNew ? handleCreate : handleSubmit} className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[#403770] leading-tight">
            Add to plan
          </h3>
          <p className="text-[11px] text-[#6E6390] truncate">
            {district.districtName}
            {district.state ? ` · ${district.state}` : ""}
          </p>
        </div>

        {/* Plan select OR new-plan name input */}
        {namingNew ? (
          <div className="space-y-1">
            <label
              htmlFor="add-plan-newname"
              className="block text-[11px] font-semibold text-[#544A78] uppercase tracking-wider"
            >
              New FY27 plan name
            </label>
            <input
              id="add-plan-newname"
              ref={newNameInputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`FY27 · ${district.districtName}`}
              disabled={isPending}
              className="w-full rounded-md border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#403770] focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40"
            />
          </div>
        ) : (
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
                <option value="">No FY27 plans yet</option>
              ) : (
                <>
                  <option value="">Select a plan…</option>
                  {fy27Plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        )}

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
                      selected ? "border-[#403770]" : "border-[#A69DC0]"
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
              placeholder="e.g. 50,000"
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={(e) => setTargetInput(formatTargetInput(e.target.value))}
              className={`w-full rounded-md border pl-5 pr-2 py-1.5 text-sm text-[#403770] tabular-nums focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 ${
                parsedTarget <= 0
                  ? "border-amber-400 bg-amber-50"
                  : "border-[#C2BBD4] bg-white"
              }`}
              required
            />
          </div>
          <p className="text-[11px] text-amber-700 mt-1" aria-live="polite" aria-atomic="true">
            {parsedTarget <= 0 ? "Set a target amount to add to plan" : ""}
          </p>
        </div>

        {/* Error */}
        {errorMessage && (
          <p className="text-xs text-[#F37167]" role="alert">
            {errorMessage}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {namingNew ? (
            <button
              type="button"
              onClick={() => {
                setNamingNew(false);
                setNewName("");
                setErrorMessage(null);
              }}
              disabled={isPending}
              className="text-[11px] font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-50"
            >
              ← Pick existing plan
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setNamingNew(true);
              }}
              disabled={isPending}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#403770] hover:underline disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              New plan…
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-3 py-1.5 rounded-md text-xs font-semibold text-[#6E6390] hover:text-[#403770] hover:bg-[#F7F5FA] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                namingNew
                  ? isPending || !newName.trim() || parsedTarget <= 0
                  : !canSubmit
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && (
                <span
                  className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {namingNew ? "Create & add" : "Add to Plan"}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body,
  );
}
